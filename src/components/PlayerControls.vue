<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Shuffle, SkipBack, SkipForward, Play, Pause, Repeat, Repeat1, MonitorSpeaker, Smartphone, Speaker, Laptop, Volume2 } from 'lucide-vue-next'
import WebPlayerToggle from './WebPlayerToggle.vue'
import { vinyl, setVinyl } from '../composables/useVinylNoise'
import { mode } from '../composables/useMode'
import { spotify, control, setShuffle, cycleRepeat, fetchDevices, transferTo, setDeviceVolume, lockLeft, fmtClock, notify } from '../composables/useSpotify'

// The player's buttons (admin): shuffle · back · play/pause · next · repeat, the heart (liked songs),
// what's up next, and which device plays (with its volume). Everything answers at once on screen and
// the request goes to Spotify behind it.
const props = defineProps({ compact: Boolean })
const now = computed(() => spotify.now)
const locked = computed(() => lockLeft.value > 0)

async function run(p) {
  const r = await p
  if (r && !r.ok && r.error) notify(r.error, true)
}
const toggle = () => {
  if (!now.value) return
  const was = now.value.playing
  now.value.playing = !was // instantly; the poll confirms
  run(control(was ? 'pause' : 'resume'))
}
const skip = (op) => (locked.value ? notify(`Låst – hør ferdig (${fmtClock(lockLeft.value)} igjen)`, true) : run(control(op)))
const shuffle = () => run(setShuffle(!now.value?.shuffle))

// ── popover: devices ──
const open = ref(null) // 'devices'
const devices = ref(null)
async function show(which) {
  open.value = open.value === which ? null : which
  if (open.value === 'devices') { devices.value = null; devices.value = await fetchDevices() }
}
async function pick(d) {
  if (d.active) return
  const r = await transferTo(d.id, !!now.value?.playing)
  if (r.ok) { notify(`Spiller på «${d.name}».`); open.value = null } else notify(r.error, true)
}
const DEV_ICON = { Computer: Laptop, Smartphone, Speaker, TV: MonitorSpeaker }
const root = ref(null)
const onDoc = (e) => { if (open.value && !root.value?.contains(e.target)) open.value = null }
onMounted(() => document.addEventListener('pointerdown', onDoc))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDoc))
</script>

<template>
  <div ref="root" class="pc" :class="{ compact }">
    <div class="transport">
      <button class="ib" :class="{ on: now?.shuffle }" title="Tilfeldig rekkefølge" aria-label="Tilfeldig rekkefølge" @click="shuffle"><Shuffle :size="16" /></button>
      <button class="ib" :class="{ dim: locked }" title="Forrige" aria-label="Forrige" @click="skip('previous')"><SkipBack :size="18" fill="currentColor" /></button>
      <button class="play" :aria-label="now?.playing ? 'Pause' : 'Spill'" @click="toggle"><Pause v-if="now?.playing" :size="18" fill="currentColor" /><Play v-else :size="18" fill="currentColor" /></button>
      <button class="ib" :class="{ dim: locked }" title="Neste" aria-label="Neste" @click="skip('next')"><SkipForward :size="18" fill="currentColor" /></button>
      <button class="ib" :class="{ on: now?.repeat && now.repeat !== 'off' }" :title="{ off: 'Gjenta: av', context: 'Gjenta lista / albumet', track: 'Gjenta låta' }[now?.repeat || 'off']" aria-label="Gjenta" @click="run(cycleRepeat())">
        <Repeat1 v-if="now?.repeat === 'track'" :size="16" /><Repeat v-else :size="16" />
      </button>
      <button class="ib dev" :class="{ on: open === 'devices' }" :title="now?.device ? `Spiller på ${now.device}` : 'Velg enhet'" aria-label="Enhet" @click="show('devices')"><MonitorSpeaker :size="16" /></button>
    </div>

    <!-- devices + volume -->
    <div v-if="open === 'devices'" class="pop glass">
      <b class="label-caps">Spill på</b>
      <WebPlayerToggle class="here" />
      <label v-if="mode === 'rom'" class="vin" title="Svak vinylknitring over musikken i 3D-rommet"><input type="checkbox" :checked="vinyl.on" @change="setVinyl($event.target.checked)" /><span class="sw"><i></i></span>Vinylknitring</label>
      <p v-if="!devices" class="muted">Henter enheter …</p>
      <p v-else-if="!devices.length" class="muted">Ingen Spotify-enheter er åpne.</p>
      <button v-for="d in devices || []" :key="d.id" class="dv" :class="{ active: d.active }" :disabled="d.restricted" @click="pick(d)">
        <component :is="DEV_ICON[d.type] || Speaker" :size="16" /><span>{{ d.name }}</span><small v-if="d.active">spiller her</small>
      </button>
      <label v-if="now?.volume != null" class="vol"><Volume2 :size="15" /><input type="range" min="0" max="100" :value="now.volume" aria-label="Volum" @input="setDeviceVolume(+$event.target.value)" /></label>
    </div>
  </div>
</template>

<style scoped>
.pc { position: relative; display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
.transport, .extras { display: flex; align-items: center; gap: 4px; }
.ib { display: inline-flex; align-items: center; gap: 5px; height: 32px; min-width: 32px; justify-content: center; padding: 0 6px; border: 0; border-radius: 999px; background: transparent; color: var(--text-2); cursor: pointer; transition: color 0.15s, background 0.15s; }
.ib:hover { color: var(--text); background: var(--accent-soft); }
.ib.on { color: #1db954; }
.ib.dim { opacity: 0.45; }
.ib.liked { color: #1db954; }
.dev span { max-width: 110px; font: 600 0.74rem var(--font); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.play { display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 50%; background: #1db954; color: #fff; cursor: pointer; box-shadow: 0 4px 12px rgba(29, 185, 84, 0.35); transition: transform 0.15s; }
.play:hover { transform: scale(1.06); }
.compact .play { width: 34px; height: 34px; }
.pop { position: absolute; z-index: 30; left: 0; right: 0; top: calc(100% + 8px); display: grid; gap: 6px; padding: 12px; border-radius: 16px; background: var(--bg); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25); max-height: 340px; overflow-y: auto; }
.vin { display: flex; align-items: center; gap: 10px; padding: 6px 10px; font-size: 0.78rem; color: var(--text-2); cursor: pointer; }
.vin input { position: absolute; opacity: 0; pointer-events: none; }
.vin .sw { position: relative; flex: none; width: 34px; height: 20px; border-radius: 999px; background: rgba(120, 130, 145, 0.35); transition: background 0.2s; }
.vin .sw i { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform 0.2s; }
.vin input:checked + .sw { background: #1db954; }
.vin input:checked + .sw i { transform: translateX(14px); }
.here { padding: 4px 10px 8px; border-bottom: 1px solid var(--glass-border); }
.muted { margin: 0; color: var(--text-3); font-size: 0.82rem; }
.q { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.q li { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 8px; }
.q img { width: 36px; height: 36px; border-radius: 5px; object-fit: cover; }
.qt { display: grid; min-width: 0; }
.qt b { font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qt small, .d { font-size: 0.72rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dv { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 0; border-radius: 10px; background: transparent; color: var(--text); font: 600 0.85rem var(--font); text-align: left; cursor: pointer; }
.dv:hover:not(:disabled) { background: var(--accent-soft); }
.dv.active { color: #1db954; }
.dv small { margin-left: auto; font-size: 0.7rem; font-weight: 600; }
.dv:disabled { opacity: 0.45; cursor: default; }
.vol { display: flex; align-items: center; gap: 8px; padding: 6px 10px 2px; color: var(--text-3); }
.vol input { flex: 1; accent-color: #1db954; }
</style>
