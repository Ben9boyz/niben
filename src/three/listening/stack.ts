import * as THREE from 'three'
import { TOP_Y, LEAN, LEAN_UP, LEAN_Z } from './constants'
import { spineTex } from './textures'
import type { StackEntry } from './constants'
import type { Kit } from './kit'

// The stack of records on the table (the queue first, then what I listened to last) and the next album leaning by the plant.
export function buildStack(kit: Kit) {
  const { group, loader } = kit
  // ── The stack of records on the table: the albums coming up in the queue on top (next one first), the albums
  // I listened to last below them. Any height: the sleeves get thinner the more there are. ──
  const stackGroup = new THREE.Group()
  stackGroup.position.set(0.88, TOP_Y, 0.27) // on the long table top, to the right of the leaning sleeves and the iPod
  group.add(stackGroup)
  let stackItems: StackEntry[] = []
  const stackTex = new Map<string, THREE.Texture>()
  // each sleeve shows a proper spine (name and artist on its colour) – the same drawing as the records on the shelf
  const spineMats = new Map<string, THREE.MeshStandardMaterial>()
  function spineMat(it: StackEntry, color: THREE.Color): THREE.MeshStandardMaterial {
    const key = it.uri + '|' + color.getHexString()
    let m = spineMats.get(key)
    if (!m) {
      const tex = spineTex({ uri: it.uri, name: it.name ?? '', artist: it.artist ?? '' } as Parameters<typeof spineTex>[0], '#' + color.getHexString())
      tex.center.set(0.5, 0.5); tex.rotation = Math.PI / 2 // (lying flat: the text runs along the sleeve)
      m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 })
      spineMats.set(key, m)
    }
    return m
  }
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
      const spine = spineMat(it, edge.color)
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, t * 0.92, 0.3), [edge, edge, top, edge, spine, edge])
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
  nextMesh.position.set(0.40, TOP_Y + LEAN_UP, LEAN_Z) // leans against the wall like the playing sleeve, to the right of it
  nextMesh.rotation.x = -LEAN
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
    // its spine (the left edge, towards the turntable)
    const sp = spineMat(a, new THREE.Color(0xe9e4d8))
    sp.map && (sp.map.rotation = 0)
    ;(nextMesh.material as THREE.Material[])[1] = sp
    const src = a.image_large || a.image
    if (src) loader.load(src, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; nextMat.map?.dispose(); nextMat.map = tex; nextMat.needsUpdate = true; onChange?.() }, undefined, () => {})
    onChange?.()
  }
  return { stackGroup, setStack, stackSlot, setNext, items: (): StackEntry[] => stackItems }
}
