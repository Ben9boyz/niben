import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { TOP_Y } from './constants'
import type { SpriteData } from './constants'
import { canvasTex, context2d } from '../textures'
import { glbLoader, warnLoad } from './models'
import type { Kit } from './kit'

// The iPod classic on the sideboard: the model, the notes that drift up from it while it plays, and its screen.
export function buildIpod(kit: Kit) {
  const { group, add, dark } = kit
  // ── iPod classic ──
  // on the sideboard, in front of the leaning sleeve – next to the turntable, so the camera hardly has to move
  const ipodHome = { pos: new THREE.Vector3(0.65, TOP_Y, 0.35), rotY: 0.3 } // (beside the next sleeve, never in front of a cover)
  const ipod = new THREE.Group()
  ipod.position.copy(ipodHome.pos)
  ipod.rotation.y = ipodHome.rotY
  ipod.userData = { kind: 'ipod' }
  group.add(ipod)
  const stand = add(new THREE.BoxGeometry(0.1, 0.02, 0.07), dark, 0, 0.01, 0, ipod)
  const body = new THREE.Group()
  body.position.set(0, 0.105, 0)
  body.rotation.x = -0.18
  ipod.add(body)
  const W = 0.1, H = 0.166, D = 0.018
  // the iPod is the model public/models/ipod.glb (an iPod classic, 10 × 16.6 cm, front towards +z); the plain box is only there until it has loaded
  const ipodFallback = new THREE.Group()
  body.add(ipodFallback)
  add(new RoundedBoxGeometry(W, H, D, 4, 0.008), new THREE.MeshPhysicalMaterial({ color: 0xe2e4e8, roughness: 0.18, clearcoat: 1, metalness: 0.05 }), 0, 0, 0, ipodFallback)
  glbLoader().load('models/ipod.glb', (g) => {
    g.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      o.castShadow = o.receiveShadow = true
      // Safari (Mac and iPhone) draws a model with too many textures per material as a black box – a material that is also
      // lit by several shadowing lights runs out of the 16 texture units a shader may use there. So: the colour map and the
      // normal map stay; the baked light / occlusion / metal-rough maps give way to plain numbers; the glass has no texture.
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue
        if (m.transparent) { m.map = null; m.color.set(0xffffff); m.opacity = Math.min(m.opacity, 0.16); m.depthWrite = false }
        else { m.emissive.set(0xffffff); m.emissiveIntensity = m.emissiveMap ? 0.22 : 0 }
        m.emissiveMap = null; m.aoMap = null; m.metalnessMap = null; m.roughnessMap = null
        m.metalness = m.transparent ? 0 : 0.35; m.roughness = m.transparent ? 0.1 : 0.32
        m.needsUpdate = true
      }
    })
    body.add(g.scene)
    ipodFallback.visible = false
    kit.markDirty()
  }, undefined, warnLoad('ipod'))
  // sound coming out of the iPod: a few music notes drifting up from it (only while it plays)
  const soundFx = new THREE.Group()
  soundFx.position.copy(ipodHome.pos).add(new THREE.Vector3(0, 0.13, 0.02))
  soundFx.visible = false
  group.add(soundFx)
  // white notes on solid black, drawn ADDITIVELY: black adds nothing, so there is no transparency to go wrong (on some Macs the
  // transparent corners of a note came out as black boxes)
  const noteTex = ['\u266A', '\u266B'].map((ch) => canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#000000'; x.fillRect(0, 0, w, h)
    x.font = '700 52px "Helvetica Neue", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'
    x.fillStyle = '#ffffff'; x.fillText(ch, w / 2, h / 2 + 4)
  }))
  const notes = [0, 1, 2, 3].map((i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex[i % 2], color: i % 2 ? 0xffd27a : 0x8fc6ff, transparent: true, blending: THREE.AdditiveBlending, opacity: 0, depthWrite: false, toneMapped: false }))
    const data: SpriteData = { phase: i / 4, side: i % 2 ? 1 : -1, sway: 0.6 + i * 0.35 }
    sp.userData = data
    sp.raycast = () => {} // only decoration: never in the way of a click
    soundFx.add(sp)
    return sp
  })
  let soundA = 0 // fades in and out
  /** Returns true while the effect is visible (the room must keep drawing). */
  function updateSound(dt: number, t: number, _camera: THREE.Camera, on: boolean): boolean {
    soundA += ((on ? 1 : 0) - soundA) * Math.min(1, dt * (on ? 3 : 4))
    soundFx.visible = soundA > 0.02
    if (!soundFx.visible) return false
    for (const n of notes) {
      const d = n.userData as SpriteData
      const k = (t * 0.32 + d.phase) % 1
      n.position.set(d.side * (0.03 + k * 0.1) + Math.sin(t * 1.6 + d.sway * 6) * 0.012 * d.sway, 0.03 + k * 0.25, 0.02)
      n.scale.setScalar(0.04 + 0.012 * Math.sin(k * Math.PI))
      n.material.opacity = soundA * Math.sin(Math.PI * k) * 0.9
    }
    return true
  }
  const screenCanvas = document.createElement('canvas')
  screenCanvas.width = 2048
  screenCanvas.height = 1661 // same shape as the screen (SW : SH), at 4× – sharp even when the iPod stands there and the camera is close
  const screenCtx = context2d(screenCanvas)
  const screenTex = new THREE.CanvasTexture(screenCanvas)
  screenTex.colorSpace = THREE.SRGBColorSpace
  screenTex.anisotropy = 16
  const SW = 0.0672, SH = 0.0545 // the model's LCD (measured on the model)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: new THREE.Color(1, 1, 1) }))
  screen.position.set(0.0003, 0.0547, 0.0168) // just in front of the glass over the LCD
  body.add(screen)
  const wheel = new THREE.Mesh(new THREE.CircleGeometry(W * 0.36, 48), new THREE.MeshStandardMaterial({ color: 0xcfd3d9, roughness: 0.55 }))
  wheel.position.set(0, -H * 0.2, D / 2 + 0.0006)
  ipodFallback.add(wheel)
  const center = new THREE.Mesh(new THREE.CircleGeometry(W * 0.13, 32), new THREE.MeshStandardMaterial({ color: 0xf7f7f5, roughness: 0.3 }))
  center.position.set(0, -H * 0.2, D / 2 + 0.0012)
  ipodFallback.add(center)
  const wheelText = new THREE.Mesh(new THREE.CircleGeometry(W * 0.36, 48), new THREE.MeshBasicMaterial({
    transparent: true,
    // the wheel's symbols, drawn as shapes at a high resolution: shuffle (top), previous (left),
    // next (right), play/pause (bottom)
    map: (() => {
      const t = canvasTex(512, 512, (x, w) => {
        const c = w / 2
        x.fillStyle = x.strokeStyle = '#8f96a0'
        x.lineWidth = 9
        x.lineCap = x.lineJoin = 'round'
        const tri = (cx: number, cy: number, dir: number, sz: number): void => { x.beginPath(); x.moveTo(cx - dir * sz * 0.5, cy - sz * 0.6); x.lineTo(cx + dir * sz * 0.5, cy); x.lineTo(cx - dir * sz * 0.5, cy + sz * 0.6); x.closePath(); x.fill() }
        // shuffle: two crossing arrows
        const sy = 66, sw = 46
        x.beginPath(); x.moveTo(c - sw, sy - 16); x.bezierCurveTo(c - 10, sy - 16, c + 10, sy + 16, c + sw - 12, sy + 16); x.stroke()
        x.beginPath(); x.moveTo(c - sw, sy + 16); x.bezierCurveTo(c - 10, sy + 16, c + 10, sy - 16, c + sw - 12, sy - 16); x.stroke()
        tri(c + sw - 4, sy - 16, 1, 22)
        tri(c + sw - 4, sy + 16, 1, 22)
        // previous: |◀◀
        x.fillRect(48, c - 22, 9, 44); tri(80, c, -1, 34); tri(108, c, -1, 34)
        // next: ▶▶|
        tri(w - 108, c, 1, 34); tri(w - 80, c, 1, 34); x.fillRect(w - 57, c - 22, 9, 44)
        // play / pause
        tri(c - 26, w - 66, 1, 38)
        x.fillRect(c + 4, w - 88, 11, 44); x.fillRect(c + 24, w - 88, 11, 44)
      })
      t.anisotropy = 8
      return t
    })(),
  }))
  wheelText.position.set(0, -H * 0.2, D / 2 + 0.001)
  ipodFallback.add(wheelText)

  // a soft glow around the lit screen (additive, so it costs no light): brighter while the iPod plays
  const haloTex = canvasTex(128, 128, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h)
    x.fillStyle = g; x.fillRect(0, 0, w, h)
  })
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0x9fd0ff, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.1, depthWrite: false, toneMapped: false }))
  halo.position.set(0.0003, 0.0547, 0.0185)
  halo.scale.setScalar(0.21)
  halo.raycast = () => {} // decoration: never in the way of a click
  body.add(halo)

  return { ipod, ipodHome, body, stand, screen, screenCtx, screenTex, updateSound, halo, W, H, SW, SH }
}
