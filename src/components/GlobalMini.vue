<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Play, Pause, SkipBack, SkipForward, ChevronDown, Music } from 'lucide-vue-next'
import { spotify, progressMs, control, lockLeft, fmtClock, notify, useSpotify } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'
import { shell } from '../composables/useShell'
import LockControl from './LockControl.vue'
import MusicDrawer from './MusicDrawer.vue'

// A small player in the top-right corner of the whole site, so the music can be changed from anywhere – e.g.
// while practising Japanese: play / pause / skip right there, and the arrow opens the library (albums and
// playlists) in a floating panel. Left out on the music page itself (it has the full player) and in the player app.
// On phones it sits just above the menu instead.
const props = defineProps({ show: { type: Boolean, default: true } })
useSpotify()
const open = ref(false)
const now = computed(() => spotify.now)
const visible = computed(() => props.show && shell.value !== 'player' && spotify.connected && (!!now.value?.name || admin.loggedIn))
const pct = computed(() => (now.value?.duration_ms ? (progressMs.value / now.value.duration_ms) * 100 : 0))
const locked = computed(() => lockLeft.value > 0)
const toggle = () => { if (!now.value) return; const was = now.value.playing; now.value.playing = !was; control(was ? 'pause' : 'resume') }
const skip = (op) => (locked.value ? notify(`Låst – hør ferdig (${fmtClock(lockLeft.value)} igjen)`, true) : control(op))
watch(visible, (v) => { if (!v) open.value = false; document.documentElement.classList.toggle('has-mini', v) }, { immediate: true })
onBeforeUnmount(() => document.documentElement.classList.remove('has-mini'))
const onKey = (e) => { if (e.key === 'Escape') open.value = false }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="gm glass" :class="{ playing: now?.playing, open }">
      <button class="cover" :aria-label="open ? 'Lukk musikken' : 'Åpne musikken'" @click="open = !open">
        <img v-if="now?.image" crossorigin="anonymous" :src="now.image" alt="" />
        <Music v-else :size="16" />
      </button>
      <button class="txt" :translate="now?.name ? 'no' : null" :title="now?.name ? `${now.name} – ${now.artist}` : 'Velg musikk'" @click="open = !open">
        <b>{{ now?.name || 'Ingenting spilles' }}</b>
        <span>{{ now?.name ? now.artist : 'Trykk for å velge' }}</span>
      </button>
      <span v-if="admin.loggedIn" class="lk"><LockControl tiny /></span>
      <span v-if="admin.loggedIn && now?.name" class="ctl">
        <button :class="{ dim: locked }" aria-label="Forrige" @click="skip('previous')"><SkipBack :size="14" fill="currentColor" /></button>
        <button class="pp" :aria-label="now.playing ? 'Pause' : 'Spill'" @click="toggle"><Pause v-if="now.playing" :size="14" fill="currentColor" /><Play v-else :size="14" fill="currentColor" /></button>
        <button :class="{ dim: locked }" aria-label="Neste" @click="skip('next')"><SkipForward :size="14" fill="currentColor" /></button>
      </span>
      <button class="chev" :class="{ on: open }" :aria-label="open ? 'Lukk musikken' : 'Bytt musikk'" :title="open ? 'Lukk' : 'Bytt musikk'" @click="open = !open"><ChevronDown :size="16" /></button>
      <i class="prog" :style="{ width: `${pct}%` }"></i>
    </div>
  </transition>
  <MusicDrawer v-if="visible && open" class="gm-drawer" @close="open = false" />
</template>

<style scoped>
.gm {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 24;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 340px;
  max-width: calc(100vw - 32px);
  padding: 6px 8px 8px 6px;
  border-radius: 18px;
  overflow: hidden;
}
.cover { flex: none; display: grid; place-items: center; width: 38px; height: 38px; padding: 0; border: 0; border-radius: 9px; overflow: hidden; background: var(--glass-strong); color: var(--text-3); cursor: pointer; }
.cover img { width: 100%; height: 100%; object-fit: cover; }
.txt { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; line-height: 1.2; cursor: pointer; }
.txt b { font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.txt span { font-size: 0.7rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lk { flex: none; display: grid; }
.ctl { flex: none; display: inline-flex; align-items: center; gap: 2px; }
.ctl button { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--text-2); cursor: pointer; }
.ctl button:hover { color: var(--text); background: var(--accent-soft); }
.ctl .dim { opacity: 0.45; }
.ctl .pp { width: 30px; height: 30px; background: #1db954; color: #fff; }
.ctl .pp:hover { background: #1db954; filter: brightness(1.08); }
.chev { flex: none; display: grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--text-3); cursor: pointer; transition: transform 0.25s, color 0.15s; }
.chev:hover { color: var(--accent); }
.chev.on { transform: rotate(180deg); color: var(--accent); }
.prog { position: absolute; left: 0; bottom: 0; height: 2px; background: #1db954; transition: width 1s linear; }
/* the library opens right under the little player */
.gm-drawer { top: 78px !important; bottom: auto !important; right: 16px !important; max-height: calc(100dvh - 100px); }

/* phones: just above the menu, full width like everything else */
@media (max-width: 720px) {
  .gm { top: auto; left: 16px; right: 16px; width: auto; max-width: none; bottom: calc(76px + env(safe-area-inset-bottom)); transition: bottom 0.35s var(--ease, ease); }
  .gm-drawer { top: calc(66px + env(safe-area-inset-top)) !important; left: 16px !important; right: 16px !important; width: auto !important; max-height: none; bottom: calc(136px + env(safe-area-inset-bottom)) !important; }
}
</style>
<style>
@media (max-width: 720px) { html.nav-hidden .gm { bottom: calc(14px + env(safe-area-inset-bottom)) !important; } }
</style>
