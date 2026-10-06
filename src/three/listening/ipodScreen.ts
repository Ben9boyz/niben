import type { NowPlaying } from '../../types'

export const fmt = (ms: number): string => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`
export function fitText(x: CanvasRenderingContext2D, text: string | null | undefined, maxW: number): string {
  let t = text ?? ''
  if (x.measureText(t).width <= maxW) return t
  while (t.length > 1 && x.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}
export function drawIpodScreen(ctx: CanvasRenderingContext2D, w: number, h: number, now: NowPlaying | null, art: HTMLImageElement | null, progressMs: number): void {
  const x = ctx
  const u = h / 100
  x.fillStyle = '#eef3f8'
  x.fillRect(0, 0, w, h)
  // header bar
  const tb = x.createLinearGradient(0, 0, 0, 13 * u)
  tb.addColorStop(0, '#fefefe')
  tb.addColorStop(1, '#ccd4dd')
  x.fillStyle = tb
  x.fillRect(0, 0, w, 13 * u)
  x.fillStyle = '#a9b3bf'
  x.fillRect(0, 13 * u - 1, w, 1)
  x.fillStyle = '#111'
  x.font = `700 ${6.4 * u}px Inter, -apple-system, sans-serif`
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(now?.name ? (now.playing ? 'Spilles nå' : 'Pause') : 'iPod', w / 2, 6.8 * u)
  if (now?.shuffle) {
    // small shuffle mark at the left of the header
    x.strokeStyle = '#2b7ff0'
    x.lineWidth = 0.9 * u
    x.lineCap = 'round'
    const sx = 5 * u, sy = 6.8 * u, d = 2.2 * u
    x.beginPath(); x.moveTo(sx, sy - d); x.bezierCurveTo(sx + 2.5 * u, sy - d, sx + 2.5 * u, sy + d, sx + 5 * u, sy + d); x.stroke()
    x.beginPath(); x.moveTo(sx, sy + d); x.bezierCurveTo(sx + 2.5 * u, sy + d, sx + 2.5 * u, sy - d, sx + 5 * u, sy - d); x.stroke()
  }
  if (now?.playing) {
    x.fillStyle = '#1db954'
    x.beginPath(); x.moveTo(w - 9 * u, 4.3 * u); x.lineTo(w - 9 * u, 9.3 * u); x.lineTo(w - 4.8 * u, 6.8 * u); x.fill()
  }
  if (!now?.name) {
    x.font = `600 ${6.4 * u}px Inter, -apple-system, sans-serif`
    x.fillStyle = '#556'
    x.fillText('Spillelister ›', w / 2, 55 * u)
    return
  }
  // cover
  const pad = 4 * u
  const aw = w * 0.42 - pad
  const ay = 13 * u + pad
  const ah = Math.min(aw, h - ay - 22 * u)
  x.save()
  x.shadowColor = 'rgba(0,0,0,0.25)'
  x.shadowBlur = 2 * u
  x.shadowOffsetY = u
  if (art) x.drawImage(art, pad, ay, ah, ah)
  else { x.fillStyle = '#c9d1db'; x.fillRect(pad, ay, ah, ah) }
  x.restore()
  // text
  const tx = pad + ah + 3 * u
  const tw = w - tx - pad
  x.textAlign = 'left'
  x.textBaseline = 'alphabetic'
  x.fillStyle = '#111'
  x.font = `700 ${6.6 * u}px Inter, -apple-system, sans-serif`
  x.fillText(fitText(x, now.name, tw), tx, ay + ah * 0.38)
  x.font = `500 ${5.4 * u}px Inter, -apple-system, sans-serif`
  x.fillStyle = '#445'
  x.fillText(fitText(x, now.artist, tw), tx, ay + ah * 0.38 + 7.5 * u)
  x.fillStyle = '#778'
  x.fillText(fitText(x, now.album, tw), tx, ay + ah * 0.38 + 14 * u)
  // progress
  if (now.duration_ms) {
    const by = h - 15 * u
    const bw = w - pad * 2
    const r = 1.1 * u
    x.fillStyle = '#cfd6de'
    x.beginPath(); x.roundRect(pad, by, bw, 2.2 * u, r); x.fill()
    const g = x.createLinearGradient(0, by, 0, by + 2.2 * u)
    g.addColorStop(0, '#6cbcff'); g.addColorStop(1, '#2b7ff0')
    x.fillStyle = g
    x.beginPath(); x.roundRect(pad, by, Math.max(2 * r, bw * Math.min(1, progressMs / now.duration_ms)), 2.2 * u, r); x.fill()
    x.fillStyle = '#556'
    x.font = `500 ${4.8 * u}px Inter, -apple-system, sans-serif`
    x.fillText(fmt(progressMs), pad, by + 9 * u)
    x.textAlign = 'right'
    x.fillText('-' + fmt(Math.max(0, now.duration_ms - progressMs)), w - pad, by + 9 * u)
  }
}

