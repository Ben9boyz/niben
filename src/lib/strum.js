// Hearing a song: the chords strummed in the song's pattern (a small synthesised guitar), and a metronome.
// Web Audio only – nothing to download. The pattern has one character per slot in a bar of 4 beats
// (8 characters = eighth notes): D = down, U = up, X = muted chuck, - = nothing.
import { findChord } from './chords'

const OPEN = [40, 45, 50, 55, 59, 64] // E2 A2 D3 G3 B3 E4
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 }
const QUALITY = [
  [/^(maj7|M7|Δ)/, [0, 4, 7, 11]], [/^m7b5|^ø/, [0, 3, 6, 10]], [/^(m7|min7|-7)/, [0, 3, 7, 10]], [/^(m6)/, [0, 3, 7, 9]],
  [/^(m|min|-)/, [0, 3, 7]], [/^7sus4/, [0, 5, 7, 10]], [/^(sus2)/, [0, 2, 7]], [/^(sus4|sus)/, [0, 5, 7]],
  [/^(dim|°)/, [0, 3, 6]], [/^(aug|\+)/, [0, 4, 8]], [/^5/, [0, 7]], [/^add9/, [0, 4, 7, 14]], [/^9/, [0, 4, 7, 10, 14]],
  [/^7/, [0, 4, 7, 10]], [/^6/, [0, 4, 7, 9]], [/^/, [0, 4, 7]],
]

/** The notes (MIDI, low → high) a guitar plays for a chord: the real shape when it's in the library, else a voicing. */
export function chordMidi(name, capo = 0) {
  const shape = findChord(name)
  if (shape) return shape.frets.map((f, i) => (f === null ? null : OPEN[i] + f + capo)).filter((n) => n !== null)
  const m = /^([A-H])([#b]?)(.*?)(?:\/([A-H][#b]?))?$/.exec(String(name || '').trim())
  if (!m) return []
  const root = (NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12
  const ints = QUALITY.find(([re]) => re.test(m[3]))[1]
  const bassPc = m[4] ? (NOTE[m[4][0]] + (m[4][1] === '#' ? 1 : m[4][1] === 'b' ? -1 : 0) + 12) % 12 : root
  const bass = 40 + ((bassPc - 4 + 12) % 12) // between E2 and D#3
  const top = []
  let n = bass + 7
  for (const i of [...ints, ...ints.map((x) => x + 12)]) { const want = root + i; while (n % 12 !== ((want % 12) + 12) % 12) n++; top.push(n); n++; if (top.length >= 5) break }
  return [bass, ...top].map((x) => x + capo)
}

let ctx = null
let master = null
function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createDynamicsCompressor()
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)

// one plucked string: a bright tone that darkens and fades like a guitar
function pluck(midi, t, vel = 1, len = 1.6) {
  const c = ctx
  const g = c.createGain()
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.setValueAtTime(Math.min(6000, hz(midi) * 9), t)
  f.frequency.exponentialRampToValueAtTime(Math.max(300, hz(midi) * 2), t + 0.35)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  for (const [type, detune, amt] of [['sawtooth', 0, 0.6], ['triangle', 5, 1]]) {
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = hz(midi)
    o.detune.value = detune
    const og = c.createGain()
    og.gain.value = amt
    o.connect(og).connect(f)
    o.start(t)
    o.stop(t + len + 0.05)
  }
  f.connect(g).connect(master)
}
// a muted chuck: a short noisy click
function chuck(t) {
  const c = ctx
  const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const s = c.createBufferSource()
  s.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 1800
  const g = c.createGain()
  g.gain.value = 0.35
  s.connect(f).connect(g).connect(master)
  s.start(t)
}
function click(t, accent) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.frequency.value = accent ? 1600 : 1050
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + 0.06)
}
function strumAt(notes, t, dir, slotLen) {
  if (dir === 'X') { chuck(t); return }
  const list = dir === 'U' ? [...notes].reverse().slice(0, 4) : notes
  const len = Math.max(0.5, slotLen * 3)
  list.forEach((n, i) => pluck(n, t + i * (dir === 'U' ? 0.008 : 0.012), dir === 'U' ? 0.6 : 1 - i * 0.04, len))
}

/**
 * Plays chords in a pattern. opts: { chords: ['G','D',…], pattern: 'D-DU-UDU', bpm, beatsPerChord, capo,
 * strum: true|false, click: true|false, onStep({ chord, slot, beat }) }. Returns { stop, set(opts) }.
 */
export function playSong(opts) {
  audio()
  let o = { pattern: 'D-D-D-D-', bpm: 80, beatsPerChord: 4, capo: 0, strum: true, click: false, ...opts }
  let next = ctx.currentTime + 0.1
  let step = 0 // slot counter since start
  const notesCache = new Map()
  const notesOf = (name) => { if (!notesCache.has(name)) notesCache.set(name, chordMidi(name, o.capo)); return notesCache.get(name) }
  const timers = []
  const tick = () => {
    const pat = (o.pattern || 'D---').toUpperCase()
    const perBeat = Math.max(1, pat.length / 4) // slots per beat
    const slotLen = 60 / o.bpm / perBeat
    while (next < ctx.currentTime + 0.12) {
      const slot = step % pat.length
      const beat = Math.floor(step / perBeat)
      const chordIdx = o.chords.length ? Math.floor(beat / o.beatsPerChord) % o.chords.length : -1
      const chord = o.chords[chordIdx]
      if (o.strum && chord && pat[slot] !== '-') strumAt(notesOf(chord), next, pat[slot], slotLen)
      if (o.click && step % perBeat === 0) click(next, beat % 4 === 0)
      const at = next
      const info = { chord: chordIdx, slot, beat }
      timers.push(setTimeout(() => o.onStep?.(info), Math.max(0, (at - ctx.currentTime) * 1000)))
      next += slotLen
      step++
    }
    if (timers.length > 64) timers.splice(0, timers.length - 64)
  }
  tick()
  const iv = setInterval(tick, 25)
  return {
    stop() { clearInterval(iv); timers.forEach(clearTimeout) },
    set(p) { if (p.capo !== undefined && p.capo !== o.capo) notesCache.clear(); if (p.chords) notesCache.clear(); o = { ...o, ...p } },
  }
}

/** Common strumming patterns (eighth notes in 4/4). */
export const PATTERNS = [
  ['D-D-D-D-', 'Fire ned'],
  ['D-DUD-DU', 'Pop'],
  ['D-DU-UDU', 'Den vanligste'],
  ['D-DU-U-U', 'Folk'],
  ['DUDUDUDU', 'Åttendeler'],
  ['D-X-D-X-', 'Med demping'],
  ['D--UXUDU', 'Funk-aktig'],
]
