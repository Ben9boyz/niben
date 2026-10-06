import * as THREE from 'three'
import { BOARD_W, TOP_Y, FRONT_Z, EXT } from './constants'
import { glbLoader, warnLoad } from './models'
import type { Kit } from './kit'

// The record cabinet (3 × 2 compartments) and the light on the records: a spot from above and an LED strip under the top board.
export function buildCabinet(kit: Kit) {
  const { group, add, wood, inner } = kit
  // ── Record cabinet (3 × 2 compartments; the frame is the model public/models/plateskap.glb – the boards below are what shows until it has loaded) ──
  const cabinet = new THREE.Group()
  group.add(cabinet)
  const CAB_Z = 0.255 // centre of the cabinet's depth (front plane at FRONT_Z)
  const CAB_D = 0.39
  const T = 0.015
  ;[-0.64, -0.215, 0.21, 0.641].forEach((x) => add(new THREE.BoxGeometry(T, TOP_Y, CAB_D), wood, x, TOP_Y / 2, CAB_Z, cabinet))
  ;[T / 2, 0.4255, TOP_Y - T / 2].forEach((y) => add(new THREE.BoxGeometry(BOARD_W, T, CAB_D), wood, 0.0005, y, CAB_Z, cabinet))
  add(new THREE.BoxGeometry(BOARD_W, TOP_Y, 0.008), inner, 0.0005, TOP_Y / 2, CAB_Z - CAB_D / 2 + 0.004, cabinet)
  // the table top goes on to the right of the cabinet (a plain bench: top, end panel and a back, in the same wood)
  const ext = new THREE.Group()
  group.add(ext)
  const ex0 = 0.65, ex1 = ex0 + EXT
  add(new THREE.BoxGeometry(EXT, T, CAB_D), wood, (ex0 + ex1) / 2, TOP_Y - T / 2, CAB_Z, ext)
  add(new THREE.BoxGeometry(T, TOP_Y, CAB_D), wood, ex1 - T / 2, TOP_Y / 2, CAB_Z, ext)
  add(new THREE.BoxGeometry(EXT, 0.4, 0.008), inner, (ex0 + ex1) / 2, TOP_Y - 0.2, CAB_Z - CAB_D / 2 + 0.004, ext)
  ext.userData.kind = 'shelf'
  ext.traverse((m) => { m.userData.kind = 'shelf' })
  const frameModel = new THREE.Group() // the model's frame (same size as the boards), once it has loaded
  frameModel.position.set(-0.215, 0, CAB_Z)
  group.add(frameModel)
  glbLoader().load('models/plateskap.glb', (g) => {
    g.scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = o.receiveShadow = true; o.userData.kind = 'shelf' } })
    frameModel.add(g.scene)
    cabinet.visible = false
    kit.markDirty()
  }, undefined, warnLoad('plateskap'))

  // ── lighting for the records ──
  // a warm spot from above onto the turntable and the sleeve that's playing
  const spot = new THREE.SpotLight(0xffd9a8, 9, 3.2, 0.62, 0.85, 1.6)
  spot.position.set(-0.15, 2.15, 0.95)
  spot.target.position.set(-0.2, TOP_Y, 0.2)
  group.add(spot, spot.target)
  // an LED strip under the top board, washing down over the record spines
  const led = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W - 0.06, 0.008, 0.012), new THREE.MeshBasicMaterial({ color: 0xffe2b8, toneMapped: false }))
  led.position.set(0, TOP_Y - 0.03, FRONT_Z - 0.03) // (under the top board: over the top row of records)
  group.add(led)
  const ledLight = new THREE.RectAreaLight(0xffd9a8, 5, BOARD_W - 0.06, 0.06)
  ledLight.position.copy(led.position)
  ledLight.lookAt(led.position.x, 0, led.position.z - 0.12) // shine down and slightly back onto the spines
  group.add(ledLight)

  // the whole sideboard is clickable ("go to the shelf"), not just the records in it
  cabinet.traverse((m) => { m.userData.kind = 'shelf' })
  frameModel.userData.kind = 'shelf'
  return { cabinet, frameModel }
}
