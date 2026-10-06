import * as THREE from 'three'
import { canvasTex } from '../textures'
import type { Kit } from './kit'

// On the wall and by the sofa: frames, fairy lights, headphones on a hook and a floor lamp.
export function buildWall(kit: Kit) {
  const { group, add, wood, dark, alu, grill } = kit
  // frames on the wall above (abstract "records at sunset")
  const art = (seed: number): THREE.CanvasTexture => canvasTex(300, 380, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h)
    const pal: [string, string] = ([['#f6c177', '#d9694f'], ['#8fb8de', '#3f5f93'], ['#cfe3c0', '#5c8a6a']] as [string, string][])[seed % 3] ?? ['#f6c177', '#d9694f']
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1])
    x.fillStyle = g; x.fillRect(0, 0, w, h)
    x.fillStyle = 'rgba(20,20,26,.92)'; x.beginPath(); x.arc(w / 2, h * 0.58, w * 0.32, 0, Math.PI * 2); x.fill()
    x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 2
    for (let r = 0.16; r < 0.3; r += 0.035) { x.beginPath(); x.arc(w / 2, h * 0.58, w * r, 0, Math.PI * 2); x.stroke() }
    x.fillStyle = pal[0]; x.beginPath(); x.arc(w / 2, h * 0.58, w * 0.08, 0, Math.PI * 2); x.fill()
  })
  ;[[-0.5, 1.38, 0.3, 0.38, 0], [0.02, 1.5, 0.36, 0.46, 1], [0.54, 1.38, 0.3, 0.38, 2]].forEach(([x, y, fw, fh, seed]) => {
    add(new THREE.BoxGeometry(fw + 0.03, fh + 0.03, 0.02), wood, x, y, 0.025)
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshStandardMaterial({ map: art(seed), roughness: 0.6 }))
    pic.position.set(x, y, 0.0362)
    group.add(pic)
  })
  // fairy lights along the wall
  const fairyMat = new THREE.MeshBasicMaterial({ color: 0xffd9a8, toneMapped: false })
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 8, 6), fairyMat, 24)
  const fm = new THREE.Matrix4()
  const wirePts: THREE.Vector3[] = []
  for (let i = 0; i < 24; i++) {
    const u = i / 23
    const x = -1.15 + u * 2.3
    const y = 2.02 - Math.sin(u * Math.PI) * 0.16 - (i % 2) * 0.03
    fm.makeTranslation(x, y, 0.04)
    bulbs.setMatrixAt(i, fm)
  }
  for (let i = 0; i <= 40; i++) { const u = i / 40; wirePts.push(new THREE.Vector3(-1.15 + u * 2.3, 2.03 - Math.sin(u * Math.PI) * 0.16, 0.037)) }
  group.add(bulbs)
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wirePts), 60, 0.0018, 4), grill))
  // headphones on a hook
  const hp = new THREE.Group()
  hp.position.set(-0.98, 1.2, 0.05)
  group.add(hp)
  add(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 8), alu, 0, 0.09, -0.01, hp).rotation.x = Math.PI / 2
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.006, 8, 24, Math.PI), dark)
  band.position.set(0, 0.02, 0.02)
  hp.add(band)
  ;[-1, 1].forEach((side) => add(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 18), dark, side * 0.07, 0.02, 0.02, hp).rotation.z = Math.PI / 2)
  // a floor lamp by the sofa
  const lamp = new THREE.Group()
  lamp.position.set(3.25, 0, 0.35)
  group.add(lamp)
  add(new THREE.CylinderGeometry(0.1, 0.11, 0.025, 24), dark, 0, 0.0125, 0, lamp)
  add(new THREE.CylinderGeometry(0.008, 0.008, 1.35, 8), alu, 0, 0.7, 0, lamp)
  const shadeMat = new THREE.MeshBasicMaterial({ color: 0xffdcae, toneMapped: false, side: THREE.DoubleSide })
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 0.26, 28, 1, true), shadeMat)
  shade.position.set(0, 1.5, 0)
  lamp.add(shade)
  const lampLight = new THREE.PointLight(0xffc98a, 0.45, 2.2, 2)
  lampLight.position.set(0, 1.45, 0.05)
  lamp.add(lampLight)

  return { fairyMat, shadeMat }
}
