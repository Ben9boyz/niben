import { reactive, watch } from 'vue'
import { spotify } from './useSpotify'
import { web } from './useWebPlayer'
import { mode } from './useMode'
import { playOn } from './usePlayOn'

// A little vinyl on top of the music: very quiet hiss and now and then a crackle or a pop – you should hardly
// notice it, just feel it. Made with the Web Audio API (no sound files). Only while a song plays HERE (the page
// is the Spotify speaker) and I'm in the 3D room – the music itself comes from Spotify, so this is layered on top.
const KEY = 'niben-vinyl'
// how loud the crackle is: 100 = the old level, the default is half of that (set with the slider by the switch)
const LKEY = 'niben-vinyl-level'
const readLevel = (): number => { try { const raw = localStorage.getItem(LKEY); const n = Number(raw); return raw != null && n >= 0 && n <= 100 ? n : 50 } catch { return 50 } }
export const vinyl = reactive({
  on: (() => { try { return localStorage.getItem(KEY) !== 'off' } catch { return true } })(),
  level: readLevel(),
})
export function setVinylLevel(n: number): void {
  vinyl.level = Math.max(0, Math.min(100, Math.round(n)))
  try { localStorage.setItem(LKEY, String(vinyl.level)) } catch { /* private mode */ }
  if (ctx && master && shouldPlay()) master.gain.setTargetAtTime(vinyl.level / 100, ctx.currentTime, 0.1)
}
export function setVinyl(v: boolean): void { vinyl.on = v; try { localStorage.setItem(KEY, v ? 'on' : 'off') } catch { /* private mode */ } }

let ctx: AudioContext | null = null
let master: GainNode | null = null
let hissSrc: AudioBufferSourceNode | null = null
let timer = 0

function noiseBuffer(audio: AudioContext, seconds: number, fn: (i: number, len: number) => number): AudioBuffer {
  const len = Math.floor(audio.sampleRate * seconds)
  const buf = audio.createBuffer(1, len, audio.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = fn(i, len)
  return buf
}

function pop(loud: boolean): void {
  if (!ctx || !master) return
  // a tiny click: a short burst of noise with a fast decay, through a band filter
  const dur = loud ? 0.014 : 0.004 + Math.random() * 0.006
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, dur, (i, n) => (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3))
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

function start(): void {
  if (ctx?.state === 'running' && hissSrc) return
  try {
    const Ctor = window.AudioContext ?? window.webkitAudioContext
    const audio = ctx ?? new Ctor()
    ctx = audio
    void audio.resume()
    if (!master) {
      master = audio.createGain()
      master.gain.value = 0
      master.connect(audio.destination)
    }
    if (!hissSrc) {
      // brown-ish hiss with the lows taken away: the "surface noise" of a record
      const src = audio.createBufferSource()
      src.buffer = noiseBuffer(audio, 3, () => Math.random() * 2 - 1)
      src.loop = true
      const hp = audio.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800
      const lp = audio.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000
      const hg = audio.createGain(); hg.gain.value = 0.010
      src.connect(hp).connect(lp).connect(hg).connect(master)
      src.start()
      hissSrc = src
    }
    master.gain.cancelScheduledValues(audio.currentTime)
    master.gain.setTargetAtTime(vinyl.level / 100, audio.currentTime, 1.2)
    if (!timer) schedule()
  } catch { /* no sound available */ }
}
function stop(): void {
  clearTimeout(timer); timer = 0
  if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.4)
}

// only while a record plays on the turntable – not for playlists / songs that belong to the iPod
function shouldPlay(): boolean { return vinyl.on && mode.value === 'rom' && web.status === 'ready' && !!spotify.now?.playing && playOn.value === 'vinyl' }
let armed = false
function sync(): void {
  if (shouldPlay()) {
    // the browser only lets sound start after a tap / click – wait for the first one
    if (ctx?.state === 'running' || armed) start()
  } else stop()
}
/** Call once: starts / stops the surface noise as the music does. */
export function useVinylNoise(): void {
  const arm = (): void => { armed = true; sync() }
  window.addEventListener('pointerdown', arm, { once: true, passive: true })
  window.addEventListener('keydown', arm, { once: true })
  watch(() => [vinyl.on, mode.value, web.status, spotify.now?.playing, playOn.value], sync, { immediate: true })
}
