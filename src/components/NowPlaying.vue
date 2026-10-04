<script setup>
import { Lock, Play, Pause } from 'lucide-vue-next'
import { ref, computed } from 'vue'
import LockControl from './LockControl.vue'
import { spotify, lockLeft, progressMs, fmtClock, control } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'
import { web, setEnabled, setVolume } from '../composables/useWebPlayer'

// stacked: big cover on top (the plain music page's sidebar)
const props = defineProps({ stacked: Boolean })
const now = computed(() => spotify.now)
const pct = computed(() => (now.value?.duration_ms ? (progressMs.value / now.value.duration_ms) * 100 : 0))

// ── lock ──
const locked = computed(() => lockLeft.value > 0)

// ── playback controls (admin) ──
const ctrlMsg = ref('')
async function run(op, ms) {
  const r = await control(op, ms)
  ctrlMsg.value = r.ok ? '' : r.error
  if (!r.ok) setTimeout(() => (ctrlMsg.value = ''), 3000)
}
const togglePlay = () => run(now.value?.playing ? 'pause' : 'resume')
// click the progress bar to jump (locked like switching)
const canSeek = computed(() => admin.loggedIn && !!now.value?.duration_ms && !locked.value)
function seek(e) {
  if (!canSeek.value) return
  const r = e.currentTarget.getBoundingClientRect()
  run('seek', Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * now.value.duration_ms)
}

// ── the browser as a Spotify speaker (admin) ──
const webLabel = computed(() => ({
  off: 'Annen enhet',
  loading: 'Kobler til …',
  ready: 'Her på siden',
  reconnect: 'Koble til på nytt',
  error: web.error || 'Noe gikk galt',
}[web.status]))
</script>

<template>
  <section class="now" :class="{ playing: now?.playing, admin: admin.loggedIn, stacked: props.stacked }">
    <div class="cover">
      <img crossorigin="anonymous" v-if="now?.image" :src="(props.stacked && now.image_large) || now.image" alt="" />
      <div v-else class="vinyl-ph"></div>
      <span v-if="now?.playing" class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
    </div>

    <div class="meta">
      <div class="top">
        <small>{{ now?.playing ? 'Spilles nå' : now?.name ? 'Satt på pause' : 'Ingenting spilles' }}</small>
        <!-- lock: settings for the admin, a countdown for everyone while it's on -->
        <LockControl v-if="admin.loggedIn" />
        <span v-else-if="locked" class="lockbtn active" title="Ingen bytting – hør ferdig"><Lock :size="12" aria-hidden="true" />{{ fmtClock(lockLeft) }}</span>
      </div>
      <b class="title">{{ now?.name || '—' }}</b>
      <span class="sub">{{ now?.artist }}<template v-if="now?.album"> · {{ now.album }}</template></span>
      <template v-if="now?.duration_ms">
        <div class="bar" :class="{ seekable: canSeek }" :title="admin.loggedIn && locked ? 'Låst – hør ferdig' : null" @click="seek">
          <span :style="{ width: `${pct}%` }"></span>
        </div>
        <div class="times"><span>{{ fmtClock(progressMs / 1000) }}</span><span>{{ fmtClock(now.duration_ms / 1000) }}</span></div>
      </template>
    </div>

    <!-- admin controls, in the same card -->
    <div v-if="admin.loggedIn && spotify.connected" class="ctrl" :class="web.status">
      <button v-if="now?.name" class="pp" :aria-label="now?.playing ? 'Pause' : 'Spill'" @click="togglePlay"><Pause v-if="now?.playing" :size="14" fill="currentColor" /><Play v-else :size="14" fill="currentColor" /></button>
      <label v-if="!web.unavailable" class="switch" title="La niben.no være en Spotify-høyttaler">
        <input type="checkbox" :checked="web.enabled && web.status !== 'reconnect'" @change="setEnabled($event.target.checked)" />
        <span class="track"><span class="knob"></span></span>
      </label>
      <span class="wl">{{ ctrlMsg || webLabel }}</span>
      <a v-if="web.status === 'reconnect'" class="btn small primary" href="api.php?action=spotify_login">Koble til</a>
      <input v-if="web.status === 'ready'" class="vol" type="range" min="0" max="1" step="0.05" :value="web.volume" aria-label="Volum" @input="setVolume(+$event.target.value)" />
    </div>
  </section>
</template>

<style scoped>
.now { position: relative; display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 4px 12px; align-items: center; padding: 10px; border-radius: 18px; background: var(--glass-strong); border: 1px solid var(--glass-border); box-shadow: inset 0 1px 0 var(--glass-hi); min-width: 0; }
.cover { position: relative; width: 72px; height: 72px; border-radius: 10px; overflow: hidden; box-shadow: 0 6px 16px rgba(0,0,0,.22); }
.cover img { width: 100%; height: 100%; object-fit: cover; }
.vinyl-ph { width: 100%; height: 100%; background: radial-gradient(circle, #555 0 12%, #111 13% 100%); }
.eq { position: absolute; right: 5px; bottom: 5px; display: flex; gap: 2px; align-items: flex-end; height: 14px; }
.eq i { width: 3px; background: #fff; border-radius: 2px; animation: eq 0.9s ease-in-out infinite; }
.eq i:nth-child(2) { animation-delay: -0.3s; }
.eq i:nth-child(3) { animation-delay: -0.6s; }
@keyframes eq { 0%, 100% { height: 4px; } 50% { height: 14px; } }
.meta { display: flex; flex-direction: column; min-width: 0; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 20px; }
.top small { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); white-space: nowrap; }
.now.playing .top small { color: #1db954; }
.title { font-size: 0.98rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { color: var(--text-2); font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar { position: relative; height: 4px; border-radius: 4px; background: var(--accent-soft); margin-top: 7px; overflow: hidden; transition: height 0.15s; }
.bar span { display: block; height: 100%; background: var(--accent); transition: width 1s linear; }
.bar.seekable { cursor: pointer; }
.bar.seekable:hover { height: 7px; margin-top: 5.5px; }
.bar.seekable::before { content: ''; position: absolute; inset: -8px 0; } /* bigger click target */
.times { display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--text-3); margin-top: 2px; font-variant-numeric: tabular-nums; }

.ctrl { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--glass-border); min-width: 0; }
.wl { flex: 1; min-width: 0; font-size: 0.78rem; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ctrl.ready .wl { color: #1db954; font-weight: 600; }
.ctrl.error .wl { color: #d24b4b; }
.switch { position: relative; flex: none; cursor: pointer; }
.switch input { position: absolute; opacity: 0; pointer-events: none; }
.switch .track { display: block; width: 34px; height: 20px; border-radius: 999px; background: rgba(120, 130, 145, 0.35); transition: background 0.2s; }
.switch .knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform 0.2s; }
.switch input:checked + .track { background: #1db954; }
.switch input:checked + .track .knob { transform: translateX(14px); }
.pp { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border: 0; border-radius: 50%; background: #1db954; color: #fff; font-size: 0.72rem; cursor: pointer; box-shadow: 0 4px 10px rgba(29, 185, 84, 0.35); }
.pp:hover { filter: brightness(1.08); }
.vol { flex: 0 1 100px; min-width: 50px; accent-color: #1db954; }

.lockbtn { display: flex; align-items: center; gap: 4px; padding: 2px 8px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass); font: 600 0.68rem var(--font); }
.lockbtn.active { color: #b8711a; border-color: rgba(240, 160, 64, 0.5); }


@media (min-width: 821px) {
  .now.stacked { grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 12px; }
  .now.stacked .cover { width: 100%; height: auto; aspect-ratio: 1; border-radius: 12px; box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3); }
  .now.stacked .eq { right: 10px; bottom: 10px; }
  .now.stacked .title { font-size: 1.15rem; }
  .now.stacked .ctrl { margin-top: 2px; }
}
</style>
