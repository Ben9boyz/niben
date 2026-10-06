export function hash01(seed: unknown): number { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } return ((h >>> 0) % 100000) / 100000 }
/** How worn a record looks: old albums a lot, new ones hardly at all (by the release year; unknown = middle). */
export function wearAmount(album: { year?: string } | null | undefined): number {
  const y = parseInt(album?.year ?? '', 10)
  if (!y) return 0.45
  const age = new Date().getFullYear() - y
  return Math.max(0.08, Math.min(1, (age - 1) / 45))
}
export function wearSleeve(x: CanvasRenderingContext2D, x0: number, y0: number, size: number, seed: string, amount = 1): void {
  const R = (k: string): number => hash01(seed + ':' + k)
  x.save()
  x.beginPath(); x.rect(x0, y0, size, size); x.clip()
  // yellowed, dirty edges
  const vg = x.createRadialGradient(x0 + size / 2, y0 + size / 2, size * 0.34, x0 + size / 2, y0 + size / 2, size * 0.72)
  vg.addColorStop(0, 'rgba(90,70,40,0)'); vg.addColorStop(1, `rgba(90,70,40,${0.11 * amount})`)
  x.fillStyle = vg; x.fillRect(x0, y0, size, size)
  // scuffed edges: short pale strokes along the sides, more at the corners
  for (let i = 0; i < Math.round(8 + 50 * amount); i++) {
    const side = Math.floor(R('s' + i) * 4), t = R('t' + i), len = size * (0.01 + R('l' + i) * 0.045), off = size * R('o' + i) * 0.012
    x.strokeStyle = `rgba(240,236,226,${(0.1 + R('a' + i) * 0.22) * amount})`
    x.lineWidth = 1 + R('w' + i) * size * 0.003
    x.beginPath()
    if (side === 0) { x.moveTo(x0 + t * size, y0 + off); x.lineTo(x0 + t * size + len * (R('d' + i) - 0.5), y0 + off + len) }
    else if (side === 1) { x.moveTo(x0 + t * size, y0 + size - off); x.lineTo(x0 + t * size + len * (R('d' + i) - 0.5), y0 + size - off - len) }
    else if (side === 2) { x.moveTo(x0 + off, y0 + t * size); x.lineTo(x0 + off + len, y0 + t * size + len * (R('d' + i) - 0.5)) }
    else { x.moveTo(x0 + size - off, y0 + t * size); x.lineTo(x0 + size - off - len, y0 + t * size + len * (R('d' + i) - 0.5)) }
    x.stroke()
  }
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { // corners rubbed through to the cardboard
    const k = R('c' + cx + cy)
    if (k < 0.45 + (1 - amount) * 0.4) continue
    const g = x.createRadialGradient(x0 + cx * size, y0 + cy * size, 0, x0 + cx * size, y0 + cy * size, size * (0.025 + k * 0.035))
    g.addColorStop(0, `rgba(226,218,200,${0.6 * amount})`); g.addColorStop(1, 'rgba(226,218,200,0)')
    x.fillStyle = g; x.fillRect(x0, y0, size, size)
  }
  // specks and fine scratches
  for (let i = 0; i < Math.round(160 * amount); i++) { x.fillStyle = `rgba(${R('v' + i) < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + R('q' + i) * 0.12 * amount})`; x.fillRect(x0 + R('x' + i) * size, y0 + R('y' + i) * size, 1 + R('z' + i) * 2.5, 1 + R('u' + i) * 2.5) }
  x.restore()
}

// a GLB loader that decodes the pictures with plain <img> elements (the default ImageBitmap path failed on some textures in some browsers)
