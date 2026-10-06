import * as THREE from 'three'
import { canvasTex, context2d } from '../textures'
import { SLEEVE, SLEEVE_T, DISC_R } from './constants'
import type { ShelfRecord, LooseRecord } from './constants'
import { spineTex, placeholderCover } from './textures'
import { wearAmount, wearSleeve } from './wear'
import type { RecordModel } from './turntable'

/** What a record needs from the rest of the corner when it leaves the shelf. */
export interface LooseDeps {
  group: THREE.Group
  loader: THREE.TextureLoader
  coverTex: Map<string, THREE.Texture>
  models: { recTpl: RecordModel | null; sleeveTpl: THREE.Object3D | null }
  pageMat: THREE.MeshStandardMaterial
  stackSlot: (uri: string) => { pos: THREE.Vector3; q: THREE.Quaternion } | null
  writeInstance: (r: ShelfRecord) => void
}

/** A real mesh (with cover) for a record that leaves the shelf: the sleeve with its cover, the vinyl inside it, and what to free again. */
export function makeLooseRecord(r: ShelfRecord, d: LooseDeps): LooseRecord {
  const { sleeveTpl, recTpl } = d.models // (what the models have loaded so far)
  // the cover glows a touch on its own so it stays readable in the shade of the shelf
  const cached = d.coverTex.get(r.album.uri) // the cover loaded in the background: on it from the first frame
  // everything made here for this one record is freed again when it goes back (browsing many records must not eat the memory)
  const ownTex: THREE.Texture[] = [], ownMat: THREE.Material[] = [], ownGeo: THREE.BufferGeometry[] = []
  const mkTex = <T extends THREE.Texture>(t: T): T => { ownTex.push(t); return t }
  let ownMap = !cached
  const coverMat = new THREE.MeshStandardMaterial({ map: cached || (sleeveTpl ? null : mkTex(placeholderCover(r.album))), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.16 })
  ownMat.push(coverMat)
  coverMat.emissiveMap = coverMat.map
  const src = r.album.image_large || r.album.image // the 640 px cover: sharp even when held up close
  if (src) {
    d.loader.load(src, (t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 16 // stays crisp at a distance and at an angle (clamped to what the GPU allows)
      paintLabelFn?.(t.image)
      if (paintCover) { paintCover(t.image); t.dispose() } else {
        if (ownMap) coverMat.map?.dispose() // (never the shared one)
        ownMap = true
        mkTex(t)
        coverMat.map = t
        coverMat.emissiveMap = t
        coverMat.needsUpdate = true
      }
    }, undefined, () => {})
  }
  const backMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(r.color), roughness: 0.6 })
  ownMat.push(backMat)
  // the sleeve: the model (rounded corners, an opening) – its texture is made here: the back on the left half, the cover on the right half –
  // or a plain box (faces: +x front cover, -x back, +y/-y edges, +z spine, -z back edge) until the model has loaded
  let mesh: THREE.Object3D
  let tint: (col: string) => void = (col) => { backMat.color.set(col) }
  let paintCover: ((img: CanvasImageSource) => void) | null = null
  let paintLabelFn: ((img: CanvasImageSource | null) => void) | null = null
  if (sleeveTpl) {
    const cv = document.createElement('canvas')
    cv.width = 1536; cv.height = 768 // (drawn in a 2048 × 1024 grid, scaled down)
    const tex = mkTex(new THREE.CanvasTexture(cv))
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 16
    let backCol = r.color, coverImg: CanvasImageSource | null = (cached?.image as CanvasImageSource | undefined) ?? null
    const draw = (): void => {
      const x = context2d(cv)
      x.setTransform(0.75, 0, 0, 0.75, 0, 0)
      const g = x.createLinearGradient(0, 0, 1024, 1024)
      g.addColorStop(0, backCol); g.addColorStop(1, '#14161c')
      x.fillStyle = g; x.fillRect(0, 0, 1024, 1024) // the back
      x.fillStyle = 'rgba(255,255,255,0.88)'; x.font = '700 58px Inter, sans-serif'; x.textAlign = 'center'
      x.fillText(String(r.album.name || '').slice(0, 26), 512, 480); x.font = '600 38px Inter, sans-serif'; x.fillText(String(r.album.artist || '').slice(0, 30), 512, 540)
      x.fillStyle = backCol; x.fillRect(1024, 0, 1024, 1024)
      if (coverImg) x.drawImage(coverImg, 1024, 0, 1024, 1024) // the front
      const wa = wearAmount(r.album)
      wearSleeve(x, 0, 0, 1024, r.album.uri + 'b', wa * 0.9) // worn (old ones more): the back and the front
      wearSleeve(x, 1024, 0, 1024, r.album.uri + 'f', wa * 0.75)
      tex.needsUpdate = true
    }
    draw()
    tint = (col) => { backCol = col; draw() }
    paintCover = (img) => { coverImg = img; draw() }
    coverMat.map = tex; coverMat.emissiveMap = tex; coverMat.needsUpdate = true
    mesh = new THREE.Group()
    const body = sleeveTpl.clone(true)
    body.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = o.receiveShadow = true; o.userData.sharedGeo = true; if (!Array.isArray(o.material) && /^cover/.test(o.material.name)) o.material = coverMat } }) // (the geometry and the cardboard belong to the model: shared)
    mesh.add(body)
  } else {
    const spineMat = new THREE.MeshStandardMaterial({ map: mkTex(spineTex(r.album, r.color)), roughness: 0.6 })
    ownMat.push(spineMat)
    const bg = new THREE.BoxGeometry(SLEEVE_T, SLEEVE, SLEEVE)
    ownGeo.push(bg)
    mesh = new THREE.Mesh(bg, [coverMat, backMat, d.pageMat, d.pageMat, spineMat, d.pageMat])
  }
  // the vinyl itself, inside the sleeve: it slides a little way out of the top when the record is held, browsed or playing
  const labelCol = r.color || '#c9553a'
  let disc: THREE.Object3D
  if (!recTpl) { // (the plain disc, until the record model has loaded)
    const discTex = mkTex(canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#0c0c0e'; x.fillRect(0, 0, w, h)
      const c = w / 2
      for (let g = 0.36; g < 0.99; g += 0.011) { x.strokeStyle = `rgba(255,255,255,${0.025 + ((g * 977) % 1) * 0.05})`; x.lineWidth = 1; x.beginPath(); x.arc(c, c, c * g, 0, Math.PI * 2); x.stroke() }
      x.strokeStyle = 'rgba(255,255,255,0.09)'; x.lineWidth = 3; x.beginPath(); x.arc(c, c, c * 0.355, 0, Math.PI * 2); x.stroke()
      x.fillStyle = labelCol; x.beginPath(); x.arc(c, c, c * 0.33, 0, Math.PI * 2); x.fill()
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.arc(c, c, c * 0.33, 0, Math.PI * 2); x.arc(c, c, c * 0.27, 0, Math.PI * 2, true); x.fill()
      x.fillStyle = '#0c0c0e'; x.beginPath(); x.arc(c, c, c * 0.028, 0, Math.PI * 2); x.fill()
    }))
    const discMat = new THREE.MeshStandardMaterial({ map: discTex, roughness: 0.32, metalness: 0.15 })
    const discEdge = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.4 })
    const dg = new THREE.CylinderGeometry(DISC_R, DISC_R, 0.0016, 72)
    ownGeo.push(dg)
    ownMat.push(discMat, discEdge)
    disc = new THREE.Mesh(dg, [discEdge, discMat, discMat])
    disc.rotation.z = Math.PI / 2 // the disc's axis points the same way as the cover's
  }
  else { // the record model: the label shows the cover
    const dc = document.createElement('canvas')
    dc.width = dc.height = 512
    const dt = mkTex(new THREE.CanvasTexture(dc))
    dt.flipY = false; dt.colorSpace = THREE.SRGBColorSpace; dt.anisotropy = 8
    const paintLabel = (img: CanvasImageSource | null): void => {
      const x = context2d(dc)
      x.fillStyle = '#0a0a0c'; x.fillRect(0, 0, 512, 512)
      for (const c of [148, 362]) { x.save(); x.beginPath(); x.arc(c, c, 48, 0, Math.PI * 2); x.clip(); if (img) x.drawImage(img, c - 48, c - 48, 96, 96); else { x.fillStyle = labelCol; x.fillRect(c - 48, c - 48, 96, 96) } x.restore(); x.fillStyle = '#0a0a0c'; x.beginPath(); x.arc(c, c, 3.5, 0, Math.PI * 2); x.fill() }
      dt.needsUpdate = true
    }
    paintLabel((cached?.image as CanvasImageSource | undefined) ?? null)
    const dm = recTpl.material.clone()
    dm.map = dt; dm.metalness = 0.15
    ownMat.push(dm)
    const model = new THREE.Mesh(recTpl.geometry, dm)
    model.userData.sharedGeo = true
    model.applyMatrix4(recTpl.matrix)
    model.castShadow = true
    disc = new THREE.Group()
    model.rotation.z += 0
    disc.add(model)
    disc.rotation.z = Math.PI / 2
    paintLabelFn = paintLabel
  }
  const free = (): void => { // give back what this record used (not the shared model geometry / cardboard)
    for (const t of ownTex) { t.dispose(); const img: unknown = t.image; if (img instanceof HTMLCanvasElement) { img.width = 1; img.height = 1 } }
    for (const m of ownMat) m.dispose()
    for (const g of ownGeo) g.dispose()
  }
  disc.castShadow = true
  const discHolder = new THREE.Group()
  discHolder.add(disc)
  mesh.add(discHolder)
  const slot = r.guest ? null : d.stackSlot(r.album.uri)
  if (slot) { mesh.position.copy(slot.pos); mesh.quaternion.copy(slot.q) } // it lies in the stack on the table: it comes from there
  else mesh.position.copy(r.home).setZ(r.home.z + r.out * 0.09)
  mesh.castShadow = mesh.receiveShadow = true
  mesh.userData = { kind: r.guest ? 'guest' : 'album', index: r.index }
  d.group.add(mesh)
  if (r.guest) {
    // tumbling in from the window
    mesh.quaternion.setFromEuler(new THREE.Euler(0.8, -1.2, 0.5))
    return { mesh, rec: r, disc: discHolder, tint, free, vel: new THREE.Vector3(0, 0.4, 0), returning: false }
  }
  r.hidden = true
  d.writeInstance(r)
  return { mesh, rec: r, disc: discHolder, tint, free, vel: new THREE.Vector3(), returning: false }
}
