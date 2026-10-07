import * as THREE from 'three'
import { canvasTex } from './textures'

export interface Door { username: string; label: string; photo: string | null; door?: string | null; owner: boolean }

// "Gangen": a curved corridor off to the side of the room with one door per room. The camera stands in the middle of the
// arc, so every door faces it; a click on a door is a click on that room (the page flies in and switches rooms).
const SPACING = 1.5 // metres between doors along the wall
const R = 5.2 // radius of the wall
const WIDTH = 1.0, HEIGHT = 2.05

/** Where the hall sits: far enough from the room that its lights and shadows never reach it. */
export const HALL_ORIGIN = new THREE.Vector3(34, 0, 0)

const hash = (s: string): number => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }

export function buildHall(scene: THREE.Scene, tag: <T extends THREE.Object3D>(o: T, station: string) => T, loadTexture: (url: string, done: (t: THREE.Texture) => void) => void) {
  const root = tag(new THREE.Group(), 'gangen')
  root.position.copy(HALL_ORIGIN)
  scene.add(root)

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x8f877d, roughness: 0.55 })
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xdfe5ee, roughness: 0.9, side: THREE.DoubleSide })
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 1, side: THREE.DoubleSide })
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f6, roughness: 0.5 })
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 1.5, 48), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = false
  root.add(floor)
  const ceil = new THREE.Mesh(new THREE.CircleGeometry(R + 1.5, 48), ceilMat)
  ceil.rotation.x = Math.PI / 2
  ceil.position.y = 3.2
  root.add(ceil)
  // a rug the whole way round – the corridor's long carpet
  const rug = new THREE.Mesh(new THREE.RingGeometry(R - 1.9, R - 0.9, 64), new THREE.MeshStandardMaterial({ color: 0x2b4a6e, roughness: 1 }))
  rug.rotation.x = -Math.PI / 2
  rug.position.y = 0.005
  root.add(rug)

  const doors = new THREE.Group()
  root.add(doors)
  let wall: THREE.Mesh | null = null
  let list: Door[] = []
  const texs: THREE.Texture[] = []

  /** The signboard over a door: name, tagline-ish line, the owner's photo as a round portrait. */
  function plate(d: Door, tint: string): THREE.MeshStandardMaterial {
    const tex = canvasTex(512, 256, (x, w, h) => {
      x.fillStyle = '#10161f'
      x.fillRect(0, 0, w, h)
      x.fillStyle = tint
      x.fillRect(0, h - 14, w, 14)
      x.fillStyle = '#fff'
      x.font = '800 78px "Inter Tight", Inter, sans-serif'
      x.textAlign = 'center'
      x.textBaseline = 'middle'
      let size = 78
      while (x.measureText(d.label).width > w - 60 && size > 28) { size -= 4; x.font = `800 ${size}px "Inter Tight", Inter, sans-serif` }
      x.fillText(d.label, w / 2, h / 2 - 8)
    })
    texs.push(tex)
    return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.6 })
  }

  const byName = new Map<string, { g: THREE.Group; hinge: THREE.Group }>() // (a room's door, to walk through it)
  let gen = 0 // (a picture that arrives after the doors were rebuilt belongs to doors that are gone: it is dropped)
  const freeDoors = (): void => {
    doors.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      o.geometry.dispose()
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose()
    })
    doors.clear()
  }
  function setDoors(next: Door[]): void {
    list = next
    const my = ++gen
    const late = (t: THREE.Texture): boolean => { if (my === gen) return false; t.dispose(); return true }
    freeDoors()
    byName.clear()
    wall?.geometry.dispose()
    if (wall) root.remove(wall)
    texs.splice(0).forEach((t) => t.dispose())
    const n = Math.max(1, next.length)
    const span = Math.min(Math.PI * 1.6, (n * SPACING) / R) // (a big house: the arc runs most of the way round)
    wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.35, R + 0.35, 3.2, 64, 1, true, Math.PI - span / 2 - 0.25, span + 0.5), wallMat)
    wall.position.y = 1.6
    root.add(wall)
    next.forEach((d, i) => {
      const a = (i - (n - 1) / 2) * (span / n) // angle from straight ahead (-z)
      const g = new THREE.Group()
      g.position.set(Math.sin(a) * R, 0, -Math.cos(a) * R)
      g.rotation.y = -a // face the middle
      g.userData.kind = 'door'
      g.userData.index = i
      const hue = hash(d.username) % 360
      const tint = `hsl(${hue} 70% 58%)`
      // the door leaf hangs on a hinge at its left edge, so it can swing open (into the room behind it); behind it, warm light
      const hinge = new THREE.Group()
      hinge.position.set(-WIDTH / 2, 0, 0)
      g.add(hinge)
      const leaf = new THREE.Group()
      leaf.position.x = WIDTH / 2
      hinge.add(leaf)
      // a shallow box of warm light in the doorway (inside the wall): what you see when the door opens, and walk into
      const glow = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, HEIGHT, 0.3), new THREE.MeshBasicMaterial({ color: 0xffe2b0, side: THREE.BackSide }))
      glow.position.set(0, HEIGHT / 2, -0.17)
      g.add(glow)
      const panel = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, HEIGHT, 0.06), new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${hue}, 45%, 38%)`), roughness: 0.5 }))
      panel.position.set(0, HEIGHT / 2, 0.02)
      leaf.add(panel)
      // frame
      for (const [w, h, x, y] of [[0.1, HEIGHT + 0.1, -WIDTH / 2 - 0.05, HEIGHT / 2 + 0.05], [0.1, HEIGHT + 0.1, WIDTH / 2 + 0.05, HEIGHT / 2 + 0.05], [WIDTH + 0.3, 0.1, 0, HEIGHT + 0.1]] as [number, number, number, number][]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), frameMat)
        f.position.set(x, y, 0.03)
        g.add(f)
      }
      // two inset panels + a handle: reads as a door from across the hall (or the room's own picture on the door)
      const inset = new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${hue}, 45%, 31%)`), roughness: 0.6 })
      if (d.door) {
        const dm = new THREE.MeshStandardMaterial({ roughness: 0.6 })
        const art = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, HEIGHT), dm)
        art.position.set(0, HEIGHT / 2, 0.056)
        leaf.add(art)
        loadTexture(d.door, (t) => { if (late(t)) return; t.colorSpace = THREE.SRGBColorSpace; dm.map = t; dm.needsUpdate = true; texs.push(t); onChange() })
      } else {
        for (const y of [0.55, 1.45]) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(WIDTH * 0.7, y < 1 ? 0.65 : 0.7, 0.02), inset)
          p.position.set(0, y, 0.065)
          leaf.add(p)
        }
      }
      const handle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd7b56d, metalness: 1, roughness: 0.3 }))
      handle.position.set(WIDTH * 0.36, 1.0, 0.1)
      leaf.add(handle)
      // the sign (name) over the door and the photo as a round window in it
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH + 0.2, (WIDTH + 0.2) / 2), plate(d, tint))
      sign.position.set(0, HEIGHT + 0.5, 0.1)
      g.add(sign)
      const pm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
      const portrait = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), pm)
      portrait.position.set(0, 1.62, 0.085)
      if (!d.door) leaf.add(portrait)
      const initial = canvasTex(128, 128, (x, w, h) => {
        x.fillStyle = tint; x.fillRect(0, 0, w, h)
        x.fillStyle = '#fff'; x.font = '800 78px "Inter Tight", Inter, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'
        x.fillText((d.label[0] ?? '?').toUpperCase(), w / 2, h / 2 + 4)
      })
      texs.push(initial)
      pm.map = initial
      if (d.photo) loadTexture(d.photo, (t) => { if (late(t)) return; t.colorSpace = THREE.SRGBColorSpace; pm.map = t; pm.needsUpdate = true; texs.push(t); onChange() })
      doors.add(g)
      byName.set(d.username, { g, hinge })
    })
    onChange()
  }
  let onChange: () => void = () => {}

  return {
    root,
    setDoors,
    setOnChange(fn: () => void) { onChange = fn },
    count: () => list.length,
    /** The camera for the hall: in the middle of the arc, a little back when there are many doors. */
    pose(): { pos: [number, number, number]; target: [number, number, number] } {
      const back = Math.min(4.4, 1.6 + Math.max(0, list.length - 3) * 0.5) // (a few doors: close; a whole street: far enough back for the arc to fit)
      return { pos: [HALL_ORIGIN.x, 1.55, HALL_ORIGIN.z + back], target: [HALL_ORIGIN.x, 1.4, HALL_ORIGIN.z - R] }
    },
    nameOf: (i: number): string | undefined => list[i]?.label,
    hasDoor: (username: string): boolean => byName.has(username),
    /** How far a room's door stands open (0 shut … 1 wide open, swung into the room behind it). */
    /** How far a door stands open (0 shut … 1 wide open). */
    openOf: (username: string): number => (byName.get(username)?.hinge.rotation.y ?? 0) / 1.3,
    /** (dev/testing) the middle of a door, in the world */
    doorCenter(username: string): THREE.Vector3 | null { const d = byName.get(username); if (!d) return null; d.g.updateWorldMatrix(true, false); return d.g.localToWorld(new THREE.Vector3(0, 1.1, 0)) },
    setOpen(username: string, a: number): void { const d = byName.get(username); if (d) d.hinge.rotation.y = Math.max(0, Math.min(1, a)) * 1.3 },
    /** In front of a room's door, and just through it (looking on into the room / back out into the hall). */
    doorPoses(username: string): { front: { pos: THREE.Vector3; target: THREE.Vector3 }; through: { pos: THREE.Vector3; target: THREE.Vector3 }; out: { pos: THREE.Vector3; target: THREE.Vector3 } } | null {
      const d = byName.get(username)
      if (!d) return null
      d.g.updateWorldMatrix(true, false)
      const at = (x: number, y: number, z: number): THREE.Vector3 => d.g.localToWorld(new THREE.Vector3(x, y, z))
      return {
        front: { pos: at(0, 1.45, 1.7), target: at(0, 1.25, 0) },
        through: { pos: at(0, 1.3, -0.12), target: at(0, 1.3, -2.5) },
        out: { pos: at(0, 1.4, -0.25), target: at(0, 1.35, 2) },
      }
    },
    userOf: (i: number): string | undefined => list[i]?.username,
  }
}
