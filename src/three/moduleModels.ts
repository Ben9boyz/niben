import * as THREE from 'three'
import { canvasTex } from './textures'

// A little model for each hobby, built from simple shapes: a chess table with a board and pieces, an espresso machine, a tent
// with a campfire … `build(g, colour)` fills a group standing on the floor (about 0.7 m across) and returns how tall it is.
export type Builder = (g: THREE.Group, col: THREE.Color) => number

const M = {
  wood: new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 0.7 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x5a3d26, roughness: 0.75 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf4f4f1, roughness: 0.6 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.5 }),
  grey: new THREE.MeshStandardMaterial({ color: 0x8a94a3, roughness: 0.5, metalness: 0.4 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xc9d1db, roughness: 0.25, metalness: 0.9 }),
  green: new THREE.MeshStandardMaterial({ color: 0x3f9e57, roughness: 0.7 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xbfe4ff, roughness: 0.05, transparent: true, opacity: 0.28 }),
  water: new THREE.MeshStandardMaterial({ color: 0x3aa0e0, roughness: 0.2, transparent: true, opacity: 0.55 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd7b56d, metalness: 1, roughness: 0.3 }),
  red: new THREE.MeshStandardMaterial({ color: 0xd64545, roughness: 0.55 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xf2e6c9, roughness: 0.8 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0x5b6b8a, roughness: 0.95 }),
}
const mat = (c: THREE.Color | number, r = 0.55): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: c, roughness: r })
const glow = (c: number, i = 1): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i })

function add(g: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rot?: [number, number, number]): THREE.Mesh {
  const o = new THREE.Mesh(geo, m)
  o.position.set(x, y, z)
  if (rot) o.rotation.set(...rot)
  o.castShadow = true
  o.receiveShadow = true
  g.add(o)
  return o
}
const B = (w: number, h: number, d: number): THREE.BoxGeometry => new THREE.BoxGeometry(w, h, d)
const C = (rt: number, rb: number, h: number, s = 24): THREE.CylinderGeometry => new THREE.CylinderGeometry(rt, rb, h, s)
const S = (r: number, s = 20): THREE.SphereGeometry => new THREE.SphereGeometry(r, s, Math.max(8, s * 0.7 | 0))
const lathe = (pts: [number, number][], seg = 20): THREE.LatheGeometry => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)
const tex = (w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ map: canvasTex(w, h, draw), roughness: 0.6 })

/** A table with four legs; returns the height of its top. */
function table(g: THREE.Group, w = 0.8, d = 0.56, h = 0.72, top: THREE.Material = M.wood): number {
  add(g, B(w, 0.045, d), top, 0, h, 0)
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) add(g, B(0.05, h, 0.05), M.dark, x * (w / 2 - 0.05), h / 2, z * (d / 2 - 0.05))
  return h + 0.0225
}
function wheel(g: THREE.Group, x: number, y: number, z: number, r: number, tube = 0.025): void {
  add(g, new THREE.TorusGeometry(r, tube, 10, 28), M.black, x, y, z, [0, Math.PI / 2, 0])
  add(g, new THREE.TorusGeometry(r * 0.98, 0.004, 4, 28), M.steel, x, y, z, [0, Math.PI / 2, 0])
  add(g, C(0.02, 0.02, 0.04, 10), M.steel, x, y, z, [0, 0, Math.PI / 2])
}
function pieceSet(g: THREE.Group, x0: number, z: number, y: number, m: THREE.Material, back: boolean): void {
  const pawn = lathe([[0, 0], [0.022, 0], [0.02, 0.012], [0.009, 0.03], [0.014, 0.04], [0.012, 0.05], [0, 0.055]], 14)
  const big = lathe([[0, 0], [0.026, 0], [0.022, 0.016], [0.011, 0.045], [0.018, 0.06], [0.016, 0.075], [0, 0.082]], 14)
  for (let i = 0; i < 8; i++) {
    add(g, pawn, m, x0 + i * 0.0625, y, z + (back ? -0.0625 : 0.0625))
    if (i === 3 || i === 4 || i === 0 || i === 7) add(g, big, m, x0 + i * 0.0625, y, z)
    else add(g, pawn, m, x0 + i * 0.0625, y + 0.002, z)
  }
}

export const MODELS: Record<string, Builder> = {
  // ── Se, lytt og spill ──
  sjakk(g, col) {
    const top = table(g, 0.8, 0.62, 0.7)
    const board = tex(256, 256, (x, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#6f4a2a' : '#ecd7a6'; x.fillRect((i * w) / 8, (j * h) / 8, w / 8 + 1, h / 8 + 1) } })
    add(g, B(0.5, 0.02, 0.5), board, 0, top + 0.01, 0)
    pieceSet(g, -0.219, 0.19, top + 0.02, M.white, true)
    pieceSet(g, -0.219, -0.19, top + 0.02, M.black, false)
    add(g, B(0.1, 0.05, 0.06), mat(col), 0.34, top + 0.025, 0.2) // the clock
    add(g, B(0.04, 0.012, 0.04), M.white, 0.32, top + 0.056, 0.2); add(g, B(0.04, 0.012, 0.04), M.white, 0.36, top + 0.056, 0.2)
    return 0.9
  },
  filmer(g, col) {
    add(g, B(0.8, 0.28, 0.34), M.dark, 0, 0.14, 0)
    add(g, B(0.7, 0.025, 0.3), M.wood, 0, 0.29, 0)
    const screen = tex(256, 144, (x, w, h) => { const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1b2340'); gr.addColorStop(1, '#b3213c'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); x.moveTo(w * 0.44, h * 0.3); x.lineTo(w * 0.64, h * 0.5); x.lineTo(w * 0.44, h * 0.7); x.fill() })
    screen.emissiveMap = screen.map; screen.emissive = new THREE.Color(0xffffff); screen.emissiveIntensity = 0.7
    add(g, B(0.74, 0.44, 0.03), M.black, 0, 0.53, -0.03)
    add(g, new THREE.PlaneGeometry(0.7, 0.394), screen, 0, 0.53, -0.013)
    add(g, B(0.1, 0.05, 0.04), M.grey, 0, 0.32, -0.03)
    // popcorn bucket
    const stripes = tex(128, 128, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#fff' : '#d64545'; x.fillRect((i * w) / 8, 0, w / 8, h) } })
    add(g, C(0.075, 0.05, 0.12, 16), stripes, 0.28, 0.35, 0.05)
    for (let i = 0; i < 9; i++) add(g, S(0.028, 8), M.cream, 0.28 + Math.cos(i * 2.3) * 0.045, 0.43 + (i % 3) * 0.012, 0.05 + Math.sin(i * 2.3) * 0.045)
    // clapperboard
    add(g, B(0.16, 0.12, 0.012), M.black, -0.28, 0.36, 0.08, [-0.5, 0, 0]); add(g, B(0.16, 0.025, 0.014), M.white, -0.28, 0.43, 0.115, [-0.5, 0, 0.08])
    return 0.8
  },
  serier(g, col) {
    add(g, B(0.46, 0.4, 0.4), mat(0x6a4a30), 0, 0.5, 0)
    add(g, B(0.36, 0.28, 0.02), M.black, -0.03, 0.5, 0.2)
    add(g, new THREE.PlaneGeometry(0.34, 0.26), glow(0x6fa8ff, 0.8), -0.03, 0.5, 0.212)
    for (const y of [0.56, 0.5, 0.44]) add(g, B(0.05, 0.012, 0.02), M.black, 0.17, y, 0.2)
    add(g, C(0.02, 0.02, 0.06, 10), M.gold, 0.17, 0.62, 0.2)
    for (const s of [-1, 1]) add(g, C(0.006, 0.006, 0.4, 6), M.steel, s * 0.08, 0.86, 0, [0, 0, s * 0.5])
    for (const s of [-1, 1]) add(g, B(0.04, 0.3, 0.04), M.dark, s * 0.18, 0.15, 0)
    add(g, B(0.46, 0.04, 0.4), M.dark, 0, 0.3, 0)
    return 1.05
  },
  podkaster(g, col) {
    add(g, C(0.12, 0.14, 0.03, 24), M.black, 0, 0.015, 0)
    add(g, C(0.012, 0.012, 0.9, 10), M.grey, 0, 0.47, 0)
    add(g, C(0.045, 0.045, 0.16, 20), M.steel, 0, 1.0, 0)
    add(g, S(0.045, 18), M.steel, 0, 1.08, 0)
    add(g, new THREE.TorusGeometry(0.06, 0.006, 8, 24), M.black, 0, 1.0, 0.02, [Math.PI / 2, 0, 0])
    add(g, C(0.22, 0.22, 0.012, 24), mat(col), 0, 0.82, 0.12, [Math.PI / 2, 0, 0]) // pop filter
    return 1.3
  },
  brettspill(g, col) {
    const top = table(g, 0.8, 0.8, 0.62)
    const board = tex(256, 256, (x, w, h) => { x.fillStyle = '#f0e6c8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#555'; x.lineWidth = 2; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo((i * w) / 8, 0); x.lineTo((i * w) / 8, h); x.moveTo(0, (i * h) / 8); x.lineTo(w, (i * h) / 8); x.stroke() } x.fillStyle = '#' + col.getHexString(); x.fillRect(0, 0, w / 4, h / 4); x.fillStyle = '#2b8cff'; x.fillRect(w * 0.75, h * 0.75, w / 4, h / 4) })
    add(g, B(0.58, 0.015, 0.58), board, 0, top + 0.008, 0)
    for (const [x, z, c] of [[-0.18, -0.2, 0xd64545], [0.2, 0.18, 0x2b8cff], [-0.1, 0.1, 0xf5a524], [0.12, -0.12, 0x2fa84f]] as const) add(g, lathe([[0, 0], [0.02, 0], [0.012, 0.03], [0.016, 0.045], [0, 0.055]], 12), mat(c), x, top + 0.015, z)
    for (const [x, z, r] of [[0.3, -0.3, 0.4], [0.35, -0.22, 1.1]] as const) add(g, B(0.04, 0.04, 0.04), M.white, x - 0.1, top + 0.035, z, [0.3, r, 0.2])
    return 0.85
  },
  retro(g, col) { // arcade cabinet
    add(g, B(0.56, 1.4, 0.5), mat(col, 0.5), 0, 0.7, 0)
    add(g, B(0.46, 0.34, 0.02), M.black, 0, 1.05, 0.255)
    const sc = tex(128, 96, (x, w, h) => { x.fillStyle = '#05070f'; x.fillRect(0, 0, w, h); x.fillStyle = '#7cf'; for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) x.fillRect(14 + i * 20, 12 + j * 14, 11, 7); x.fillStyle = '#fc4'; x.fillRect(w / 2 - 6, h - 16, 12, 6) })
    sc.emissiveMap = sc.map; sc.emissive = new THREE.Color(0xffffff); sc.emissiveIntensity = 0.9
    add(g, new THREE.PlaneGeometry(0.42, 0.3), sc, 0, 1.05, 0.268)
    add(g, B(0.56, 0.06, 0.34), M.dark, 0, 0.78, 0.27, [0.25, 0, 0]) // control panel
    add(g, C(0.012, 0.012, 0.08, 8), M.black, -0.1, 0.84, 0.3); add(g, S(0.028, 12), M.red, -0.1, 0.89, 0.3)
    for (const x of [0.06, 0.12, 0.18]) add(g, C(0.02, 0.02, 0.012, 12), glow(x > 0.1 ? 0xffcc33 : 0x33ccff, 0.6), x, 0.82, 0.3)
    add(g, B(0.56, 0.12, 0.02), glow(0xffffff, 0.35), 0, 1.34, 0.255)
    return 1.6
  },
  piano(g, col) {
    add(g, B(0.9, 0.95, 0.4), mat(0x1c1c20, 0.3), 0, 0.575, -0.05)
    add(g, B(0.9, 0.04, 0.12), M.black, 0, 0.64, 0.2)
    for (let i = 0; i < 14; i++) add(g, B(0.0585, 0.02, 0.1), M.white, -0.4 + i * 0.0615, 0.665, 0.21)
    for (const i of [0, 1, 3, 4, 5, 7, 8, 10, 11, 12]) add(g, B(0.034, 0.025, 0.06), M.black, -0.37 + i * 0.0615, 0.682, 0.18)
    add(g, B(0.3, 0.2, 0.012), M.black, 0, 0.82, 0.14, [-0.2, 0, 0])
    add(g, B(0.9, 0.03, 0.4), mat(0x1c1c20, 0.3), 0, 1.06, -0.05)
    for (const s of [-1, 1]) add(g, B(0.05, 0.62, 0.05), M.black, s * 0.4, 0.31, 0.2)
    add(g, B(0.4, 0.04, 0.2), mat(col), 0, 0.28, 0.45) // stool
    add(g, C(0.015, 0.015, 0.26, 8), M.black, 0, 0.14, 0.45)
    return 1.3
  },
  dans(g, col) {
    add(g, C(0.3, 0.3, 0.025, 32), M.wood, 0, 0.0125, 0)
    add(g, C(0.012, 0.012, 1.0, 8), M.grey, 0, 0.5, 0)
    const ball = tex(256, 128, (x, w, h) => { x.fillStyle = '#cfd6e2'; x.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : '#8ea0b8'; x.fillRect((i * w) / 16, (j * h) / 8, w / 16, h / 8) } })
    ball.metalness = 0.9; ball.roughness = 0.15
    add(g, S(0.16, 24), ball, 0, 1.12, 0)
    add(g, B(0.05, 0.3, 0.05), M.dark, 0.2, 0.17, 0); add(g, S(0.05, 12), mat(col), 0.2, 0.36, 0)
    return 1.45
  },
  // ── Mat og drikke ──
  oppskrifter(g, col) {
    const top = table(g, 0.8, 0.5, 0.72)
    add(g, C(0.11, 0.09, 0.1, 24), mat(col, 0.35), -0.15, top + 0.05, 0); add(g, C(0.085, 0.085, 0.012, 24), M.steel, -0.15, top + 0.105, 0)
    add(g, B(0.05, 0.015, 0.016), M.dark, -0.28, top + 0.09, 0, [0, 0, 0.1]); add(g, B(0.05, 0.015, 0.016), M.dark, -0.02, top + 0.09, 0, [0, 0, -0.1])
    add(g, B(0.2, 0.014, 0.14), M.wood, 0.2, top + 0.007, 0.05)
    add(g, S(0.035, 14), mat(0xd64545), 0.17, top + 0.04, 0.05); add(g, S(0.03, 14), mat(0xf5a524), 0.24, top + 0.035, 0.03)
    add(g, B(0.1, 0.012, 0.012), M.steel, 0.2, top + 0.018, 0.14)
    add(g, B(0.1, 0.18, 0.05), M.cream, 0.34, top + 0.1, -0.15, [0, -0.3, 0]) // cookbook standing
    return 1.0
  },
  restauranter(g, col) {
    const top = table(g, 0.7, 0.7, 0.72, mat(0xf2ede4, 0.9))
    add(g, C(0.1, 0.1, 0.012, 28), M.white, -0.1, top + 0.006, 0.1)
    add(g, C(0.14, 0.14, 0.008, 28), M.white, -0.1, top + 0.004, 0.1)
    add(g, lathe([[0, 0], [0.11, 0], [0.1, 0.07], [0.05, 0.13], [0.018, 0.15], [0.02, 0.17], [0, 0.175]], 24), M.steel, 0.15, top, -0.1) // cloche
    for (const s of [-1, 1]) add(g, B(0.012, 0.0025, 0.2), M.steel, -0.1 + s * 0.2, top + 0.002, 0.1)
    add(g, C(0.03, 0.03, 0.11, 14), M.glass, 0.26, top + 0.055, 0.2); add(g, C(0.028, 0.028, 0.06, 14), mat(0xa02850, 0.3), 0.26, top + 0.03, 0.2)
    add(g, B(0.1, 0.005, 0.14), mat(col), -0.28, top + 0.003, -0.15)
    add(g, C(0.015, 0.015, 0.12, 10), M.green, 0.0, top + 0.06, -0.25); add(g, S(0.03, 10), mat(0xff7aa8), 0.0, top + 0.13, -0.25)
    return 1.05
  },
  baking(g, col) {
    const top = table(g, 0.8, 0.5, 0.72)
    add(g, lathe([[0, 0], [0.09, 0.0], [0.13, 0.09], [0.14, 0.11], [0.13, 0.115], [0, 0.04]], 24), mat(0xe7e1d4, 0.5), -0.15, top, 0)
    const loaf = add(g, S(0.1, 18), mat(0xc98a4b, 0.8), 0.17, top + 0.04, 0.02); loaf.scale.set(1.5, 0.7, 0.85)
    for (let i = -1; i <= 1; i++) add(g, B(0.004, 0.004, 0.09), mat(0xe8c48a), 0.17 + i * 0.05, top + 0.1, 0.02, [0, 0.5, 0])
    add(g, C(0.016, 0.016, 0.24, 10), M.wood, -0.05, top + 0.016, -0.18, [0, 0, Math.PI / 2]); add(g, S(0.02, 8), M.wood, -0.18, top + 0.016, -0.18); add(g, S(0.02, 8), M.wood, 0.08, top + 0.016, -0.18)
    add(g, B(0.12, 0.05, 0.08), M.white, 0.3, top + 0.025, -0.15); void col
    return 0.95
  },
  kaffe(g, col) {
    const top = table(g, 0.8, 0.5, 0.72)
    add(g, B(0.3, 0.3, 0.26), mat(col, 0.3), -0.12, top + 0.15, -0.05)
    add(g, B(0.3, 0.03, 0.28), M.steel, -0.12, top + 0.315, -0.05)
    add(g, C(0.03, 0.03, 0.06, 12), M.steel, -0.12, top + 0.2, 0.1); add(g, B(0.018, 0.018, 0.1), M.black, -0.12, top + 0.2, 0.17)
    add(g, C(0.045, 0.035, 0.06, 16), M.white, -0.12, top + 0.035, 0.1)
    add(g, new THREE.TorusGeometry(0.03, 0.006, 8, 12, Math.PI), M.white, -0.075, top + 0.045, 0.1, [0, 0, -Math.PI / 2])
    add(g, C(0.05, 0.05, 0.06, 16), mat(0xd64545), 0.2, top + 0.03, 0.1); add(g, C(0.045, 0.045, 0.01, 16), mat(0x4a2c17), 0.2, top + 0.058, 0.1)
    add(g, lathe([[0, 0], [0.05, 0], [0.055, 0.16], [0.03, 0.2], [0.03, 0.24], [0, 0.24]], 16), M.glass, 0.25, top, -0.12) // beans jar
    add(g, S(0.04, 10), mat(0x3b2412), 0.25, top + 0.04, -0.12)
    return 1.1
  },
  vin(g, col) {
    add(g, B(0.7, 1.0, 0.3), M.dark, 0, 0.5, 0)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const y = 0.12 + r * 0.24, x = -0.24 + c * 0.16 + (r % 2) * 0.04
      add(g, C(0.034, 0.034, 0.26, 12), r % 2 ? mat(0x1f3d1f, 0.2) : mat(col, 0.2), x, y, 0.2, [Math.PI / 2, 0, 0])
      add(g, C(0.012, 0.015, 0.08, 8), M.black, x, y, 0.35, [Math.PI / 2, 0, 0])
    }
    return 1.15
  },
  // ── Skap og bygg ──
  lego(g, col) {
    const top = table(g, 0.8, 0.6, 0.55)
    const brick = (x: number, z: number, y: number, w: number, d: number, c: number): void => {
      add(g, B(w * 0.03, 0.03, d * 0.03), mat(c, 0.4), x, y + 0.015, z)
      for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) add(g, C(0.008, 0.008, 0.008, 8), mat(c, 0.4), x + (i - (w - 1) / 2) * 0.03, y + 0.034, z + (j - (d - 1) / 2) * 0.03)
    }
    for (let i = 0; i < 4; i++) for (const [x, z, w, d, c] of [[-0.1, 0, 4, 2, 0xd64545], [0.1, 0.02, 2, 4, 0x2b8cff], [0, -0.14, 4, 2, 0xf5c518]] as const) brick(x, z, top + i * 0.03, w, d, c)
    add(g, C(0.012, 0.012, 0.04, 8), mat(0xf5c518), 0.28, top + 0.02, 0.18); add(g, S(0.015, 8), mat(0xf5c518), 0.28, top + 0.048, 0.18)
    void col
    return 0.85
  },
  modell(g, col) {
    add(g, C(0.14, 0.17, 0.04, 24), M.dark, 0, 0.02, 0)
    add(g, C(0.01, 0.01, 0.5, 8), M.steel, 0, 0.27, 0)
    const fus = add(g, S(0.06, 16), mat(col, 0.35), 0, 0.56, 0); fus.scale.set(0.5, 0.5, 3.4)
    add(g, B(0.5, 0.012, 0.1), mat(col, 0.35), 0, 0.56, 0.02, [0, 0, 0.1]); add(g, B(0.2, 0.01, 0.06), mat(col, 0.35), 0, 0.58, -0.17); add(g, B(0.01, 0.1, 0.07), mat(col, 0.35), 0, 0.62, -0.17)
    add(g, S(0.025, 10), M.glass, 0, 0.58, 0.1); add(g, C(0.03, 0.03, 0.01, 12), M.black, 0, 0.56, 0.21, [Math.PI / 2, 0, 0])
    return 0.9
  },
  kunst(g, col) {
    for (const [x, r] of [[-0.25, 0.14], [0.25, -0.14]] as const) add(g, B(0.04, 1.3, 0.04), M.dark, x, 0.65, 0.05, [0, 0, r])
    add(g, B(0.04, 1.2, 0.04), M.dark, 0, 0.62, -0.3, [0.25, 0, 0]); add(g, B(0.6, 0.04, 0.06), M.dark, 0, 0.42, 0.1)
    const art = tex(256, 192, (x, w, h) => { x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, w, h); const gr = x.createLinearGradient(0, 0, 0, h * 0.6); gr.addColorStop(0, '#79b8ff'); gr.addColorStop(1, '#ffd7a3'); x.fillStyle = gr; x.fillRect(12, 12, w - 24, h * 0.55); x.fillStyle = '#' + col.getHexString(); x.beginPath(); x.moveTo(12, h * 0.67); x.lineTo(w * 0.35, h * 0.3); x.lineTo(w * 0.6, h * 0.67); x.fill(); x.fillStyle = '#4c9a5a'; x.fillRect(12, h * 0.67, w - 24, h * 0.28) })
    add(g, B(0.64, 0.5, 0.02), M.white, 0, 0.78, 0.11); add(g, new THREE.PlaneGeometry(0.6, 0.46), art, 0, 0.78, 0.122)
    const pal = add(g, C(0.11, 0.11, 0.012, 18), M.wood, 0.34, 0.9, 0.3, [0.3, 0, 0.3]); pal.scale.set(1.2, 1, 0.8)
    for (const [i, c] of [0xd64545, 0xf5c518, 0x2b8cff, 0x2fa84f].entries()) add(g, S(0.016, 8), mat(c), 0.3 + i * 0.03, 0.915, 0.3)
    return 1.35
  },
  foto(g, col) {
    for (const [x, z] of [[0, 0.22], [-0.2, -0.14], [0.2, -0.14]] as const) add(g, C(0.01, 0.014, 1.1, 8), M.black, x * 0.55, 0.55, z * 0.45, [z * 0.3, 0, -x * 0.6])
    add(g, B(0.1, 0.04, 0.1), M.black, 0, 1.12, 0)
    add(g, B(0.2, 0.13, 0.1), M.black, 0, 1.22, 0); add(g, B(0.2, 0.02, 0.1), mat(col), 0, 1.29, 0)
    add(g, C(0.045, 0.05, 0.1, 20), M.grey, 0, 1.22, 0.1, [Math.PI / 2, 0, 0]); add(g, C(0.034, 0.034, 0.012, 20), M.glass, 0, 1.22, 0.152, [Math.PI / 2, 0, 0])
    add(g, B(0.04, 0.025, 0.04), M.white, 0.07, 1.31, 0)
    return 1.5
  },
  strikking(g, col) {
    add(g, lathe([[0, 0], [0.16, 0], [0.19, 0.12], [0.17, 0.2], [0.13, 0.22]], 18), mat(0xc79a62, 0.9), 0, 0, 0) // basket
    for (const [x, z, c] of [[-0.05, 0, col], [0.07, 0.04, new THREE.Color(0xf5c518)], [0.0, -0.07, new THREE.Color(0x2b8cff)]] as const) add(g, S(0.09, 14), mat(c, 0.95), x, 0.25, z)
    for (const s of [-1, 1]) add(g, C(0.006, 0.006, 0.5, 8), M.wood, s * 0.05 + 0.02, 0.45, 0.02, [0.1, 0, s * 0.25])
    return 0.75
  },
  diy(g, col) {
    const top = table(g, 0.9, 0.5, 0.78)
    add(g, B(0.9, 0.03, 0.1), M.dark, 0, top + 0.3, -0.25) // pegboard shelf
    add(g, B(0.9, 0.5, 0.02), mat(0xcaa66a, 0.9), 0, top + 0.5, -0.27)
    add(g, B(0.016, 0.16, 0.012), M.steel, -0.2, top + 0.55, -0.255); add(g, B(0.09, 0.03, 0.03), mat(col), -0.2, top + 0.64, -0.255) // hammer
    for (const x of [0, 0.1, 0.2]) add(g, B(0.012, 0.14 + x * 0.1, 0.012), mat(0xd64545), x, top + 0.55, -0.255)
    add(g, B(0.14, 0.12, 0.1), mat(col, 0.4), 0.25, top + 0.06, 0.05); add(g, C(0.01, 0.01, 0.1, 8), M.steel, 0.25, top + 0.17, 0.05)
    add(g, B(0.3, 0.04, 0.12), M.wood, -0.15, top + 0.02, 0.1); add(g, S(0.02, 8), M.steel, -0.05, top + 0.05, 0.1)
    return 1.35
  },
  samling(g, col) {
    add(g, B(0.7, 0.7, 0.4), M.dark, 0, 0.35, 0)
    add(g, B(0.64, 0.5, 0.34), M.glass, 0, 0.95, 0)
    add(g, B(0.66, 0.02, 0.36), M.dark, 0, 1.2, 0)
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) add(g, B(0.1, 0.14, 0.012), mat(i % 2 ? col : new THREE.Color(0xf5c518), 0.4), -0.22 + j * 0.15, 0.78 + (i === 2 ? 0.2 : 0), 0.1, [0, 0, 0])
    add(g, C(0.05, 0.05, 0.012, 18), M.gold, 0, 0.74, 0.0)
    return 1.3
  },
  // ── Natur og dyr ──
  planter(g, col) {
    add(g, lathe([[0, 0], [0.12, 0], [0.16, 0.26], [0.18, 0.3], [0.16, 0.3], [0, 0.26]], 22), mat(col, 0.6), 0, 0, 0)
    add(g, C(0.15, 0.15, 0.01, 18), mat(0x4a3220, 1), 0, 0.28, 0)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, r = 0.05 + (i % 3) * 0.04
      add(g, C(0.006, 0.008, 0.45 + (i % 3) * 0.12, 6), M.green, Math.cos(a) * r, 0.5, Math.sin(a) * r, [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35])
      const leaf = add(g, S(0.1, 12), mat(0x2f8a47 + (i % 3) * 0x080800, 0.5), Math.cos(a) * (r + 0.17), 0.68 + (i % 3) * 0.1, Math.sin(a) * (r + 0.17)); leaf.scale.set(1, 0.14, 0.65); leaf.rotation.y = -a; leaf.rotation.z = 0.3
    }
    return 1.05
  },
  akvarium(g, col) {
    add(g, B(0.78, 0.04, 0.42), M.dark, 0, 0.02, 0)
    add(g, B(0.78, 0.04, 0.42), M.dark, 0, 0.58, 0)
    add(g, B(0.74, 0.4, 0.38), M.glass, 0, 0.3, 0)
    add(g, B(0.74, 0.32, 0.38), M.water, 0, 0.26, 0)
    add(g, B(0.74, 0.04, 0.38), mat(0xe3cf9a, 1), 0, 0.1, 0)
    for (const [x, z] of [[-0.2, -0.08], [0.1, 0.05], [0.25, -0.1]] as const) { add(g, C(0.004, 0.006, 0.18, 5), M.green, x, 0.2, z); add(g, S(0.03, 8), M.green, x, 0.3, z) }
    add(g, S(0.07, 10), M.grey, -0.05, 0.14, -0.1)
    for (const [x, y, z, c] of [[-0.15, 0.32, 0.05, 0xff7a29], [0.12, 0.25, -0.05, 0x29b6ff], [0.22, 0.36, 0.08, 0xff7a29]] as const) {
      const f = add(g, S(0.03, 10), mat(c, 0.4), x, y, z); f.scale.set(1.7, 1, 0.7)
      add(g, new THREE.ConeGeometry(0.025, 0.04, 6), mat(c, 0.4), x - 0.055, y, z, [0, 0, Math.PI / 2])
    }
    add(g, B(0.6, 0.03, 0.1), M.black, 0, 0.6, -0.1)
    return 0.8
  },
  kjaledyr(g, col) {
    add(g, lathe([[0, 0], [0.22, 0], [0.26, 0.08], [0.24, 0.14], [0.2, 0.12], [0, 0.04]], 24), mat(col, 0.95), -0.1, 0, 0)
    add(g, C(0.12, 0.1, 0.07, 18), M.steel, 0.3, 0.035, 0.18); add(g, C(0.1, 0.1, 0.01, 18), mat(0x8b5a2b), 0.3, 0.07, 0.18)
    add(g, C(0.1, 0.1, 0.07, 18), M.steel, 0.3, 0.035, -0.05); add(g, C(0.09, 0.09, 0.01, 18), mat(0x3aa0e0), 0.3, 0.065, -0.05)
    add(g, S(0.07, 14), mat(0xd64545, 0.5), -0.1, 0.12, 0.05) // a ball
    const body = add(g, S(0.1, 14), mat(0xb98a55, 0.9), -0.1, 0.18, -0.05); body.scale.set(1.2, 0.8, 1)
    add(g, S(0.06, 12), mat(0xb98a55, 0.9), -0.02, 0.24, -0.06)
    for (const s of [-1, 1]) add(g, new THREE.ConeGeometry(0.02, 0.05, 6), mat(0x8c6a3f, 0.9), 0.0 + 0.0, 0.3, -0.06 + s * 0.03)
    return 0.5
  },
  fugler(g, col) {
    add(g, C(0.02, 0.02, 1.0, 8), M.dark, 0, 0.5, 0)
    add(g, B(0.3, 0.3, 0.26), mat(col, 0.7), 0, 1.1, 0)
    add(g, B(0.34, 0.03, 0.3), M.dark, 0, 1.27, 0, [0, 0, 0.0]); add(g, new THREE.ConeGeometry(0.26, 0.16, 4), M.dark, 0, 1.36, 0, [0, Math.PI / 4, 0])
    add(g, C(0.05, 0.05, 0.01, 16), M.black, 0, 1.1, 0.135, [Math.PI / 2, 0, 0]); add(g, B(0.2, 0.012, 0.1), M.dark, 0, 0.98, 0.16)
    add(g, C(0.004, 0.004, 0.14, 4), M.dark, 0, 0.92, 0.18)
    const bird = add(g, S(0.04, 10), mat(0xd64545), 0.05, 1.01, 0.18); bird.scale.set(1.3, 1, 1)
    return 1.55
  },
  astronomi(g, col) {
    for (const [x, z] of [[0, 0.2], [-0.18, -0.12], [0.18, -0.12]] as const) add(g, C(0.01, 0.014, 0.7, 8), M.dark, x * 0.5, 0.35, z * 0.4, [z * 0.5, 0, -x * 0.9])
    add(g, C(0.06, 0.06, 0.04, 14), M.grey, 0, 0.72, 0)
    add(g, C(0.05, 0.065, 0.62, 20), mat(col, 0.3), 0.0, 0.98, 0.1, [-0.9, 0, 0])
    add(g, C(0.052, 0.052, 0.01, 20), M.glass, 0, 1.2, -0.17, [-0.9, 0, 0]); add(g, C(0.012, 0.012, 0.1, 8), M.black, 0.05, 1.05, 0.2, [-0.9, 0, 0])
    add(g, S(0.025, 8), M.steel, 0.0, 0.82, 0.31)
    return 1.5
  },
  hage(g, col) {
    add(g, B(0.8, 0.28, 0.45), M.wood, 0, 0.14, 0); add(g, B(0.74, 0.02, 0.39), mat(0x4a3220, 1), 0, 0.27, 0)
    for (let i = 0; i < 5; i++) { const x = -0.3 + i * 0.15; add(g, C(0.005, 0.006, 0.14 + (i % 3) * 0.06, 5), M.green, x, 0.35, (i % 2) * 0.1 - 0.05); add(g, S(0.04 + (i % 2) * 0.015, 9), i % 2 ? mat(col, 0.5) : M.green, x, 0.44 + (i % 3) * 0.06, (i % 2) * 0.1 - 0.05) }
    add(g, B(0.012, 0.18, 0.012), M.dark, 0.34, 0.37, 0.2); add(g, B(0.08, 0.05, 0.008), M.cream, 0.34, 0.45, 0.2)
    const can = add(g, C(0.05, 0.045, 0.1, 14), M.steel, 0.5, 0.05, 0.1); void can
    return 0.7
  },
  // ── Kropp og friluft ──
  trening(g, col) {
    add(g, B(0.7, 0.02, 0.28), mat(col, 0.9), 0, 0.01, 0.2) // mat
    for (const [i, kg] of [0.08, 0.1, 0.12].entries()) { const x = -0.3 + i * 0.12; add(g, C(0.01, 0.01, 0.14, 8), M.black, x, 0.16 + kg * 0.2, -0.1, [0, 0, Math.PI / 2]); add(g, C(0.04 + kg * 0.2, 0.04 + kg * 0.2, 0.03, 16), M.black, x - 0.07, 0.16 + kg * 0.2, -0.1, [0, 0, Math.PI / 2]); add(g, C(0.04 + kg * 0.2, 0.04 + kg * 0.2, 0.03, 16), M.black, x + 0.07, 0.16 + kg * 0.2, -0.1, [0, 0, Math.PI / 2]) }
    add(g, B(0.4, 0.04, 0.2), M.dark, -0.15, 0.1, -0.1); for (const x of [-0.3, 0]) add(g, B(0.04, 0.1, 0.18), M.dark, x, 0.05, -0.1)
    add(g, S(0.1, 18), mat(col, 0.4), 0.28, 0.11, -0.12); add(g, new THREE.TorusGeometry(0.05, 0.012, 8, 16), mat(col, 0.4), 0.28, 0.24, -0.12) // kettlebell
    add(g, C(0.035, 0.035, 0.18, 14), mat(0x2b8cff, 0.3), 0.32, 0.09, 0.15); add(g, C(0.03, 0.03, 0.02, 14), M.black, 0.32, 0.19, 0.15) // bottle
    return 0.6
  },
  lop(g, col) {
    add(g, C(0.3, 0.3, 0.02, 30), mat(0x3a3f4a, 0.9), 0, 0.01, 0)
    const shoe = (x: number, rot: number): void => {
      const sole = add(g, S(0.09, 14), M.white, x, 0.06, 0, [0, rot, 0]); sole.scale.set(2.1, 0.25, 0.75)
      const up = add(g, S(0.08, 14), mat(col, 0.5), x - 0.02 * Math.cos(rot), 0.12, 0.02 * Math.sin(rot), [0, rot, 0]); up.scale.set(1.5, 0.7, 0.7)
      add(g, B(0.1, 0.012, 0.05), M.white, x + 0.02, 0.15, 0, [0, rot, 0])
    }
    shoe(-0.08, 0.15); shoe(0.1, -0.12)
    add(g, C(0.01, 0.01, 0.9, 8), M.grey, 0.28, 0.45, -0.2); add(g, B(0.2, 0.12, 0.01), mat(col), 0.38, 0.88, -0.2); add(g, S(0.07, 14), M.gold, -0.28, 0.14, -0.2) // flag + medal
    add(g, new THREE.TorusGeometry(0.06, 0.01, 8, 18), M.gold, -0.28, 0.22, -0.2)
    return 1.05
  },
  sykling(g, col) {
    wheel(g, 0, 0.32, 0.38, 0.32); wheel(g, 0, 0.32, -0.38, 0.32)
    const tube = (a: THREE.Vector3, b: THREE.Vector3, m: THREE.Material, r = 0.012): void => { const d = b.clone().sub(a); const o = add(g, C(r, r, d.length(), 8), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()) }
    const V = (z: number, y: number): THREE.Vector3 => new THREE.Vector3(0, y, z)
    const fm = mat(col, 0.35)
    tube(V(0.38, 0.32), V(0.12, 0.72), fm); tube(V(-0.38, 0.32), V(-0.1, 0.34), fm); tube(V(-0.1, 0.34), V(0.12, 0.72), fm); tube(V(-0.38, 0.32), V(-0.14, 0.7), fm); tube(V(-0.14, 0.7), V(0.12, 0.72), fm); tube(V(-0.1, 0.34), V(-0.14, 0.7), fm); tube(V(0.12, 0.72), V(0.1, 0.8), M.black)
    add(g, B(0.4, 0.014, 0.014), M.black, 0, 0.82, 0.1); add(g, B(0.06, 0.03, 0.18), M.black, 0, 0.74, -0.18)
    add(g, C(0.03, 0.03, 0.05, 10), M.steel, 0, 0.34, -0.1, [0, 0, Math.PI / 2])
    return 1.0
  },
  styrke(g, col) {
    for (const s of [-1, 1]) { add(g, B(0.04, 1.2, 0.04), M.black, s * 0.33, 0.6, -0.15); add(g, B(0.04, 0.04, 0.4), M.black, s * 0.33, 0.02, 0); add(g, B(0.08, 0.04, 0.05), M.steel, s * 0.33, 1.0, -0.12) }
    add(g, B(0.7, 0.04, 0.04), M.black, 0, 1.24, -0.15)
    add(g, C(0.012, 0.012, 1.0, 10), M.steel, 0, 1.0, -0.08, [0, 0, Math.PI / 2])
    for (const s of [-1, 1]) for (const [i, r] of [0.15, 0.12].entries()) add(g, C(r, r, 0.03, 20), i ? mat(col, 0.5) : M.black, s * (0.36 - i * 0.04), 1.0, -0.08, [0, 0, Math.PI / 2])
    add(g, B(0.2, 0.06, 0.5), M.black, 0, 0.42, 0.35); add(g, B(0.02, 0.4, 0.02), M.black, 0, 0.2, 0.35)
    return 1.35
  },
  svomming(g, col) {
    add(g, B(0.8, 0.22, 0.5), mat(0xdde7ee, 0.7), 0, 0.11, 0)
    add(g, B(0.72, 0.04, 0.42), M.water, 0, 0.215, 0)
    for (const i of [-1, 0, 1]) add(g, B(0.7, 0.012, 0.01), mat(i === 0 ? col : 0xf5f5f5), 0, 0.236, i * 0.13)
    for (const s of [-1, 1]) { const rail = add(g, new THREE.TorusGeometry(0.07, 0.008, 8, 14, Math.PI), M.steel, 0.38 + 0.0, 0.3, s * 0.1, [0, 0, 0]); rail.rotation.y = Math.PI / 2 }
    add(g, B(0.2, 0.02, 0.1), mat(col), -0.2, 0.32, 0.3); add(g, S(0.035, 10), mat(0xf2d3a5), -0.28, 0.35, 0.3)
    add(g, new THREE.TorusGeometry(0.06, 0.02, 8, 16), M.red, 0.15, 0.25, 0.05, [Math.PI / 2, 0, 0]) // ring buoy
    return 0.6
  },
  tur(g, col) {
    add(g, new THREE.ConeGeometry(0.34, 0.8, 7), mat(0x7b8794, 0.9), 0, 0.4, 0)
    add(g, new THREE.ConeGeometry(0.17, 0.3, 7), M.white, 0, 0.72, 0)
    add(g, new THREE.ConeGeometry(0.2, 0.5, 6), mat(0x6c7885, 0.9), 0.3, 0.25, 0.1)
    add(g, C(0.005, 0.005, 0.22, 6), M.dark, 0, 0.94, 0); add(g, B(0.1, 0.06, 0.004), mat(col), 0.05, 1.0, 0)
    add(g, C(0.04, 0.05, 0.05, 8), M.green, -0.3, 0.03, 0.2); add(g, new THREE.ConeGeometry(0.07, 0.2, 7), M.green, -0.3, 0.16, 0.2)
    return 1.15
  },
  fiske(g, col) {
    add(g, C(0.01, 0.014, 1.1, 8), M.dark, 0.0, 0.55, 0, [0.0, 0, 0.35]); add(g, C(0.035, 0.035, 0.05, 14), M.steel, -0.05, 0.4, 0.04, [Math.PI / 2, 0, 0])
    add(g, C(0.002, 0.002, 0.7, 4), M.grey, 0.26, 0.9, 0.0, [0, 0, 0.0])
    add(g, lathe([[0, 0], [0.12, 0], [0.14, 0.26], [0.12, 0.26], [0, 0.02]], 18), mat(col, 0.7), 0.26, 0, 0.22)
    const fish = add(g, S(0.07, 12), M.steel, 0.24, 0.3, 0.22); fish.scale.set(1.9, 0.6, 0.4)
    add(g, new THREE.ConeGeometry(0.05, 0.1, 4), M.steel, 0.12, 0.3, 0.22, [0, 0, Math.PI / 2])
    add(g, B(0.2, 0.03, 0.14), M.wood, -0.25, 0.1, 0.2); add(g, B(0.06, 0.06, 0.06), mat(0x2fa84f), -0.22, 0.15, 0.2)
    return 1.2
  },
  camping(g, col) {
    const tent = add(g, new THREE.CylinderGeometry(0, 0.4, 0.55, 3, 1, false, Math.PI / 2), mat(col, 0.85), -0.05, 0.275, -0.05, [0, Math.PI / 2, Math.PI / 2])
    tent.scale.set(1, 1, 1)
    add(g, B(0.16, 0.34, 0.01), M.black, 0.2, 0.17, -0.05)
    for (let i = 0; i < 5; i++) add(g, C(0.015, 0.02, 0.2, 6), mat(0x5a3d26), 0.28 + Math.cos(i * 1.3) * 0.05, 0.1, 0.25 + Math.sin(i * 1.3) * 0.05, [Math.sin(i) * 0.6, 0, Math.cos(i) * 0.6])
    add(g, new THREE.ConeGeometry(0.04, 0.14, 8), glow(0xffa028, 1.6), 0.28, 0.2, 0.25)
    for (let i = 0; i < 8; i++) add(g, S(0.025, 6), M.grey, 0.28 + Math.cos(i * 0.8) * 0.1, 0.02, 0.25 + Math.sin(i * 0.8) * 0.1)
    return 0.9
  },
  meditasjon(g, col) {
    add(g, C(0.2, 0.2, 0.08, 24), mat(col, 0.95), 0, 0.04, 0.12); add(g, C(0.12, 0.12, 0.005, 20), mat(0xf2e6c9), 0, 0.083, 0.12)
    add(g, C(0.03, 0.04, 0.12, 14), M.cream, 0.0, 0.06, -0.2); add(g, new THREE.ConeGeometry(0.016, 0.05, 8), glow(0xffb347, 1.8), 0, 0.16, -0.2)
    add(g, B(0.4, 0.015, 0.6), mat(0x8f7ad6, 0.95), 0, 0.008, 0.05)
    add(g, lathe([[0, 0], [0.09, 0], [0.07, 0.07], [0.1, 0.1], [0, 0.1]], 18), M.gold, -0.25, 0.0, -0.1)
    return 0.55
  },
  // ── Hode og ord ──
  skriving(g, col) {
    const top = table(g, 0.8, 0.5, 0.74)
    add(g, B(0.3, 0.1, 0.26), M.black, -0.05, top + 0.05, 0); add(g, B(0.26, 0.04, 0.2), M.grey, -0.05, top + 0.12, -0.02, [-0.2, 0, 0])
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) add(g, C(0.011, 0.011, 0.01, 8), M.white, -0.15 + c * 0.028, top + 0.108 + r * 0.01, 0.04 - r * 0.045 + 0.02)
    add(g, B(0.2, 0.002, 0.28), M.white, -0.05, top + 0.2, -0.08, [-0.25, 0, 0])
    add(g, C(0.004, 0.004, 0.16, 6), mat(col), 0.28, top + 0.004, 0.1, [0, 0, Math.PI / 2]); add(g, B(0.12, 0.012, 0.16), M.cream, 0.28, top + 0.006, -0.05)
    add(g, C(0.035, 0.035, 0.08, 14), M.steel, 0.3, top + 0.04, -0.2)
    return 1.1
  },
  sprak(g, col) {
    add(g, C(0.14, 0.17, 0.03, 20), M.dark, 0, 0.015, 0)
    add(g, C(0.01, 0.01, 0.5, 8), M.dark, 0, 0.27, 0)
    const map = tex(256, 128, (x, w, h) => { x.fillStyle = '#3aa0e0'; x.fillRect(0, 0, w, h); x.fillStyle = '#4cae62'; for (const [a, b, c, d] of [[20, 20, 70, 50], [100, 30, 90, 40], [60, 70, 40, 40], [160, 70, 70, 30], [30, 55, 30, 30]]) { x.beginPath(); x.ellipse(a + c / 2, b + d / 2, c / 2, d / 2, 0, 0, 7); x.fill() } })
    add(g, S(0.22, 28), map, 0, 0.62, 0, [0.4, 0, 0.4])
    add(g, new THREE.TorusGeometry(0.235, 0.008, 8, 40, Math.PI * 1.5), mat(col, 0.3), 0, 0.62, 0, [0, Math.PI / 2, 0.4])
    return 0.95
  },
  dagbok(g, col) {
    add(g, B(0.5, 0.04, 0.4), M.dark, 0, 0.5, 0); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) add(g, B(0.03, 0.5, 0.03), M.dark, x * 0.22, 0.25, z * 0.17)
    add(g, B(0.2, 0.02, 0.28), mat(col, 0.7), -0.1, 0.545, 0, [0, 0, 0]); add(g, B(0.2, 0.02, 0.28), mat(col, 0.7), 0.1, 0.545, 0)
    add(g, B(0.19, 0.012, 0.26), M.cream, -0.1, 0.562, 0, [0, 0, 0.1]); add(g, B(0.19, 0.012, 0.26), M.cream, 0.1, 0.562, 0, [0, 0, -0.1])
    add(g, C(0.004, 0.004, 0.18, 6), M.black, 0.2, 0.57, 0.1, [0, 0.6, Math.PI / 2]); add(g, C(0.03, 0.03, 0.14, 12), M.cream, -0.2, 0.62, -0.1); add(g, new THREE.ConeGeometry(0.02, 0.05, 6), glow(0xffb347, 1.8), -0.2, 0.72, -0.1)
    return 0.9
  },
  bokmerker(g, col) {
    add(g, B(0.6, 0.04, 0.3), M.dark, 0, 0.02, 0); add(g, B(0.6, 0.7, 0.04), M.dark, 0, 0.37, -0.13)
    for (let i = 0; i < 6; i++) add(g, B(0.07, 0.4 + (i % 3) * 0.06, 0.2), mat(i % 2 ? col : new THREE.Color(0x8aa0b8), 0.7), -0.22 + i * 0.085, 0.24 + (i % 3) * 0.03, -0.0)
    for (const x of [-0.12, 0.1]) add(g, B(0.02, 0.1, 0.004), mat(0xd64545), x, 0.5, 0.11)
    return 0.8
  },
  // ── Planlegg ──
  onskeliste(g, col) {
    add(g, B(0.4, 0.3, 0.4), mat(col, 0.5), -0.1, 0.15, 0); add(g, B(0.42, 0.06, 0.42), mat(col, 0.5), -0.1, 0.33, 0); add(g, B(0.06, 0.36, 0.42), M.gold, -0.1, 0.18, 0); add(g, B(0.42, 0.06, 0.06), M.gold, -0.1, 0.34, 0)
    add(g, new THREE.TorusGeometry(0.06, 0.018, 8, 14), M.gold, -0.14, 0.4, 0, [0, 0.4, 0]); add(g, new THREE.TorusGeometry(0.06, 0.018, 8, 14), M.gold, -0.06, 0.4, 0, [0, -0.4, 0])
    add(g, B(0.26, 0.2, 0.26), mat(0x2b8cff, 0.5), 0.25, 0.1, 0.12, [0, 0.4, 0]); add(g, B(0.04, 0.2, 0.28), M.white, 0.25, 0.1, 0.12, [0, 0.4, 0])
    add(g, B(0.18, 0.16, 0.18), mat(0x2fa84f, 0.5), 0.2, 0.08, -0.2, [0, -0.3, 0])
    return 0.6
  },
  bucket(g, col) {
    add(g, B(0.7, 0.34, 0.42), M.dark, 0, 0.17, 0); add(g, C(0.21, 0.21, 0.7, 20, ), M.dark, 0, 0.34, 0, [0, 0, Math.PI / 2]).scale.set(1, 1, 1)
    add(g, new THREE.CylinderGeometry(0.21, 0.21, 0.7, 20, 1, false, 0, Math.PI), mat(0x6d4c2f), 0, 0.34, 0, [0, 0, Math.PI / 2])
    add(g, B(0.72, 0.03, 0.44), M.gold, 0, 0.1, 0); add(g, B(0.04, 0.36, 0.46), M.gold, -0.25, 0.17, 0); add(g, B(0.04, 0.36, 0.46), M.gold, 0.25, 0.17, 0)
    add(g, B(0.08, 0.1, 0.02), M.gold, 0, 0.34, 0.22)
    for (let i = 0; i < 6; i++) add(g, S(0.025, 8), glow(0xffd24a, 1), -0.15 + i * 0.06, 0.4 + (i % 2) * 0.01, 0.0)
    return 0.7
  },
  reisemal(g, col) {
    for (const [i, c] of [col, new THREE.Color(0x2b8cff), new THREE.Color(0xf5a524)].entries()) {
      const w = 0.5 - i * 0.08
      add(g, B(w, 0.22, 0.28), mat(c, 0.6), 0, 0.11 + i * 0.23, 0); add(g, B(w * 0.8, 0.02, 0.02), M.steel, 0, 0.18 + i * 0.23, 0.15); add(g, B(0.14, 0.04, 0.04), M.black, 0, 0.24 + i * 0.23, 0)
      for (const s of [-1, 1]) add(g, B(0.015, 0.2, 0.01), M.gold, s * w * 0.3, 0.11 + i * 0.23, 0.145)
    }
    add(g, B(0.2, 0.14, 0.012), M.cream, 0.1, 0.9, 0.15, [0, 0, 0.1]); add(g, S(0.012, 6), M.red, 0.1, 0.9, 0.158)
    return 1.0
  },
  bil(g, col) {
    wheel(g, 0, 0.2, 0.34, 0.2, 0.04); wheel(g, 0, 0.2, -0.34, 0.2, 0.04)
    add(g, B(0.2, 0.12, 0.5), mat(col, 0.35), 0, 0.42, 0.0); const tank = add(g, S(0.11, 14), mat(col, 0.3), 0, 0.55, 0.1); tank.scale.set(0.9, 0.9, 1.5)
    add(g, B(0.1, 0.05, 0.3), M.black, 0, 0.5, -0.18); add(g, B(0.4, 0.014, 0.014), M.black, 0, 0.7, 0.28)
    add(g, C(0.012, 0.012, 0.42, 8), M.steel, 0.07, 0.34, 0.34, [0.25, 0, 0]); add(g, C(0.012, 0.012, 0.42, 8), M.steel, -0.07, 0.34, 0.34, [0.25, 0, 0])
    add(g, S(0.04, 10), glow(0xfff3c4, 1.4), 0, 0.62, 0.38); add(g, C(0.03, 0.04, 0.3, 10), M.steel, 0.12, 0.2, -0.2, [Math.PI / 2, 0, 0])
    return 0.95
  },
}
