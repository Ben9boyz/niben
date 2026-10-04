// Helpers for guitar recordings: read the recording date from the file and turn video into MP3.

const MAC_EPOCH = Date.UTC(1904, 0, 1) // QuickTime/MP4 timestamps count from 1904

async function readBox(file, offset) {
  const head = new DataView(await file.slice(offset, offset + 16).arrayBuffer())
  if (head.byteLength < 8) return null
  let size = head.getUint32(0)
  const type = String.fromCharCode(head.getUint8(4), head.getUint8(5), head.getUint8(6), head.getUint8(7))
  if (size === 1 && head.byteLength >= 16) size = Number(head.getBigUint64(8))
  else if (size === 0) size = file.size - offset
  return { type, size }
}

/** Finds the 'moov' box of an MP4/MOV/M4A file without reading the whole (possibly huge) file. */
async function readMoov(file) {
  let offset = 0
  for (let n = 0; n < 64 && offset < file.size; n++) {
    const box = await readBox(file, offset)
    if (!box || box.size < 8) return null
    if (box.type === 'moov') {
      if (box.size > 64 * 1024 * 1024) return null
      return new Uint8Array(await file.slice(offset, offset + box.size).arrayBuffer())
    }
    offset += box.size
  }
  return null
}

function isoDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return null
  const y = d.getFullYear()
  if (y < 1990 || y > 2200) return null
  return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Best guess at when a recording was made:
 *  1. Apple's "com.apple.quicktime.creationdate" (local time; iPhone videos and voice memos)
 *  2. the MP4 'mvhd' creation time
 *  3. the file's last-modified date
 * Returns { date: 'YYYY-MM-DD' | null, source: 'video' | 'file' | null }.
 */
export async function recordingDate(file) {
  try {
    const name = file.name.toLowerCase()
    if (/\.(mp4|mov|m4v|m4a|3gp)$/.test(name) || /^(video|audio)\/(mp4|quicktime|x-m4a|3gpp)/.test(file.type)) {
      const moov = await readMoov(file)
      if (moov) {
        const text = new TextDecoder('latin1').decode(moov)
        if (text.includes('com.apple.quicktime.creationdate')) {
          const m = text.match(/(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}/)
          if (m) return { date: m[1], source: 'video' }
        }
        const i = text.indexOf('mvhd')
        if (i > 0) {
          const v = new DataView(moov.buffer, moov.byteOffset + i + 4)
          const secs = v.getUint8(0) === 1 ? Number(v.getBigUint64(4)) : v.getUint32(4)
          const d = secs > 0 ? isoDate(new Date(MAC_EPOCH + secs * 1000)) : null
          if (d) return { date: d, source: 'video' }
        }
      }
    }
  } catch {
    // fall back to the file date
  }
  const d = isoDate(new Date(file.lastModified))
  return d ? { date: d, source: 'file' } : { date: null, source: null }
}

/** Files we turn into MP3 before uploading: any video, plus large uncompressed audio. */
export function needsMp3(file) {
  const n = file.name.toLowerCase()
  return file.type.startsWith('video/') || /\.(mp4|mov|m4v|3gp|webm|wav|aif|aiff)$/.test(n)
}

/**
 * Extracts the audio track (works for MP4/MOV video too) and encodes it as MP3.
 * onProgress(stage, fraction) – stage is 'read' | 'decode' | 'encode'.
 */
export async function toMp3(file, onProgress = () => {}) {
  onProgress('read', 0)
  const buf = await file.arrayBuffer()
  onProgress('decode', 0)
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = new Ctx({ sampleRate: 44100 })
  let audio
  try {
    audio = await ctx.decodeAudioData(buf)
  } catch {
    // The browser can't read this container/codec (common for QuickTime .mov from a Mac):
    // fall back to ffmpeg compiled to WebAssembly, which reads practically anything.
    return ffmpegToMp3(file, onProgress)
  } finally {
    ctx.close?.()
  }
  const channels = [audio.getChannelData(0)]
  if (audio.numberOfChannels > 1) channels.push(audio.getChannelData(1))

  const worker = new Worker(new URL('../workers/mp3Worker.js', import.meta.url), { type: 'module' })
  try {
    const blob = await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        if (data.done) resolve(data.blob)
        else onProgress('encode', data.progress)
      }
      worker.onerror = (e) => reject(new Error('MP3-konverteringen feilet: ' + (e.message || 'ukjent feil')))
      worker.postMessage({ channels, sampleRate: audio.sampleRate, kbps: 160 })
    })
    onProgress('encode', 1)
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.mp3', { type: 'audio/mpeg', lastModified: file.lastModified })
  } finally {
    worker.terminate()
  }
}

// ── ffmpeg.wasm fallback ────────────────────────────────────
const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'
let ffmpegPromise = null

async function loadFfmpeg(onProgress) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')])
      const ff = new FFmpeg()
      await ff.load({
        coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, 'text/javascript'),
        // (no download progress: the CDN doesn't always send Content-Length, which toBlobURL needs for it)
        wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      return ff
    })().catch((e) => {
      ffmpegPromise = null
      throw e
    })
  }
  return ffmpegPromise
}

async function ffmpegToMp3(file, onProgress) {
  onProgress('load', 0)
  let ff
  try {
    ff = await loadFfmpeg(onProgress)
  } catch (e) {
    console.error('ffmpeg load failed', e)
    throw new Error(`Kunne ikke laste lydverktøyet (ffmpeg): ${e?.message || e}`)
  }
  const ext = (file.name.split('.').pop() || 'mov').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mov'
  const input = `input.${ext}`
  const onProg = ({ progress }) => onProgress('encode', Math.max(0, Math.min(1, progress || 0)))
  ff.on('progress', onProg)
  try {
    await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()))
    onProgress('encode', 0)
    const code = await ff.exec(['-i', input, '-vn', '-ac', '2', '-ar', '44100', '-b:a', '160k', 'out.mp3'])
    if (code !== 0) throw new Error('ffmpeg exit ' + code)
    const data = await ff.readFile('out.mp3')
    onProgress('encode', 1)
    return new File([data], file.name.replace(/\.\w+$/, '') + '.mp3', { type: 'audio/mpeg', lastModified: file.lastModified })
  } catch {
    throw new Error('Fant ingen lyd i filen. Har videoen lyd?')
  } finally {
    ff.off('progress', onProg)
    try { await ff.deleteFile(input) } catch {}
    try { await ff.deleteFile('out.mp3') } catch {}
  }
}
