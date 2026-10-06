import { reactive, watch } from 'vue'
import { spotify } from './useSpotify'
import { web } from './useWebPlayer'
import { mode } from '@/composables/ui/useMode'
import { playOn } from './usePlayOn'
import { room } from '@/composables/room/useRoom'
import { newAudioContext } from '@/lib/audio'
import { trackGap, setGapWanted } from './useTrackGap'

// A record player on top of the music, all made with the Web Audio API (no sound files). Spotify's own stream can't be
// touched (DRM), so this is a second layer that is played alongside it, only while a song plays HERE and I'm in the 3D room:
//  · surface noise: hiss + crackle, with a slow speed wobble (wow & flutter) so the loop never sounds digital
//  · the mechanics: the needle dropping and the needle lifting (friction) – and nothing between two songs: on a real record
//    the next track just follows (with the short pause made by useTrackGap, in which only this noise is heard)
//  · a fake sidechain: the noise sits ~18 % lower under the music, and swells for a second when it stops
//  · timed to the 3D tonearm: the needle sound comes when the arm actually touches the record
const KEY = 'niben-vinyl'
const LKEY = 'niben-vinyl-level' // crackle loudness 0–100
const MKEY = 'niben-vinyl-mech' // the mechanical sounds on / off
const WKEY = 'niben-vinyl-wow' // wow & flutter amount 0–100
const readNum = (key: string, fallback: number): number => { try { const raw = localStorage.getItem(key); const n = Number(raw); return raw != null && n >= 0 && n <= 100 ? n : fallback } catch { return fallback } }
const save = (key: string, v: string): void => { try { localStorage.setItem(key, v) } catch { /* private mode */ } }
export const vinyl = reactive({
  on: (() => { try { return localStorage.getItem(KEY) !== 'off' } catch { return true } })(),
  level: readNum(LKEY, 50),
  mech: (() => { try { return localStorage.getItem(MKEY) !== 'off' } catch { return true } })(),
  wow: readNum(WKEY, 50),
})
export function setVinylLevel(n: number): void {
  vinyl.level = Math.max(0, Math.min(100, Math.round(n)))
  save(LKEY, String(vinyl.level))
  applyLevel(0.1)
}
export function setVinyl(v: boolean): void { vinyl.on = v; save(KEY, v ? 'on' : 'off') }
export function setVinylMech(v: boolean): void { vinyl.mech = v; save(MKEY, v ? 'on' : 'off') }
export function setVinylWow(n: number): void {
  vinyl.wow = Math.max(0, Math.min(100, Math.round(n)))
  save(WKEY, String(vinyl.wow))
  applyWow()
}

const DUCK = 0.82 // the crackle under playing music (−18 %)
const SWELL = 1.18 // …and between songs / at a pause

let ctx: AudioContext | null = null
let master: GainNode | null = null // the crackle bus (ducked)
let fx: GainNode | null = null // the mechanical sounds (not ducked)
let hissSrc: AudioBufferSourceNode | null = null
let flutterDepth: GainNode | null = null
let wowDepth: GainNode | null = null
let flutterLfo: OscillatorNode | null = null
let driftTimer = 0 // (kept for the page lifetime)
let timer = 0
let active = false // the crackle layer is "on" (a record is playing)
let fadeTimer = 0

function noiseBuffer(audio: AudioContext, seconds: number, fn: (i: number, len: number) => number): AudioBuffer {
  const len = Math.max(1, Math.floor(audio.sampleRate * seconds))
  const buf = audio.createBuffer(1, len, audio.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = fn(i, len)
  return buf
}
const white = (): number => Math.random() * 2 - 1

// ── the level: what the crackle should sit at right now ──
const levelNow = (ducked: boolean): number => (vinyl.level / 100) * (ducked ? DUCK : 1)
/** Under the music the crackle sits lower; in the pause between two songs it is all there is, so it is not ducked. */
const under = (): boolean => !!spotify.now?.playing && !trackGap.active
function applyLevel(tc: number): void {
  if (ctx && master && active) master.gain.setTargetAtTime(levelNow(under()), ctx.currentTime, tc)
}
/** Wow (slow, ~0.5 Hz) and flutter (fast, 4–6 Hz) as a small pitch wobble, in cents, scaled by the setting. */
function applyWow(): void {
  if (!ctx) return
  const k = vinyl.wow / 100
  flutterDepth?.gain.setTargetAtTime(k * 7, ctx.currentTime, 0.2)
  wowDepth?.gain.setTargetAtTime(k * 12, ctx.currentTime, 0.2)
}

// ── crackle ──
function pop(loud: boolean): void {
  if (!ctx || !master) return
  // a tiny click: a short burst of noise with a fast decay, through a band filter
  const dur = loud ? 0.014 : 0.004 + Math.random() * 0.006
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, dur, (i, n) => white() * Math.pow(1 - i / n, 3))
  src.playbackRate.value = 0.94 + Math.random() * 0.12 // the same wobble in the crackle
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = loud ? 1400 + Math.random() * 1200 : 2500 + Math.random() * 4000
  f.Q.value = 0.8
  const g = ctx.createGain()
  g.gain.value = loud ? 0.22 : 0.04 + Math.random() * 0.1
  src.connect(f).connect(g).connect(master)
  src.start()
}
function schedule(): void {
  // on average ~2 crackles a second, a pop every ~12 seconds
  timer = window.setTimeout(() => {
    pop(false)
    if (Math.random() < 0.45) setTimeout(() => pop(false), 20 + Math.random() * 90)
    if (Math.random() < 0.08) pop(true)
    schedule()
  }, 150 + Math.random() * 900)
}

// ── the mechanics (all synthesised) ──
const fxLevel = (): number => 0.35 + 0.65 * (vinyl.level / 100)
/** A burst of noise through a filter with an envelope; the building block of the sounds below. */
function burst(at: number, dur: number, opts: { type: BiquadFilterType; from: number; to?: number; q?: number; gain: number; curve?: number }): void {
  if (!ctx || !fx) return
  const src = ctx.createBufferSource()
  const curve = opts.curve ?? 2
  src.buffer = noiseBuffer(ctx, dur, (i, n) => white() * Math.pow(1 - i / n, curve))
  const f = ctx.createBiquadFilter()
  f.type = opts.type
  f.Q.value = opts.q ?? 0.9
  f.frequency.setValueAtTime(opts.from, at)
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, at + dur)
  const g = ctx.createGain()
  g.gain.value = opts.gain * fxLevel()
  src.connect(f).connect(g).connect(fx)
  src.start(at)
}
/** The needle lands: a soft low thump, a tick, a small bounce and a moment of rumble. */
function needleDrop(): void {
  if (!ctx || !vinyl.mech) return
  const t = ctx.currentTime + 0.005
  burst(t, 0.16, { type: 'lowpass', from: 220, q: 0.5, gain: 0.9, curve: 3 })
  burst(t, 0.012, { type: 'bandpass', from: 1900, q: 1.2, gain: 0.5, curve: 3 })
  burst(t + 0.07, 0.008, { type: 'bandpass', from: 2600, q: 1.2, gain: 0.25, curve: 3 })
  burst(t + 0.02, 0.5, { type: 'lowpass', from: 140, q: 0.4, gain: 0.35, curve: 1.5 })
}
/** The needle lifts: a short swish of friction and a faint thud as the arm comes to rest. */
function needleLift(): void {
  if (!ctx || !vinyl.mech) return
  const t = ctx.currentTime + 0.005
  burst(t, 0.32, { type: 'bandpass', from: 3400, to: 1300, q: 0.7, gain: 0.22, curve: 1.2 })
  burst(t + 0.3, 0.09, { type: 'lowpass', from: 200, q: 0.5, gain: 0.35, curve: 3 })
}
/** Runs `fn` when the 3D tonearm has really reached the record (down) / left it (up); a fallback timer without the 3D room. */
function onArm(down: boolean, fn: () => void, fallbackMs: number): void {
  const api = mode.value === 'rom' ? room.api : null
  if (!api) { setTimeout(fn, fallbackMs); return }
  const t0 = performance.now()
  const id = window.setInterval(() => {
    const a = api.tonearmAngle()
    if ((down ? a < 0.06 : a > 0.06) || performance.now() - t0 > 2500) { clearInterval(id); fn() }
  }, 30)
}

// ── start / stop ──
function ensureGraph(): AudioContext | null {
  try {
    const audio = ctx ?? newAudioContext()
    ctx = audio
    void audio.resume()
    if (!master || !fx) {
      master = audio.createGain(); master.gain.value = 0; master.connect(audio.destination)
      fx = audio.createGain(); fx.gain.value = 1; fx.connect(audio.destination)
    }
    if (!hissSrc) {
      // brown-ish hiss with the lows taken away: the "surface noise" of a record
      const src = audio.createBufferSource()
      src.buffer = noiseBuffer(audio, 3, white)
      src.loop = true
      const hp = audio.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800
      const lp = audio.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000
      const hg = audio.createGain(); hg.gain.value = 0.010
      src.connect(hp).connect(lp).connect(hg).connect(master)
      // wow & flutter: two slow oscillators nudge the pitch (detune, in cents) of the looped hiss
      flutterLfo = audio.createOscillator(); flutterLfo.frequency.value = 5
      flutterDepth = audio.createGain(); flutterDepth.gain.value = 0
      flutterLfo.connect(flutterDepth).connect(src.detune)
      const wowLfo = audio.createOscillator(); wowLfo.frequency.value = 0.55
      wowDepth = audio.createGain(); wowDepth.gain.value = 0
      wowLfo.connect(wowDepth).connect(src.detune)
      src.start(); flutterLfo.start(); wowLfo.start()
      hissSrc = src
      // the flutter rate drifts between 4 and 6 Hz so it is never a perfect, mechanical wobble
      driftTimer = window.setInterval(() => { if (ctx && flutterLfo) flutterLfo.frequency.setTargetAtTime(4 + Math.random() * 2, ctx.currentTime, 0.8) }, 2500)
    }
    applyWow()
    return audio
  } catch { return null /* no sound available */ }
}
function begin(): void {
  const audio = ensureGraph()
  if (!audio || !master) return
  clearTimeout(fadeTimer)
  active = true
  master.gain.cancelScheduledValues(audio.currentTime)
  master.gain.setValueAtTime(master.gain.value, audio.currentTime)
  // the needle comes down first; the crackle fades in right after it lands
  onArm(true, () => { needleDrop() }, 900)
  master.gain.setTargetAtTime(levelNow(true), audio.currentTime + 0.35, 0.7)
  if (!timer) schedule()
}
function end(): void {
  active = false
  clearTimeout(timer); timer = 0
  if (!ctx || !master) return
  const audio = ctx
  needleLift()
  // between songs the crackle swells for a second (the music is gone, the groove is not) – then it fades out
  master.gain.cancelScheduledValues(audio.currentTime)
  master.gain.setTargetAtTime(levelNow(false) * SWELL, audio.currentTime, 0.12)
  if (!timer) schedule()
  clearTimeout(fadeTimer)
  fadeTimer = window.setTimeout(() => {
    if (active || !ctx || !master) return
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.35)
    clearTimeout(timer); timer = 0
  }, 1000)
}
// only while a record plays on the turntable – not for playlists / songs that belong to the iPod
function shouldPlay(): boolean { return vinyl.on && mode.value === 'rom' && web.status === 'ready' && (!!spotify.now?.playing || trackGap.active) && playOn.value === 'vinyl' }
let armed = false
function sync(): void {
  const want = shouldPlay()
  if (want && !active) {
    // the browser only lets sound start after a tap / click – wait for the first one
    if (ctx?.state === 'running' || armed) begin()
  } else if (!want && active) end()
  else if (want && active) applyLevel(0.4) // (the level setting, or ducking changes) – a new song changes nothing here
}
/** Call once: starts / stops the record player layer as the music does. */
export function useVinylNoise(): void {
  const arm = (): void => { armed = true; sync() }
  window.addEventListener('pointerdown', arm, { once: true, passive: true })
  window.addEventListener('keydown', arm, { once: true })
  // the gap between songs is only made while the record layer is on (otherwise a silent hole would be just that)
  setGapWanted(() => vinyl.on && mode.value === 'rom' && playOn.value === 'vinyl')
  watch(() => [vinyl.on, vinyl.mech, mode.value, web.status, spotify.now?.playing, trackGap.active, playOn.value], sync, { immediate: true })
}
