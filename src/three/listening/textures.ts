import * as THREE from 'three'
import type { Album } from '../../types'
import { canvasTex, wrapText } from '../textures'
import type { ShelfAlbum } from './constants'

// Pictures drawn for the records: the average colour of a cover, a spine and a placeholder cover, the grooves of the vinyl.
export function averageColor(img: CanvasImageSource): string | null {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 8
    const x = c.getContext('2d', { willReadFrequently: true })
    if (!x) return null
    x.drawImage(img, 0, 0, 8, 8)
    const d = x.getImageData(0, 0, 8, 8).data
    let r = 0, g = 0, b = 0
    for (let i = 0; i < d.length; i += 4) { r += d[i] ?? 0; g += d[i + 1] ?? 0; b += d[i + 2] ?? 0 }
    const n = d.length / 4
    return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`
  } catch {
    return null
  }
}

export function spineTex(album: Album, color: string): THREE.CanvasTexture {
  return canvasTex(32, 512, (x, w, h) => {
    x.fillStyle = color
    x.fillRect(0, 0, w, h)
    // subtle edge shading so neighbouring spines read as separate records
    const g = x.createLinearGradient(0, 0, w, 0)
    g.addColorStop(0, 'rgba(0,0,0,0.35)')
    g.addColorStop(0.2, 'rgba(0,0,0,0)')
    g.addColorStop(0.8, 'rgba(255,255,255,0.06)')
    g.addColorStop(1, 'rgba(0,0,0,0.3)')
    x.fillStyle = g
    x.fillRect(0, 0, w, h)
    const m = color.match(/\d+/g)?.map(Number) ?? [60, 60, 60]
    const light = (0.299 * (m[0] ?? 0) + 0.587 * (m[1] ?? 0) + 0.114 * (m[2] ?? 0)) / 255 > 0.6
    x.save()
    x.translate(w / 2, h / 2)
    x.rotate(Math.PI / 2)
    x.fillStyle = light ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)'
    x.font = '700 15px Inter, sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    let t = `${album.name}  ·  ${album.artist || ''}`
    while (x.measureText(t).width > h - 30 && t.length > 4) t = t.slice(0, -2)
    x.fillText(t, 0, 1)
    x.restore()
  })
}

export function placeholderCover(album: ShelfAlbum): THREE.CanvasTexture {
  return canvasTex(256, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, album.color || '#3a4a6b')
    g.addColorStop(1, '#10151f')
    x.fillStyle = g
    x.fillRect(0, 0, w, h)
    x.fillStyle = '#fff'
    x.textAlign = 'center'
    x.font = '700 26px "Inter Tight", Inter, sans-serif'
    wrapText(x, album.name, w / 2, h / 2 - 10, 210, 30, 3)
    x.globalAlpha = 0.7
    x.font = '500 16px Inter, sans-serif'
    x.fillText(album.artist || '', w / 2, h - 30)
  })
}

export function grooves(): THREE.CanvasTexture {
  return canvasTex(512, 512, (x, w) => {
    const c = w / 2
    x.fillStyle = '#0c0c0e'
    x.fillRect(0, 0, w, w)
    for (let r = 70; r < c - 4; r += 2.2) {
      x.strokeStyle = `rgba(255,255,255,${0.03 + ((r * 7) % 5) / 100})`
      x.lineWidth = 0.8
      x.beginPath()
      x.arc(c, c, r, 0, Math.PI * 2)
      x.stroke()
    }
    const g = x.createLinearGradient(0, 0, w, w)
    g.addColorStop(0.35, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.08)')
    g.addColorStop(0.65, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, w, w)
  })
}

// The iPod's own screen in the room (on its stand): the same "now playing" view as the iPod in hand –
