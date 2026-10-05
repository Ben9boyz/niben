import * as THREE from 'three'

// Right half of each body outline, from bottom centre up to top centre.
// The left half is mirrored. Units are roughly decimetres.
const OUTLINES: Record<string, [number, number][]> = {
  elektrisk: [
    [0, -2.2], [1.0, -2.1], [1.62, -1.6], [1.74, -0.75], [1.36, 0.02], [1.28, 0.55],
    [1.58, 1.3], [1.5, 2.0], [1.16, 2.06], [0.86, 1.6], [0.5, 1.38], [0, 1.42],
  ],
  akustisk: [
    [0, -2.45], [1.2, -2.3], [1.86, -1.65], [1.96, -0.8], [1.62, 0.02], [1.32, 0.5],
    [1.46, 1.12], [1.24, 1.72], [0.62, 1.98], [0, 2.02],
  ],
}

function bodyShape(points: [number, number][], mirrorX = 1): THREE.Shape {
  const right = points.map(([x, y]) => new THREE.Vector3(x * mirrorX, y, 0))
  const left = points.slice(1, -1).reverse().map(([x, y]) => new THREE.Vector3(-x * mirrorX, y, 0))
  const curve = new THREE.CatmullRomCurve3([...right, ...left], true, 'centripetal')
  return new THREE.Shape(curve.getPoints(260).map((p) => new THREE.Vector2(p.x, p.y)))
}

const FRETBOARDS: Record<string, number> = {
  palisander: 0x3a2318,
  lønn: 0xe6c18a,
  ibenholt: 0x141110,
}

/** The part of a guitar's data that decides how it is built. */
export interface GuitarSpec { type?: string; farge?: string; gripebrett?: string; pickguard?: string }
export function buildGuitar(spec: GuitarSpec = {}): THREE.Group {
  const type = spec.type === 'akustisk' ? 'akustisk' : 'elektrisk'
  const acoustic = type === 'akustisk'
  const color = new THREE.Color(spec.farge || (acoustic ? '#c98a4b' : '#2b8cff'))

  const g = new THREE.Group()
  const mats = {
    body: new THREE.MeshPhysicalMaterial({
      color, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06,
      sheen: 0.3, sheenColor: color.clone().offsetHSL(0, 0, 0.2),
    }),
    binding: new THREE.MeshPhysicalMaterial({ color: 0xf4efe6, roughness: 0.3, clearcoat: 1 }),
    neck: new THREE.MeshPhysicalMaterial({ color: acoustic ? 0x9a6a3a : 0xdcb47c, roughness: 0.45, clearcoat: 0.6 }),
    board: new THREE.MeshStandardMaterial({ color: (spec.gripebrett ? FRETBOARDS[spec.gripebrett] : undefined) ?? (acoustic ? FRETBOARDS.palisander : FRETBOARDS.lønn), roughness: 0.7 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe8edf2, metalness: 1, roughness: 0.18 }),
    string: new THREE.MeshStandardMaterial({ color: 0xd9dde3, metalness: 1, roughness: 0.25 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.55 }),
    guard: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(spec.pickguard || (acoustic ? '#2a1a12' : '#f6f3ec')), roughness: 0.25, clearcoat: 1 }),
    pickup: new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.4 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.5 }),
    dot: new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.3 }),
  }

  // ── Body ──────────────────────────────────────────────
  const depth = acoustic ? 0.95 : 0.42
  const bevel = acoustic ? 0.05 : 0.1
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape(OUTLINES[type]), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6, curveSegments: 4,
  })
  bodyGeo.translate(0, 0, -depth / 2)
  const body = new THREE.Mesh(bodyGeo, mats.body)
  g.add(body)
  const top = depth / 2 + bevel // z of the front face

  if (acoustic) {
    // white binding around the top edge
    const bind = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bodyShape(OUTLINES.akustisk, 1.012), { depth: 0.04, bevelEnabled: false }),
      mats.binding,
    )
    bind.position.z = top - 0.06
    bind.scale.set(1.0, 1.003, 1)
    g.add(bind)
  }

  // ── Neck geometry ──────────────────────────────────────
  const bridgeY = acoustic ? -1.3 : -1.35
  const neckStart = acoustic ? 1.85 : 1.0
  const nutY = acoustic ? 6.25 : 6.4
  const scale = nutY - bridgeY
  const neckLen = nutY - neckStart
  const boardZ = top + 0.12

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.5, neckLen, 0.22), mats.neck)
  neck.position.set(0, neckStart + neckLen / 2, top - 0.02)
  g.add(neck)

  const boardStart = acoustic ? 1.0 : 0.45
  const boardLen = nutY - boardStart
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.56, boardLen, 0.06), mats.board)
  board.position.set(0, boardStart + boardLen / 2, boardZ - 0.03)
  g.add(board)

  // frets at equal-tempered positions
  const fretGeo = new THREE.BoxGeometry(0.56, 0.018, 0.03)
  for (let n = 1; n <= 22; n++) {
    const y = nutY - (scale - scale / Math.pow(2, n / 12))
    if (y < boardStart + 0.05) break
    const f = new THREE.Mesh(fretGeo, mats.chrome)
    f.position.set(0, y, boardZ + 0.01)
    g.add(f)
    if ([3, 5, 7, 9, 15, 17].includes(n) || n === 12) {
      const prev = nutY - (scale - scale / Math.pow(2, (n - 1) / 12))
      const mid = (y + prev) / 2
      const xs = n === 12 ? [-0.12, 0.12] : [0]
      xs.forEach((x) => {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 20), mats.dot)
        d.rotation.x = Math.PI / 2
        d.position.set(x, mid, boardZ + 0.001)
        g.add(d)
      })
    }
  }

  // nut
  const nut = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.07), mats.cream)
  nut.position.set(0, nutY, boardZ + 0.01)
  g.add(nut)

  // headstock
  const head = new THREE.Group()
  const headShape = new THREE.Shape()
  if (acoustic) {
    headShape.moveTo(-0.28, 0)
    headShape.lineTo(-0.38, 1.35)
    headShape.quadraticCurveTo(0, 1.5, 0.38, 1.35)
    headShape.lineTo(0.28, 0)
  } else {
    headShape.moveTo(-0.28, 0)
    headShape.bezierCurveTo(-0.5, 0.4, -0.3, 0.9, -0.32, 1.5)
    headShape.quadraticCurveTo(-0.2, 1.75, 0.1, 1.68)
    headShape.bezierCurveTo(0.42, 1.2, 0.5, 0.5, 0.28, 0)
  }
  const headGeo = new THREE.ExtrudeGeometry(headShape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 })
  const headMesh = new THREE.Mesh(headGeo, acoustic ? mats.dark : mats.neck)
  head.add(headMesh)
  const pegs = acoustic
    ? [[-0.36, 0.35], [-0.38, 0.7], [-0.4, 1.05], [0.36, 0.35], [0.38, 0.7], [0.4, 1.05]]
    : [[-0.38, 0.25], [-0.36, 0.48], [-0.34, 0.71], [-0.33, 0.94], [-0.33, 1.17], [-0.34, 1.4]]
  pegs.forEach(([x, y]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 16), mats.chrome)
    post.rotation.x = Math.PI / 2
    post.position.set(x * (acoustic ? 0.55 : 0.55), y, 0.2)
    const key = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20), mats.chrome)
    key.rotation.z = Math.PI / 2
    key.position.set(x * 1.18, y, 0.05)
    head.add(post, key)
  })
  head.position.set(0, nutY + 0.02, boardZ - 0.12)
  if (acoustic) head.rotation.x = -0.22
  g.add(head)

  // ── Hardware ───────────────────────────────────────────
  if (acoustic) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.55, 64), mats.dark)
    hole.position.set(0, 0.75, top + 0.002)
    const ros = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.74, 80), mats.cream)
    ros.position.set(0, 0.75, top + 0.003)
    const ros2 = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.81, 80), mats.cream)
    ros2.position.set(0, 0.75, top + 0.003)
    const guardShape = new THREE.Shape()
    guardShape.moveTo(0.62, 0.35)
    guardShape.bezierCurveTo(1.25, 0.1, 1.45, -0.55, 1.05, -0.75)
    guardShape.bezierCurveTo(0.75, -0.9, 0.5, -0.5, 0.45, -0.15)
    guardShape.lineTo(0.62, 0.35)
    const guard = new THREE.Mesh(new THREE.ExtrudeGeometry(guardShape, { depth: 0.01, bevelEnabled: false }), mats.guard)
    guard.position.z = top
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.28, 0.08), mats.dark)
    bridge.position.set(0, bridgeY, top + 0.04)
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.06), mats.cream)
    saddle.position.set(0, bridgeY + 0.05, top + 0.1)
    g.add(hole, ros, ros2, guard, bridge, saddle)
  } else {
    const guardShape = new THREE.Shape()
    guardShape.moveTo(-0.3, 1.25)
    guardShape.bezierCurveTo(-1.0, 1.35, -1.25, 0.6, -1.25, 0.1)
    guardShape.bezierCurveTo(-1.25, -0.8, -1.05, -1.5, -0.45, -1.7)
    guardShape.bezierCurveTo(0.2, -1.85, 1.0, -1.55, 1.15, -1.05)
    guardShape.bezierCurveTo(1.25, -0.6, 0.9, -0.2, 0.95, 0.4)
    guardShape.bezierCurveTo(0.95, 0.9, 0.55, 1.25, 0.3, 1.25)
    guardShape.lineTo(-0.3, 1.25)
    const guard = new THREE.Mesh(new THREE.ExtrudeGeometry(guardShape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.015, bevelSegments: 2 }), mats.guard)
    guard.position.z = top
    g.add(guard)
    ;[-0.55, 0.05, 0.62].forEach((y, i) => {
      const pu = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.52, 6, 16), mats.pickup)
      pu.rotation.z = Math.PI / 2 + (i === 0 ? 0.12 : 0)
      pu.scale.z = 0.5
      pu.position.set(0, y, top + 0.06)
      g.add(pu)
      for (let s = 0; s < 6; s++) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), mats.chrome)
        pole.rotation.x = Math.PI / 2
        pole.position.set(-0.25 + s * 0.1, y + (i === 0 ? (s - 2.5) * -0.012 : 0), top + 0.11)
        g.add(pole)
      }
    })
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.06), mats.chrome)
    bridge.position.set(0, bridgeY - 0.1, top + 0.04)
    g.add(bridge)
    ;[[0.82, -1.0], [0.95, -1.38], [0.98, -1.78]].forEach(([x, y]) => {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.12, 32), mats.pickup)
      knob.rotation.x = Math.PI / 2
      knob.position.set(x, y + 0.25, top + 0.08)
      g.add(knob)
    })
    const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 24), mats.chrome)
    jack.rotation.x = Math.PI / 2
    jack.position.set(-0.95, -1.05, top + 0.03)
    jack.scale.set(1, 1, 1.6)
    g.add(jack)
  }

  // ── Strings ────────────────────────────────────────────
  const strZ = boardZ + 0.06
  const strings = []
  for (let s = 0; s < 6; s++) {
    const xb = -0.25 + s * 0.1
    const xn = -0.21 + s * 0.084
    const a = new THREE.Vector3(xb, bridgeY + (acoustic ? 0.05 : 0), strZ)
    const b = new THREE.Vector3(xn, nutY, strZ)
    const len = a.distanceTo(b)
    const r = 0.006 + (5 - s) * 0.0018
    const str = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mats.string)
    str.position.copy(a).add(b).multiplyScalar(0.5)
    str.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    str.userData.base = str.position.clone()
    strings.push(str)
    g.add(str)
  }
  g.userData.strings = strings

  g.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true } })

  // centre it vertically
  const box = new THREE.Box3().setFromObject(g)
  const centre = box.getCenter(new THREE.Vector3())
  const wrap = new THREE.Group()
  g.position.sub(centre)
  wrap.add(g)
  wrap.userData.height = box.max.y - box.min.y
  wrap.userData.strings = strings
  return wrap
}
