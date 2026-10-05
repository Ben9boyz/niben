import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Album, NowPlaying } from '../types'
import { canvasTex, wrapText, context2d } from './textures'
import { meshAdder } from './helpers'

// Listening corner on the back wall:
//  - an open sideboard that works as a record shelf (spines out, one record per saved Spotify album)
//  - a turntable and an iPod classic on top
// Selecting a record pulls it out and floats it in front of the camera; the album that is playing
// lies on top of the sideboard next to the turntable. The iPod can be "picked up" (held in front of the camera).

const SLEEVE = 0.31
const THICK = 0.0095
const SLEEVE_T = 0.0045 // a record sleeve that has left the shelf: thin, like the real thing (the shelf slots are wider)
const DISC_R = 0.147 // the vinyl: a 12-inch disc in a 12.4-inch sleeve
const BOARD_W = 1.295 // the record cabinet (3 × 2 compartments)
const TOP_Y = 0.85 // top of the cabinet
const FRONT_Z = 0.45
// the playing record's sleeve leans against the wall: tilted back LEAN rad, turned a bit towards the room
const LEAN = 0.26
const LEAN_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-LEAN, -Math.PI / 2 - 0.25, 0, 'XYZ'))
const LEAN_UP = (SLEEVE / 2) * Math.cos(LEAN) + 0.002 // centre height above the top
const LEAN_Z = 0.165 - (SLEEVE / 2) * Math.sin(LEAN) // bottom edge ~16 cm from the wall
// the six compartments of the cabinet: 3 columns × 2 rows, top row first (inner x range + the height of the floor)
const COLS: [number, number][] = [[-0.625, -0.2225], [-0.2075, 0.2025], [0.2175, 0.626]]
const FLOORS = [0.433, 0.015]
// the turntable (the model public/models/turntable.glb: a Pioneer, split into base / platter / tonearm): where the platter
// turns and where the tonearm pivots, in the model's own coordinates
const TT_C = { x: -0.0618, z: -0.0055 }
const TT_ARM = { x: 0.141, z: -0.1 }
const COMPARTMENT = FLOORS.flatMap((y) => COLS.map(([a, b]) => ({ x0: a, x1: b, y })))

/** An album as the room draws it: the shelf's colour can be known in advance. */
type ShelfAlbum = Album & { color?: string | null }
/** One entry in the stack of records on the table (the queue first, then what I listened to last). */
export interface StackEntry { uri: string; name?: string; artist?: string; image?: string | null; image_large?: string | null; queued?: boolean }
/** A record on the shelf (or a guest from the search): where it rests and how it sticks out. */
interface ShelfRecord {
  album: ShelfAlbum
  index: number
  color: string
  out: number
  hidden: boolean
  home: THREE.Vector3
  guest?: boolean
  comp?: number
  end?: number
  dz?: number
  yaw?: number
  lean?: number
}
/** A record that has left the shelf: its own mesh, the disc inside and the spring that moves it. */
interface LooseRecord {
  mesh: THREE.Object3D
  rec: ShelfRecord
  disc: THREE.Group
  tint: (col: string) => void
  free: () => void
  vel: THREE.Vector3
  returning: boolean
}
/** A pixel rectangle on the screen. */
export interface ScreenRect { x: number; y: number; w: number; h: number }
interface CoverJob { (img: HTMLImageElement): void; src?: string }
type SpriteData = { phase: number; side: number; sway: number }

function averageColor(img: CanvasImageSource): string | null {
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

function spineTex(album: Album, color: string): THREE.CanvasTexture {
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

function placeholderCover(album: ShelfAlbum): THREE.CanvasTexture {
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

function grooves(): THREE.CanvasTexture {
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
// cover, song, artist, album and a progress bar.
const fmt = (ms: number): string => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`
function fitText(x: CanvasRenderingContext2D, text: string | null | undefined, maxW: number): string {
  let t = text ?? ''
  if (x.measureText(t).width <= maxW) return t
  while (t.length > 1 && x.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}
function drawIpodScreen(ctx: CanvasRenderingContext2D, w: number, h: number, now: NowPlaying | null, art: HTMLImageElement | null, progressMs: number): void {
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

// ── wear: records that have been handled for years – scuffed edges and corners, a pale ring where the vinyl pressed through, specks ──
function hash01(seed: unknown): number { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } return ((h >>> 0) % 100000) / 100000 }
/** How worn a record looks: old albums a lot, new ones hardly at all (by the release year; unknown = middle). */
function wearAmount(album: { year?: string } | null | undefined): number {
  const y = parseInt(album?.year ?? '', 10)
  if (!y) return 0.45
  const age = new Date().getFullYear() - y
  return Math.max(0.08, Math.min(1, (age - 1) / 45))
}
function wearSleeve(x: CanvasRenderingContext2D, x0: number, y0: number, size: number, seed: string, amount = 1): void {
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
function glbLoader(): GLTFLoader {
  const l = new GLTFLoader()
  l.register((parser) => ({ name: 'niben_img', beforeRoot() { parser.textureLoader = new THREE.TextureLoader(parser.options.manager); return null } }))
  return l
}
const warnLoad = (what: string) => (e: unknown): void => console.warn(`niben glb ${what}`, e instanceof Error ? e.message : e)

export function buildListeningCorner() {
  const group = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.45 })
  const inner = new THREE.MeshStandardMaterial({ color: 0xe4e7ec, roughness: 0.7 })
  const wood = new THREE.MeshStandardMaterial({ color: 0xc89b6d, roughness: 0.5 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x18191d, roughness: 0.4, metalness: 0.2 })
  const alu = new THREE.MeshStandardMaterial({ color: 0xd5dae0, roughness: 0.25, metalness: 0.9 })
  const add = meshAdder(group)

  // ── Record cabinet (3 × 2 compartments; the frame is the model public/models/plateskap.glb – the boards below are what shows until it has loaded) ──
  const sideboardStart = group.children.length
  const cabinet = new THREE.Group()
  group.add(cabinet)
  const CAB_Z = 0.255 // centre of the cabinet's depth (front plane at FRONT_Z)
  const CAB_D = 0.39
  const T = 0.015
  ;[-0.64, -0.215, 0.21, 0.641].forEach((x) => add(new THREE.BoxGeometry(T, TOP_Y, CAB_D), wood, x, TOP_Y / 2, CAB_Z, cabinet))
  ;[T / 2, 0.4255, TOP_Y - T / 2].forEach((y) => add(new THREE.BoxGeometry(BOARD_W, T, CAB_D), wood, 0.0005, y, CAB_Z, cabinet))
  add(new THREE.BoxGeometry(BOARD_W, TOP_Y, 0.008), inner, 0.0005, TOP_Y / 2, CAB_Z - CAB_D / 2 + 0.004, cabinet)
  const frameModel = new THREE.Group() // the model's frame (same size as the boards), once it has loaded
  frameModel.position.set(-0.215, 0, CAB_Z)
  group.add(frameModel)
  glbLoader().load('models/plateskap.glb', (g) => {
    g.scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = o.receiveShadow = true; o.userData.kind = 'shelf' } })
    frameModel.add(g.scene)
    cabinet.visible = false
    shelfDirty = true
  }, undefined, warnLoad('plateskap'))
  let shelfDirty = false

  // ── lighting for the records ──
  // a warm spot from above onto the turntable and the sleeve that's playing
  const spot = new THREE.SpotLight(0xffd9a8, 9, 3.2, 0.62, 0.85, 1.6)
  spot.position.set(-0.15, 2.15, 0.95)
  spot.target.position.set(-0.2, TOP_Y, 0.2)
  group.add(spot, spot.target)
  // an LED strip under the top board, washing down over the record spines
  const led = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W - 0.06, 0.008, 0.012), new THREE.MeshBasicMaterial({ color: 0xffe2b8, toneMapped: false }))
  led.position.set(0, TOP_Y - 0.03, FRONT_Z - 0.03) // (under the top board: over the top row of records)
  group.add(led)
  const ledLight = new THREE.RectAreaLight(0xffd9a8, 5, BOARD_W - 0.06, 0.06)
  ledLight.position.copy(led.position)
  ledLight.lookAt(led.position.x, 0, led.position.z - 0.12) // shine down and slightly back onto the spines
  group.add(ledLight)

  // the whole sideboard is clickable ("go to the shelf"), not just the records in it
  cabinet.traverse((m) => { m.userData.kind = 'shelf' })
  frameModel.userData.kind = 'shelf'
  // ── Turntable ──
  const tt = new THREE.Group()
  tt.position.set(-0.38, TOP_Y, 0.24)
  tt.userData = { kind: 'turntable' } // click: pause / play
  group.add(tt)
  add(new RoundedBoxGeometry(0.46, 0.08, 0.36, 3, 0.012), wood, 0, 0.04, 0, tt)
  add(new THREE.CylinderGeometry(0.155, 0.155, 0.016, 64), dark, -0.04, 0.088, 0, tt)
  const platter = new THREE.Group()
  platter.position.set(TT_C.x, 0.111, TT_C.z) // (the platter's centre on the model)
  tt.add(platter)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.004, 96), [
    new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ map: grooves(), roughness: 0.35, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: 0x0c0c0e }),
  ])
  disc.castShadow = true
  // the record on the turntable: only there while one is playing (it comes out of its sleeve and lands on the platter)
  const rec = new THREE.Group()
  rec.visible = false
  platter.add(rec)
  rec.add(disc)
  const labelMat = new THREE.MeshStandardMaterial({ color: 0xd33a2c, roughness: 0.6 })
  const label = new THREE.Mesh(new THREE.CircleGeometry(0.048, 48), labelMat)
  label.rotation.x = -Math.PI / 2
  label.position.y = 0.0025
  rec.add(label)
  // the same record in flight between the sleeve and the platter
  const flyDisc = new THREE.Group()
  flyDisc.add(disc.clone(), label.clone())
  flyDisc.visible = false
  group.add(flyDisc)
  // the record's own model (public/models/record.glb: a 12-inch with a hole, grooves as a normal map). Its label is painted here:
  // the cover of the album that plays, on both sides. The plain disc above stays until the model has loaded.
  const discCanvas = document.createElement('canvas')
  discCanvas.width = discCanvas.height = 1024
  const discTex = new THREE.CanvasTexture(discCanvas)
  discTex.flipY = false // (like the model's own textures)
  discTex.colorSpace = THREE.SRGBColorSpace
  discTex.anisotropy = 8
  let discLabel: HTMLImageElement | null = null // the cover image on the label (null: a plain red label)
  function paintDisc(): void {
    const x = context2d(discCanvas)
    x.fillStyle = '#0a0a0c'
    x.fillRect(0, 0, 1024, 1024)
    for (const c of [296, 724]) { // the two sides
      x.save()
      x.beginPath(); x.arc(c, c, 97, 0, Math.PI * 2); x.clip()
      if (discLabel) x.drawImage(discLabel, c - 97, c - 97, 194, 194)
      else { x.fillStyle = '#d33a2c'; x.fillRect(c - 97, c - 97, 194, 194) }
      x.restore()
      x.fillStyle = '#0a0a0c'; x.beginPath(); x.arc(c, c, 7, 0, Math.PI * 2); x.fill() // the spindle hole
    }
    discTex.needsUpdate = true
  }
  paintDisc()
  /** The record model, kept to make the discs inside the sleeves. */
  let recTpl: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; matrix: THREE.Matrix4 } | null = null
  let sleeveTpl: THREE.Object3D | null = null // the sleeve model (a Group)
  glbLoader().load('models/sleeve.glb', (g) => { sleeveTpl = g.scene }, undefined, warnLoad('sleeve'))
  glbLoader().load('models/record.glb', (g) => {
    let found: THREE.Mesh | null = null
    g.scene.traverse((o) => { if (o instanceof THREE.Mesh && !found) found = o })
    const src = found as THREE.Mesh | null
    if (!src || !(src.material instanceof THREE.MeshStandardMaterial)) return
    src.updateWorldMatrix(true, false)
    const mat = src.material.clone()
    mat.map = discTex
    mat.metalness = 0.15
    mat.needsUpdate = true
    recTpl = { geometry: src.geometry, material: src.material, matrix: src.matrixWorld.clone() }
    const flat = (): THREE.Mesh => { const m = new THREE.Mesh(src.geometry, mat); m.applyMatrix4(src.matrixWorld); m.castShadow = true; return m }
    for (const c of rec.children) c.visible = false
    for (const c of flyDisc.children) c.visible = false
    rec.add(flat())
    flyDisc.add(flat())
    shelfDirty = true
  }, undefined, warnLoad('record'))
  add(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 8), alu, -0.04, 0.11, 0, tt)
  add(new THREE.CylinderGeometry(0.025, 0.028, 0.03, 24), alu, 0.16, 0.095, -0.1, tt)
  const arm = new THREE.Group()
  arm.position.set(TT_ARM.x, 0.12, TT_ARM.z) // (where the tonearm turns on the model)
  tt.add(arm)
  const armRod = add(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 8), alu, -0.06, 0, 0.1, arm)
  armRod.rotation.x = Math.PI / 2
  armRod.rotation.z = 0.5
  add(new THREE.BoxGeometry(0.018, 0.01, 0.03), dark, -0.115, -0.006, 0.205, arm)
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 16), alu, 0.17, 0.09, 0.13, tt)

  // ── Decor: speakers, a plant, a candle, frames, fairy lights, headphones, a floor lamp ──
  const terracotta = new THREE.MeshStandardMaterial({ color: 0xc9774f, roughness: 0.85 })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f8a5b, roughness: 0.7 })
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x66a06d, roughness: 0.7 })
  const speakerWood = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.5 })
  const grill = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.9 })
  // floor-standing speakers either side of the sideboard
  ;[-1, 1].forEach((side) => {
    const sp = new THREE.Group()
    sp.position.set(side * 0.9, 0, 0.2)
    group.add(sp)
    add(new RoundedBoxGeometry(0.26, 0.82, 0.24, 3, 0.012), speakerWood, 0, 0.5, 0, sp)
    add(new THREE.CylinderGeometry(0.022, 0.03, 0.09, 12), dark, 0, 0.045, 0, sp) // plinth
    const w = add(new THREE.CylinderGeometry(0.085, 0.085, 0.01, 40), grill, 0, 0.36, 0.122, sp)
    w.rotation.x = Math.PI / 2
    const w2 = add(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 24), alu, 0, 0.36, 0.128, sp) // dust cap
    w2.rotation.x = Math.PI / 2
    const tw = add(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 24), grill, 0, 0.66, 0.122, sp)
    tw.rotation.x = Math.PI / 2
  })
  // a plant on the sideboard
  const plantLeaves: THREE.Mesh[] = []
  const plant = new THREE.Group()
  plant.position.set(0.56, TOP_Y, 0.14)
  group.add(plant)
  add(new THREE.CylinderGeometry(0.058, 0.044, 0.1, 20), terracotta, 0, 0.05, 0, plant)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + i * 0.4
    const lf = add(new THREE.SphereGeometry(0.05, 10, 8), i % 2 ? leafMat : leafMat2, Math.cos(a) * 0.035, 0.17 + (i % 3) * 0.05, Math.sin(a) * 0.035, plant)
    lf.scale.set(0.34, 1.35 + (i % 3) * 0.2, 0.12)
    lf.rotation.set(Math.sin(a) * 0.55, -a, -Math.cos(a) * 0.55)
    lf.userData.rx = lf.rotation.x
    lf.userData.rz = lf.rotation.z
    plantLeaves.push(lf)
  }
  // a candle that flickers (the flame is part of the beat pulse below)
  const candle = new THREE.Group()
  candle.position.set(0.6, TOP_Y, 0.4)
  group.add(candle)
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0xe9d9bd, roughness: 0.5 }), 0, 0.03, 0, candle)
  add(new THREE.CylinderGeometry(0.0015, 0.0015, 0.014, 6), dark, 0, 0.067, 0, candle)
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xe8a24e }) // not too bright: the bloom would make it glow
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), flameMat)
  flame.scale.set(0.8, 1.7, 0.8)
  flame.position.set(0, 0.082, 0)
  candle.add(flame)
  const candleLight = new THREE.PointLight(0xffb76b, 0.05, 0.35, 2)
  candleLight.position.set(0, 0.1, 0.02)
  candle.add(candleLight)
  // ── The stack of records on the table: the albums coming up in the queue on top (next one first), the albums
  // I listened to last below them. Any height: the sleeves get thinner the more there are. ──
  const stackGroup = new THREE.Group()
  stackGroup.position.set(0.42, TOP_Y, 0.27)
  group.add(stackGroup)
  let stackItems: StackEntry[] = []
  const stackTex = new Map<string, THREE.Texture>()
  const hueOf = (str: string): number => { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360; return h }
  function setStack(list: StackEntry[], onChange?: () => void): void {
    const key = list.map((x) => x.uri + (x.queued ? 'q' : '')).join('|')
    if (key === stackKey) return
    stackKey = key
    stackItems = list.slice(0, 30)
    for (const m of [...stackGroup.children]) {
      stackGroup.remove(m)
      if (!(m instanceof THREE.Mesh)) continue
      m.geometry.dispose()
      for (const mt of Array.isArray(m.material) ? m.material : [m.material]) if (!(mt instanceof THREE.MeshStandardMaterial && mt.map)) mt.dispose()
    }
    const n = stackItems.length
    const t = Math.min(0.0095, 0.26 / Math.max(n, 1)) // 30 sleeves still fit in 26 cm
    stackItems.forEach((it, i) => {
      const fromBottom = n - 1 - i
      const hue = hueOf(it.uri)
      const edge = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue / 360, it.queued ? 0.55 : 0.4, it.queued ? 0.5 : 0.42), roughness: 0.75 })
      let top: THREE.MeshStandardMaterial = edge
      if (i === 0) { // only the top sleeve shows its cover
        top = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
        const src = it.image_large || it.image
        if (src) {
          const apply = (tex: THREE.Texture): void => { top.map = tex; top.needsUpdate = true; onChange?.() }
          const known = stackTex.get(src)
          if (known) apply(known)
          else loader.load(src, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; stackTex.set(src, tex); apply(tex) }, undefined, () => {})
        } else top.color.setHSL(hue / 360, 0.4, 0.55)
      }
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, t * 0.92, 0.3), [edge, edge, top, edge, edge, edge])
      const j = ((hueOf(it.uri + i) % 100) / 100 - 0.5)
      m.position.set(j * 0.02, t * fromBottom + t / 2, ((hueOf(it.name || it.uri) % 100) / 100 - 0.5) * 0.02)
      m.rotation.y = j * 0.16
      m.castShadow = m.receiveShadow = true
      m.userData = { kind: 'stack', index: i }
      stackGroup.add(m)
    })
    onChange?.()
  }
  let stackKey = ''
  // where a record lies when it is one of the sleeves in the stack on the table (group-local), or null
  const slotQ = new THREE.Quaternion(), slotFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2))
  function stackSlot(uri: string): { pos: THREE.Vector3; q: THREE.Quaternion } | null {
    const i = stackItems.findIndex((x) => x.uri === uri)
    if (i < 0) return null
    const m = stackGroup.children.find((c) => c.userData.index === i)
    if (!m) return null
    slotQ.setFromEuler(new THREE.Euler(0, m.rotation.y, 0)).multiply(slotFlat) // lying flat, cover up
    return { pos: new THREE.Vector3().copy(stackGroup.position).add(m.position), q: slotQ.clone() }
  }
  // the next album (all of it is in the queue): one sleeve leaning against the wall at the left of the plant
  const nextMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
  const nextEdge = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.8 })
  const nextMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.008), [nextEdge, nextEdge, nextEdge, nextEdge, nextMat, nextEdge])
  nextMesh.position.set(0.26, TOP_Y + 0.15 * Math.cos(0.26) + 0.002, 0.11)
  nextMesh.rotation.x = -0.26
  nextMesh.castShadow = nextMesh.receiveShadow = true
  nextMesh.userData = { kind: 'next' }
  nextMesh.visible = false
  group.add(nextMesh)
  let nextUri: string | null = null
  function setNext(a: StackEntry | null | undefined, onChange?: () => void): void {
    const uri = a?.uri ?? null
    if (uri === nextUri) return
    nextUri = uri
    nextMesh.visible = !!a
    if (!a) { onChange?.(); return }
    const src = a.image_large || a.image
    if (src) loader.load(src, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; nextMat.map?.dispose(); nextMat.map = tex; nextMat.needsUpdate = true; onChange?.() }, undefined, () => {})
    onChange?.()
  }
  // frames on the wall above (abstract "records at sunset")
  const art = (seed: number): THREE.CanvasTexture => canvasTex(300, 380, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h)
    const pal: [string, string] = ([['#f6c177', '#d9694f'], ['#8fb8de', '#3f5f93'], ['#cfe3c0', '#5c8a6a']] as [string, string][])[seed % 3] ?? ['#f6c177', '#d9694f']
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1])
    x.fillStyle = g; x.fillRect(0, 0, w, h)
    x.fillStyle = 'rgba(20,20,26,.92)'; x.beginPath(); x.arc(w / 2, h * 0.58, w * 0.32, 0, Math.PI * 2); x.fill()
    x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 2
    for (let r = 0.16; r < 0.3; r += 0.035) { x.beginPath(); x.arc(w / 2, h * 0.58, w * r, 0, Math.PI * 2); x.stroke() }
    x.fillStyle = pal[0]; x.beginPath(); x.arc(w / 2, h * 0.58, w * 0.08, 0, Math.PI * 2); x.fill()
  })
  ;[[-0.5, 1.38, 0.3, 0.38, 0], [0.02, 1.5, 0.36, 0.46, 1], [0.54, 1.38, 0.3, 0.38, 2]].forEach(([x, y, fw, fh, seed]) => {
    add(new THREE.BoxGeometry(fw + 0.03, fh + 0.03, 0.02), wood, x, y, 0.025)
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshStandardMaterial({ map: art(seed), roughness: 0.6 }))
    pic.position.set(x, y, 0.0362)
    group.add(pic)
  })
  // fairy lights along the wall
  const fairyMat = new THREE.MeshBasicMaterial({ color: 0xffd9a8, toneMapped: false })
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 8, 6), fairyMat, 24)
  const fm = new THREE.Matrix4()
  const wirePts: THREE.Vector3[] = []
  for (let i = 0; i < 24; i++) {
    const u = i / 23
    const x = -1.15 + u * 2.3
    const y = 2.02 - Math.sin(u * Math.PI) * 0.16 - (i % 2) * 0.03
    fm.makeTranslation(x, y, 0.04)
    bulbs.setMatrixAt(i, fm)
  }
  for (let i = 0; i <= 40; i++) { const u = i / 40; wirePts.push(new THREE.Vector3(-1.15 + u * 2.3, 2.03 - Math.sin(u * Math.PI) * 0.16, 0.037)) }
  group.add(bulbs)
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wirePts), 60, 0.0018, 4), grill))
  // headphones on a hook
  const hp = new THREE.Group()
  hp.position.set(-0.98, 1.2, 0.05)
  group.add(hp)
  add(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 8), alu, 0, 0.09, -0.01, hp).rotation.x = Math.PI / 2
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.006, 8, 24, Math.PI), dark)
  band.position.set(0, 0.02, 0.02)
  hp.add(band)
  ;[-1, 1].forEach((side) => add(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 18), dark, side * 0.07, 0.02, 0.02, hp).rotation.z = Math.PI / 2)
  // a floor lamp by the sofa
  const lamp = new THREE.Group()
  lamp.position.set(3.25, 0, 0.35)
  group.add(lamp)
  add(new THREE.CylinderGeometry(0.1, 0.11, 0.025, 24), dark, 0, 0.0125, 0, lamp)
  add(new THREE.CylinderGeometry(0.008, 0.008, 1.35, 8), alu, 0, 0.7, 0, lamp)
  const shadeMat = new THREE.MeshBasicMaterial({ color: 0xffdcae, toneMapped: false, side: THREE.DoubleSide })
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 0.26, 28, 1, true), shadeMat)
  shade.position.set(0, 1.5, 0)
  lamp.add(shade)
  const lampLight = new THREE.PointLight(0xffc98a, 0.45, 2.2, 2)
  lampLight.position.set(0, 1.45, 0.05)
  lamp.add(lampLight)

  // more turntable details: strobe dots, felt mat, speed buttons, pitch fader, power LED, counterweight, headshell, dust cover, feet
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x2a2b30, roughness: 1 })
  add(new THREE.CylinderGeometry(0.146, 0.146, 0.002, 64), feltMat, 0, 0.0005, 0, platter)
  const dots = new THREE.InstancedMesh(new THREE.BoxGeometry(0.004, 0.006, 0.0025), new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.5 }), 72)
  const dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), dv = new THREE.Vector3(), ds = new THREE.Vector3(1, 1, 1)
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2
    dq.setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0))
    dm.compose(dv.set(Math.cos(a) * 0.1535, 0.0035, Math.sin(a) * 0.1535), dq, ds)
    dots.setMatrixAt(i, dm)
  }
  platter.add(dots)
  // speed buttons 33 / 45 and the start-stop button along the front
  ;[[-0.17, 0.12], [-0.145, 0.12]].forEach(([x, z], i) => add(new THREE.CylinderGeometry(0.0085, 0.0085, 0.008, 16), i ? dark : alu, x, 0.084, z, tt))
  const startBtn = add(new THREE.CylinderGeometry(0.011, 0.011, 0.009, 18), alu, -0.2, 0.0845, 0.12, tt)
  const ttLed = new THREE.Mesh(new THREE.SphereGeometry(0.0033, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3be08a, toneMapped: false }))
  ttLed.position.set(-0.2, 0.0905, 0.1)
  tt.add(ttLed)
  // the turntable model replaces the plain one above (which stays until it has loaded)
  glbLoader().load('models/turntable.glb', (g) => {
    const part = (name: string): THREE.Object3D | undefined => g.scene.getObjectByName(name)
    const mark = (o: THREE.Object3D): void => o.traverse((m) => {
      if (!(m instanceof THREE.Mesh)) return
      m.castShadow = m.receiveShadow = true
      const mt: unknown = m.material
      if (mt instanceof THREE.MeshStandardMaterial && mt.metalness > 0.5 && !mt.userData.tuned) { mt.userData.tuned = true; mt.envMapIntensity = 0.22 } // (full metal just mirrors the bright room: the platter turned pale)
    })
    for (const c of tt.children) if (c !== platter && c !== arm && c !== ttLed && !deckBtns.some((b) => b === c)) c.visible = false
    for (const c of platter.children) if (c !== rec) c.visible = false
    for (const c of arm.children) c.visible = false
    const base = part('tt_static'), pl = part('tt_platter'), ar = part('tt_arm')
    if (base) { mark(base); tt.add(base) }
    if (pl) { mark(pl); pl.traverse((m) => { if (m instanceof THREE.Mesh && m.material instanceof THREE.MeshStandardMaterial) { const own = m.material.clone(); own.color.multiplyScalar(0.4); m.material = own } }); pl.position.set(-TT_C.x, -0.111, -TT_C.z); platter.add(pl) } // (the platter under the spot light looked too pale: graphite)
    if (ar) { mark(ar); ar.position.set(-TT_ARM.x, -0.12, -TT_ARM.z); arm.add(ar) }
    arm.userData.kind = 'tt-arm' // press the tonearm: the needle lifts (pause) / goes down again (play)
    shelfDirty = true
  }, undefined, warnLoad('turntable'))
  // the turntable seen from above (deck view): its three knobs on the right become buttons – previous, play / pause, next –
  // and the tonearm lifts / lowers the needle. Round marks with icons show where to press (only in that view).
  const deckBtns: THREE.Mesh[] = []
  const iconTex = (draw: (x: CanvasRenderingContext2D) => void): THREE.CanvasTexture => canvasTex(128, 128, (x) => { x.fillStyle = 'rgba(20,24,32,0.78)'; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.stroke(); x.fillStyle = '#fff'; draw(x) })
  const tri = (x: CanvasRenderingContext2D, cx: number, dir: number, h = 22): void => { x.beginPath(); x.moveTo(cx - dir * 14, 64 - h); x.lineTo(cx + dir * 14, 64); x.lineTo(cx - dir * 14, 64 + h); x.closePath(); x.fill() }
  ;([
    { kind: 'tt-prev', z: 0.052, draw: (x: CanvasRenderingContext2D) => { x.fillRect(34, 40, 9, 48); tri(x, 66, -1); tri(x, 90, -1) } },
    { kind: 'tt-toggle', z: 0.087, draw: (x: CanvasRenderingContext2D) => { tri(x, 52, 1); x.fillRect(74, 40, 10, 48); x.fillRect(94, 40, 10, 48) } },
    { kind: 'tt-next', z: 0.109, draw: (x: CanvasRenderingContext2D) => { tri(x, 38, 1); tri(x, 62, 1); x.fillRect(85, 40, 9, 48) } },
  ]).forEach((b) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(b.kind === 'tt-toggle' ? 0.0125 : 0.0105, 32), new THREE.MeshBasicMaterial({ map: iconTex(b.draw), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))
    m.rotation.x = -Math.PI / 2
    m.position.set(0.191, 0.142, b.z)
    m.userData.kind = b.kind
    m.renderOrder = 5
    tt.add(m)
    deckBtns.push(m)
  })
  let deckOn = false
  let deckA = 0
  function updateDeck(dt: number, t: number): boolean {
    deckA += ((deckOn ? 1 : 0) - deckA) * Math.min(1, dt * 6)
    for (const m of deckBtns) (m.material as THREE.MeshBasicMaterial).opacity = deckA * (0.82 + 0.18 * Math.sin(t * 3 + m.position.z * 90))
    return deckA > 0.01
  }
  // pitch fader on the right
  add(new THREE.BoxGeometry(0.012, 0.003, 0.09), dark, 0.2, 0.0815, 0.04, tt)
  add(new THREE.BoxGeometry(0.02, 0.008, 0.012), alu, 0.2, 0.0845, 0.03, tt)
  // dust cover: open, hinged at the back, tilted up
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.003, 0.3), new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.18, metalness: 0, clearcoat: 1 }))
  lid.castShadow = false
  const lidPivot = new THREE.Group()
  lidPivot.position.set(0, 0.082, -0.172)
  lidPivot.rotation.x = -1.75
  lid.position.set(0, 0, 0.15)
  lidPivot.add(lid)
  tt.add(lidPivot)
  add(new THREE.BoxGeometry(0.44, 0.004, 0.004), alu, 0, 0.082, -0.172, tt) // hinge
  // rubber feet
  ;[[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]].forEach(([x, z]) => add(new THREE.CylinderGeometry(0.018, 0.02, 0.012, 14), dark, x, -0.006, z, tt))
  // arm: counterweight, headshell + cartridge + finger lift, arm rest
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 16), dark, -0.045, 0.0, -0.06, arm).rotation.x = Math.PI / 2
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16), alu, 0, 0, 0, arm)
  add(new THREE.BoxGeometry(0.014, 0.004, 0.035), alu, -0.119, -0.002, 0.232, arm) // headshell
  add(new THREE.BoxGeometry(0.01, 0.008, 0.016), new THREE.MeshStandardMaterial({ color: 0xd33a2c, roughness: 0.4 }), -0.119, -0.008, 0.24, arm) // cartridge
  add(new THREE.CylinderGeometry(0.0012, 0.0012, 0.02, 6), alu, -0.128, 0.004, 0.22, arm).rotation.z = 1.2 // finger lift
  add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.03, 10), alu, 0.04, 0.1, 0.07, tt)
  add(new THREE.BoxGeometry(0.022, 0.006, 0.012), dark, 0.04, 0.115, 0.07, tt) // arm rest clip
  // a yellow "45" adapter on the board next to it
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 20), new THREE.MeshStandardMaterial({ color: 0xe8b934, roughness: 0.5 }), 0.27, 0.002, 0.07, tt)

  // ── iPod classic ──
  // on the sideboard, in front of the leaning sleeve – next to the turntable, so the camera hardly has to move
  const ipodHome = { pos: new THREE.Vector3(-0.02, TOP_Y, 0.36), rotY: 0.22 }
  const ipod = new THREE.Group()
  ipod.position.copy(ipodHome.pos)
  ipod.rotation.y = ipodHome.rotY
  ipod.userData = { kind: 'ipod' }
  group.add(ipod)
  const stand = add(new THREE.BoxGeometry(0.1, 0.02, 0.07), dark, 0, 0.01, 0, ipod)
  const body = new THREE.Group()
  body.position.set(0, 0.105, 0)
  body.rotation.x = -0.18
  ipod.add(body)
  const W = 0.1, H = 0.166, D = 0.018
  // the iPod is the model public/models/ipod.glb (an iPod classic, 10 × 16.6 cm, front towards +z); the plain box is only there until it has loaded
  const ipodFallback = new THREE.Group()
  body.add(ipodFallback)
  add(new RoundedBoxGeometry(W, H, D, 4, 0.008), new THREE.MeshPhysicalMaterial({ color: 0xe2e4e8, roughness: 0.18, clearcoat: 1, metalness: 0.05 }), 0, 0, 0, ipodFallback)
  glbLoader().load('models/ipod.glb', (g) => {
    g.scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = o.receiveShadow = true } })
    body.add(g.scene)
    ipodFallback.visible = false
    shelfDirty = true
  }, undefined, warnLoad('ipod'))
  // sound coming out of the iPod: a few music notes drifting up from it (only while it plays)
  const soundFx = new THREE.Group()
  soundFx.position.copy(ipodHome.pos).add(new THREE.Vector3(0, 0.13, 0.02))
  soundFx.visible = false
  group.add(soundFx)
  // white notes on solid black, drawn ADDITIVELY: black adds nothing, so there is no transparency to go wrong (on some Macs the
  // transparent corners of a note came out as black boxes)
  const noteTex = ['\u266A', '\u266B'].map((ch) => canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#000000'; x.fillRect(0, 0, w, h)
    x.font = '700 52px "Helvetica Neue", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'
    x.fillStyle = '#ffffff'; x.fillText(ch, w / 2, h / 2 + 4)
  }))
  const notes = [0, 1, 2, 3].map((i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex[i % 2], color: i % 2 ? 0xffd27a : 0x8fc6ff, transparent: true, blending: THREE.AdditiveBlending, opacity: 0, depthWrite: false, toneMapped: false }))
    const data: SpriteData = { phase: i / 4, side: i % 2 ? 1 : -1, sway: 0.6 + i * 0.35 }
    sp.userData = data
    sp.raycast = () => {} // only decoration: never in the way of a click
    soundFx.add(sp)
    return sp
  })
  let soundA = 0 // fades in and out
  /** Returns true while the effect is visible (the room must keep drawing). */
  function updateSound(dt: number, t: number, _camera: THREE.Camera, on: boolean): boolean {
    soundA += ((on ? 1 : 0) - soundA) * Math.min(1, dt * (on ? 3 : 4))
    soundFx.visible = soundA > 0.02
    if (!soundFx.visible) return false
    for (const n of notes) {
      const d = n.userData as SpriteData
      const k = (t * 0.32 + d.phase) % 1
      n.position.set(d.side * (0.03 + k * 0.1) + Math.sin(t * 1.6 + d.sway * 6) * 0.012 * d.sway, 0.03 + k * 0.25, 0.02)
      n.scale.setScalar(0.04 + 0.012 * Math.sin(k * Math.PI))
      n.material.opacity = soundA * Math.sin(Math.PI * k) * 0.9
    }
    return true
  }
  const screenCanvas = document.createElement('canvas')
  screenCanvas.width = 2048
  screenCanvas.height = 1661 // same shape as the screen (SW : SH), at 4× – sharp even when the iPod stands there and the camera is close
  const screenCtx = context2d(screenCanvas)
  const screenTex = new THREE.CanvasTexture(screenCanvas)
  screenTex.colorSpace = THREE.SRGBColorSpace
  screenTex.anisotropy = 16
  const SW = 0.0672, SH = 0.0545 // the model's LCD (measured on the model)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: new THREE.Color(1, 1, 1) }))
  screen.position.set(0.0003, 0.0547, 0.0168) // just in front of the glass over the LCD
  body.add(screen)
  const wheel = new THREE.Mesh(new THREE.CircleGeometry(W * 0.36, 48), new THREE.MeshStandardMaterial({ color: 0xcfd3d9, roughness: 0.55 }))
  wheel.position.set(0, -H * 0.2, D / 2 + 0.0006)
  ipodFallback.add(wheel)
  const center = new THREE.Mesh(new THREE.CircleGeometry(W * 0.13, 32), new THREE.MeshStandardMaterial({ color: 0xf7f7f5, roughness: 0.3 }))
  center.position.set(0, -H * 0.2, D / 2 + 0.0012)
  ipodFallback.add(center)
  const wheelText = new THREE.Mesh(new THREE.CircleGeometry(W * 0.36, 48), new THREE.MeshBasicMaterial({
    transparent: true,
    // the wheel's symbols, drawn as shapes at a high resolution: shuffle (top), previous (left),
    // next (right), play/pause (bottom)
    map: (() => {
      const t = canvasTex(512, 512, (x, w) => {
        const c = w / 2
        x.fillStyle = x.strokeStyle = '#8f96a0'
        x.lineWidth = 9
        x.lineCap = x.lineJoin = 'round'
        const tri = (cx: number, cy: number, dir: number, sz: number): void => { x.beginPath(); x.moveTo(cx - dir * sz * 0.5, cy - sz * 0.6); x.lineTo(cx + dir * sz * 0.5, cy); x.lineTo(cx - dir * sz * 0.5, cy + sz * 0.6); x.closePath(); x.fill() }
        // shuffle: two crossing arrows
        const sy = 66, sw = 46
        x.beginPath(); x.moveTo(c - sw, sy - 16); x.bezierCurveTo(c - 10, sy - 16, c + 10, sy + 16, c + sw - 12, sy + 16); x.stroke()
        x.beginPath(); x.moveTo(c - sw, sy + 16); x.bezierCurveTo(c - 10, sy + 16, c + 10, sy - 16, c + sw - 12, sy - 16); x.stroke()
        tri(c + sw - 4, sy - 16, 1, 22)
        tri(c + sw - 4, sy + 16, 1, 22)
        // previous: |◀◀
        x.fillRect(48, c - 22, 9, 44); tri(80, c, -1, 34); tri(108, c, -1, 34)
        // next: ▶▶|
        tri(w - 108, c, 1, 34); tri(w - 80, c, 1, 34); x.fillRect(w - 57, c - 22, 9, 44)
        // play / pause
        tri(c - 26, w - 66, 1, 38)
        x.fillRect(c + 4, w - 88, 11, 44); x.fillRect(c + 24, w - 88, 11, 44)
      })
      t.anisotropy = 8
      return t
    })(),
  }))
  wheelText.position.set(0, -H * 0.2, D / 2 + 0.001)
  ipodFallback.add(wheelText)

  // ── Sofa corner ──
  const fabric = new THREE.MeshStandardMaterial({ color: 0x9fb2c6, roughness: 0.95 })
  const fabricDark = new THREE.MeshStandardMaterial({ color: 0x8295aa, roughness: 0.95 })
  const pillow = new THREE.MeshStandardMaterial({ color: 0x2b8cff, roughness: 0.9 })
  const sofa = new THREE.Group()
  sofa.position.set(2.1, 0, 0)
  group.add(sofa)
  add(new RoundedBoxGeometry(1.9, 0.3, 0.86, 3, 0.04), fabricDark, 0, 0.26, 0.47, sofa) // base
  ;[-0.62, 0, 0.62].forEach((x) => {
    add(new RoundedBoxGeometry(0.6, 0.14, 0.64, 4, 0.05), fabric, x, 0.48, 0.55, sofa) // seat
    const back = add(new RoundedBoxGeometry(0.6, 0.42, 0.2, 4, 0.06), fabric, x, 0.68, 0.17, sofa)
    back.rotation.x = -0.12
  })
  ;[-0.88, 0.88].forEach((x) => add(new RoundedBoxGeometry(0.16, 0.56, 0.86, 3, 0.05), fabricDark, x, 0.34, 0.47, sofa))
  ;[[-0.85, 0.08], [0.85, 0.08], [-0.85, 0.84], [0.85, 0.84]].forEach(([x, z]) => add(new THREE.CylinderGeometry(0.02, 0.015, 0.11, 10), wood, x, 0.055, z, sofa))
  const p1 = add(new RoundedBoxGeometry(0.36, 0.34, 0.12, 4, 0.05), pillow, -0.55, 0.66, 0.3, sofa)
  p1.rotation.set(-0.25, 0.25, 0.12)
  const p2 = add(new RoundedBoxGeometry(0.34, 0.32, 0.11, 4, 0.05), new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.9 }), 0.58, 0.65, 0.3, sofa)
  p2.rotation.set(-0.25, -0.3, -0.1)
  // rug + coffee table
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.01, 72), new THREE.MeshStandardMaterial({ color: 0xd9d0c3, roughness: 1 }))
  rug.scale.set(1.25, 1, 0.85)
  rug.position.set(2.05, 0.005, 1.15)
  rug.receiveShadow = true
  group.add(rug)
  add(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 64), wood, 1.95, 0.405, 1.3)
  add(new THREE.CylinderGeometry(0.3, 0.3, 0.012, 64), white, 1.95, 0.05, 1.3)
  ;[0, 1, 2].forEach((i) => {
    const a = (i / 3) * Math.PI * 2
    const leg = add(new THREE.CylinderGeometry(0.014, 0.014, 0.4, 10), white, 1.95 + Math.cos(a) * 0.2, 0.2, 1.3 + Math.sin(a) * 0.2)
    leg.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18)
  })
  add(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 24), white, 2.17, 0.465, 1.42) // mug

  // ── Alive: a sleeping cat on the sofa, steam over the mug, dust in the sunbeam, a swaying plant ──
  const cat = new THREE.Group()
  cat.position.set(0.66, 0.555, 0.52)
  cat.rotation.y = 0.5
  sofa.add(cat)
  const fur = new THREE.MeshStandardMaterial({ color: 0xd9904a, roughness: 0.95 })
  const furLight = new THREE.MeshStandardMaterial({ color: 0xf3d2a4, roughness: 0.95 })
  const catBody = add(new THREE.SphereGeometry(0.1, 20, 14), fur, 0, 0.055, 0, cat)
  catBody.scale.set(1.5, 0.62, 1)
  const catHead = add(new THREE.SphereGeometry(0.055, 16, 12), fur, -0.15, 0.05, 0.04, cat)
  ;[-1, 1].forEach((s) => { const e = add(new THREE.ConeGeometry(0.02, 0.04, 6), fur, -0.16 + s * 0.03, 0.1, 0.045, cat); e.rotation.z = s * 0.12 })
  add(new THREE.SphereGeometry(0.03, 10, 8), furLight, -0.188, 0.04, 0.045, cat) // muzzle
  const tail = add(new THREE.TorusGeometry(0.09, 0.016, 8, 22, 4.2), fur, 0.02, 0.025, 0.05, cat)
  tail.rotation.x = Math.PI / 2
  tail.rotation.z = 0.4
  ;[0.0, 0.05, 0.1].forEach((x) => add(new THREE.BoxGeometry(0.012, 0.004, 0.04), furLight, x - 0.02, 0.1, 0.0, cat).rotation.y = 0.3) // stripes
  const steam: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = []
  const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), steamMat.clone())
    s.userData.phase = i / 4
    s.scale.set(1, 1.4, 1)
    group.add(s)
    steam.push(s)
  }
  const DUST = 70
  const dustPos = new Float32Array(DUST * 3)
  const dustSeed: { x: number; y: number; z: number; p: number; sp: number }[] = []
  for (let i = 0; i < DUST; i++) {
    dustSeed.push({ x: 1.6 + Math.random() * 1.8, y: 0.5 + Math.random() * 1.5, z: 0.1 + Math.random() * 1.1, p: Math.random() * 6.28, sp: 0.04 + Math.random() * 0.08 })
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xfff1d6, size: 0.012, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, sizeAttenuation: true }))
  dust.frustumCulled = false
  group.add(dust)
  function animateLife(t: number): void {
    catBody.scale.y = 0.62 + Math.sin(t * 1.6) * 0.035 // breathing
    catBody.scale.x = 1.5 + Math.sin(t * 1.6) * 0.015
    const catFirst = cat.children[0]
    if (catFirst) catFirst.position.y = 0.055 + Math.sin(t * 1.6) * 0.003
    steam.forEach((s) => {
      const k = (t * 0.25 + (s.userData.phase as number)) % 1
      s.position.set(2.17 + Math.sin(t * 1.3 + (s.userData.phase as number) * 9) * 0.01 * k, 0.5 + k * 0.16, 1.42 + Math.cos(t * 1.1 + (s.userData.phase as number) * 7) * 0.008 * k)
      s.material.opacity = Math.sin(k * Math.PI) * 0.16
      s.scale.setScalar(0.8 + k * 1.1)
    })
    for (let i = 0; i < DUST; i++) {
      const d = dustSeed[i]
      if (!d) continue
      dustPos[i * 3] = d.x + Math.sin(t * d.sp * 3 + d.p) * 0.12
      dustPos[i * 3 + 1] = d.y + ((t * d.sp + d.p) % 1.5) * 0.1 + Math.sin(t * 0.6 + d.p) * 0.03
      dustPos[i * 3 + 2] = d.z + Math.cos(t * d.sp * 2 + d.p) * 0.1
    }
    dustGeo.attributes.position.needsUpdate = true
    plantLeaves.forEach((l, i) => { l.rotation.z = (l.userData.rz as number) + Math.sin(t * 0.9 + i) * 0.045; l.rotation.x = (l.userData.rx as number) + Math.cos(t * 0.7 + i * 1.3) * 0.03 })
  }

  // ── Records ──
  // All records on the shelf are ONE instanced mesh. Spines come from a shared texture atlas
  // (one 16-px column per record), so 65+ records cost a single draw call. Only a record that is
  // selected or playing becomes its own mesh with a real cover.
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')
  const pageMat = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.8 })
  const COLW = 24 // px per record in the atlas (a spine is 9.5 mm wide)
  const AH = 1024 // atlas height: the spine fills the lower 90 %
  const MAX_RECORDS = Math.min(150, COMPARTMENT.reduce((n, c) => n + Math.floor((c.x1 - c.x0 - 0.01) / THICK), 0)) // (the texture atlas must stay under 4096 px wide)
  const atlas = document.createElement('canvas')
  atlas.width = COLW * MAX_RECORDS
  atlas.height = AH
  const atlasCtx = context2d(atlas)
  const atlasTex = new THREE.CanvasTexture(atlas)
  atlasTex.colorSpace = THREE.SRGBColorSpace
  atlasTex.anisotropy = 8
  let atlasTimer = 0
  // the flat sides of the sleeves (the cover face): a second atlas, one cell per record, so the slivers you see between the spines are the cover art
  const CELL = 96, CCOLS = 8, CROWS = Math.ceil(MAX_RECORDS / CCOLS)
  const facesCanvas = document.createElement('canvas')
  facesCanvas.width = CELL * CCOLS
  facesCanvas.height = CELL * CROWS
  const facesCtx = context2d(facesCanvas)
  const facesTex = new THREE.CanvasTexture(facesCanvas)
  facesTex.colorSpace = THREE.SRGBColorSpace
  facesTex.anisotropy = 4
  function drawFace(i: number, color: string, img: CanvasImageSource | null): void {
    const x = (i % CCOLS) * CELL, y = Math.floor(i / CCOLS) * CELL
    facesCtx.fillStyle = color
    facesCtx.fillRect(x, y, CELL, CELL)
    if (img) facesCtx.drawImage(img, x, y, CELL, CELL)
  }
  const atlasDirty = (): void => { clearTimeout(atlasTimer); atlasTimer = window.setTimeout(() => { atlasTex.needsUpdate = true; facesTex.needsUpdate = true }, 120) }

  const coverTex = new Map<string, THREE.Texture>() // uri -> texture of the cover, loaded in the background
  let coverJobs: CoverJob[] = []
  let coverActive = 0
  function pumpCovers(): void { // three at a time, so the shelf never hogs the connection
    while (coverActive < 3 && coverJobs.length) {
      const job = coverJobs.shift()
      if (!job) break
      coverActive++
      const img = new Image()
      img.crossOrigin = 'anonymous'
      const done = (): void => { coverActive--; pumpCovers() }
      img.onload = () => { try { job(img) } finally { done() } }
      img.onerror = done
      img.src = job.src ?? ''
    }
  }
  const spineCovers = new Map<number, HTMLImageElement>() // index -> the small cover (drawn at the top of the spine)
  function drawSpine(i: number, album: ShelfAlbum, color: string): void {
    const x = atlasCtx
    const x0 = i * COLW
    x.save()
    x.beginPath(); x.rect(x0, 0, COLW, AH); x.clip()
    x.fillStyle = color
    x.fillRect(x0, 0, COLW, AH)
    const g = x.createLinearGradient(x0, 0, x0 + COLW, 0)
    g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.25, 'rgba(0,0,0,0)')
    g.addColorStop(0.8, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.3)')
    x.fillStyle = g
    x.fillRect(x0, 70, COLW, AH - 70) // keep the top plain: other faces sample their colour there
    const m = String(color).match(/\d+/g)?.map(Number) ?? [60, 60, 60]
    const light = (0.299 * (m[0] ?? 0) + 0.587 * (m[1] ?? 0) + 0.114 * (m[2] ?? 0)) / 255 > 0.6
    // the spine is the edge of the cover: take the last few pixels of the cover (the side next to the spine) and stretch them along it
    const cov = spineCovers.get(i)
    const top = Math.round(AH * 0.1)
    if (cov) {
      const sw = Math.max(2, Math.min(10, Math.round(cov.width * 0.08)))
      x.drawImage(cov, cov.width - sw, 0, sw, cov.height, x0, top, COLW, AH - top)
      x.fillStyle = 'rgba(0,0,0,0.32)' // a veil so the name stays readable on any cover
      x.fillRect(x0, top, COLW, AH - top)
    }
    const dark = !cov && light
    x.translate(x0 + COLW / 2, (top + AH) / 2 + 6)
    x.rotate(Math.PI / 2)
    x.font = '700 17px Inter, sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    const room = AH - top - 40
    let t = album.name || ''
    const full = `${album.name}  ·  ${album.artist || ''}`
    if (x.measureText(full).width <= room) t = full // name and artist if there is room, otherwise the name
    while (x.measureText(t).width > room && t.length > 4) t = t.slice(0, -2)
    if (cov) { x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,0.55)'; x.strokeText(t, 0, 1) }
    x.fillStyle = dark ? 'rgba(0,0,0,0.78)' : 'rgba(255,255,255,0.92)'
    x.fillText(t, 0, 1)
    x.restore()
    // worn spine: pale scuffs at the top and bottom ends and along the edges
    x.save()
    x.beginPath(); x.rect(x0, 0, COLW, AH); x.clip()
    const wa = wearAmount(album)
    for (let k = 0; k < Math.round(14 * wa); k++) {
      const top = hash01(album.uri + 'sw' + k) < 0.5
      const yy = top ? AH * 0.1 + hash01(album.uri + 'sy' + k) * 36 : AH - hash01(album.uri + 'sz' + k) * 40
      x.fillStyle = `rgba(235,230,215,${(0.1 + hash01(album.uri + 'sa' + k) * 0.2) * wa})`
      x.fillRect(x0 + hash01(album.uri + 'sx' + k) * (COLW - 6), yy, 2 + hash01(album.uri + 'sl' + k) * 8, 1 + hash01(album.uri + 'sh' + k) * 3)
    }
    x.fillStyle = `rgba(235,230,215,${0.12 * wa})`; x.fillRect(x0, AH * 0.1, 1, AH); x.fillRect(x0 + COLW - 1, AH * 0.1, 1, AH)
    x.restore()
  }

  const recGeo = new THREE.BoxGeometry(THICK, SLEEVE, SLEEVE)
  // flag the spine face (+z = vertices 16..19 of a BoxGeometry) so the shader can map it into the atlas
  const spineFlag = new Float32Array(recGeo.attributes.position.count)
  for (let v = 16; v < 20; v++) spineFlag[v] = 1
  recGeo.setAttribute('spineFace', new THREE.BufferAttribute(spineFlag, 1))
  const colAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RECORDS), 1)
  recGeo.setAttribute('aCol', colAttr)
  const cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RECORDS * 2), 2) // where a record's cover cell sits in the faces atlas (uv)
  recGeo.setAttribute('aCell', cellAttr)
  const faceFlag = new Float32Array(recGeo.attributes.position.count)
  for (let v = 0; v < 4; v++) faceFlag[v] = 1 // +x = the cover face
  recGeo.setAttribute('coverFace', new THREE.BufferAttribute(faceFlag, 1))
  const shelfMat = new THREE.MeshStandardMaterial({ map: atlasTex, roughness: 0.6 })
  shelfMat.onBeforeCompile = (sh) => {
    sh.uniforms.uCols = { value: MAX_RECORDS }
    sh.uniforms.uFaces = { value: facesTex }
    sh.uniforms.uCell = { value: new THREE.Vector2(CELL / facesCanvas.width, CELL / facesCanvas.height) }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', 'attribute float spineFace;\nattribute float aCol;\nattribute float coverFace;\nattribute vec2 aCell;\nuniform float uCols;\nuniform vec2 uCell;\nvarying float vCF;\nvarying vec2 vCUv;\n#include <common>')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
      vCF = coverFace; vCUv = aCell + (uv * 0.96 + 0.02) * uCell;
      vMapUv = spineFace > 0.5 ? vec2((aCol + uv.x) / uCols, uv.y * 0.9) : vec2((aCol + 0.5) / uCols, 0.97);`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', 'uniform sampler2D uFaces;\nvarying float vCF;\nvarying vec2 vCUv;\n#include <common>')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
      vec4 sampledDiffuseColor = vCF > 0.5 ? texture2D(uFaces, vCUv) : texture2D(map, vMapUv);
      diffuseColor *= sampledDiffuseColor;
    #endif`)
  }
  const shelfMesh = new THREE.InstancedMesh(recGeo, shelfMat, MAX_RECORDS)
  shelfMesh.count = 0
  shelfMesh.castShadow = shelfMesh.receiveShadow = true
  shelfMesh.userData = { kind: 'album' }
  shelfMesh.frustumCulled = false
  group.add(shelfMesh)

  let records: ShelfRecord[] = []
  let albumsKey = ''
  const loose = new Map<string, LooseRecord>()
  // guests: albums from search that aren't on the shelf. They fly in through the window (the wall on the
  // right) and leave the same way when put back.
  const guestRecs = new Map<string, ShelfRecord>()
  let guestAlbums: ShelfAlbum[] = []
  let windowHome: THREE.Vector3 | null = null
  function guestHome(): THREE.Vector3 {
    if (!windowHome) {
      group.updateWorldMatrix(true, false)
      windowHome = group.worldToLocal(new THREE.Vector3(3.8, 1.55, 1.75))
    }
    return windowHome
  }
  function recordFor(uri: string): ShelfRecord | null {
    const r = records.find((x) => x.album.uri === uri)
    if (r) return r
    const known = guestRecs.get(uri)
    if (known) return known
    const album = guestAlbums.find((a) => a.uri === uri)
    if (!album) return null
    const g: ShelfRecord = { album, index: -1, guest: true, color: '#3a4352', out: 0, hidden: false, home: guestHome().clone() }
    const thumb = album.thumb || album.image
    if (thumb) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const col = averageColor(img)
        if (!col) return
        g.color = col
        loose.get(uri)?.tint?.(col)
      }
      img.src = thumb
    }
    guestRecs.set(uri, g)
    return g
  }
  // search in the shelf: the matching records slide out
  let filterSet: Set<string> | null = null
  const im = new THREE.Matrix4()
  const iq = new THREE.Quaternion()
  const is = new THREE.Vector3()
  const ipos = new THREE.Vector3()
  const ZERO = new THREE.Vector3(0, 0, 0)

  const ieu = new THREE.Euler(0, 0, 0, 'YXZ')
  function writeInstance(r: ShelfRecord): void {
    if (r.hidden) im.compose(r.home, iq.identity(), ZERO)
    else {
      // a little untidy, like a real shelf: some records stick out, some lean (the last one in a row leans a lot)
      const a = r.lean || 0
      ipos.copy(r.home).setZ(r.home.z + r.out * 0.09 + (r.dz || 0))
      ipos.x += -Math.sin(a) * (SLEEVE / 2) // (turns about the bottom edge, not the middle)
      ipos.y += (Math.cos(a) - 1) * (SLEEVE / 2)
      iq.setFromEuler(ieu.set(0, r.yaw || 0, a))
      im.compose(ipos, iq, is.set(1, 1, 1))
    }
    shelfMesh.setMatrixAt(r.index, im)
    shelfMesh.instanceMatrix.needsUpdate = true
  }

  function setAlbums(albums: ShelfAlbum[]): void {
    const key = albums.map((a) => a.uri).join('|')
    if (key === albumsKey) return
    albumsKey = key
    spineCovers.clear()
    for (const t of coverTex.values()) t.dispose()
    coverTex.clear()
    coverJobs = []
    for (const l of loose.values()) { group.remove(l.mesh); l.free?.() }
    loose.clear()
    // a little air before each new artist (not much – a few millimetres), so the shelf reads in groups
    const GAP = 0.012
    const room = COMPARTMENT.map((c) => c.x1 - c.x0 - 0.01)
    const per = Math.max(14, Math.ceil(Math.min(albums.length, MAX_RECORDS) / 3)) // spread over the top row first, then the bottom row
    const artistOf = (a: ShelfAlbum | undefined): string => String(a?.artist ?? '').split(',')[0]?.trim().toLowerCase() ?? ''
    let comp = 0, cursor = 0, inComp = 0
    const rnd = (seed: string): number => { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } return ((h >>> 0) % 10000) / 10000 }
    const lastOf = new Map<number, ShelfRecord[]>() // compartment -> its records
    records = albums.slice(0, MAX_RECORDS).map((album, i): ShelfRecord => {
      let gap = i > 0 && cursor > 0 && artistOf(album) !== artistOf(albums[i - 1]) ? GAP : 0
      const full = cursor + gap + THICK > (room[comp] ?? 0) + 1e-6 || inComp >= per
      if (full && comp < COMPARTMENT.length - 1) { comp++; cursor = 0; gap = 0; inComp = 0 }
      const off = cursor + gap
      cursor = off + THICK
      inComp++
      const cab = COMPARTMENT[comp] ?? { x0: 0, x1: 0, y: 0 }
      const color = album.color || '#3a4352'
      drawSpine(i, album, color)
      colAttr.setX(i, i)
      cellAttr.setXY(i, (i % CCOLS) * (CELL / facesCanvas.width), 1 - (Math.floor(i / CCOLS) + 1) * (CELL / facesCanvas.height))
      drawFace(i, color, null)
      const r = { album, index: i, color, out: 0, hidden: false, comp, end: off + THICK,
        dz: rnd(album.uri + 'z') < 0.2 ? 0.006 + rnd(album.uri + 'zz') * 0.016 : 0, yaw: (rnd(album.uri + 'y') - 0.5) * 0.05, lean: (rnd(album.uri + 'l') - 0.5) * 0.04,
        home: new THREE.Vector3(cab.x0 + 0.006 + THICK / 2 + off, cab.y + SLEEVE / 2 + 0.001, FRONT_Z - SLEEVE / 2 - 0.012) }
      const sameComp = lastOf.get(comp)
      if (sameComp) sameComp.push(r)
      else lastOf.set(comp, [r])
      writeInstance(r)
      // the cover (300 px) loads in the background: it goes on the spine, colours it if the album has no colour yet, and is
      // kept as a texture so that a record pulled out of the shelf already has its cover on it
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
      const src = (saveData ? album.thumb : album.image) || album.thumb || album.image
      if (src) {
        const job: CoverJob = (img) => {
          if (records[i] !== r) return // the shelf changed meanwhile
          spineCovers.set(i, img)
          if (!album.color) {
            const col = averageColor(img)
            if (col) {
              r.color = col
              const l = loose.get(album.uri)
              if (l) l.tint?.(col)
            }
          }
          drawSpine(i, album, r.color)
          drawFace(i, r.color, img)
          atlasDirty()
          const tex = new THREE.Texture(img)
          tex.colorSpace = THREE.SRGBColorSpace
          tex.anisotropy = 4
          tex.needsUpdate = true
          coverTex.set(album.uri, tex)
        }
        job.src = src
        coverJobs.push(job)
      }
      return r
    })
    // the last records in a row have room to lean: the very last one a lot, the one before it a little
    for (const [c, list] of lastOf) {
      const lastRec = list[list.length - 1]
      if (!lastRec) continue
      const free = (room[c] ?? 0) - (lastRec.end ?? 0)
      if (free < 0.03) continue
      const n = list.length
      const lean = -Math.min(0.42, 0.14 + free * 1.6 + rnd(lastRec.album.uri + 'e') * 0.1)
      lastRec.lean = lean
      const second = list[n - 2], third = list[n - 3]
      if (second) second.lean = lean * 0.45
      if (third && second && rnd(second.album.uri + 'f') < 0.5) third.lean = lean * 0.2
      for (const r of list.slice(-3)) writeInstance(r)
    }
    setTimeout(pumpCovers, 500) // after the first picture is up
    colAttr.needsUpdate = true
    cellAttr.needsUpdate = true
    facesTex.needsUpdate = true
    shelfMesh.count = records.length
    shelfMesh.computeBoundingSphere() // clicks/hover test against it – fit it to the records now on the shelf
    atlasTex.needsUpdate = true
  }

  /** A real mesh (with cover) for a record that leaves the shelf. */
  function makeLoose(r: ShelfRecord): LooseRecord {
    // the cover glows a touch on its own so it stays readable in the shade of the shelf
    const cached = coverTex.get(r.album.uri) // the cover loaded in the background: on it from the first frame
    // everything made here for this one record is freed again when it goes back (browsing many records must not eat the memory)
    const ownTex: THREE.Texture[] = [], ownMat: THREE.Material[] = [], ownGeo: THREE.BufferGeometry[] = []
    const mkTex = <T extends THREE.Texture>(t: T): T => { ownTex.push(t); return t }
    let ownMap = !cached
    const coverMat = new THREE.MeshStandardMaterial({ map: cached || (sleeveTpl ? null : mkTex(placeholderCover(r.album))), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.16 })
    ownMat.push(coverMat)
    coverMat.emissiveMap = coverMat.map
    const src = r.album.image_large || r.album.image // the 640 px cover: sharp even when held up close
    if (src) {
      loader.load(src, (t) => {
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 16 // stays crisp at a distance and at an angle (clamped to what the GPU allows)
        paintLabelFn?.(t.image)
        if (paintCover) { paintCover(t.image); t.dispose() } else {
          if (ownMap) coverMat.map?.dispose() // (never the shared one)
          ownMap = true
          mkTex(t)
          coverMat.map = t
          coverMat.emissiveMap = t
          coverMat.needsUpdate = true
        }
      }, undefined, () => {})
    }
    const backMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(r.color), roughness: 0.6 })
    ownMat.push(backMat)
    // the sleeve: the model (rounded corners, an opening) – its texture is made here: the back on the left half, the cover on the right half –
    // or a plain box (faces: +x front cover, -x back, +y/-y edges, +z spine, -z back edge) until the model has loaded
    let mesh: THREE.Object3D
    let tint: (col: string) => void = (col) => { backMat.color.set(col) }
    let paintCover: ((img: CanvasImageSource) => void) | null = null
    let paintLabelFn: ((img: CanvasImageSource | null) => void) | null = null
    if (sleeveTpl) {
      const cv = document.createElement('canvas')
      cv.width = 1536; cv.height = 768 // (drawn in a 2048 × 1024 grid, scaled down)
      const tex = mkTex(new THREE.CanvasTexture(cv))
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 16
      let backCol = r.color, coverImg: CanvasImageSource | null = (cached?.image as CanvasImageSource | undefined) ?? null
      const draw = (): void => {
        const x = context2d(cv)
        x.setTransform(0.75, 0, 0, 0.75, 0, 0)
        const g = x.createLinearGradient(0, 0, 1024, 1024)
        g.addColorStop(0, backCol); g.addColorStop(1, '#14161c')
        x.fillStyle = g; x.fillRect(0, 0, 1024, 1024) // the back
        x.fillStyle = 'rgba(255,255,255,0.88)'; x.font = '700 58px Inter, sans-serif'; x.textAlign = 'center'
        x.fillText(String(r.album.name || '').slice(0, 26), 512, 480); x.font = '600 38px Inter, sans-serif'; x.fillText(String(r.album.artist || '').slice(0, 30), 512, 540)
        x.fillStyle = backCol; x.fillRect(1024, 0, 1024, 1024)
        if (coverImg) x.drawImage(coverImg, 1024, 0, 1024, 1024) // the front
        const wa = wearAmount(r.album)
        wearSleeve(x, 0, 0, 1024, r.album.uri + 'b', wa * 0.9) // worn (old ones more): the back and the front
        wearSleeve(x, 1024, 0, 1024, r.album.uri + 'f', wa * 0.75)
        tex.needsUpdate = true
      }
      draw()
      tint = (col) => { backCol = col; draw() }
      paintCover = (img) => { coverImg = img; draw() }
      coverMat.map = tex; coverMat.emissiveMap = tex; coverMat.needsUpdate = true
      mesh = new THREE.Group()
      const body = sleeveTpl.clone(true)
      body.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = o.receiveShadow = true; o.userData.sharedGeo = true; if (!Array.isArray(o.material) && /^cover/.test(o.material.name)) o.material = coverMat } }) // (the geometry and the cardboard belong to the model: shared)
      mesh.add(body)
    } else {
      const spineMat = new THREE.MeshStandardMaterial({ map: mkTex(spineTex(r.album, r.color)), roughness: 0.6 })
      ownMat.push(spineMat)
      const bg = new THREE.BoxGeometry(SLEEVE_T, SLEEVE, SLEEVE)
      ownGeo.push(bg)
      mesh = new THREE.Mesh(bg, [coverMat, backMat, pageMat, pageMat, spineMat, pageMat])
    }
    // the vinyl itself, inside the sleeve: it slides a little way out of the top when the record is held, browsed or playing
    const labelCol = r.color || '#c9553a'
    let disc: THREE.Object3D
    if (!recTpl) { // (the plain disc, until the record model has loaded)
      const discTex = mkTex(canvasTex(512, 512, (x, w, h) => {
        x.fillStyle = '#0c0c0e'; x.fillRect(0, 0, w, h)
        const c = w / 2
        for (let g = 0.36; g < 0.99; g += 0.011) { x.strokeStyle = `rgba(255,255,255,${0.025 + ((g * 977) % 1) * 0.05})`; x.lineWidth = 1; x.beginPath(); x.arc(c, c, c * g, 0, Math.PI * 2); x.stroke() }
        x.strokeStyle = 'rgba(255,255,255,0.09)'; x.lineWidth = 3; x.beginPath(); x.arc(c, c, c * 0.355, 0, Math.PI * 2); x.stroke()
        x.fillStyle = labelCol; x.beginPath(); x.arc(c, c, c * 0.33, 0, Math.PI * 2); x.fill()
        x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.arc(c, c, c * 0.33, 0, Math.PI * 2); x.arc(c, c, c * 0.27, 0, Math.PI * 2, true); x.fill()
        x.fillStyle = '#0c0c0e'; x.beginPath(); x.arc(c, c, c * 0.028, 0, Math.PI * 2); x.fill()
      }))
      const discMat = new THREE.MeshStandardMaterial({ map: discTex, roughness: 0.32, metalness: 0.15 })
      const discEdge = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.4 })
      const dg = new THREE.CylinderGeometry(DISC_R, DISC_R, 0.0016, 72)
      ownGeo.push(dg)
      ownMat.push(discMat, discEdge)
      disc = new THREE.Mesh(dg, [discEdge, discMat, discMat])
      disc.rotation.z = Math.PI / 2 // the disc's axis points the same way as the cover's
    }
    else { // the record model: the label shows the cover
      const dc = document.createElement('canvas')
      dc.width = dc.height = 512
      const dt = mkTex(new THREE.CanvasTexture(dc))
      dt.flipY = false; dt.colorSpace = THREE.SRGBColorSpace; dt.anisotropy = 8
      const paintLabel = (img: CanvasImageSource | null): void => {
        const x = context2d(dc)
        x.fillStyle = '#0a0a0c'; x.fillRect(0, 0, 512, 512)
        for (const c of [148, 362]) { x.save(); x.beginPath(); x.arc(c, c, 48, 0, Math.PI * 2); x.clip(); if (img) x.drawImage(img, c - 48, c - 48, 96, 96); else { x.fillStyle = labelCol; x.fillRect(c - 48, c - 48, 96, 96) } x.restore(); x.fillStyle = '#0a0a0c'; x.beginPath(); x.arc(c, c, 3.5, 0, Math.PI * 2); x.fill() }
        dt.needsUpdate = true
      }
      paintLabel((cached?.image as CanvasImageSource | undefined) ?? null)
      const dm = recTpl.material.clone()
      dm.map = dt; dm.metalness = 0.15
      ownMat.push(dm)
      const model = new THREE.Mesh(recTpl.geometry, dm)
      model.userData.sharedGeo = true
      model.applyMatrix4(recTpl.matrix)
      model.castShadow = true
      disc = new THREE.Group()
      model.rotation.z += 0
      disc.add(model)
      disc.rotation.z = Math.PI / 2
      paintLabelFn = paintLabel
    }
    const free = (): void => { // give back what this record used (not the shared model geometry / cardboard)
      for (const t of ownTex) { t.dispose(); const img: unknown = t.image; if (img instanceof HTMLCanvasElement) { img.width = 1; img.height = 1 } }
      for (const m of ownMat) m.dispose()
      for (const g of ownGeo) g.dispose()
    }
    disc.castShadow = true
    const discHolder = new THREE.Group()
    discHolder.add(disc)
    mesh.add(discHolder)
    const slot = r.guest ? null : stackSlot(r.album.uri)
    if (slot) { mesh.position.copy(slot.pos); mesh.quaternion.copy(slot.q) } // it lies in the stack on the table: it comes from there
    else mesh.position.copy(r.home).setZ(r.home.z + r.out * 0.09)
    mesh.castShadow = mesh.receiveShadow = true
    mesh.userData = { kind: r.guest ? 'guest' : 'album', index: r.index }
    group.add(mesh)
    if (r.guest) {
      // tumbling in from the window
      mesh.quaternion.setFromEuler(new THREE.Euler(0.8, -1.2, 0.5))
      return { mesh, rec: r, disc: discHolder, tint, free, vel: new THREE.Vector3(0, 0.4, 0), returning: false }
    }
    r.hidden = true
    writeInstance(r)
    return { mesh, rec: r, disc: discHolder, tint, free, vel: new THREE.Vector3(), returning: false }
  }
  function dropLoose(uri: string): void {
    const l = loose.get(uri)
    if (!l) return
    group.remove(l.mesh)
    l.free?.()
    loose.delete(uri)
    if (l.rec.guest) { guestRecs.delete(uri); return }
    l.rec.hidden = false
    writeInstance(l.rec)
  }

  let hoverUri: string | null = null
  let dailyUri: string | null = null // the record of the day: always sticks out a little from the shelf
  let selectedUri: string | null = null
  let playingUri: string | null = null
  let peekUri: string | null = null // browsing the shelf: this record is pulled out, cover to the front
  let playing = false
  let holdIpod = false
  let flipSel = false // the held-up record shows its back (the track list)
  let ipodBig = false // panel hidden: hold it bigger
  let nowKey = ''
  let screenNow: NowPlaying | null = null
  let screenArt: HTMLImageElement | null = null // the cover, loaded for the screen
  let screenAt = 0 // performance.now() when screenNow.progress_ms was current
  let screenDrawn = 0
  function redrawScreen(): void {
    const p = screenNow?.duration_ms
      ? Math.min(screenNow.duration_ms, (screenNow.progress_ms || 0) + (screenNow.playing ? performance.now() - screenAt : 0))
      : 0
    drawIpodScreen(screenCtx, 2048, 1680, screenNow, screenArt, p)
    screenTex.needsUpdate = true
    screenDrawn = performance.now()
  }

  let screenImgSrc: string | null = null, labelSrc: string | null = null
  // ── the record goes from its sleeve to the turntable ──
  let recUri: string | null = null // the album whose record is (about to be) on the turntable
  let recOn = false // settled on the platter
  let recFlight: { t: number; wait: number } | null = null // while it travels (wait: until the sleeve has arrived by the turntable)
  const recEnd = new THREE.Vector3(-0.38 + TT_C.x, TOP_Y + 0.111, 0.24 + TT_C.z) // the platter's centre (group-local)
  const vA = new THREE.Vector3(), vB = new THREE.Vector3()
  const qStart = new THREE.Quaternion(), qId = new THREE.Quaternion()
  const qZ90 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2))
  const easeIO = (k: number): number => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
  function setState({ albums = [], now = null, guests = [], playOn = 'vinyl' }: { albums?: ShelfAlbum[]; now?: NowPlaying | null; guests?: ShelfAlbum[]; playOn?: string }): void {
    setAlbums(albums)
    guestAlbums = guests
    // what is playing belongs either to the turntable (an album) or to the iPod (a playlist, a found song): only that
    // one "plays" – the other stands still
    const onIpod = playOn === 'ipod'
    const vNow = onIpod ? null : now
    playing = !!vNow?.playing
    playingUri = vNow?.context && vNow.context.startsWith('spotify:album:') ? vNow.context : null
    // fall back to matching the album name when the context isn't an album (e.g. a track from it)
    if (!playingUri && vNow?.album) playingUri = albums.find((a) => a.name === vNow.album)?.uri || null
    screenNow = onIpod ? now : null
    screenAt = performance.now()
    const wantRec = vNow?.name && playingUri ? playingUri : null
    if (wantRec !== recUri) { // another record (or none): the platter is bare, and a new disc will come from its sleeve
      recUri = wantRec
      recOn = false
      rec.visible = false
      flyDisc.visible = false
      recFlight = wantRec ? { t: 0, wait: 1.0 } : null
    }
    if (screenNow?.image !== screenImgSrc) {
      screenImgSrc = screenNow?.image || null
      screenArt = null
      if (screenImgSrc) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        const src = screenImgSrc
        img.onload = () => { if (screenImgSrc === src) { screenArt = img; redrawScreen() } }
        img.src = src
      }
    }
    if (vNow?.image && vNow.image !== labelSrc) {
      labelSrc = vNow.image
      loader.load(vNow.image_large || vNow.image, (t) => {
        t.anisotropy = 16
        t.colorSpace = THREE.SRGBColorSpace
        discLabel = t.image
        paintDisc()
        labelMat.map?.dispose()
        labelMat.map = t
        labelMat.color.set(0xffffff)
        labelMat.needsUpdate = true
      }, undefined, () => {})
    }
    const key = `${vNow?.name}|${playing}|${screenNow?.image}|${screenNow?.name}|${screenNow?.playing}`
    if (key !== nowKey) { nowKey = key; redrawScreen() }
  }
  redrawScreen()

  // world → group-local helpers for things placed relative to the camera
  const tmpV = new THREE.Vector3()
  const tmpQ = new THREE.Quaternion()
  const camFwd = new THREE.Vector3()
  const camUp = new THREE.Vector3()
  const targetPos = new THREE.Vector3()
  const targetRot = new THREE.Euler()
  const targetQ = new THREE.Quaternion()
  const groupQ = new THREE.Quaternion()
  const basis = new THREE.Matrix4()
  const ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3()
  let armAngle = 0.45
  // the record turns once per bar (4 beats): a 120 BPM song gives 30 rpm. Unknown tempo = 33⅓ rpm.
  let tempo = 0
  let calm = false // calm mode: the record doesn't turn, nothing drifts or pulses
  let spin = 0 // rad/s, eased so the record winds up and slows down
  const rpmFor = (bpm: number): number => {
    if (!(bpm > 30)) return 33.3
    let b = bpm
    while (b < 84) b *= 2
    while (b > 168) b /= 2
    return Math.min(42, Math.max(24, b / 4))
  }

  function update(dt: number, t: number, camera: THREE.PerspectiveCamera): boolean {
    let moving = false
    if (shelfDirty) { moving = true; shelfDirty = false } // the frame model has just arrived: draw it
    if (!calm) animateLife(t)
    ttLed.visible = playing
    const spinTarget = playing && !calm ? (rpmFor(tempo) / 60) * Math.PI * 2 : 0
    spin += (spinTarget - spin) * Math.min(1, dt * (playing ? 1.4 : 0.9))
    if (spin > 0.002) platter.rotation.y -= dt * spin
    if (Math.abs(spinTarget - spin) > 0.05) moving = true
    // lights pulse softly on the beat while a song plays; the candle flickers
    const beat = playing && !calm && tempo > 30 ? Math.exp(-5 * (((t * tempo) / 60) % 1)) : 0
    const glow = playing ? 0.82 + 0.38 * beat : 0.7
    fairyMat.color.setRGB(1, 0.85, 0.66).multiplyScalar(glow)
    shadeMat.color.setRGB(1, 0.86, 0.68).multiplyScalar(0.8 + 0.25 * beat)
    flame.scale.y = 1.7 + Math.sin(t * 9) * 0.18 + Math.sin(t * 23) * 0.1
    candleLight.intensity = 0.045 + Math.sin(t * 7) * 0.008 + Math.sin(t * 19) * 0.005
    armAngle += ((playing ? 0 : 0.45) - armAngle) * Math.min(1, dt * 2) // 0 = the needle on the record, 0.45 = back on its rest
    arm.rotation.y = armAngle
    // the iPod's progress bar moves on once a second while something plays
    if (screenNow?.playing && performance.now() - screenDrawn > 1000) redrawScreen()
    if (updateSound(dt, t, camera, !!screenNow?.playing && !holdIpod && !calm)) moving = true
    if (updateDeck(dt, t)) moving = true

    // the disc travels: out of the sleeve, in an arc, down onto the platter
    if (recFlight) {
      const l = recUri ? loose.get(recUri) : undefined
      moving = true
      if (recFlight.wait > 0) recFlight.wait -= dt
      else if (!l) { recFlight = null; recOn = true; rec.visible = true } // no sleeve to come from: it is just there
      else {
        recFlight.t = Math.min(1, recFlight.t + dt / 1.25)
        const k = easeIO(recFlight.t)
        vA.copy(l.mesh.position).add(vB.set(0, 0.05, 0).applyQuaternion(l.mesh.quaternion)) // where the disc sits in the sleeve
        qStart.copy(l.mesh.quaternion).multiply(qZ90)
        flyDisc.position.lerpVectors(vA, recEnd, k)
        flyDisc.position.y += Math.sin(Math.PI * k) * 0.16
        flyDisc.quaternion.slerpQuaternions(qStart, qId, k)
        flyDisc.visible = true
        if (recFlight.t >= 1) { recFlight = null; recOn = true; rec.visible = true; flyDisc.visible = false }
      }
    }

    camera.getWorldDirection(camFwd)
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
    group.getWorldQuaternion(groupQ).invert()

    // records that should be off the shelf get a loose mesh; the rest stay instanced
    for (const uri of [selectedUri, playingUri, peekUri]) {
      if (!uri) continue
      const r = recordFor(uri)
      if (r && !loose.has(uri)) loose.set(uri, makeLoose(r))
      else { const l = loose.get(uri); if (l) l.returning = false }
    }
    for (const [uri, l] of loose) {
      if (uri !== selectedUri && uri !== playingUri && uri !== peekUri) l.returning = true
    }

    // hover: slide the record out a little
    for (const r of records) {
      const target = r.album.uri === hoverUri || filterSet?.has(r.album.uri) || r.album.uri === dailyUri ? 1 : 0
      if (Math.abs(target - r.out) > 0.001) {
        r.out += (target - r.out) * Math.min(1, dt * 10)
        if (!r.hidden) writeInstance(r)
        moving = true
      }
    }

    for (const [uri, l] of loose) {
      const r = l.rec
      const sel = uri === selectedUri && !l.returning
      const isPlaying = uri === playingUri && !sel && !l.returning
      const slot = r.guest ? null : stackSlot(uri)
      const peek = uri === peekUri && uri !== playingUri && !slot && !sel && !l.returning // the album that's playing already lies on the table: browsing past it must not pull it back to the shelf
      let scale = 1
      if (sel) {
        // hold still in front of the camera, cover (local +x) facing it – or flipped over to its back
        tmpV.copy(camera.position).addScaledVector(camFwd, 0.95).addScaledVector(camUp, -0.03)
        targetPos.copy(group.worldToLocal(tmpV))
        ax.copy(camFwd)
        if (!flipSel) ax.negate()
        ay.copy(camUp)
        az.crossVectors(ax, ay)
        basis.makeBasis(ax, ay, az)
        targetQ.setFromRotationMatrix(basis).premultiply(groupQ)
        scale = 1.05
      } else if (peek) {
        // pulled out in front of its slot and turned so the cover faces the room
        targetPos.set(r.home.x, r.home.y + 0.06, FRONT_Z + 0.1)
        targetQ.setFromEuler(targetRot.set(0, -Math.PI / 2, 0))
      } else if (isPlaying) {
        // "now playing" display: standing next to the turntable, leaning back against the wall,
        // cover facing the room and turned a little towards the listening spot
        targetPos.set(0.06, TOP_Y + LEAN_UP, LEAN_Z)
        targetQ.copy(LEAN_Q)
      } else if (slot) {
        // back on the table, in its place in the stack
        targetPos.copy(slot.pos)
        targetQ.copy(slot.q)
      } else {
        targetPos.copy(r.home)
        targetQ.identity()
      }
      // the vinyl slides out of the sleeve a little (held / browsed / playing) and back in
      const wantOut = sel ? 0.056 : peek ? 0.05 : isPlaying ? 0.042 : 0
      if (Math.abs(wantOut - l.disc.position.y) > 0.0004) { l.disc.position.y += (wantOut - l.disc.position.y) * Math.min(1, dt * 5); moving = true }
      // the record that is on the turntable is not in its sleeve any more
      l.disc.visible = !(uri === recUri && (recOn || (recFlight && recFlight.wait <= 0)))
      const k = sel ? 55 : 90, c = sel ? 11 : 14
      l.vel.x += ((targetPos.x - l.mesh.position.x) * k - l.vel.x * c) * dt
      l.vel.y += ((targetPos.y - l.mesh.position.y) * k - l.vel.y * c) * dt
      l.vel.z += ((targetPos.z - l.mesh.position.z) * k - l.vel.z * c) * dt
      l.mesh.position.addScaledVector(l.vel, dt)
      const e = Math.min(1, dt * 6)
      l.mesh.quaternion.slerp(targetQ, e)
      l.mesh.scale.setScalar(l.mesh.scale.x + (scale - l.mesh.scale.x) * e)
      if (l.vel.lengthSq() > 1e-6 || l.mesh.quaternion.angleTo(targetQ) > 0.002) moving = true
      // back home: hand it back to the instanced shelf
      if (l.returning && l.mesh.position.distanceTo(targetPos) < 0.002 && l.mesh.quaternion.angleTo(targetQ) < 0.01) dropLoose(uri)
    }

    // a sleeve from the stack that has been picked up is not in the stack meanwhile
    for (const m of stackGroup.children) m.visible = !loose.has(stackItems[m.userData.index]?.uri)

    // iPod: on its stand, or held in front of the camera
    if (holdIpod) {
      // distance chosen so the whole iPod (click wheel included) fills ~64 % of the view height,
      // nudged up a little to leave room for the "put down" button underneath
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
      // it should nearly fill the screen – and on a phone (narrow, tall view) almost all of it, like using a real iPod
      const phone = camera.aspect < 0.9
      const hf = phone ? 0.84 : ipodBig ? 0.9 : 0.72
      const wf = phone ? 0.94 : ipodBig ? 0.7 : 0.5
      const fitH = H / (hf * 2 * tanH)
      const fitW = W / (wf * 2 * tanH * camera.aspect)
      const dist = Math.max(fitH, fitW)
      tmpV.copy(camera.position).addScaledVector(camFwd, dist).addScaledVector(camUp, (phone ? 0.02 : ipodBig ? 0.01 : -0.03) * dist * tanH * 2)
      targetPos.copy(group.worldToLocal(tmpV))
      ipod.position.lerp(targetPos, Math.min(1, dt * 7))
      tmpQ.copy(camera.quaternion).premultiply(groupQ)
      ipod.quaternion.slerp(tmpQ, Math.min(1, dt * 7))
      body.rotation.x += (0 - body.rotation.x) * Math.min(1, dt * 7)
      body.position.y += (-0.0 - body.position.y) * Math.min(1, dt * 7)
      stand.visible = false
      if (ipod.position.distanceTo(targetPos) > 0.0005 || ipod.quaternion.angleTo(tmpQ) > 0.002) moving = true
    } else {
      ipod.position.lerp(ipodHome.pos, Math.min(1, dt * 6))
      tmpQ.setFromEuler(new THREE.Euler(0, ipodHome.rotY, 0))
      ipod.quaternion.slerp(tmpQ, Math.min(1, dt * 6))
      body.rotation.x += (-0.18 - body.rotation.x) * Math.min(1, dt * 6)
      body.position.y += (0.105 - body.position.y) * Math.min(1, dt * 6)
      stand.visible = ipod.position.distanceTo(ipodHome.pos) < 0.02
      if (ipod.position.distanceTo(ipodHome.pos) > 0.002) moving = true
    }
    return moving
  }

  /** Screen rectangle of the record held up to the camera (for the play button / caption overlay). */
  const boxCorner = new THREE.Vector3()
  function selectedRect(camera: THREE.Camera, width: number, height: number): ScreenRect | null {
    const l = selectedUri ? loose.get(selectedUri) : undefined
    if (!l || l.returning) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let i = 0; i < 8; i++) {
      boxCorner.set(i & 1 ? SLEEVE_T / 2 : -SLEEVE_T / 2, i & 2 ? SLEEVE / 2 : -SLEEVE / 2, i & 4 ? SLEEVE / 2 : -SLEEVE / 2)
      l.mesh.localToWorld(boxCorner).project(camera)
      const x = (boxCorner.x + 1) / 2 * width
      const y = (1 - boxCorner.y) / 2 * height
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }

  /** The iPod screen's rectangle on screen (CSS px relative to the canvas), for the HTML overlay. */
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  function ipodScreenRect(camera: THREE.Camera, width: number, height: number): ScreenRect {
    const hw = SW / 2, hh = SH / 2
    corners[0].set(-hw, hh, 0); corners[1].set(hw, hh, 0); corners[2].set(-hw, -hh, 0); corners[3].set(hw, -hh, 0)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const c of corners) {
      screen.localToWorld(c)
      c.project(camera)
      const x = (c.x + 1) / 2 * width
      const y = (1 - c.y) / 2 * height
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }

  return {
    group,
    setState,
    setHover(uri: string | null) { hoverUri = uri },
    setSelected(uri: string | null) { selectedUri = uri },
    setPeek(uri: string | null) { peekUri = uri },
    setFilter(list: string[] | null | undefined) { filterSet = list?.length ? new Set(list) : null },
    setDeck(v: boolean) { deckOn = !!v },
    setHoldIpod(v: boolean, big = false) { holdIpod = v; ipodBig = big },
    setFlip(v: boolean) { flipSel = v },
    setCalm(v: boolean) { calm = !!v },
    setDaily(uri: string | null | undefined) { dailyUri = uri ?? null },
    setStack,
    setNext,
    setTempo(bpm: number | string | null | undefined) { tempo = Number(bpm) || 0 },
    isSpinning: () => playing || spin > 0.02,
    isHoldingIpod: () => holdIpod,
    ipodScreenRect,
    selectedRect,
    update,
  }
}
