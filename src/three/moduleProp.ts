import * as THREE from 'three'
import { canvasTex } from './textures'
import type { ModuleKind, Prop } from '@/lib/modules/catalog'
import { MODELS } from './moduleModels'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Twenty hobbies in a room must not mean a thousand draw calls. Each model is built from many small parts; once built, every
// plain part (no picture on it, not see-through, not glowing) is baked into ONE mesh whose colours sit in the geometry – one for
// the matte parts, one for the metal ones. What is left (a screen, a board, glass, a flame) stays as it is: a model ends up as
// 1–5 draw calls instead of 20–60.
const BAKED = {
  matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85 }),
}
export function bake(body: THREE.Group): void {
  body.updateMatrixWorld(true)
  const inv = body.matrixWorld.clone().invert()
  const parts: Record<'matte' | 'metal', THREE.BufferGeometry[]> = { matte: [], metal: [] }
  const done: THREE.Mesh[] = []
  body.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return
    const m = o.material as THREE.MeshStandardMaterial
    if (!(m instanceof THREE.MeshStandardMaterial) || m.map || m.transparent || m.emissive.getHex() !== 0) return
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k)
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))
    const n = g.attributes.position!.count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { col[i * 3] = m.color.r; col[i * 3 + 1] = m.color.g; col[i * 3 + 2] = m.color.b }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    parts[m.metalness > 0.5 ? 'metal' : 'matte'].push(g)
    done.push(o)
  })
  for (const o of done) { o.removeFromParent(); o.geometry.dispose() }
  for (const k of ['matte', 'metal'] as const) {
    if (!parts[k].length) continue
    const merged = mergeGeometries(parts[k], false)
    parts[k].forEach((g) => g.dispose())
    if (!merged) continue
    const mesh = new THREE.Mesh(merged, BAKED[k])
    mesh.castShadow = true
    mesh.receiveShadow = true
    body.add(mesh)
  }
}

// The little piece of furniture a hobby module stands as in the room: seven simple shapes in the module's own colour, with a
// sign over it (the symbol and the name) that always turns towards you.
const wood = new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 0.7 })
const darkWood = new THREE.MeshStandardMaterial({ color: 0x6d4c2f, roughness: 0.75 })
const metal = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.8, roughness: 0.35 })

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Mesh {
  const o = new THREE.Mesh(g, m)
  o.position.set(x, y, z)
  o.castShadow = true
  o.receiveShadow = true
  parent.add(o)
  return o
}
const bx = (w: number, h: number, d: number): THREE.BoxGeometry => new THREE.BoxGeometry(w, h, d)

/** Returns the prop and how tall it is (the sign floats above that). */
function shape(prop: Prop, col: THREE.Color, g: THREE.Group): number {
  const paint = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 })
  const light = new THREE.MeshStandardMaterial({ color: col.clone().lerp(new THREE.Color(0xffffff), 0.55), roughness: 0.6 })
  switch (prop) {
    case 'crate': {
      mesh(bx(0.56, 0.34, 0.46), wood, 0, 0.17, 0, g)
      mesh(bx(0.6, 0.05, 0.5), paint, 0, 0.365, 0, g)
      mesh(bx(0.58, 0.05, 0.06), darkWood, 0, 0.1, 0.22, g)
      return 0.4
    }
    case 'table': {
      mesh(bx(0.78, 0.045, 0.5), wood, 0, 0.7, 0, g)
      for (const [x, z] of [[-0.35, -0.2], [0.35, -0.2], [-0.35, 0.2], [0.35, 0.2]]) mesh(bx(0.05, 0.68, 0.05), darkWood, x!, 0.34, z!, g)
      mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 16), paint, -0.2, 0.775, 0, g)
      mesh(bx(0.22, 0.03, 0.16), light, 0.17, 0.737, 0.03, g)
      return 0.8
    }
    case 'shelf': {
      mesh(bx(0.78, 1.05, 0.04), darkWood, 0, 0.525, -0.13, g)
      for (const y of [0.02, 0.36, 0.7, 1.04]) mesh(bx(0.8, 0.04, 0.3), wood, 0, y, 0, g)
      for (const y of [0.4, 0.74]) mesh(bx(0.04, 0.34, 0.3), wood, 0.38, y - 0.02, 0, g)
      let x = -0.3
      for (const [w, h, m] of [[0.12, 0.24, paint], [0.1, 0.2, light], [0.14, 0.26, paint]] as [number, number, THREE.Material][]) { mesh(bx(w, h, 0.2), m, x, 0.04 + h / 2, 0, g); x += w + 0.04 }
      mesh(bx(0.3, 0.12, 0.2), light, 0.12, 0.44, 0, g)
      mesh(bx(0.16, 0.22, 0.2), paint, -0.2, 0.8, 0, g)
      return 1.1
    }
    case 'easel': {
      for (const [x, r] of [[-0.25, 0.12], [0.25, -0.12]] as [number, number][]) { const l = mesh(bx(0.04, 1.2, 0.04), darkWood, x, 0.6, 0, g); l.rotation.z = r }
      mesh(bx(0.04, 1.15, 0.04), darkWood, 0, 0.58, -0.28, g).rotation.x = 0.25
      mesh(bx(0.62, 0.04, 0.06), darkWood, 0, 0.45, 0.06, g)
      mesh(bx(0.58, 0.46, 0.025), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 0, 0.72, 0.05, g)
      mesh(bx(0.36, 0.26, 0.012), paint, -0.04, 0.74, 0.07, g)
      mesh(new THREE.CircleGeometry(0.07, 20), light, 0.15, 0.82, 0.08, g)
      return 1.25
    }
    case 'stand': {
      mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.07, 32), darkWood, 0, 0.035, 0, g)
      mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.7, 32), light, 0, 0.42, 0, g)
      mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.06, 32), paint, 0, 0.8, 0, g)
      mesh(new THREE.OctahedronGeometry(0.13), paint, 0, 0.98, 0, g).rotation.y = 0.6
      return 1.15
    }
    case 'plant': {
      mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 24), paint, 0, 0.15, 0, g)
      const leaf = new THREE.MeshStandardMaterial({ color: 0x3f9e57, roughness: 0.7 })
      mesh(new THREE.SphereGeometry(0.26, 18, 14), leaf, 0, 0.5, 0, g)
      mesh(new THREE.SphereGeometry(0.17, 16, 12), leaf, 0.15, 0.7, 0.05, g)
      mesh(new THREE.SphereGeometry(0.15, 16, 12), leaf, -0.14, 0.66, -0.05, g)
      return 0.95
    }
    case 'chest': {
      mesh(bx(0.64, 0.3, 0.4), paint, 0, 0.15, 0, g)
      const lid = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.64, 20, 1, false, 0, Math.PI), wood, 0, 0.3, 0, g)
      lid.rotation.z = Math.PI / 2
      lid.rotation.y = Math.PI / 2
      mesh(bx(0.07, 0.08, 0.02), metal, 0, 0.3, 0.205, g)
      return 0.55
    }
  }
}

export interface PropHandle { root: THREE.Group; body: THREE.Group; sign: THREE.Sprite; dispose: () => void }

export function buildModuleProp(kind: ModuleKind, title: string, icon: string = kind.icon): PropHandle {
  const root = new THREE.Group()
  const body = new THREE.Group() // the built-in model (taken away again when the room has its own .glb)
  root.add(body)
  const col = new THREE.Color(kind.color)
  const own = MODELS[kind.id] // a model of its own for the hobby, or else one of the seven general shapes
  const top = own ? own(body, col) : shape(kind.prop, col, body)
  bake(body)
  const tex = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = 'rgba(16,22,31,0.86)'
    x.beginPath()
    x.roundRect(8, 8, w - 16, h - 16, 40)
    x.fill()
    x.fillStyle = kind.color
    x.fillRect(40, h - 34, w - 80, 8)
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.font = '90px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
    x.fillText(icon, w / 2, 86)
    x.fillStyle = '#fff'
    let size = 48
    x.font = `800 ${size}px "Inter Tight", Inter, sans-serif`
    while (x.measureText(title).width > w - 70 && size > 22) { size -= 3; x.font = `800 ${size}px "Inter Tight", Inter, sans-serif` }
    x.fillText(title, w / 2, 178)
  })
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true })
  const sign = new THREE.Sprite(mat)
  sign.scale.set(0.62, 0.31, 1)
  sign.position.set(0, top + 0.26, 0)
  sign.userData.noCull = true
  root.add(sign)
  return { root, body, sign, dispose: () => { tex.dispose(); mat.dispose() } }
}
