<script setup>
import { ref, computed } from 'vue'
import { Play, Pause, SkipBack, SkipForward, Volume2, Lock, LockOpen, Speaker } from 'lucide-vue-next'
import { spotify, progressMs, fmtClock, control, lockLeft, fmtLock } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'
import { web, setEnabled, setVolume } from '../composables/useWebPlayer'

// Spotify-style bar along the bottom of the music player app: what's playing, the transport
// buttons, a seekable progress bar, volume and where it plays.
const now = computed(() => spotify.now)
const locked = computed(() => lockLeft.value > 0)
const pct = computed(() => (now.value?.duration_ms ? (progressMs.value / now.value.duration_ms) * 100 : 0))
const msg = ref('')

async function run(op, ms) {
  const r = await control(op, ms)
  msg.value = r.ok ? '' : r.error
  if (!r.ok) setTimeout(() => (msg.value = ''), 3000)
}
function seek(e) {
  if (locked.value || !now.value?.duration_ms) return
  const r = e.currentTarget.getBoundingClientRect()
  run('seek', Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * now.value.duration_ms)
}
const where = computed(() => (web.unavailable ? 'Annen enhet' : web.status === 'ready' ? 'Spiller her' : web.status === 'loading' ? 'Kobler til …' : web.status === 'reconnect' ? 'Koble til Spotify på nytt' : web.status === 'elsewhere' ? 'Spiller i en annen fane' : web.status === 'error' ? web.error : 'Annen enhet'))
</script>

<template>
  <footer class="pbar glass">
    <div class="track">
      <img crossorigin="anonymous" v-if="now?.image" :src="now.image" alt="" />
      <div v-else class="ph"></div>
      <div class="t">
        <b>{{ now?.name || 'Ingenting spilles' }}</b>
        <span>{{ now?.artist }}</span>
      </div>
    </div>

    <div class="center">
      <div class="btns">
        <button class="b" :disabled="!admin.loggedIn || locked || !now?.name" aria-label="Forrige" @click="run('previous')"><SkipBack :size="18" fill="currentColor" /></button>
        <button class="b big" :disabled="!admin.loggedIn || !now?.name" :aria-label="now?.playing ? 'Pause' : 'Spill'" @click="run(now?.playing ? 'pause' : 'resume')">
          <Pause v-if="now?.playing" :size="18" fill="currentColor" />
          <Play v-else :size="18" fill="currentColor" />
        </button>
        <button class="b" :disabled="!admin.loggedIn || locked || !now?.name" aria-label="Neste" @click="run('next')"><SkipForward :size="18" fill="currentColor" /></button>
      </div>
      <div class="prog">
        <span>{{ now?.duration_ms ? fmtClock(progressMs / 1000) : '' }}</span>
        <div class="bar" :class="{ seekable: admin.loggedIn && !locked && now?.duration_ms }" @click="admin.loggedIn && seek($event)"><i :style="{ width: `${pct}%` }"></i></div>
        <span>{{ now?.duration_ms ? fmtClock(now.duration_ms / 1000) : '' }}</span>
      </div>
      <small v-if="msg" class="msg">{{ msg }}</small>
    </div>

    <div class="right">
      <span v-if="locked" class="lock" :title="`Låst – hør ferdig`"><Lock :size="13" />{{ fmtClock(lockLeft) }}</span>
      <span v-else-if="spotify.lockSeconds" class="lock off" :title="`Låses i ${fmtLock(spotify.lockSeconds)} når noe startes`"><LockOpen :size="13" /></span>
      <label v-if="admin.loggedIn && !web.unavailable" class="dev" :title="where">
        <Speaker :size="16" />
        <input type="checkbox" :checked="web.enabled && web.status !== 'reconnect'" @change="setEnabled($event.target.checked)" />
        <span class="sw"><i></i></span>
      </label>
      <a v-if="web.status === 'reconnect'" class="btn small primary" href="api.php?action=spotify_login">Koble til</a>
      <label v-if="web.status === 'ready'" class="vol"><Volume2 :size="16" /><input type="range" min="0" max="1" step="0.05" :value="web.volume" aria-label="Volum" @input="setVolume(+$event.target.value)" /></label>
    </div>
  </footer>
</template>

<style scoped>
.pbar {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 30;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  padding: 10px 16px;
  border-radius: 20px;
}
.track { display: flex; align-items: center; gap: 12px; min-width: 0; }
.track img, .ph { width: 52px; height: 52px; flex: none; border-radius: 8px; object-fit: cover; box-shadow: 0 6px 14px rgba(0, 0, 0, 0.22); }
.ph { background: radial-gradient(circle, #555 0 12%, #111 13% 100%); }
.t { display: flex; flex-direction: column; min-width: 0; }
.t b { font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t span { font-size: 0.78rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.center { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
.btns { display: flex; align-items: center; gap: 14px; }
.b { display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 50%; background: transparent; color: var(--text-2); cursor: pointer; transition: color 0.15s, transform 0.15s; }
.b:hover:not(:disabled) { color: var(--text); transform: scale(1.06); }
.b:disabled { opacity: 0.35; cursor: default; }
.b.big { width: 40px; height: 40px; background: var(--text); color: var(--bg); }
.b.big:hover:not(:disabled) { color: var(--bg); }
.prog { display: grid; grid-template-columns: 40px minmax(0, 1fr) 40px; align-items: center; gap: 8px; width: 100%; font-size: 0.7rem; color: var(--text-3); font-variant-numeric: tabular-nums; }
.prog span:first-child { text-align: right; }
.bar { position: relative; height: 4px; border-radius: 4px; background: var(--accent-soft); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--accent); transition: width 1s linear; }
.bar.seekable { cursor: pointer; }
.bar.seekable:hover i { background: #1db954; }
.bar.seekable::before { content: ''; position: absolute; inset: -8px 0; }
.msg { font-size: 0.72rem; color: #d24b4b; }
.right { display: flex; align-items: center; justify-content: flex-end; gap: 12px; min-width: 0; color: var(--text-2); }
.lock { display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 600; color: #b8711a; font-variant-numeric: tabular-nums; }
.lock.off { color: var(--text-3); }
.dev { position: relative; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.dev input { position: absolute; opacity: 0; pointer-events: none; }
.dev .sw { width: 30px; height: 18px; border-radius: 999px; background: rgba(120, 130, 145, 0.35); position: relative; transition: background 0.2s; }
.dev .sw i { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform 0.2s; }
.dev input:checked + .sw { background: #1db954; }
.dev input:checked + .sw i { transform: translateX(12px); }
.vol { display: inline-flex; align-items: center; gap: 6px; }
.vol input { width: 100px; accent-color: #1db954; }

@media (max-width: 760px) {
  .pbar { grid-template-columns: minmax(0, 1fr) auto; gap: 10px; left: 8px; right: 8px; bottom: 8px; padding: 8px 10px; }
  .center { grid-column: 1 / -1; grid-row: 2; }
  .right .vol, .right .lock { display: none; }
  .track img, .ph { width: 42px; height: 42px; }
}
</style>
