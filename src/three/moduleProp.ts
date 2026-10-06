import * as THREE from 'three'
import { canvasTex } from './textures'
import type { ModuleKind } from '@/lib/modules/catalog'
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

// The piece of furniture a hobby module stands as in the room: its own model (three/moduleModels.ts) in the module's colour, with a
// sign over it (the symbol and the name) that always turns towards you.
const darkWood = new THREE.MeshStandardMaterial({ color: 0x6d4c2f, roughness: 0.75 })

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Mesh {
  const o = new THREE.Mesh(g, m)
  o.position.set(x, y, z)
  o.castShadow = true
  o.receiveShadow = true
  parent.add(o)
  return o
}

/** A kind without a model of its own (a new hobby before its model is made): a plain pedestal in its colour. */
function pedestal(col: THREE.Color, g: THREE.Group): number {
  const paint = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 })
  mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.07, 32), darkWood, 0, 0.035, 0, g)
  mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.7, 32), paint, 0, 0.42, 0, g)
  mesh(new THREE.OctahedronGeometry(0.13), paint, 0, 0.92, 0, g)
  return 1.1
}

export interface PropHandle { root: THREE.Group; body: THREE.Group; sign: THREE.Sprite; dispose: () => void }

export function buildModuleProp(kind: ModuleKind, title: string, icon: string = kind.icon): PropHandle {
  const root = new THREE.Group()
  const body = new THREE.Group() // the built-in model (taken away again when the room has its own .glb)
  root.add(body)
  const col = new THREE.Color(kind.color)
  const own = MODELS[kind.id] // a model of its own for the hobby (a new kind without one yet: a pedestal)
  const top = own ? own(body, col) : pedestal(col, body)
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
  return { root, body, sign, dispose: () => { tex.dispose(); mat.dispose(); body.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose() }) } }
}
