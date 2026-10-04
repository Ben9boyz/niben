import * as THREE from 'three'
import ThreeGlobe from 'three-globe'
import ConicPolygonGeometry from 'three-conic-polygon-geometry'
import GeoJsonGeometry from 'three-geojson-geometry'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { feature } from 'topojson-client'
import worldTopo from 'world-atlas/countries-110m.json'

const RADIUS = 0.24
const countries = feature(worldTopo, worldTopo.objects.countries).features
  .filter((f) => f.properties.name !== 'Antarctica')

function centre(f) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  let best = null, bestArea = -1
  for (const p of polys) {
    let minX = 180, maxX = -180, minY = 90, maxY = -90
    for (const [x, y] of p[0]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
    const area = (maxX - minX) * (maxY - minY)
    if (area > bestArea) { bestArea = area; best = { lng: (minX + maxX) / 2, lat: (minY + maxY) / 2 } }
  }
  return best
}
const centres = new Map(countries.map((f) => [f.properties.name, centre(f)]))

function shortest(from, to) {
  let d = (to - from) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return from + d
}

export function buildGlobeTable() {
  const group = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: 0xd9b48a, roughness: 0.5 })
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.45 })
  const brass = new THREE.MeshStandardMaterial({ color: 0xd7b56d, roughness: 0.25, metalness: 1 })
  const add = (geo, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    parent.add(m)
    return m
  }

  // round side table
  add(new THREE.CylinderGeometry(0.36, 0.36, 0.035, 64), wood, 0, 0.62, 0)
  add(new THREE.CylinderGeometry(0.035, 0.05, 0.6, 24), white, 0, 0.31, 0)
  add(new THREE.CylinderGeometry(0.22, 0.24, 0.025, 48), white, 0, 0.012, 0)
  // a couple of travel books on the table
  add(new THREE.BoxGeometry(0.2, 0.03, 0.14), new THREE.MeshStandardMaterial({ color: 0x2b8cff, roughness: 0.6 }), 0.16, 0.652, 0.12).rotation.y = 0.4
  add(new THREE.BoxGeometry(0.18, 0.025, 0.13), new THREE.MeshStandardMaterial({ color: 0xe8eef6, roughness: 0.6 }), 0.16, 0.68, 0.12).rotation.y = 0.2

  // globe stand
  const centerY = 0.64 + 0.04 + 0.08 + RADIUS + 0.03
  add(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 48), brass, 0, 0.66, 0)
  add(new THREE.CylinderGeometry(0.012, 0.016, 0.1, 16), brass, 0, 0.72, 0)

  const stand = new THREE.Group() // rotated by the room to face the camera
  stand.position.set(0, centerY, 0)
  group.add(stand)

  const meridian = new THREE.Mesh(new THREE.TorusGeometry(RADIUS + 0.025, 0.007, 12, 96, Math.PI * 1.2), brass)
  meridian.rotation.z = -Math.PI * 0.1
  meridian.castShadow = true
  stand.add(meridian)

  const tilt = new THREE.Group()
  stand.add(tilt)
  const spin = new THREE.Group()
  tilt.add(spin)

  const globe = new ThreeGlobe({ animateIn: false })
    .showAtmosphere(false)
    .showGraticules(true)
  globe.scale.setScalar(RADIUS / 100)
  spin.add(globe)

  const gm = globe.globeMaterial()
  gm.color = new THREE.Color(0x173a6e)
  gm.shininess = 40
  gm.specular = new THREE.Color(0x335577)

  const mats = {
    land: new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.6, side: THREE.DoubleSide }),
    hover: new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.5, side: THREE.DoubleSide }),
    visited: new THREE.MeshStandardMaterial({ color: 0x6fe3ff, emissive: 0x18b8ff, emissiveIntensity: 0.35, roughness: 0.4, side: THREE.DoubleSide }),
    selected: new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a00, emissiveIntensity: 0.25, roughness: 0.35, side: THREE.DoubleSide }),
    side: new THREE.MeshStandardMaterial({ color: 0xc9d6e6, roughness: 0.7, side: THREE.DoubleSide }),
    sideVisited: new THREE.MeshStandardMaterial({ color: 0x2b8cff, emissive: 0x2b8cff, emissiveIntensity: 0.2, side: THREE.DoubleSide }),
    stroke: new THREE.LineBasicMaterial({ color: 0x3c6eaa, transparent: true, opacity: 0.35 }),
  }

  // ── Country layers ────────────────────────────────────
  // three-globe draws every country as its own cap + side + outline (~750 draw calls). We build
  // the same shapes with the same geometry classes, but merge them into a handful of meshes.
  const layer = new THREE.Group()
  globe.add(layer)
  const R = 100
  const RES = 5
  const shapes = new Map(countries.map((f) => [
    f.properties.name,
    f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates,
  ]))

  function plain(g) {
    const out = g.index ? g.toNonIndexed() : g
    for (const k of Object.keys(out.attributes)) if (!['position', 'normal'].includes(k)) out.deleteAttribute(k)
    out.clearGroups()
    return out
  }
  function countryGeo(name, alt, part) {
    const polys = shapes.get(name) || []
    const parts = polys.map((coords) => {
      const g = new ConicPolygonGeometry(coords, 0, R, false, part === 'cap', part === 'side', RES)
      g.scale(1 + alt, 1 + alt, 1 + alt)
      return plain(g)
    })
    return parts.length ? mergeGeometries(parts, false) : null
  }
  function strokeGeo(name, alt) {
    const polys = shapes.get(name) || []
    const parts = polys.map((coords) => {
      const g = new GeoJsonGeometry({ type: 'Polygon', coordinates: coords }, R, RES)
      g.scale(1 + alt + 1e-4, 1 + alt + 1e-4, 1 + alt + 1e-4)
      const out = g.index ? g.toNonIndexed() : g
      for (const k of Object.keys(out.attributes)) if (k !== 'position') out.deleteAttribute(k)
      return out
    })
    return parts.length ? mergeGeometries(parts, false) : null
  }

  /** Builds cap + side + outline for a set of countries at one altitude. Caps remember which triangles belong to which country. */
  function buildLayer(names, alt, capMat, sideMat) {
    const g = new THREE.Group()
    const caps = [], sides = [], strokes = [], ranges = []
    let tri = 0
    for (const n of names) {
      const cap = countryGeo(n, alt, 'cap')
      if (cap) {
        caps.push(cap)
        ranges.push({ start: tri, name: n })
        tri += cap.attributes.position.count / 3
      }
      const side = countryGeo(n, alt, 'side')
      if (side) sides.push(side)
      const st = strokeGeo(n, alt)
      if (st) strokes.push(st)
    }
    if (caps.length) {
      const m = new THREE.Mesh(mergeGeometries(caps, false), capMat)
      m.userData.ranges = ranges
      g.add(m)
    }
    if (sides.length) g.add(new THREE.Mesh(mergeGeometries(sides, false), sideMat))
    if (strokes.length) g.add(new THREE.LineSegments(mergeGeometries(strokes, false), mats.stroke))
    return g
  }
  function disposeLayer(g) {
    if (!g) return
    layer.remove(g)
    g.traverse((o) => o.geometry?.dispose())
  }

  const base = buildLayer([...shapes.keys()], 0.006, mats.land, mats.side)
  layer.add(base)
  let visitedLayer = null
  let hoverLayer = null
  let selectedLayer = null

  let visited = new Set()
  let hovered = null
  let selected = null
  let dragging = false
  let spinVel = 0
  let target = null // { yaw, pitch }

  function rebuildVisited() {
    disposeLayer(visitedLayer)
    visitedLayer = buildLayer([...visited].filter((n) => shapes.has(n)), 0.018, mats.visited, mats.sideVisited)
    layer.add(visitedLayer)
  }
  function rebuildHover() {
    disposeLayer(hoverLayer)
    hoverLayer = null
    if (hovered && hovered !== selected && shapes.has(hovered)) {
      hoverLayer = buildLayer([hovered], 0.03, visited.has(hovered) ? mats.visited : mats.hover, visited.has(hovered) ? mats.sideVisited : mats.side)
      layer.add(hoverLayer)
    }
  }
  function rebuildSelected() {
    disposeLayer(selectedLayer)
    selectedLayer = null
    if (selected && shapes.has(selected)) {
      selectedLayer = buildLayer([selected], 0.05, mats.selected, visited.has(selected) ? mats.sideVisited : mats.side)
      layer.add(selectedLayer)
    }
  }

  /** Country under a raycast hit (uses the triangle index on merged meshes). */
  function countryFromHit(hit) {
    const ranges = hit?.object?.userData?.ranges
    if (!ranges || hit.faceIndex == null) return null
    let lo = 0, hi = ranges.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (ranges[mid].start <= hit.faceIndex) lo = mid
      else hi = mid - 1
    }
    return ranges[lo]?.name ?? null
  }

  function aim(name) {
    const c = centres.get(name)
    if (!c) { target = null; return }
    // three-globe: lng → rotation about y, lat → tilt toward the viewer (+z of the stand)
    const p = globe.getCoords(c.lat, c.lng, 0)
    const yaw = -Math.atan2(p.x, p.z)
    const pitch = THREE.MathUtils.clamp(THREE.MathUtils.degToRad(c.lat), -0.9, 0.9)
    target = { yaw: shortest(spin.rotation.y, yaw), pitch }
  }

  /** Returns true while the globe is still moving. */
  function update(dt, t, autoSpin) {
    if (target) {
      const dy = target.yaw - spin.rotation.y, dx = target.pitch - tilt.rotation.x
      spin.rotation.y += dy * Math.min(1, dt * 3.5)
      tilt.rotation.x += dx * Math.min(1, dt * 3.5)
      spinVel = 0
      return Math.abs(dy) > 1e-4 || Math.abs(dx) > 1e-4
    } else {
      if (!dragging) {
        spinVel += ((autoSpin ? 0.18 : 0) - spinVel) * Math.min(1, dt * 1.5)
      }
      spin.rotation.y += spinVel * dt
      const dx = 0.15 - tilt.rotation.x
      tilt.rotation.x += dx * Math.min(1, dt * 1.5)
      return Math.abs(spinVel) > 1e-4 || Math.abs(dx) > 1e-4 || dragging
    }
  }

  const _n = new THREE.Vector3()
  const _c = new THREE.Vector3()
  /** World position of the selected country on the globe surface (or null). */
  function selectedWorld(out, cameraPos) {
    if (!selected) return null
    const c = centres.get(selected)
    if (!c) return null
    const p = globe.getCoords(c.lat, c.lng, 0.06)
    out.set(p.x, p.y, p.z)
    globe.localToWorld(out)
    // hidden behind the globe? (surface normal facing away from the camera)
    globe.getWorldPosition(_c)
    _n.subVectors(out, _c).normalize()
    const facing = _n.dot(_c.subVectors(cameraPos, out).normalize()) > 0.1
    return facing ? out : null
  }

  return {
    group,
    stand,
    selectedWorld,
    globe,
    centerY,
    countryFromHit,
    setVisited(set) { visited = set; rebuildVisited(); rebuildHover(); rebuildSelected() },
    setHover(n) { if (n !== hovered) { hovered = n; rebuildHover() } },
    setSelected(n) {
      selected = n
      rebuildSelected()
      rebuildHover()
      if (n) aim(n)
      else target = null
    },
    drag(dx) { target = null; spinVel = dx * 6; spin.rotation.y += dx * 4 },
    setDragging(v) { dragging = v },
    update,
  }
}
