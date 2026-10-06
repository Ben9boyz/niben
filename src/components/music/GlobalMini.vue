<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Play, Pause, SkipBack, SkipForward, ChevronDown, Music } from 'lucide-vue-next'
import { spotify, progressMs, control, lockLeft, fmtClock, notify, useSpotify } from '@/composables/music/useSpotify'
import { admin } from '@/composables/site/useAdmin'
import { shell } from '@/composables/ui/useShell'
import LockControl from './LockControl.vue'
import MusicDrawer from './MusicDrawer.vue'

// A small player in the top-right corner of the whole site, so the music can be changed from anywhere – e.g.
// while practising Japanese: play / pause / skip right there, and the arrow opens the library (albums and
// playlists) in a floating panel. Left out on the music page itself (it has the full player) and in the player app.
// On phones it sits just above the menu instead.
const props = withDefaults(defineProps<{ show?: boolean }>(), { show: true })
const emit = defineEmits<{ panel: [] }>()
const route = useRoute()
useSpotify()
const open = ref(false)
const now = computed(() => spotify.now)
const visible = computed(() => props.show && shell.value !== 'player' && spotify.connected && (!!now.value?.name || admin.mine))
const pct = computed(() => (now.value?.duration_ms ? (progressMs.value / now.value?.duration_ms) * 100 : 0))
const locked = computed(() => lockLeft.value > 0)
// a tap anywhere on it opens the music: in the listening corner that is the side panel, elsewhere the library floats open
function openIt() { if (route.name === 'lytte') emit('panel'); else open.value = !open.value }
const toggle = () => { const n = spotify.now; if (!n) return; const was = n.playing; n.playing = !was; void control(was ? 'pause' : 'resume') }
const skip = (op: 'next' | 'previous') => (locked.value ? notify(`Låst – hør ferdig (${fmtClock(lockLeft.value)} igjen)`, true) : control(op))
watch(visible, (v) => { if (!v) open.value = false; document.documentElement.classList.toggle('has-mini', v) }, { immediate: true })
onBeforeUnmount(() => document.documentElement.classList.remove('has-mini'))
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') open.value = false }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <transition name="gm">
    <div v-if="visible" class="gm glass" :class="{ playing: now?.playing, open }" role="button" tabindex="0" :aria-label="now?.name ? `${now.name} – ${now.artist}. Åpne musikken` : 'Åpne musikken'" @click="openIt" @keydown.enter.prevent="openIt">
      <!-- a new song: the cover and the title fade out and the next ones fade in -->
      <transition name="swap" mode="out-in">
        <button :key="'c' + (now?.uri || 'none')" class="cover" :aria-label="open ? 'Lukk musikken' : 'Åpne musikken'" @click.stop="openIt">
          <img v-if="now?.image" crossorigin="anonymous" :src="now.image" alt="" />
          <Music v-else :size="16" />
        </button>
      </transition>
      <transition name="swap" mode="out-in">
        <button :key="'t' + (now?.uri || 'none')" class="txt" :translate="now?.name ? 'no' : undefined" :title="now?.name ? `${now.name} – ${now.artist}` : 'Velg musikk'" @click.stop="openIt">
          <b>{{ now?.name || 'Ingenting spilles' }}<template v-if="now?.name"> – {{ now.artist }}</template></b>
          <span v-if="now?.name" class="tm">{{ fmtClock(progressMs / 1000) }} / {{ fmtClock((now.duration_ms || 0) / 1000) }}<i class="bar"><u :style="{ width: `${pct}%` }"></u></i></span>
          <span v-else>Trykk for å velge</span>
        </button>
      </transition>
      <span v-if="admin.mine" class="lk" @click.stop><LockControl tiny /></span>
      <span v-if="admin.mine && now?.name" class="ctl">
        <button class="sk" :class="{ dim: locked }" aria-label="Forrige" @click.stop="skip('previous')"><SkipBack :size="14" fill="currentColor" /></button>
        <button class="pp" :aria-label="now.playing ? 'Pause' : 'Spill'" @click.stop="toggle"><Pause v-if="now.playing" :size="14" fill="currentColor" /><Play v-else :size="14" fill="currentColor" /></button>
        <button class="sk" :class="{ dim: locked }" aria-label="Neste" @click.stop="skip('next')"><SkipForward :size="14" fill="currentColor" /></button>
      </span>
      <button class="chev" :class="{ on: open }" :aria-label="open ? 'Lukk musikken' : 'Bytt musikk'" :title="open ? 'Lukk' : 'Bytt musikk'" @click.stop="open = !open"><ChevronDown :size="16" /></button>
      <i class="prog" :style="{ width: `${pct}%` }"></i>
    </div>
  </transition>
  <transition name="gm-drawer"><MusicDrawer v-if="visible && open" class="gm-drawer" @close="open = false" /></transition>
</template>

<style scoped>
/* the little player glides in from the top-right corner and out again */
.gm-enter-active { transition: opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1), transform 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
.gm-leave-active { transition: opacity 0.28s ease, transform 0.3s ease; }
.gm-enter-from, .gm-leave-to { opacity: 0; transform: translate(14px, -10px) scale(0.94); }
/* new song: soft cross-fade */
.swap-enter-active, .swap-leave-active { transition: opacity 0.22s ease, transform 0.22s ease; }
.swap-enter-from { opacity: 0; transform: translateY(4px); }
.swap-leave-to { opacity: 0; transform: translateY(-4px); }
.gm-drawer-enter-active, .gm-drawer-leave-active { transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
.gm-drawer-enter-from, .gm-drawer-leave-to { opacity: 0; transform: translateY(-8px) scale(0.98); }
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
/* PC: almost only text, floating in the corner – no box, no cover (the cover is on the iPod and on the record on the table), no accent
   colour: just the text colour of the theme. Everything else is in the side panel; a tap anywhere on it opens that. */
@media (min-width: 721px) {
  .gm.gm { width: auto; max-width: min(420px, calc(100vw - 32px)); padding: 2px 4px; gap: 6px; border: 0; border-radius: 8px; background: none; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; overflow: visible; cursor: pointer; color: var(--text); text-shadow: 0 0 10px color-mix(in srgb, var(--bg) 75%, transparent), 0 0 3px color-mix(in srgb, var(--bg) 60%, transparent); }
  .gm .cover, .gm .lk, .gm .sk, .gm .chev, .gm > .prog { display: none; }
  .gm .txt { flex: none; align-items: flex-end; text-align: right; max-width: 100%; }
  .gm .txt b { font-size: 0.82rem; font-weight: 600; color: var(--text); max-width: 100%; }
  .gm .txt span { font-size: 0.7rem; color: var(--text-2); }
  .gm .tm { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
  .gm .bar { display: block; width: 120px; height: 2px; border-radius: 2px; background: color-mix(in srgb, var(--text) 22%, transparent); overflow: hidden; }
  .gm .bar u { display: block; height: 100%; background: var(--text); opacity: 0.8; transition: width 1s linear; text-decoration: none; }
  .gm .ctl button { background: transparent; color: var(--text-2); width: 22px; height: 22px; opacity: 0; transition: opacity 0.2s; }
  .gm:hover .ctl button, .gm:focus-within .ctl button { opacity: 1; }
  .gm .ctl .pp { background: transparent; color: var(--text); width: 22px; height: 22px; }
  .gm .ctl .pp:hover { background: transparent; filter: none; color: var(--text); }
  .gm.open .txt b { opacity: 0.7; }
}
/* the library opens right under the little player */
.gm-drawer { top: 78px !important; bottom: auto !important; right: 16px !important; max-height: calc(100dvh - 100px); }

/* phones: just the album cover, up in the top bar next to the other little buttons – tap it for the player + library */
@media (max-width: 720px) {
  .gm { z-index: 45; top: calc(10px + env(safe-area-inset-top)); right: 62px; left: auto; bottom: auto; width: 40px; height: 40px; max-width: none; padding: 0; gap: 0; border-radius: 12px; }
  .gm .txt, .gm .ctl, .gm .lk, .gm .chev, .gm .prog { display: none; }
  .gm .cover { width: 40px; height: 40px; border-radius: 12px; }
  .gm.playing .cover { box-shadow: 0 0 0 2px #1db954; }
  .gm-drawer { z-index: 50 !important; top: calc(62px + env(safe-area-inset-top)) !important; left: 12px !important; right: 12px !important; width: auto !important; max-height: none; bottom: calc(14px + env(safe-area-inset-bottom)) !important; }
}
</style>
