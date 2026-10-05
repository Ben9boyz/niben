// Encodes PCM audio to MP3 off the main thread.
import { Mp3Encoder } from '@breezystack/lamejs'
import type { Mp3Job, Mp3Reply } from '../lib/media'

const BLOCK = 1152

function toInt16(f32: Float32Array): Int16Array {
  const out = new Int16Array(f32.length)
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i] ?? 0))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

const reply = (m: Mp3Reply): void => { self.postMessage(m) }

self.onmessage = ({ data }: MessageEvent<Mp3Job>) => {
  const { channels, sampleRate, kbps = 160 } = data
  const first = channels[0]
  if (!first) return
  const left = toInt16(first)
  const second = channels[1]
  const right = second ? toInt16(second) : null
  const enc = new Mp3Encoder(right ? 2 : 1, sampleRate, kbps)
  const parts: Uint8Array[] = []
  const total = left.length
  let lastReport = 0
  for (let i = 0; i < total; i += BLOCK) {
    const l = left.subarray(i, i + BLOCK)
    const buf = right ? enc.encodeBuffer(l, right.subarray(i, i + BLOCK)) : enc.encodeBuffer(l)
    if (buf.length) parts.push(new Uint8Array(buf))
    if (i - lastReport > sampleRate) { // report roughly every second of audio
      lastReport = i
      reply({ done: false, progress: i / total })
    }
  }
  const end = enc.flush()
  if (end.length) parts.push(new Uint8Array(end))
  reply({ done: true, blob: new Blob(parts as BlobPart[], { type: 'audio/mpeg' }) })
}
