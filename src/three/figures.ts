import * as THREE from 'three'
import { meshAdder } from './helpers'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

// A wall shelf with collectible figures – Star Wars on the top board, anime on the lower one – small low-poly
// versions built from simple shapes. A warm LED strip lights each board and a lightsaber glows softly.
const mat = (color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o })

export interface ShelfFigure { id: string; file: string; name: string }
/** Twelve places on the two boards: six on the top one, six on the lower one. */
export const FIGURE_SLOTS = 12
const slotAt = (i: number): { x: number; y: number } => ({ x: -0.55 + (i % 6) * 0.22, y: i < 6 ? 0.46 : 0 })

export function buildFigureShelf(): {
  group: THREE.Group
  update: (t: number) => void
  /** The figures somebody has uploaded (they take the places on the shelf); the built-in ones go away when there are any. */
  setFigures: (list: ShelfFigure[], load: (url: string) => Promise<GLTF>, onChange: () => void, keepBuiltin: boolean) => void
  /** where a figure stands in the world (for the camera) */
  figurePos: (index: number) => THREE.Vector3 | null
  /** which of the own figures have their model on the shelf (for tests) */
  shown: () => boolean[]
  builtinShown: () => boolean
} {
  const group = new THREE.Group()
  const wood = mat(0xc89b6d, { roughness: 0.5 })
  const white = mat(0xf3f4f6, { roughness: 0.45 })
  const black = mat(0x15161a, { roughness: 0.4 })
  const add = meshAdder(group)
  const W = 1.25
  // two boards on small brackets + a thin back strip so it reads as a "display shelf"
  ;[0, 0.46].forEach((y) => {
    add(new RoundedBoxGeometry(W, 0.03, 0.17, 2, 0.008), wood, 0, y, 0.085)
    ;[-W / 2 + 0.1, W / 2 - 0.1].forEach((x) => add(new THREE.BoxGeometry(0.02, 0.07, 0.12), black, x, y - 0.045, 0.06))
    const led = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.006, 0.01), new THREE.MeshBasicMaterial({ color: 0xffe2b8, toneMapped: false }))
    led.position.set(0, y - 0.018, 0.14)
    group.add(led)
  })
  const shelfParts = group.children.slice() // (the boards, the brackets, the strips: they stay whatever stands on them)
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }))
  group.add(tag)

  const fig = (x: number, y: number, z = 0.09): THREE.Group => { const g = new THREE.Group(); g.position.set(x, y + 0.015, z); group.add(g); return g }
  const sph = (r: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D, sx = 1, sy = 1, sz = 1): THREE.Mesh => { const o = add(new THREE.SphereGeometry(r, 16, 12), m, x, y, z, parent); o.scale.set(sx, sy, sz); return o }
  const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Mesh => add(new THREE.CylinderGeometry(rt, rb, h, 16), m, x, y, z, parent)

  // ── Star Wars (top board, y = 0.46) ──
  const top = 0.46
  // Stormtrooper
  {
    const g = fig(-0.5, top)
    cyl(0.032, 0.04, 0.085, white, 0, 0.075, 0, g)
    add(new THREE.BoxGeometry(0.085, 0.012, 0.05), black, 0, 0.05, 0.002, g)
    ;[-0.018, 0.018].forEach((x) => { cyl(0.014, 0.017, 0.06, white, x, 0.015, 0, g) })
    ;[-0.05, 0.05].forEach((x) => cyl(0.011, 0.011, 0.065, white, x, 0.085, 0, g))
    sph(0.04, white, 0, 0.15, 0, g, 1, 1.08, 1)
    ;[-0.016, 0.016].forEach((x) => add(new THREE.BoxGeometry(0.018, 0.012, 0.01), black, x, 0.155, 0.036, g))
    add(new THREE.BoxGeometry(0.014, 0.022, 0.01), black, 0, 0.13, 0.04, g)
  }
  // Darth Vader
  {
    const g = fig(-0.33, top)
    const cape = add(new THREE.ConeGeometry(0.055, 0.14, 16, 1, true), mat(0x0b0c0f, { side: THREE.DoubleSide }), 0, 0.07, -0.005, g)
    cyl(0.03, 0.04, 0.09, black, 0, 0.085, 0.004, g)
    add(new THREE.BoxGeometry(0.04, 0.03, 0.01), mat(0x2a2d36), 0, 0.1, 0.042, g)
    ;[-0.012, 0, 0.012].forEach((x, i) => add(new THREE.BoxGeometry(0.006, 0.006, 0.005), mat([0xd33a2c, 0x3b82f6, 0x22c55e][i], { emissive: [0xd33a2c, 0x3b82f6, 0x22c55e][i], emissiveIntensity: 0.9 }), x, 0.105, 0.049, g))
    const helmet = sph(0.042, black, 0, 0.17, 0, g, 1, 1.05, 1.08)
    add(new THREE.CylinderGeometry(0.052, 0.05, 0.012, 20), black, 0, 0.145, 0, g)
    ;[-0.016, 0.016].forEach((x) => add(new THREE.BoxGeometry(0.02, 0.014, 0.01), mat(0x1c2230, { roughness: 0.2, metalness: 0.5 }), x, 0.172, 0.04, g))
  }
  // R2-D2
  {
    const g = fig(-0.16, top)
    const body = cyl(0.04, 0.042, 0.085, white, 0, 0.065, 0, g)
    sph(0.04, white, 0, 0.108, 0, g, 1, 0.9, 1) // dome
    ;[0.03, 0.05, 0.075].forEach((y) => add(new THREE.BoxGeometry(0.05, 0.006, 0.01), mat(0x2f6fe0), 0, y, 0.041, g))
    add(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 10), mat(0xd33a2c, { emissive: 0xd33a2c, emissiveIntensity: 0.7 }), 0, 0.125, 0.034, g).rotation.x = Math.PI / 2
    ;[-0.047, 0.047].forEach((x) => add(new THREE.BoxGeometry(0.014, 0.075, 0.03), mat(0x2f6fe0), x, 0.04, 0, g))
  }
  // Grogu
  {
    const g = fig(0.02, top)
    const robe = mat(0xb08968)
    cyl(0.02, 0.035, 0.07, robe, 0, 0.04, 0, g)
    sph(0.034, mat(0x9fc58a), 0, 0.1, 0, g, 1.05, 1, 1)
    ;[-1, 1].forEach((s) => { const e = add(new THREE.ConeGeometry(0.014, 0.065, 8), mat(0x9fc58a), s * 0.05, 0.108, 0, g); e.rotation.z = -s * 1.45 })
    ;[-0.012, 0.012].forEach((x) => sph(0.006, black, x, 0.104, 0.03, g))
  }
  // lightsaber (blue) leaning on the shelf, glowing
  const saber = new THREE.Group()
  saber.position.set(0.3, top + 0.015, 0.1)
  saber.rotation.z = -0.22
  group.add(saber)
  cyl(0.009, 0.009, 0.09, mat(0xb9bec8, { metalness: 0.9, roughness: 0.25 }), 0, 0.045, 0, saber)
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0x6fb8ff, toneMapped: false })
  const blade = cyl(0.007, 0.007, 0.2, bladeMat, 0, 0.19, 0, saber)
  const bladeGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 12), new THREE.MeshBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0.25, toneMapped: false, depthWrite: false }))
  bladeGlow.position.set(0, 0.19, 0)
  saber.add(bladeGlow)
  const saberLight = new THREE.PointLight(0x4aa3ff, 0.35, 0.7, 2)
  saberLight.position.set(0.3, top + 0.2, 0.2)
  group.add(saberLight)
  // a little X-wing-ish ship on a stand
  {
    const g = fig(0.5, top, 0.08)
    cyl(0.003, 0.003, 0.05, mat(0xb9bec8, { metalness: 0.9 }), 0, 0.025, 0, g)
    add(new THREE.CylinderGeometry(0.006, 0.014, 0.12, 8), mat(0xd9dce2), 0, 0.075, 0, g).rotation.x = Math.PI / 2
    ;[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sy]) => { const w = add(new THREE.BoxGeometry(0.075, 0.004, 0.03), mat(0xd9dce2), sx * 0.04, 0.075 + sy * 0.018, 0, g); w.rotation.z = sy * sx * 0.25 })
  }

  // ── Anime (lower board, y = 0) ──
  const low = 0
  const skin = mat(0xf2c7a0)
  // straw-hat pirate
  {
    const g = fig(-0.5, low)
    cyl(0.028, 0.034, 0.07, mat(0xd33a2c), 0, 0.045, 0, g)
    ;[-0.014, 0.014].forEach((x) => cyl(0.012, 0.014, 0.04, mat(0x2f6fe0), x, 0.012, 0, g))
    sph(0.04, skin, 0, 0.11, 0, g)
    ;[-0.014, 0.014].forEach((x) => sph(0.005, black, x, 0.112, 0.036, g))
    cyl(0.07, 0.07, 0.006, mat(0xe2c46a), 0, 0.145, 0, g)
    cyl(0.04, 0.045, 0.035, mat(0xe2c46a), 0, 0.16, 0, g)
    cyl(0.046, 0.046, 0.01, mat(0xd33a2c), 0, 0.15, 0, g)
  }
  // spiky-haired fighter
  {
    const g = fig(-0.32, low)
    cyl(0.028, 0.034, 0.07, mat(0xf08a24), 0, 0.045, 0, g)
    ;[-0.014, 0.014].forEach((x) => cyl(0.012, 0.014, 0.04, mat(0xf08a24), x, 0.012, 0, g))
    sph(0.04, skin, 0, 0.11, 0, g)
    ;[-0.014, 0.014].forEach((x) => sph(0.005, black, x, 0.112, 0.036, g))
    ;[[-0.03, 0.15, 0.4], [0, 0.17, 0], [0.03, 0.15, -0.4], [-0.015, 0.16, 0.2], [0.015, 0.16, -0.2]].forEach(([x, y, r]) => {
      const c = add(new THREE.ConeGeometry(0.014, 0.06, 8), black, x, y, 0, g)
      c.rotation.z = r
    })
  }
  // round forest spirit
  {
    const g = fig(-0.14, low)
    sph(0.06, mat(0x8f9aa8), 0, 0.075, 0, g, 1, 1.15, 0.95)
    sph(0.04, mat(0xf1efe6), 0, 0.06, 0.03, g, 1, 1.1, 0.6)
    ;[-1, 1].forEach((s) => { const e = add(new THREE.ConeGeometry(0.014, 0.04, 8), mat(0x8f9aa8), s * 0.03, 0.155, 0, g); e.rotation.z = -s * 0.15 })
    ;[-0.018, 0.018].forEach((x) => { sph(0.009, white, x, 0.11, 0.05, g); sph(0.004, black, x, 0.11, 0.058, g) })
  }
  // yellow electric mascot
  {
    const g = fig(0.04, low)
    sph(0.045, mat(0xf2cf2f), 0, 0.055, 0, g, 1, 1.05, 0.95)
    sph(0.035, mat(0xf2cf2f), 0, 0.12, 0.004, g)
    ;[-1, 1].forEach((s) => {
      const e = add(new THREE.ConeGeometry(0.01, 0.06, 6), mat(0xf2cf2f), s * 0.025, 0.17, 0, g)
      e.rotation.z = -s * 0.35
      const tip = add(new THREE.ConeGeometry(0.0075, 0.02, 6), black, s * 0.034, 0.195, 0, g)
      tip.rotation.z = -s * 0.35
      sph(0.008, mat(0xe5533d), s * 0.026, 0.108, 0.03, g)
      sph(0.004, black, s * 0.014, 0.125, 0.032, g)
    })
    const tail = add(new THREE.BoxGeometry(0.05, 0.012, 0.01), mat(0xd9a521), 0.05, 0.07, -0.03, g)
    tail.rotation.z = 0.7
  }
  // a cat-eared girl figure on a clear base
  {
    const g = fig(0.24, low)
    cyl(0.04, 0.04, 0.008, mat(0xcfe6ff, { transparent: true, opacity: 0.55 }), 0, 0.004, 0, g)
    cyl(0.026, 0.034, 0.08, mat(0xe8eefc), 0, 0.05, 0, g)
    cyl(0.034, 0.03, 0.05, mat(0x2f3a63), 0, 0.01, 0, g)
    sph(0.04, skin, 0, 0.115, 0, g)
    sph(0.044, mat(0x6fb8ff), 0, 0.125, -0.006, g, 1, 1, 0.95)
    ;[-1, 1].forEach((s) => add(new THREE.ConeGeometry(0.013, 0.03, 6), mat(0x6fb8ff), s * 0.028, 0.165, 0, g).rotation.z = -s * 0.2)
    ;[-0.014, 0.014].forEach((x) => sph(0.005, mat(0x2f6fe0), x, 0.115, 0.036, g))
  }
  // a small row of books at the end, and a mini plant
  ;[0xd97b66, 0x5b8fb9, 0xe2c46a, 0x6fae7e].forEach((c, i) => add(new THREE.BoxGeometry(0.018, 0.1 - i * 0.008, 0.07), mat(c), 0.42 + i * 0.02, 0.065 - i * 0.004, 0.09 + low))
  {
    const g = fig(0.54, low, 0.09)
    cyl(0.022, 0.017, 0.03, mat(0xc9774f), 0, 0.015, 0, g)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const l = sph(0.02, mat(0x4f8a5b), Math.cos(a) * 0.015, 0.055, Math.sin(a) * 0.015, g, 0.4, 1.4, 0.2)
      l.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6)
    }
  }

  // everything that was put on the shelf above is the built-in set: one group, so it can be taken away as a whole
  const builtin = new THREE.Group()
  for (const c of group.children.slice()) if (!shelfParts.includes(c)) builtin.add(c)
  group.add(builtin)

  // ── the figures somebody has uploaded ──
  const own = new THREE.Group()
  group.add(own)
  const slots: THREE.Group[] = []
  function setFigures(list: ShelfFigure[], load: (url: string) => Promise<GLTF>, onChange: () => void, keepBuiltin: boolean): void {
    builtin.visible = keepBuiltin && !list.length
    for (const g of slots) own.remove(g)
    slots.length = 0
    list.slice(0, FIGURE_SLOTS).forEach((f, i) => {
      const root = new THREE.Group()
      const { x, y } = slotAt(i)
      root.position.set(x, y + 0.015, 0.09)
      root.userData = { kind: 'figure', index: i }
      own.add(root)
      slots.push(root)
      load(f.file).then((gltf) => {
        if (slots[i] !== root) return
        const m = gltf.scene.clone(true)
        // the same size on the shelf whatever the file: about 17 cm tall (and not wider than 18 cm), standing on the board
        const b0 = new THREE.Box3().setFromObject(m)
        const size = b0.getSize(new THREE.Vector3())
        m.scale.multiplyScalar(Math.min(0.17 / Math.max(size.y, 1e-4), 0.18 / Math.max(size.x, size.z, 1e-4)))
        m.updateMatrixWorld(true)
        const b = new THREE.Box3().setFromObject(m)
        const c = b.getCenter(new THREE.Vector3())
        m.position.set(-c.x, -b.min.y, -c.z)
        m.traverse((n) => { if (n instanceof THREE.Mesh) { n.castShadow = true; n.receiveShadow = true } })
        root.add(m)
        onChange()
      }).catch(() => {})
    })
    onChange()
  }
  const figurePos = (i: number): THREE.Vector3 | null => {
    const s = slots[i]
    return s ? s.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.09, 0)) : null
  }

  function update(t: number): void {
    // the blade hums softly
    const p = 0.9 + Math.sin(t * 6) * 0.05 + Math.sin(t * 17) * 0.03
    saberLight.intensity = 0.35 * p
    bladeGlow.material.opacity = 0.2 + 0.07 * p
  }
  return { group, update, setFigures, figurePos, shown: () => slots.map((s) => s.children.length > 0), builtinShown: () => builtin.visible }
}
