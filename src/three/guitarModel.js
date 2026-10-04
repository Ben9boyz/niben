import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const GUITAR_HEIGHT = 1.0 // metres

function hsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0))
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

/**
 * Recolours a wood texture atlas: light, yellowish wood (spruce top) → `top`,
 * darker brown wood (mahogany back/sides) → `body`. The wood grain is kept by
 * scaling the target colour with the original brightness.
 * `region` limits the change to the upper part of the atlas (the body), so the neck keeps its wood.
 */
function recolorWood(texture, { top, body, region = 0.52 }) {
  const img = texture.image
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(img, 0, 0)
  const data = x.getImageData(0, 0, c.width, c.height)
  const px = data.data
  const tc = new THREE.Color(top)
  const bc = new THREE.Color(body || top)
  const maxY = Math.floor(c.height * region)
  for (let y = 0; y < maxY; y++) {
    for (let xx = 0; xx < c.width; xx++) {
      const i = (y * c.width + xx) * 4
      const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255
      const [h, s, l] = hsl(r, g, b)
      if (s < 0.2 || h < 12 || h > 58 || l < 0.08) continue // not wood: keep (pickguard, rosette, outline)
      const light = l > 0.42
      const target = light ? tc : bc
      const k = light ? l / 0.62 : l / 0.28
      // soft "burst": darken the light top towards the edges of its panel
      px[i] = Math.min(255, target.r * 255 * k)
      px[i + 1] = Math.min(255, target.g * 255 * k)
      px[i + 2] = Math.min(255, target.b * 255 * k)
    }
  }
  x.putImageData(data, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.flipY = texture.flipY
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.wrapS = texture.wrapS
  t.wrapT = texture.wrapT
  return t
}

/**
 * Normalises a downloaded guitar model (upright, front towards +z) to real-world
 * size and applies the colours from data.json:
 *   "farger": { "<materialnavn>": "#hex" | "krom" }   – recolour whole materials
 *   "tre": { "topp": "#hex", "kropp": "#hex" }       – recolour a wood texture atlas
 */
export function prepareGuitarModel(scene, spec = {}) {
  const model = scene.clone(true)
  const recolored = new Map()

  model.traverse((o) => {
    if (!o.isMesh) return
    o.castShadow = true
    o.receiveShadow = true
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    const next = mats.map((m) => {
      if (recolored.has(m)) return recolored.get(m)
      let out = m
      const want = spec.farger?.[m.name]
      if (want === 'krom') {
        out = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.18, name: m.name })
      } else if (want) {
        out = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(want), roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, name: m.name,
        })
      } else if (spec.tre && m.map) {
        out = m.clone()
        out.map = recolorWood(m.map, { top: spec.tre.topp, body: spec.tre.kropp })
        if ('clearcoat' in out) out.clearcoat = Math.min(out.clearcoat, 0.25)
        out.needsUpdate = true
      }
      recolored.set(m, out)
      return out
    })
    o.material = Array.isArray(o.material) ? next : next[0]
  })

  // Merge every mesh that shares a material into one (the Pacifica model alone has ~100 parts,
  // each costing a draw call). Looks identical, renders much faster.
  model.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert()
  const byMat = new Map()
  model.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return
    const g = o.geometry.clone()
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))
    const keep = o.material.map || o.material.normalMap ? ['position', 'normal', 'uv'] : ['position', 'normal']
    for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k)
    if (!g.attributes.normal) g.computeVertexNormals()
    const flat = g.index ? g.toNonIndexed() : g
    if (!byMat.has(o.material)) byMat.set(o.material, [])
    byMat.get(o.material).push(flat)
  })
  const merged = new THREE.Group()
  for (const [mat, geos] of byMat) {
    const keys = Object.keys(geos[0].attributes).join()
    const ok = geos.every((g) => Object.keys(g.attributes).join() === keys)
    const geo = ok ? mergeGeometries(geos, false) : null
    if (geo) {
      const m = new THREE.Mesh(geo, mat)
      m.castShadow = m.receiveShadow = true
      merged.add(m)
    } else {
      geos.forEach((g) => merged.add(Object.assign(new THREE.Mesh(g, mat), { castShadow: true, receiveShadow: true })))
    }
  }
  if (merged.children.length) {
    // geometry is baked relative to the model root, so the root keeps its own transform
    model.clear()
    merged.children.slice().forEach((c) => model.add(c))
  }

  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  const s = GUITAR_HEIGHT / size.y
  // keep any offset the file's root already had: new = s * (old - centre)
  model.position.sub(centre).multiplyScalar(s)
  model.scale.multiplyScalar(s)
  const wrap = new THREE.Group()
  wrap.add(model)
  return wrap
}
