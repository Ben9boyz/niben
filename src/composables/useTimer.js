import { reactive } from 'vue'

// Practice interval timer shared by the clock in the room and the "Øving" panel.
const KEY = 'niben-timer'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
const saved = load()

export const timer = reactive({
  running: false,
  interval: saved.interval > 0 ? saved.interval : 10, // seconds
  sound: typeof saved.sound === 'boolean' ? saved.sound : true,
  startedAt: 0, // performance.now() when the current run segment started
  pausedMs: 0, // time accumulated before the current segment
  now: 0, // ticks while running so the UI updates
})

let raf = 0
let lastCycle = 0
let audio = null

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ interval: timer.interval, sound: timer.sound })) } catch {}
}

export function elapsedMs() {
  return timer.running ? timer.pausedMs + (performance.now() - timer.startedAt) : timer.pausedMs
}

/** Snapshot used by the clock and the panel. */
export function timerState() {
  const ms = elapsedMs()
  const intervalMs = timer.interval * 1000
  const cycle = Math.floor(ms / intervalMs)
  const inCycle = ms - cycle * intervalMs
  return {
    ms,
    cycle,
    progress: inCycle / intervalMs,
    left: Math.ceil((intervalMs - inCycle) / 1000),
    go: cycle > 0 && inCycle < 1200, // just finished an interval
    running: timer.running,
    started: ms > 0,
  }
}

export function formatTime(ms) {
  const tenths = Math.floor(ms / 100) % 10
  const total = Math.floor(ms / 1000)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}.${tenths}`
}

function beep() {
  if (!timer.sound) return
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)()
    const t = audio.currentTime
    ;[880, 1320].forEach((f, i) => {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.frequency.value = f
      gain.gain.setValueAtTime(0.0001, t + i * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.22, t + i * 0.12 + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.3)
      osc.connect(gain).connect(audio.destination)
      osc.start(t + i * 0.12)
      osc.stop(t + i * 0.12 + 0.32)
    })
  } catch {}
}

function tick() {
  if (!timer.running) { raf = 0; return }
  timer.now = performance.now()
  const { cycle } = timerState()
  if (cycle > lastCycle) beep()
  lastCycle = cycle
  raf = requestAnimationFrame(tick)
}

export function start() {
  if (timer.running) return
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume()
  } catch {}
  timer.startedAt = performance.now()
  timer.running = true
  lastCycle = timerState().cycle
  if (!raf) raf = requestAnimationFrame(tick)
}

export function pause() {
  if (!timer.running) return
  timer.pausedMs = elapsedMs()
  timer.running = false
}

export function toggle() {
  timer.running ? pause() : start()
}

export function reset() {
  timer.running = false
  timer.pausedMs = 0
  lastCycle = 0
  timer.now = performance.now()
}

export function setIntervalSeconds(sec) {
  const v = Math.max(1, Math.min(3600, Math.round(Number(sec) || 10)))
  timer.interval = v
  lastCycle = timerState().cycle // avoid a stray beep when shortening the interval
  save()
}

export function setSound(on) {
  timer.sound = !!on
  save()
}
