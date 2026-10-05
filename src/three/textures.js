import * as THREE from 'three'

export function canvasTex(w, h, draw, { srgb = true, repeat } = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(...repeat)
  }
  return t
}

function rand(seed) {
  let s = seed
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296
}

export function woodFloor() {
  const r = rand(7)
  return canvasTex(1024, 1024, (x, w, h) => {
    const rows = 8
    const ph = h / rows
    for (let i = 0; i < rows; i++) {
      let px = -r() * 400
      while (px < w) {
        const len = 380 + r() * 320
        const tone = 0.92 + r() * 0.1
        x.fillStyle = `rgb(${Math.round(214 * tone)},${Math.round(178 * tone)},${Math.round(134 * tone)})`
        x.fillRect(px, i * ph, len, ph)
        // grain
        for (let g = 0; g < 14; g++) {
          x.strokeStyle = `rgba(120,80,40,${0.04 + r() * 0.07})`
          x.lineWidth = 1 + r() * 1.5
          x.beginPath()
          const y0 = i * ph + r() * ph
          x.moveTo(px, y0)
          x.bezierCurveTo(px + len * 0.3, y0 + (r() - 0.5) * 10, px + len * 0.6, y0 + (r() - 0.5) * 10, px + len, y0 + (r() - 0.5) * 6)
          x.stroke()
        }
        x.fillStyle = 'rgba(80,50,25,0.35)'
        x.fillRect(px, i * ph, 2, ph)
        px += len
      }
      x.fillStyle = 'rgba(80,50,25,0.3)'
      x.fillRect(0, i * ph, w, 2)
    }
  }, { repeat: [2.2, 2.2] })
}

export function wallTexture() {
  const r = rand(3)
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#ffffff'
    x.fillRect(0, 0, w, h)
    for (let i = 0; i < 9000; i++) {
      x.fillStyle = `rgba(0,0,0,${r() * 0.025})`
      x.fillRect(r() * w, r() * h, 1.5, 1.5)
    }
  }, { repeat: [4, 2] })
}

export function skyTexture(night, kind = 'clear') {
  const r = rand(11)
  const grey = ['cloud', 'rain', 'drizzle', 'thunder', 'snow', 'fog'].includes(kind)
  const heavy = ['rain', 'thunder', 'drizzle'].includes(kind)
  return canvasTex(256, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h)
    if (grey && night) {
      g.addColorStop(0, '#0b1020'); g.addColorStop(0.7, '#1a2338'); g.addColorStop(1, '#2c3a52')
    } else if (grey) {
      if (heavy) { g.addColorStop(0, '#6c7685'); g.addColorStop(0.65, '#8f99a8'); g.addColorStop(1, '#b4bcc7') }
      else if (kind === 'fog') { g.addColorStop(0, '#c9d0d9'); g.addColorStop(1, '#e6eaef') }
      else { g.addColorStop(0, '#9aa7b8'); g.addColorStop(0.65, '#c3ccd8'); g.addColorStop(1, '#e1e6ee') }
    } else if (night) {
      g.addColorStop(0, '#050b1e')
      g.addColorStop(0.7, '#0f2550')
      g.addColorStop(1, '#2a4f8a')
    } else {
      g.addColorStop(0, '#6fb8ff')
      g.addColorStop(0.65, '#bfe3ff')
      g.addColorStop(1, '#f2f8ff')
    }
    x.fillStyle = g
    x.fillRect(0, 0, w, h)
    if (grey) {
      // heavy cloud cover: soft grey blobs all over
      for (let i = 0; i < (kind === 'fog' ? 6 : 26); i++) {
        x.fillStyle = night ? `rgba(60,72,95,${0.25 + r() * 0.3})` : heavy ? `rgba(95,104,118,${0.25 + r() * 0.35})` : `rgba(235,240,248,${0.35 + r() * 0.4})`
        x.beginPath(); x.arc(r() * w, r() * h * 0.75, 18 + r() * 34, 0, Math.PI * 2); x.fill()
      }
    } else if (night) {
      for (let i = 0; i < 70; i++) {
        x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`
        x.beginPath()
        x.arc(r() * w, r() * h * 0.7, r() * 1.2 + 0.3, 0, Math.PI * 2)
        x.fill()
      }
      x.fillStyle = '#f4f1e0'
      x.beginPath()
      x.arc(190, 60, 16, 0, Math.PI * 2)
      x.fill()
    } else {
      x.fillStyle = 'rgba(255,255,255,0.85)'
      ;[[60, 70, 30], [95, 62, 24], [125, 72, 20], [180, 120, 18], [205, 114, 22]].forEach(([cx, cy, rr]) => {
        x.beginPath(); x.arc(cx, cy, rr, 0, Math.PI * 2); x.fill()
      })
    }
    // distant hills
    x.fillStyle = night ? '#0a1730' : grey ? '#8fa89c' : '#9cc7b4'
    x.beginPath()
    x.moveTo(0, h)
    for (let i = 0; i <= 16; i++) x.lineTo((i / 16) * w, h * 0.8 - Math.sin(i * 0.9) * 14 - r() * 10)
    x.lineTo(w, h)
    x.fill()
  })
}

export function wrapText(ctx, text, x, y, maxW, lh, maxLines = 99) {
  const words = String(text || '').split(/\s+/)
  let line = ''
  let n = 0
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + n * lh)
      n++
      line = w
      if (n >= maxLines) return n
    } else line = test
  }
  if (line) { ctx.fillText(line, x, y + n * lh); n++ }
  return n
}

export function hash(str) {
  let h = 2166136261
  for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

export function shade(hex, amt) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))))
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function luminance(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}
