<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Shuffle, SkipBack, SkipForward, Play, Pause, Repeat, Repeat1, Heart, ListMusic, MonitorSpeaker, Smartphone, Speaker, Laptop, Volume2 } from 'lucide-vue-next'
import { spotify, control, setShuffle, cycleRepeat, isLiked, setLiked, fetchQueue, fetchDevices, transferTo, setDeviceVolume, lockLeft, fmtClock, notify } from '../composables/useSpotify'

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

// ── liked ──
const liked = ref(false)
watch(() => now.value?.uri, async (uri) => { liked.value = uri?.startsWith('spotify:track:') ? await isLiked(uri) : false }, { immediate: true })
async function like() {
  if (!now.value?.uri) return
  liked.value = !liked.value
  const r = await setLiked(now.value.uri, liked.value)
  if (!r.ok) liked.value = !liked.value
}

// ── popovers: queue / devices ──
const open = ref(null) // 'queue' | 'devices'
const queue = ref(null)
const devices = ref(null)
async function show(which) {
  open.value = open.value === which ? null : which
  if (open.value === 'queue') { queue.value = null; queue.value = await fetchQueue() }
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
    </div>
    <div class="extras">
      <button class="ib" :class="{ liked }" :title="liked ? 'Fjern fra Likte sanger' : 'Lagre i Likte sanger'" aria-label="Likte sanger" @click="like"><Heart :size="16" :fill="liked ? 'currentColor' : 'none'" /></button>
      <button class="ib" :class="{ on: open === 'queue' }" title="Neste i køen" aria-label="Kø" @click="show('queue')"><ListMusic :size="16" /></button>
      <button class="ib dev" :class="{ on: open === 'devices' }" :title="now?.device ? `Spiller på ${now.device}` : 'Velg enhet'" aria-label="Enhet" @click="show('devices')"><MonitorSpeaker :size="16" /><span v-if="!compact && now?.device">{{ now.device }}</span></button>
    </div>

    <!-- up next -->
    <div v-if="open === 'queue'" class="pop glass">
      <b class="label-caps">Neste i køen</b>
      <p v-if="!queue" class="muted">Henter …</p>
      <p v-else-if="!queue.length" class="muted">Køen er tom.</p>
      <ol v-else class="q">
        <li v-for="(t, i) in queue.slice(0, 12)" :key="t.uri + i">
          <img v-if="t.img" :src="t.img" alt="" crossorigin="anonymous" /><span class="qt"><b>{{ t.name }}</b><small>{{ t.artist }}</small></span><small class="d">{{ fmtClock(t.ms / 1000) }}</small>
        </li>
      </ol>
    </div>

    <!-- devices + volume -->
    <div v-if="open === 'devices'" class="pop glass">
      <b class="label-caps">Spill på</b>
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
.pc { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
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
