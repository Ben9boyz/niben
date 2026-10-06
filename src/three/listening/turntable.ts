import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { TOP_Y, TT_C, TT_ARM } from './constants'
import { canvasTex, context2d } from '../textures'
import { grooves } from './textures'
import { glbLoader, warnLoad } from './models'
import type { Kit } from './kit'

/** The record model: its geometry and material, and where it sits in the model's own coordinates. */
export interface RecordModel { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; matrix: THREE.Matrix4 }

// The turntable: platter, the record on it, the tonearm and all the details; the three knobs that become buttons in the deck view.
export function buildTurntable(kit: Kit) {
  const { group, add, dark, alu, wood } = kit
  // ── Turntable ──
  const tt = new THREE.Group()
  tt.position.set(-0.38, TOP_Y, 0.24)
  tt.userData = { kind: 'turntable' } // click: pause / play
  group.add(tt)
  add(new RoundedBoxGeometry(0.46, 0.08, 0.36, 3, 0.012), wood, 0, 0.04, 0, tt)
  add(new THREE.CylinderGeometry(0.155, 0.155, 0.016, 64), dark, -0.04, 0.088, 0, tt)
  const platter = new THREE.Group()
  platter.position.set(TT_C.x, 0.111, TT_C.z) // (the platter's centre on the model)
  tt.add(platter)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.004, 96), [
    new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ map: grooves(), roughness: 0.35, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: 0x0c0c0e }),
  ])
  disc.castShadow = true
  // the record on the turntable: only there while one is playing (it comes out of its sleeve and lands on the platter)
  const rec = new THREE.Group()
  rec.visible = false
  platter.add(rec)
  rec.add(disc)
  const labelMat = new THREE.MeshStandardMaterial({ color: 0xd33a2c, roughness: 0.6 })
  const label = new THREE.Mesh(new THREE.CircleGeometry(0.048, 48), labelMat)
  label.rotation.x = -Math.PI / 2
  label.position.y = 0.0025
  rec.add(label)
  // the same record in flight between the sleeve and the platter
  const flyDisc = new THREE.Group()
  flyDisc.add(disc.clone(), label.clone())
  flyDisc.visible = false
  group.add(flyDisc)
  // the record's own model (public/models/record.glb: a 12-inch with a hole, grooves as a normal map). Its label is painted here:
  // the cover of the album that plays, on both sides. The plain disc above stays until the model has loaded.
  const discCanvas = document.createElement('canvas')
  discCanvas.width = discCanvas.height = 1024
  const discTex = new THREE.CanvasTexture(discCanvas)
  discTex.flipY = false // (like the model's own textures)
  discTex.colorSpace = THREE.SRGBColorSpace
  discTex.anisotropy = 8
  let discLabel: HTMLImageElement | null = null // the cover image on the label (null: a plain red label)
  function paintDisc(): void {
    const x = context2d(discCanvas)
    x.fillStyle = '#0a0a0c'
    x.fillRect(0, 0, 1024, 1024)
    for (const c of [296, 724]) { // the two sides
      x.save()
      x.beginPath(); x.arc(c, c, 97, 0, Math.PI * 2); x.clip()
      if (discLabel) x.drawImage(discLabel, c - 97, c - 97, 194, 194)
      else { x.fillStyle = '#d33a2c'; x.fillRect(c - 97, c - 97, 194, 194) }
      x.restore()
      x.fillStyle = '#0a0a0c'; x.beginPath(); x.arc(c, c, 7, 0, Math.PI * 2); x.fill() // the spindle hole
    }
    discTex.needsUpdate = true
  }
  paintDisc()
  // the sleeve and record models, kept to make the sleeves and the discs inside them (read by the shelf when a record leaves it)
  const models: { recTpl: RecordModel | null; sleeveTpl: THREE.Object3D | null } = { recTpl: null, sleeveTpl: null }
  glbLoader().load('models/sleeve.glb', (g) => { models.sleeveTpl = g.scene }, undefined, warnLoad('sleeve'))
  glbLoader().load('models/record.glb', (g) => {
    let found: THREE.Mesh | null = null
    g.scene.traverse((o) => { if (o instanceof THREE.Mesh && !found) found = o })
    const src = found as THREE.Mesh | null
    if (!src || !(src.material instanceof THREE.MeshStandardMaterial)) return
    src.updateWorldMatrix(true, false)
    const mat = src.material.clone()
    mat.map = discTex
    mat.metalness = 0.15
    mat.needsUpdate = true
    models.recTpl = { geometry: src.geometry, material: src.material, matrix: src.matrixWorld.clone() }
    const flat = (): THREE.Mesh => { const m = new THREE.Mesh(src.geometry, mat); m.applyMatrix4(src.matrixWorld); m.castShadow = true; return m }
    for (const c of rec.children) c.visible = false
    for (const c of flyDisc.children) c.visible = false
    rec.add(flat())
    flyDisc.add(flat())
    kit.markDirty()
  }, undefined, warnLoad('record'))
  add(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 8), alu, -0.04, 0.11, 0, tt)
  add(new THREE.CylinderGeometry(0.025, 0.028, 0.03, 24), alu, 0.16, 0.095, -0.1, tt)
  const arm = new THREE.Group()
  arm.position.set(TT_ARM.x, 0.12, TT_ARM.z) // (where the tonearm turns on the model)
  tt.add(arm)
  const armRod = add(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 8), alu, -0.06, 0, 0.1, arm)
  armRod.rotation.x = Math.PI / 2
  armRod.rotation.z = 0.5
  add(new THREE.BoxGeometry(0.018, 0.01, 0.03), dark, -0.115, -0.006, 0.205, arm)
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 16), alu, 0.17, 0.09, 0.13, tt)

  // more turntable details: strobe dots, felt mat, speed buttons, pitch fader, power LED, counterweight, headshell, dust cover, feet
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x2a2b30, roughness: 1 })
  add(new THREE.CylinderGeometry(0.146, 0.146, 0.002, 64), feltMat, 0, 0.0005, 0, platter)
  const dots = new THREE.InstancedMesh(new THREE.BoxGeometry(0.004, 0.006, 0.0025), new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.5 }), 72)
  const dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), dv = new THREE.Vector3(), ds = new THREE.Vector3(1, 1, 1)
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2
    dq.setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0))
    dm.compose(dv.set(Math.cos(a) * 0.1535, 0.0035, Math.sin(a) * 0.1535), dq, ds)
    dots.setMatrixAt(i, dm)
  }
  platter.add(dots)
  // speed buttons 33 / 45 and the start-stop button along the front
  ;[[-0.17, 0.12], [-0.145, 0.12]].forEach(([x, z], i) => add(new THREE.CylinderGeometry(0.0085, 0.0085, 0.008, 16), i ? dark : alu, x, 0.084, z, tt))
  add(new THREE.CylinderGeometry(0.011, 0.011, 0.009, 18), alu, -0.2, 0.0845, 0.12, tt)
  const ttLed = new THREE.Mesh(new THREE.SphereGeometry(0.0033, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3be08a, toneMapped: false }))
  ttLed.position.set(-0.2, 0.0905, 0.1)
  tt.add(ttLed)
  // the turntable model replaces the plain one above (which stays until it has loaded)
  glbLoader().load('models/turntable.glb', (g) => {
    const part = (name: string): THREE.Object3D | undefined => g.scene.getObjectByName(name)
    const mark = (o: THREE.Object3D): void => o.traverse((m) => {
      if (!(m instanceof THREE.Mesh)) return
      m.castShadow = m.receiveShadow = true
      const mt: unknown = m.material
      if (mt instanceof THREE.MeshStandardMaterial && mt.metalness > 0.5 && !mt.userData.tuned) { mt.userData.tuned = true; mt.envMapIntensity = 0.22 } // (full metal just mirrors the bright room: the platter turned pale)
    })
    for (const c of tt.children) if (c !== platter && c !== arm && c !== ttLed && !deckBtns.some((b) => b === c)) c.visible = false
    for (const c of platter.children) if (c !== rec) c.visible = false
    for (const c of arm.children) c.visible = false
    const base = part('tt_static'), pl = part('tt_platter'), ar = part('tt_arm')
    // the model has put the headshell + cartridge (Object_5 / Object_6) in the platter's group and the power LED (Object_4) too:
    // they would turn round with the record. The headshell hangs on the tonearm, the LED stays on the base.
    if (ar) for (const n of ['Object_5_platter', 'Object_6_platter']) { const o = g.scene.getObjectByName(n); if (o) ar.add(o) }
    const ledMesh = g.scene.getObjectByName('Object_4_platter')
    if (ledMesh && base) base.add(ledMesh)
    if (base) { mark(base); tt.add(base) }
    if (pl) { mark(pl); pl.traverse((m) => { if (m instanceof THREE.Mesh && m.material instanceof THREE.MeshStandardMaterial) { const own = m.material.clone(); own.color.multiplyScalar(0.4); m.material = own } }); pl.position.set(-TT_C.x, -0.111, -TT_C.z); platter.add(pl) } // (the platter under the spot light looked too pale: graphite)
    if (ar) { mark(ar); ar.position.set(-TT_ARM.x, -0.12, -TT_ARM.z); arm.add(ar) }
    arm.userData.kind = 'tt-arm' // press the tonearm: the needle lifts (pause) / goes down again (play)
    kit.markDirty()
  }, undefined, warnLoad('turntable'))
  // the turntable seen from above (deck view): its three knobs on the right become buttons – previous, play / pause, next –
  // and the tonearm lifts / lowers the needle. Round marks with icons show where to press (only in that view).
  const deckBtns: THREE.Mesh[] = []
  const iconTex = (draw: (x: CanvasRenderingContext2D) => void): THREE.CanvasTexture => canvasTex(128, 128, (x) => { x.fillStyle = 'rgba(20,24,32,0.78)'; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.stroke(); x.fillStyle = '#fff'; draw(x) })
  const tri = (x: CanvasRenderingContext2D, cx: number, dir: number, h = 22): void => { x.beginPath(); x.moveTo(cx - dir * 14, 64 - h); x.lineTo(cx + dir * 14, 64); x.lineTo(cx - dir * 14, 64 + h); x.closePath(); x.fill() }
  ;([
    { kind: 'tt-prev', z: 0.052, draw: (x: CanvasRenderingContext2D) => { x.fillRect(34, 40, 9, 48); tri(x, 66, -1); tri(x, 90, -1) } },
    { kind: 'tt-toggle', z: 0.087, draw: (x: CanvasRenderingContext2D) => { tri(x, 52, 1); x.fillRect(74, 40, 10, 48); x.fillRect(94, 40, 10, 48) } },
    { kind: 'tt-next', z: 0.109, draw: (x: CanvasRenderingContext2D) => { tri(x, 38, 1); tri(x, 62, 1); x.fillRect(85, 40, 9, 48) } },
  ]).forEach((b) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(b.kind === 'tt-toggle' ? 0.0125 : 0.0105, 32), new THREE.MeshBasicMaterial({ map: iconTex(b.draw), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))
    m.rotation.x = -Math.PI / 2
    m.position.set(0.191, 0.142, b.z)
    m.userData.kind = b.kind
    m.renderOrder = 5
    tt.add(m)
    deckBtns.push(m)
  })
  let deckOn = false
  let deckA = 0
  function updateDeck(dt: number, t: number): boolean {
    deckA += ((deckOn ? 1 : 0) - deckA) * Math.min(1, dt * 6)
    for (const m of deckBtns) (m.material as THREE.MeshBasicMaterial).opacity = deckA * (0.82 + 0.18 * Math.sin(t * 3 + m.position.z * 90))
    return deckA > 0.01
  }
  // pitch fader on the right
  add(new THREE.BoxGeometry(0.012, 0.003, 0.09), dark, 0.2, 0.0815, 0.04, tt)
  add(new THREE.BoxGeometry(0.02, 0.008, 0.012), alu, 0.2, 0.0845, 0.03, tt)
  // dust cover: open, hinged at the back, tilted up
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.003, 0.3), new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.18, metalness: 0, clearcoat: 1 }))
  lid.castShadow = false
  const lidPivot = new THREE.Group()
  lidPivot.position.set(0, 0.082, -0.172)
  lidPivot.rotation.x = -1.75
  lid.position.set(0, 0, 0.15)
  lidPivot.add(lid)
  tt.add(lidPivot)
  add(new THREE.BoxGeometry(0.44, 0.004, 0.004), alu, 0, 0.082, -0.172, tt) // hinge
  // rubber feet
  ;[[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]].forEach(([x, z]) => add(new THREE.CylinderGeometry(0.018, 0.02, 0.012, 14), dark, x, -0.006, z, tt))
  // arm: counterweight, headshell + cartridge + finger lift, arm rest
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 16), dark, -0.045, 0.0, -0.06, arm).rotation.x = Math.PI / 2
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16), alu, 0, 0, 0, arm)
  add(new THREE.BoxGeometry(0.014, 0.004, 0.035), alu, -0.119, -0.002, 0.232, arm) // headshell
  add(new THREE.BoxGeometry(0.01, 0.008, 0.016), new THREE.MeshStandardMaterial({ color: 0xd33a2c, roughness: 0.4 }), -0.119, -0.008, 0.24, arm) // cartridge
  add(new THREE.CylinderGeometry(0.0012, 0.0012, 0.02, 6), alu, -0.128, 0.004, 0.22, arm).rotation.z = 1.2 // finger lift
  add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.03, 10), alu, 0.04, 0.1, 0.07, tt)
  add(new THREE.BoxGeometry(0.022, 0.006, 0.012), dark, 0.04, 0.115, 0.07, tt) // arm rest clip
  // a yellow "45" adapter on the board next to it
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 20), new THREE.MeshStandardMaterial({ color: 0xe8b934, roughness: 0.5 }), 0.27, 0.002, 0.07, tt)

  return {
    tt, platter, rec, flyDisc, arm, ttLed, labelMat, models,
    updateDeck,
    setDeck(v: boolean): void { deckOn = v },
    /** The cover of the album that plays, on the record's label (null: a plain label). */
    setDiscLabel(img: HTMLImageElement | null): void { discLabel = img; paintDisc() },
  }
}
