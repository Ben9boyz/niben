<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Play, Pause } from 'lucide-vue-next'

// A metronome (Web Audio with look-ahead scheduling, so it doesn't drift): tempo, beats per bar (the first one is accented),
// tap tempo, and a speed trainer that adds a few BPM every few bars up to a goal – for practising something slowly until it's clean.
const bpm = ref(100)
const beats = ref(4)
const running = ref(false)
const beat = ref(-1) // which beat lights up
const trainer = ref(false)
const stepBpm = ref(5)
const everyBars = ref(4)
const goal = ref(140)
const BEATS = [2, 3, 4, 5, 6, 7]
const clamp = (v) => Math.max(30, Math.min(260, Math.round(v)))
const setBpm = (v) => { bpm.value = clamp(Number(v) || 100) }
const word = computed(() => (bpm.value < 60 ? 'Largo' : bpm.value < 76 ? 'Adagio' : bpm.value < 108 ? 'Andante' : bpm.value < 120 ? 'Moderato' : bpm.value < 156 ? 'Allegro' : bpm.value < 176 ? 'Vivace' : 'Presto'))

let ctx = null, timer = 0, nextTime = 0, count = 0, bars = 0
const queue = [] // [{ time, i }] for the lights
let raf = 0

function click(time, accent) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.frequency.value = accent ? 1500 : 1000
  o.type = 'square'
  g.gain.setValueAtTime(0.0001, time)
  g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.28, time + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)
  o.connect(g); g.connect(ctx.destination)
  o.start(time); o.stop(time + 0.06)
}
function schedule() {
  while (nextTime < ctx.currentTime + 0.14) {
    const i = count % beats.value
    click(nextTime, i === 0)
    queue.push({ time: nextTime, i })
    nextTime += 60 / bpm.value
    count++
    if (i === beats.value - 1) {
      bars++
      if (trainer.value && bars % everyBars.value === 0 && bpm.value < goal.value) bpm.value = clamp(Math.min(goal.value, bpm.value + stepBpm.value))
    }
  }
}
function lights() {
  raf = requestAnimationFrame(lights)
  while (queue.length && queue[0].time <= ctx.currentTime) beat.value = queue.shift().i
}
async function start() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') await ctx.resume()
  count = 0; bars = 0; queue.length = 0
  nextTime = ctx.currentTime + 0.06
  running.value = true
  schedule()
  timer = setInterval(schedule, 25)
  lights()
}
function stop() {
  clearInterval(timer)
  cancelAnimationFrame(raf)
  running.value = false
  beat.value = -1
}
const toggle = () => (running.value ? stop() : start())
// space starts / stops, the arrow keys nudge the tempo
function onKey(e) {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return
  if (e.code === 'Space') { e.preventDefault(); toggle() }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); setBpm(bpm.value + 1) }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); setBpm(bpm.value - 1) }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); stop(); ctx?.close().catch(() => {}) })

// tap tempo: the average of the last taps
let taps = []
function tap() {
  const now = performance.now()
  if (taps.length && now - taps[taps.length - 1] > 2200) taps = []
  taps.push(now)
  if (taps.length > 6) taps.shift()
  if (taps.length >= 2) setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)))
}
watch(beats, () => { count = 0 })
</script>

<template>
  <div class="metro">
    <div class="dots" aria-hidden="true">
      <i v-for="n in beats" :key="n" :class="{ on: beat === n - 1, first: n === 1 }"></i>
    </div>
    <div class="tempo">
      <button class="pm" aria-label="Saktere" @click="setBpm(bpm - 1)">−</button>
      <div class="big"><b>{{ bpm }}</b><small>BPM · {{ word }}</small></div>
      <button class="pm" aria-label="Raskere" @click="setBpm(bpm + 1)">+</button>
    </div>
    <input class="slider" type="range" min="30" max="260" :value="bpm" aria-label="Tempo" @input="setBpm($event.target.value)" />
    <div class="row">
      <button class="go" :class="{ on: running }" :aria-label="running ? 'Stopp' : 'Start'" @click="toggle"><Pause v-if="running" :size="22" fill="currentColor" /><Play v-else :size="22" fill="currentColor" /></button>
      <button class="tap" @click="tap">Tapp tempo</button>
    </div>
    <div class="beats" role="group" aria-label="Slag i takten">
      <span>Slag:</span>
      <button v-for="b in BEATS" :key="b" :class="{ on: beats === b }" @click="beats = b">{{ b }}</button>
    </div>
    <label class="tr"><input v-model="trainer" type="checkbox" /> <span>Fartstrener: øk automatisk</span></label>
    <div v-if="trainer" class="trset">
      <label>+<input v-model.number="stepBpm" type="number" min="1" max="20" /> BPM</label>
      <label>hver<input v-model.number="everyBars" type="number" min="1" max="32" /> takt</label>
      <label>opp til<input v-model.number="goal" type="number" min="40" max="260" /></label>
    </div>
  </div>
</template>

<style scoped>
.metro { display: grid; gap: 14px; justify-items: center; width: min(380px, 100%); margin: 0 auto; }
.dots { display: flex; gap: 10px; height: 22px; align-items: center; }
.dots i { width: 16px; height: 16px; border-radius: 50%; background: var(--glass-border); transition: background 0.06s, transform 0.06s; }
.dots i.first { width: 20px; height: 20px; }
.dots i.on { background: #f0a040; transform: scale(1.25); }
.dots i.first.on { background: #3cc47e; }
.tempo { display: flex; align-items: center; gap: 14px; }
.big { display: grid; justify-items: center; min-width: 130px; line-height: 1.1; }
.big b { font-size: 4rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.big small { color: var(--text-3); font-size: 0.8rem; }
.pm { width: 48px; height: 48px; border: 1px solid var(--glass-border); border-radius: 50%; background: var(--glass-strong); color: var(--text); font: 600 1.5rem var(--font); cursor: pointer; touch-action: manipulation; }
.pm:active { background: var(--accent-soft); }
.slider { width: 100%; accent-color: var(--accent); }
.row { display: flex; align-items: center; gap: 12px; }
.go { display: grid; place-items: center; width: 64px; height: 64px; border: 0; border-radius: 50%; background: var(--accent); color: #fff; cursor: pointer; box-shadow: 0 8px 22px color-mix(in srgb, var(--accent) 40%, transparent); touch-action: manipulation; }
.go.on { background: #d24b4b; box-shadow: 0 8px 22px rgba(210, 75, 75, 0.4); }
.tap { padding: 12px 20px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass-strong); color: var(--text); font: 700 0.88rem var(--font); cursor: pointer; touch-action: manipulation; }
.tap:active { background: var(--accent-soft); }
.beats { display: flex; align-items: center; gap: 5px; color: var(--text-3); font-size: 0.8rem; }
.beats button { width: 34px; height: 34px; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--glass-strong); color: var(--text-2); font: 700 0.85rem var(--font); cursor: pointer; }
.beats button.on { background: var(--text); color: var(--bg); border-color: var(--text); }
.tr { display: flex; align-items: center; gap: 8px; color: var(--text-2); font-size: 0.85rem; cursor: pointer; }
.trset { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; color: var(--text-3); font-size: 0.8rem; }
.trset label { display: inline-flex; align-items: center; gap: 4px; }
.trset input { width: 52px; padding: 4px 6px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg); color: var(--text); font: 600 0.82rem var(--font); text-align: center; }
</style>
