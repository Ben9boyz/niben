import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

import type { Kit } from './kit'

// The sofa corner (sofa, rug, coffee table, mug) and what is alive in it: a sleeping cat, steam over the mug, dust in the sunbeam, a swaying plant.
export function buildLiving(kit: Kit, deps: { plantLeaves: THREE.Mesh[] }) {
  const { group, add, white, wood } = kit
  const { plantLeaves } = deps
  // ── Sofa corner ──
  const fabric = new THREE.MeshStandardMaterial({ color: 0x9fb2c6, roughness: 0.95 })
  const fabricDark = new THREE.MeshStandardMaterial({ color: 0x8295aa, roughness: 0.95 })
  const pillow = new THREE.MeshStandardMaterial({ color: 0x2b8cff, roughness: 0.9 })
  const sofa = new THREE.Group()
  sofa.position.set(2.1, 0, 0)
  group.add(sofa)
  add(new RoundedBoxGeometry(1.9, 0.3, 0.86, 3, 0.04), fabricDark, 0, 0.26, 0.47, sofa) // base
  ;[-0.62, 0, 0.62].forEach((x) => {
    add(new RoundedBoxGeometry(0.6, 0.14, 0.64, 4, 0.05), fabric, x, 0.48, 0.55, sofa) // seat
    const back = add(new RoundedBoxGeometry(0.6, 0.42, 0.2, 4, 0.06), fabric, x, 0.68, 0.17, sofa)
    back.rotation.x = -0.12
  })
  ;[-0.88, 0.88].forEach((x) => add(new RoundedBoxGeometry(0.16, 0.56, 0.86, 3, 0.05), fabricDark, x, 0.34, 0.47, sofa))
  ;[[-0.85, 0.08], [0.85, 0.08], [-0.85, 0.84], [0.85, 0.84]].forEach(([x, z]) => add(new THREE.CylinderGeometry(0.02, 0.015, 0.11, 10), wood, x, 0.055, z, sofa))
  const p1 = add(new RoundedBoxGeometry(0.36, 0.34, 0.12, 4, 0.05), pillow, -0.55, 0.66, 0.3, sofa)
  p1.rotation.set(-0.25, 0.25, 0.12)
  const p2 = add(new RoundedBoxGeometry(0.34, 0.32, 0.11, 4, 0.05), new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.9 }), 0.58, 0.65, 0.3, sofa)
  p2.rotation.set(-0.25, -0.3, -0.1)
  // rug + coffee table
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.01, 72), new THREE.MeshStandardMaterial({ color: 0xd9d0c3, roughness: 1 }))
  rug.scale.set(1.25, 1, 0.85)
  rug.position.set(2.05, 0.005, 1.15)
  rug.receiveShadow = true
  group.add(rug)
  add(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 64), wood, 1.95, 0.405, 1.3)
  add(new THREE.CylinderGeometry(0.3, 0.3, 0.012, 64), white, 1.95, 0.05, 1.3)
  ;[0, 1, 2].forEach((i) => {
    const a = (i / 3) * Math.PI * 2
    const leg = add(new THREE.CylinderGeometry(0.014, 0.014, 0.4, 10), white, 1.95 + Math.cos(a) * 0.2, 0.2, 1.3 + Math.sin(a) * 0.2)
    leg.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18)
  })
  add(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 24), white, 2.17, 0.465, 1.42) // mug

  // ── Alive: a sleeping cat on the sofa, steam over the mug, dust in the sunbeam, a swaying plant ──
  const cat = new THREE.Group()
  cat.position.set(0.66, 0.555, 0.52)
  cat.rotation.y = 0.5
  sofa.add(cat)
  const fur = new THREE.MeshStandardMaterial({ color: 0xd9904a, roughness: 0.95 })
  const furLight = new THREE.MeshStandardMaterial({ color: 0xf3d2a4, roughness: 0.95 })
  const catBody = add(new THREE.SphereGeometry(0.1, 20, 14), fur, 0, 0.055, 0, cat)
  catBody.scale.set(1.5, 0.62, 1)
  add(new THREE.SphereGeometry(0.055, 16, 12), fur, -0.15, 0.05, 0.04, cat)
  ;[-1, 1].forEach((s) => { const e = add(new THREE.ConeGeometry(0.02, 0.04, 6), fur, -0.16 + s * 0.03, 0.1, 0.045, cat); e.rotation.z = s * 0.12 })
  add(new THREE.SphereGeometry(0.03, 10, 8), furLight, -0.188, 0.04, 0.045, cat) // muzzle
  const tail = add(new THREE.TorusGeometry(0.09, 0.016, 8, 22, 4.2), fur, 0.02, 0.025, 0.05, cat)
  tail.rotation.x = Math.PI / 2
  tail.rotation.z = 0.4
  ;[0.0, 0.05, 0.1].forEach((x) => add(new THREE.BoxGeometry(0.012, 0.004, 0.04), furLight, x - 0.02, 0.1, 0.0, cat).rotation.y = 0.3) // stripes
  const steam: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = []
  const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), steamMat.clone())
    s.userData.phase = i / 4
    s.scale.set(1, 1.4, 1)
    group.add(s)
    steam.push(s)
  }
  const DUST = 70
  const dustPos = new Float32Array(DUST * 3)
  const dustSeed: { x: number; y: number; z: number; p: number; sp: number }[] = []
  for (let i = 0; i < DUST; i++) {
    dustSeed.push({ x: 1.6 + Math.random() * 1.8, y: 0.5 + Math.random() * 1.5, z: 0.1 + Math.random() * 1.1, p: Math.random() * 6.28, sp: 0.04 + Math.random() * 0.08 })
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xfff1d6, size: 0.012, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, sizeAttenuation: true }))
  dust.frustumCulled = false
  group.add(dust)
  function animateLife(t: number): void {
    catBody.scale.y = 0.62 + Math.sin(t * 1.6) * 0.035 // breathing
    catBody.scale.x = 1.5 + Math.sin(t * 1.6) * 0.015
    const catFirst = cat.children[0]
    if (catFirst) catFirst.position.y = 0.055 + Math.sin(t * 1.6) * 0.003
    steam.forEach((s) => {
      const k = (t * 0.25 + (s.userData.phase as number)) % 1
      s.position.set(2.17 + Math.sin(t * 1.3 + (s.userData.phase as number) * 9) * 0.01 * k, 0.5 + k * 0.16, 1.42 + Math.cos(t * 1.1 + (s.userData.phase as number) * 7) * 0.008 * k)
      s.material.opacity = Math.sin(k * Math.PI) * 0.16
      s.scale.setScalar(0.8 + k * 1.1)
    })
    for (let i = 0; i < DUST; i++) {
      const d = dustSeed[i]
      if (!d) continue
      dustPos[i * 3] = d.x + Math.sin(t * d.sp * 3 + d.p) * 0.12
      dustPos[i * 3 + 1] = d.y + ((t * d.sp + d.p) % 1.5) * 0.1 + Math.sin(t * 0.6 + d.p) * 0.03
      dustPos[i * 3 + 2] = d.z + Math.cos(t * d.sp * 2 + d.p) * 0.1
    }
    dustGeo.attributes.position.needsUpdate = true
    plantLeaves.forEach((l, i) => { l.rotation.z = (l.userData.rz as number) + Math.sin(t * 0.9 + i) * 0.045; l.rotation.x = (l.userData.rx as number) + Math.cos(t * 0.7 + i * 1.3) * 0.03 })
  }

  return { animateLife }
}
