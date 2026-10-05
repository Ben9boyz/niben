<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { Mic, MicOff, Volume2 } from 'lucide-vue-next'

// A tuner for the guitar: listens through the microphone, finds the pitch (autocorrelation) and shows which string it is
// closest to and how many cents off. The tuning can be changed (standard, half a step down, a whole step down, Drop D, DADGAD …)
// and shifted up / down by half steps; tapping a string plays its note as a reference.
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const midiName = (m) => NAMES[((m % 12) + 12) % 12]
// the strings from low to high, as MIDI note numbers
const TUNINGS = [
  { id: 'std', label: 'Standard', notes: [40, 45, 50, 55, 59, 64] },
  { id: 'dropd', label: 'Drop D', notes: [38, 45, 50, 55, 59, 64] },
  { id: 'dadgad', label: 'DADGAD', notes: [38, 45, 50, 55, 57, 62] },
  { id: 'openg', label: 'Åpen G', notes: [38, 43, 50, 55, 59, 62] },
  { id: 'uke', label: 'Ukulele', notes: [67, 60, 64, 69] },
  { id: 'bass', label: 'Bass', notes: [28, 33, 38, 43] },
]
const tuning = ref('std')
const shift = ref(0) // half steps: −1 = half a step down (Eb), −2 = a whole step down (D) …
const a4 = ref(440)
const strings = computed(() => (TUNINGS.find((t) => t.id === tuning.value)?.notes || []).map((m) => m + shift.value))
const freqOf = (m) => a4.value * Math.pow(2, (m - 69) / 12)
const shiftLabel = computed(() => (shift.value === 0 ? 'Vanlig' : shift.value < 0 ? `${-shift.value === 1 ? 'Halvt' : -shift.value === 2 ? 'Helt' : -shift.value / 2 + ' hele'} steg ned` : `${shift.value === 1 ? 'Halvt' : shift.value === 2 ? 'Helt' : shift.value / 2 + ' hele'} steg opp`))

// ── listening ──
const on = ref(false)
const error = ref('')
const freq = ref(0) // the smoothed pitch, 0 = nothing heard
const auto = ref(true) // follow the string that is closest; false = the string I tapped
const picked = ref(0)
let ctx = null, stream = null, analyser = null, raf = 0, buf = null
const recent = []

async function start() {
  error.value = ''
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
  } catch {
    error.value = 'Fikk ikke tilgang til mikrofonen. Tillat den i nettleseren – tuneren lytter bare, den tar ikke opp noe.'
    return
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  const src = ctx.createMediaStreamSource(stream)
  analyser = ctx.createAnalyser()
  analyser.fftSize = 4096
  buf = new Float32Array(analyser.fftSize)
  src.connect(analyser)
  on.value = true
  loop()
}
function stop() {
  cancelAnimationFrame(raf)
  stream?.getTracks().forEach((t) => t.stop())
  ctx?.close().catch(() => {})
  ctx = stream = analyser = null
  on.value = false
  freq.value = 0
  recent.length = 0
}
onBeforeUnmount(() => { stop(); tone?.stop?.(); })

// pitch by autocorrelation (the lag with the strongest self-similarity inside the guitar range), refined between samples
function detect(b, sr) {
  const n = b.length
  let rms = 0
  for (let i = 0; i < n; i++) rms += b[i] * b[i]
  rms = Math.sqrt(rms / n)
  if (rms < 0.008) return 0
  const minLag = Math.floor(sr / 1200), maxLag = Math.floor(sr / 40)
  const half = n >> 1
  let best = -1, bestLag = 0
  const corr = new Float32Array(maxLag + 2)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0, e1 = 0, e2 = 0
    for (let i = 0; i < half; i++) { const x = b[i], y = b[i + lag]; s += x * y; e1 += x * x; e2 += y * y }
    const c = s / (Math.sqrt(e1 * e2) + 1e-9)
    corr[lag] = c
  }
  // the first strong peak (not the highest: that could be an octave below)
  let top = -1
  for (let lag = minLag; lag <= maxLag; lag++) if (corr[lag] > top) top = corr[lag]
  if (top < 0.6) return 0
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (corr[lag] > top * 0.9 && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) { best = corr[lag]; bestLag = lag; break }
  }
  if (bestLag === 0) return 0
  const a = corr[bestLag - 1], c0 = corr[bestLag], d = corr[bestLag + 1]
  const shiftLag = (a - d) / (2 * (a - 2 * c0 + d) || 1)
  return sr / (bestLag + (Number.isFinite(shiftLag) ? shiftLag : 0))
}
let tick = 0
function loop() {
  raf = requestAnimationFrame(loop)
  if (++tick % 2) return // ~30 times a second
  analyser.getFloatTimeDomainData(buf)
  const f = detect(buf, ctx.sampleRate)
  if (f) { recent.push(f); if (recent.length > 5) recent.shift() } else if (recent.length) recent.shift()
  if (!recent.length) { freq.value = 0; return }
  const sorted = [...recent].sort((x, y) => x - y)
  freq.value = sorted[sorted.length >> 1] // the middle value: one wrong reading doesn't jump the needle
}

// which string is it, and how far off?
const target = computed(() => {
  const list = strings.value
  if (!list.length) return null
  if (!auto.value) return { i: picked.value, m: list[picked.value] }
  if (!freq.value) return { i: picked.value, m: list[picked.value] }
  let bi = 0, bd = Infinity
  list.forEach((m, i) => { const d = Math.abs(1200 * Math.log2(freq.value / freqOf(m))); if (d < bd) { bd = d; bi = i } })
  return { i: bi, m: list[bi] }
})
const cents = computed(() => (freq.value && target.value ? Math.round(1200 * Math.log2(freq.value / freqOf(target.value.m))) : 0))
const clamped = computed(() => Math.max(-50, Math.min(50, cents.value)))
const inTune = computed(() => !!freq.value && Math.abs(cents.value) <= 5)
const hint = computed(() => (!on.value ? 'Trykk på mikrofonen og spill en streng' : !freq.value ? 'Spill en streng …' : inTune.value ? 'Stemt!' : cents.value < 0 ? 'For lavt – stram opp' : 'For høyt – slakk ned'))
function pick(i) {
  picked.value = i
  auto.value = false
  playTone(freqOf(strings.value[i]))
}

// a reference tone for a string (a soft, plucked-sounding oscillator)
let tone = null
function playTone(f) {
  try {
    const c = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (!ctx) ctx = c
    const t = c.currentTime
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4)
    const o1 = c.createOscillator(), o2 = c.createOscillator()
    o1.type = 'triangle'; o2.type = 'sine'
    o1.frequency.value = f; o2.frequency.value = f * 2
    const g2 = c.createGain(); g2.gain.value = 0.25
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(c.destination)
    o1.start(t); o2.start(t); o1.stop(t + 2.5); o2.stop(t + 2.5)
    tone = o1
  } catch {}
}
</script>

<template>
  <div class="tuner">
    <div class="presets pills" role="group" aria-label="Stemming">
      <button v-for="t in TUNINGS" :key="t.id" :class="{ on: tuning === t.id }" @click="tuning = t.id; picked = 0">{{ t.label }}</button>
    </div>

    <div class="shift" role="group" aria-label="Flytt stemmingen">
      <button class="pill" aria-label="Ett halvt steg ned" :disabled="shift <= -6" @click="shift--">♭ −½</button>
      <span class="sl"><b>{{ shiftLabel }}</b><small>{{ shift > 0 ? '+' : '' }}{{ shift }} halvtoner</small></span>
      <button class="pill" aria-label="Ett halvt steg opp" :disabled="shift >= 6" @click="shift++">♯ +½</button>
    </div>

    <div class="gauge" :class="{ tune: inTune, idle: !freq }">
      <div class="note">{{ freq && target ? midiName(target.m) : '–' }}<small v-if="freq && target">{{ Math.floor(target.m / 12) - 1 }}</small></div>
      <div class="meter" aria-hidden="true">
        <i v-for="n in 21" :key="n" class="tick" :class="{ mid: n === 11 }"></i>
        <span class="needle" :style="{ left: `${50 + clamped}%` }"></span>
      </div>
      <div class="cents"><span>♭</span><b>{{ freq ? (cents > 0 ? '+' : '') + cents : '' }}<small v-if="freq"> cent</small></b><span>♯</span></div>
      <p class="hint" :class="{ ok: inTune }">{{ hint }}</p>
      <small v-if="freq" class="hz">{{ freq.toFixed(1) }} Hz</small>
    </div>

    <div class="strings" role="group" aria-label="Strenger – trykk for å høre tonen">
      <button v-for="(m, i) in strings" :key="i" class="str" :class="{ on: target && target.i === i, cur: !auto && picked === i }" @click="pick(i)">
        <b>{{ midiName(m) }}</b><small>{{ Math.floor(m / 12) - 1 }}</small>
      </button>
    </div>
    <p class="sub"><Volume2 :size="13" aria-hidden="true" /> Trykk på en streng for å høre tonen. <button v-if="!auto" class="lnk" @click="auto = true">Finn streng automatisk</button></p>

    <button class="btn primary mic" :class="{ stop: on }" @click="on ? stop() : start()">
      <component :is="on ? MicOff : Mic" :size="20" aria-hidden="true" />{{ on ? 'Stopp' : 'Start tuner' }}
    </button>
    <p v-if="error" class="err">{{ error }}</p>

    <label class="ref">Referanse A = <input v-model.number="a4" type="number" min="415" max="466" step="1" aria-label="Frekvens for A" /> Hz</label>
  </div>
</template>

<style scoped>
.tuner { display: grid; gap: 12px; justify-items: center; width: 100%; }
.presets { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; }
.shift { display: flex; align-items: center; gap: 10px; }
.sl { display: grid; justify-items: center; min-width: 130px; line-height: 1.2; }
.sl b { font-size: 0.92rem; }
.sl small { color: var(--text-3); font-size: 0.72rem; }
.gauge { display: grid; justify-items: center; gap: 6px; width: min(360px, 100%); padding: 16px 14px 12px; border-radius: 22px; background: var(--glass-strong); border: 1px solid var(--glass-border); transition: box-shadow 0.2s, border-color 0.2s; }
.gauge.tune { border-color: #3cc47e; box-shadow: 0 0 0 3px color-mix(in srgb, #3cc47e 25%, transparent); }
.note { font-size: 4.2rem; font-weight: 800; line-height: 1; letter-spacing: -0.02em; }
.note small { font-size: 1.2rem; font-weight: 600; color: var(--text-3); margin-left: 2px; }
.gauge.idle .note { color: var(--text-3); }
.gauge.tune .note { color: #3cc47e; }
.meter { position: relative; display: flex; justify-content: space-between; align-items: flex-end; width: 100%; height: 34px; margin-top: 4px; }
.tick { width: 2px; height: 10px; border-radius: 1px; background: var(--glass-border); }
.tick.mid { height: 22px; background: #3cc47e; width: 3px; }
.needle { position: absolute; bottom: 0; width: 4px; height: 34px; margin-left: -2px; border-radius: 2px; background: #f0a040; transition: left 0.12s linear; }
.gauge.tune .needle { background: #3cc47e; }
.gauge.idle .needle { opacity: 0.25; }
.cents { display: flex; align-items: baseline; justify-content: space-between; width: 100%; color: var(--text-3); font-size: 1.1rem; }
.cents b { color: var(--text); font-size: 1.05rem; font-variant-numeric: tabular-nums; }
.cents small { font-size: 0.7rem; font-weight: 500; color: var(--text-3); }
.hint { margin: 0; font-size: 0.9rem; color: var(--text-2); }
.hint.ok { color: #3cc47e; font-weight: 700; }
.hz { color: var(--text-3); font-size: 0.72rem; }
.strings { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.str { display: grid; place-items: center; width: 50px; height: 56px; padding: 0; border: 1px solid var(--glass-border); border-radius: 14px; background: var(--glass-strong); color: var(--text); cursor: pointer; line-height: 1; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.str b { font-size: 1.15rem; }
.str small { font-size: 0.62rem; color: var(--text-3); }
.str.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
.str.cur { outline: 2px solid var(--accent); outline-offset: 1px; }
.sub { display: flex; align-items: center; gap: 5px; margin: 0; color: var(--text-3); font-size: 0.78rem; }
.lnk { border: 0; background: none; color: var(--accent); font: 600 0.78rem var(--font); cursor: pointer; padding: 0; }
.mic { padding: 13px 26px; }
.mic.stop { background: #d24b4b; box-shadow: 0 8px 24px rgba(210, 75, 75, 0.4); }
.err { margin: 0; max-width: 34ch; text-align: center; color: #d24b4b; font-size: 0.82rem; }
.ref { display: flex; align-items: center; gap: 6px; color: var(--text-3); font-size: 0.78rem; }
.ref input { width: 56px; padding: 4px 6px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg); color: var(--text); font: 600 0.82rem var(--font); text-align: center; }
@media (max-width: 520px), (max-height: 700px) {
  .tuner { gap: 9px; }
  .note { font-size: 3.4rem; }
  .gauge { padding: 12px 12px 10px; }
  .str { width: 46px; height: 52px; }
  .chip { padding: 6px 10px; font-size: 0.74rem; }
}
</style>
