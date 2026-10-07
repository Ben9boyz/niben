import * as THREE from 'three'
import { canvasTex } from './textures'

// A trophy won in one of the room's games, standing in the room: a cup on a stepped plinth, in the tier's metal (bronze …
// diamond, and a glowing violet one for "legend"), with a small plate in front saying what it was for.
const TIERS: Record<string, { metal: number; rough: number; glow?: number; size: number }> = {
  bronse: { metal: 0xcd7f32, rough: 0.35, size: 0.8 },
  solv: { metal: 0xd7dde4, rough: 0.22, size: 0.88 },
  gull: { metal: 0xffc933, rough: 0.18, size: 0.96 },
  platina: { metal: 0xe5f1f8, rough: 0.12, size: 1.04 },
  diamant: { metal: 0xb9f2ff, rough: 0.05, glow: 0x4fc3f7, size: 1.12 },
  legende: { metal: 0xd9a7ff, rough: 0.1, glow: 0x7b2ff7, size: 1.22 },
}

export function buildTrophy(tier: string, label: string): { root: THREE.Group; body: THREE.Group; dispose: () => void } {
  const t = TIERS[tier] ?? TIERS.bronse!
  const root = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []
  const metal = new THREE.MeshStandardMaterial({ color: t.metal, metalness: 1, roughness: t.rough, emissive: t.glow ?? 0x000000, emissiveIntensity: t.glow ? 0.35 : 0 })
  const stone = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.45, metalness: 0.2 })
  mats.push(metal, stone)
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, x = 0, z = 0): THREE.Mesh => {
    geos.push(geo)
    const o = new THREE.Mesh(geo, m)
    o.position.set(x, y, z)
    o.castShadow = true
    o.receiveShadow = true
    root.add(o)
    return o
  }
  const s = t.size
  // the plinth: two steps of dark stone
  add(new THREE.BoxGeometry(0.26 * s, 0.06 * s, 0.26 * s), stone, 0.03 * s)
  add(new THREE.BoxGeometry(0.2 * s, 0.07 * s, 0.2 * s), stone, 0.095 * s)
  // the cup: foot, stem, knot and bowl turned on a lathe
  const prof: [number, number][] = [[0, 0], [0.075, 0], [0.075, 0.012], [0.03, 0.03], [0.018, 0.09], [0.035, 0.105], [0.018, 0.12], [0.03, 0.15], [0.085, 0.19], [0.1, 0.26], [0.105, 0.3], [0.098, 0.3], [0.09, 0.26], [0.075, 0.2], [0, 0.17]]
  const cup = add(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * s, y * s)), 32), metal, 0.13 * s)
  cup.name = 'cup'
  // two handles
  for (const side of [-1, 1]) {
    const h = add(new THREE.TorusGeometry(0.045 * s, 0.009 * s, 8, 20, Math.PI), metal, 0.13 * s + 0.24 * s, side * 0.1 * s)
    h.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2
  }
  // a star on top for the two best
  if (t.glow) {
    const star = new THREE.Shape()
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = (i % 2 ? 0.022 : 0.05) * s; if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r) }
    const st = add(new THREE.ExtrudeGeometry(star, { depth: 0.012 * s, bevelEnabled: false }), metal, 0.13 * s + 0.36 * s)
    st.name = 'star'
  }
  // the plate in front
  const tex = canvasTex(256, 64, (x, w, h) => {
    x.fillStyle = '#d9c38a'; x.fillRect(0, 0, w, h)
    x.fillStyle = '#3b2f15'; x.font = 'bold 26px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'
    x.fillText(label.slice(0, 18), w / 2, h / 2 + 1)
  })
  const plateMat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.35 })
  mats.push(plateMat)
  const plate = add(new THREE.PlaneGeometry(0.17 * s, 0.042 * s), plateMat, 0.095 * s, 0, 0.1 * s + 0.002)
  plate.castShadow = false
  return { root, body: root, dispose: () => { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); tex.dispose() } }
}
