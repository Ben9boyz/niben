import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { TOP_Y } from './constants'
import type { Kit } from './kit'

// Speakers either side of the cabinet, a plant and a candle.
export function buildDecor(kit: Kit) {
  const { group, add, dark, alu, grill } = kit
  const terracotta = new THREE.MeshStandardMaterial({ color: 0xc9774f, roughness: 0.85 })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f8a5b, roughness: 0.7 })
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x66a06d, roughness: 0.7 })
  const speakerWood = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.5 })
  // floor-standing speakers either side of the sideboard
  ;[-1, 1].forEach((side) => {
    const sp = new THREE.Group()
    sp.position.set(side > 0 ? 1.47 : -0.9, 0, 0.2) // (the right one stands beyond the longer table top)
    group.add(sp)
    add(new RoundedBoxGeometry(0.26, 0.82, 0.24, 3, 0.012), speakerWood, 0, 0.5, 0, sp)
    add(new THREE.CylinderGeometry(0.022, 0.03, 0.09, 12), dark, 0, 0.045, 0, sp) // plinth
    const w = add(new THREE.CylinderGeometry(0.085, 0.085, 0.01, 40), grill, 0, 0.36, 0.122, sp)
    w.rotation.x = Math.PI / 2
    const w2 = add(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 24), alu, 0, 0.36, 0.128, sp) // dust cap
    w2.rotation.x = Math.PI / 2
    const tw = add(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 24), grill, 0, 0.66, 0.122, sp)
    tw.rotation.x = Math.PI / 2
  })
  // a plant on the sideboard
  const plantLeaves: THREE.Mesh[] = []
  const plant = new THREE.Group()
  plant.position.set(1.12, TOP_Y, 0.15)
  group.add(plant)
  add(new THREE.CylinderGeometry(0.058, 0.044, 0.1, 20), terracotta, 0, 0.05, 0, plant)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + i * 0.4
    const lf = add(new THREE.SphereGeometry(0.05, 10, 8), i % 2 ? leafMat : leafMat2, Math.cos(a) * 0.035, 0.17 + (i % 3) * 0.05, Math.sin(a) * 0.035, plant)
    lf.scale.set(0.34, 1.35 + (i % 3) * 0.2, 0.12)
    lf.rotation.set(Math.sin(a) * 0.55, -a, -Math.cos(a) * 0.55)
    lf.userData.rx = lf.rotation.x
    lf.userData.rz = lf.rotation.z
    plantLeaves.push(lf)
  }
  // a candle that flickers (the flame is part of the beat pulse below)
  const candle = new THREE.Group()
  candle.position.set(1.12, TOP_Y, 0.38)
  group.add(candle)
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0xe9d9bd, roughness: 0.5 }), 0, 0.03, 0, candle)
  add(new THREE.CylinderGeometry(0.0015, 0.0015, 0.014, 6), dark, 0, 0.067, 0, candle)
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xe8a24e }) // not too bright: the bloom would make it glow
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), flameMat)
  flame.scale.set(0.8, 1.7, 0.8)
  flame.position.set(0, 0.082, 0)
  candle.add(flame)
  const candleLight = new THREE.PointLight(0xffb76b, 0.05, 0.35, 2)
  candleLight.position.set(0, 0.1, 0.02)
  candle.add(candleLight)
  return { plantLeaves, flame, candleLight }
}
