// Encodes PCM audio to MP3 off the main thread.
import { Mp3Encoder } from '@breezystack/lamejs'

const BLOCK = 1152

function toInt16(f32) {
  const out = new Int16Array(f32.length)
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

self.onmessage = ({ data }) => {
  const { channels, sampleRate, kbps = 160 } = data
  const left = toInt16(channels[0])
  const right = channels[1] ? toInt16(channels[1]) : null
  const enc = new Mp3Encoder(right ? 2 : 1, sampleRate, kbps)
  const parts = []
  const total = left.length
  let lastReport = 0
  for (let i = 0; i < total; i += BLOCK) {
    const l = left.subarray(i, i + BLOCK)
    const buf = right ? enc.encodeBuffer(l, right.subarray(i, i + BLOCK)) : enc.encodeBuffer(l)
    if (buf.length) parts.push(new Uint8Array(buf))
    if (i - lastReport > sampleRate) { // report roughly every second of audio
      lastReport = i
      self.postMessage({ progress: i / total })
    }
  }
  const end = enc.flush()
  if (end.length) parts.push(new Uint8Array(end))
  self.postMessage({ done: true, blob: new Blob(parts, { type: 'audio/mpeg' }) })
}
