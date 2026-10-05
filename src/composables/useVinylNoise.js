import { reactive, watch } from 'vue'
import { spotify } from './useSpotify'
import { web } from './useWebPlayer'
import { mode } from './useMode'

// A little vinyl on top of the music: very quiet hiss and now and then a crackle or a pop – you should hardly
// notice it, just feel it. Made with the Web Audio API (no sound files). Only while a song plays HERE (the page
// is the Spotify speaker) and I'm in the 3D room – the music itself comes from Spotify, so this is layered on top.
const KEY = 'niben-vinyl'
export const vinyl = reactive({ on: (() => { try { return localStorage.getItem(KEY) !== 'off' } catch { return true } })() })
export function setVinyl(v) { vinyl.on = v; try { localStorage.setItem(KEY, v ? 'on' : 'off') } catch {} }

let ctx = null
let master = null
let hissSrc = null
let timer = 0

function noiseBuffer(seconds, fn) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = fn(i, len)
  return buf
}

function pop(loud) {
  if (!ctx || !master) return
  // a tiny click: a short burst of noise with a fast decay, through a band filter
  const dur = loud ? 0.014 : 0.004 + Math.random() * 0.006
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(dur, (i, n) => (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3))
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = loud ? 1400 + Math.random() * 1200 : 2500 + Math.random() * 4000
  f.Q.value = 0.8
  const g = ctx.createGain()
  g.gain.value = loud ? 0.22 : 0.04 + Math.random() * 0.1
  src.connect(f).connect(g).connect(master)
  src.start()
}
function schedule() {
  // on average ~2 crackles a second, a pop every ~12 seconds
  timer = setTimeout(() => {
    pop(false)
    if (Math.random() < 0.45) setTimeout(() => pop(false), 20 + Math.random() * 90)
    if (Math.random() < 0.08) pop(true)
    schedule()
  }, 150 + Math.random() * 900)
}

function start() {
  if (ctx?.state === 'running' && hissSrc) return
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)()
    ctx.resume?.()
    if (!master) {
      master = ctx.createGain()
      master.gain.value = 0
      master.connect(ctx.destination)
    }
    if (!hissSrc) {
      // brown-ish hiss with the lows taken away: the "surface noise" of a record
      hissSrc = ctx.createBufferSource()
      hissSrc.buffer = noiseBuffer(3, () => Math.random() * 2 - 1)
      hissSrc.loop = true
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000
      const hg = ctx.createGain(); hg.gain.value = 0.010
      hissSrc.connect(hp).connect(lp).connect(hg).connect(master)
      hissSrc.start()
    }
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setTargetAtTime(1, ctx.currentTime, 1.2)
    if (!timer) schedule()
  } catch {}
}
function stop() {
  clearTimeout(timer); timer = 0
  if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.4)
}

const shouldPlay = () => vinyl.on && mode.value === 'rom' && web.status === 'ready' && !!spotify.now?.playing
let armed = false
function sync() {
  if (shouldPlay()) {
    // the browser only lets sound start after a tap / click – wait for the first one
    if (ctx?.state === 'running' || armed) start()
  } else stop()
}
/** Call once: starts / stops the surface noise as the music does. */
export function useVinylNoise() {
  const arm = () => { armed = true; sync() }
  window.addEventListener('pointerdown', arm, { once: true, passive: true })
  window.addEventListener('keydown', arm, { once: true })
  watch(() => [vinyl.on, mode.value, web.status, spotify.now?.playing], sync, { immediate: true })
}
