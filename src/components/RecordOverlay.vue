<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Play, Pause, Lock } from 'lucide-vue-next'
import { room } from '../composables/useRoom'
import { spotify, lockLeft, fmtClock, play, lockNote, control } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'

// Sits on the record held up in the 3D room: a play button in its corner and its name underneath
// (so the side panel only needs the track list).
const rect = ref(null)
const busy = ref(false)
const toast = ref('')
let raf = 0

const album = computed(() => (room.sel.musikk?.kind === 'album' ? spotify.albums.find((a) => a.uri === room.sel.musikk.uri) : null))
const locked = computed(() => lockLeft.value > 0)
const playingThis = computed(() => spotify.now?.context === album.value?.uri)

function frame() {
  raf = requestAnimationFrame(frame)
  const r = album.value ? room.api?.recordScreenRect() : null
  const next = r && r.w > 60 ? r : null
  // only touch reactive state when it moved
  if (!next !== !rect.value || (next && (Math.abs(next.x - rect.value.x) > 0.5 || Math.abs(next.y - rect.value.y) > 0.5 || Math.abs(next.w - rect.value.w) > 0.5))) rect.value = next
}

// this record is the one on: the button pauses / resumes (always allowed, even while locked)
const isOn = computed(() => playingThis.value && !!spotify.now?.name)
const blocked = computed(() => !isOn.value && locked.value)

async function onPlay() {
  if (!album.value || busy.value) return
  if (isOn.value) {
    busy.value = true
    const r = await control(spotify.now.playing ? 'pause' : 'resume')
    busy.value = false
    if (!r.ok) { toast.value = r.error; setTimeout(() => (toast.value = ''), 3000) }
    return
  }
  if (locked.value) return
  busy.value = true
  const r = await play(album.value.uri)
  busy.value = false
  toast.value = r.ok ? `Spiller «${album.value.name}»${lockNote()}` : r.error
  setTimeout(() => (toast.value = ''), 3000)
}

onMounted(() => (raf = requestAnimationFrame(frame)))
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <template v-if="rect && album">
    <button
      v-if="admin.loggedIn"
      class="rplay"
      :class="{ locked: blocked }"
      :disabled="blocked || busy"
      :style="{ left: `${rect.x + rect.w - 18}px`, top: `${rect.y + rect.h - 18}px` }"
      :title="blocked ? `Låst ${fmtClock(lockLeft)}` : isOn ? (spotify.now.playing ? 'Pause' : 'Fortsett') : `Spill av «${album.name}»`"
      :aria-label="blocked ? 'Låst' : isOn && spotify.now.playing ? 'Pause' : 'Spill av'"
      @click="onPlay"
    >
      <Lock v-if="blocked" :size="22" />
      <Pause v-else-if="isOn && spotify.now.playing" :size="24" fill="currentColor" />
      <Play v-else :size="24" fill="currentColor" />
    </button>
    <div class="rcap glass" :style="{ left: `${rect.x + rect.w / 2}px`, top: `${rect.y + rect.h + 14}px`, maxWidth: `${Math.max(rect.w, 260)}px` }">
      <b>{{ album.name }}</b>
      <span>{{ album.artist }}<template v-if="album.year"> · {{ album.year }}</template><template v-if="isOn"> · <em :class="{ paused: !spotify.now.playing }">{{ spotify.now.playing ? 'spilles nå' : 'på pause' }}</em></template></span>
    </div>
    <transition name="fade">
      <div v-if="toast" class="rtoast glass" :style="{ left: `${rect.x + rect.w / 2}px`, top: `${rect.y - 14}px` }">{{ toast }}</div>
    </transition>
  </template>
</template>

<style scoped>
.rplay {
  position: fixed;
  z-index: 24;
  width: 64px;
  height: 64px;
  transform: translate(-100%, -100%);
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: #1db954;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(29, 185, 84, 0.45), 0 2px 6px rgba(0, 0, 0, 0.25);
  transition: transform 0.18s var(--spring, ease), filter 0.18s;
  animation: pop 0.4s var(--spring, ease) both;
}
.rplay:hover:not(:disabled) { transform: translate(-100%, -100%) scale(1.08); filter: brightness(1.08); }
.rplay.locked, .rplay:disabled { background: #9aa3ad; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25); cursor: not-allowed; }
@keyframes pop { from { opacity: 0; transform: translate(-100%, -100%) scale(0.6); } }
.rcap {
  position: fixed;
  z-index: 24;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  border-radius: 16px;
  text-align: center;
  pointer-events: none;
}
.rcap b { font-size: 0.98rem; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.rcap span { font-size: 0.8rem; color: var(--text-2); }
.rcap em { font-style: normal; color: #1db954; font-weight: 600; }
.rcap em.paused { color: var(--text-3); }
.rtoast { position: fixed; z-index: 26; transform: translate(-50%, -100%); padding: 8px 14px; border-radius: 999px; font-size: 0.82rem; font-weight: 600; white-space: nowrap; }
</style>
