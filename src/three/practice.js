import * as THREE from 'three'
import { canvasTex } from './textures'

const R = 0.34 // clock radius (m)
const S = 768 // clock face canvas size

const WAIT = '#f0a040'
const GO = '#3cc47e'

function fmt(ms) {
  const tenths = Math.floor(ms / 100) % 10
  const total = Math.floor(ms / 1000)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}.${tenths}`
}

function drawFace(x, st, interval) {
  const c = S / 2
  x.clearRect(0, 0, S, S)
  // face
  const g = x.createRadialGradient(c, c * 0.8, 40, c, c, c)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(1, '#eef3f8')
  x.fillStyle = g
  x.beginPath()
  x.arc(c, c, c, 0, Math.PI * 2)
  x.fill()

  // minute ticks
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2
    const big = i % 5 === 0
    const r1 = c - 22
    const r2 = c - (big ? 58 : 40)
    x.strokeStyle = big ? '#1b2433' : '#9aa6b6'
    x.lineWidth = big ? 7 : 3
    x.lineCap = 'round'
    x.beginPath()
    x.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1)
    x.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2)
    x.stroke()
  }

  // progress ring (the interval)
  const ringR = c - 86
  x.lineWidth = 26
  x.lineCap = 'round'
  x.strokeStyle = '#e4e9f0'
  x.beginPath()
  x.arc(c, c, ringR, 0, Math.PI * 2)
  x.stroke()
  const col = st.go ? GO : WAIT
  if (st.progress > 0.001 || st.go) {
    x.strokeStyle = col
    x.shadowColor = col
    x.shadowBlur = 18
    x.beginPath()
    x.arc(c, c, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (st.go ? 1 : st.progress))
    x.stroke()
    x.shadowBlur = 0
  }

  // status
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillStyle = st.go ? GO : !st.started ? '#7d8aa3' : !st.running ? '#7d8aa3' : WAIT
  x.font = '700 40px "Inter Tight", Inter, sans-serif'
  const status = st.go ? 'SPILL!' : !st.started ? 'KLAR' : !st.running ? 'PAUSE' : 'VENT'
  x.fillText(status, c, c - 118)

  // elapsed
  x.fillStyle = '#0b1424'
  x.font = '800 132px "Inter Tight", Inter, sans-serif'
  x.fillText(fmt(st.ms), c, c + 4)

  // interval info
  x.fillStyle = '#4a5872'
  x.font = '500 34px Inter, sans-serif'
  x.fillText(`Intervall ${st.cycle + 1} · ${st.left}s igjen`, c, c + 110)
  x.fillStyle = '#9aa6b6'
  x.font = '600 26px Inter, sans-serif'
  x.fillText(`${interval}s`, c, c + 160)
}

function grilleTex() {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#23262c'
    x.fillRect(0, 0, w, h)
    x.strokeStyle = 'rgba(255,255,255,0.06)'
    x.lineWidth = 2
    for (let i = -h; i < w; i += 8) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke()
      x.beginPath(); x.moveTo(i + h, 0); x.lineTo(i, h); x.stroke()
    }
  }, { repeat: [2, 2] })
}

function sheetTex() {
  return canvasTex(512, 380, (x, w, h) => {
    x.fillStyle = '#fbfaf6'
    x.fillRect(0, 0, w, h)
    x.fillStyle = '#1b2433'
    x.font = '600 22px Inter, sans-serif'
    x.fillText('Øvelse – skalaer', 28, 36)
    for (let staff = 0; staff < 4; staff++) {
      const y0 = 70 + staff * 76
      x.strokeStyle = '#6b778a'
      x.lineWidth = 1.2
      for (let l = 0; l < 5; l++) {
        x.beginPath(); x.moveTo(24, y0 + l * 9); x.lineTo(w - 24, y0 + l * 9); x.stroke()
      }
      for (let n = 0; n < 14; n++) {
        const nx = 60 + n * 30
        const ny = y0 + 36 - ((n * 3 + staff * 2) % 9) * 4.5
        x.fillStyle = '#1b2433'
        x.beginPath(); x.ellipse(nx, ny, 5.5, 4, -0.4, 0, Math.PI * 2); x.fill()
        x.fillRect(nx + 4.5, ny - 26, 1.6, 26)
      }
    }
  })
}

export function buildPracticeCorner() {
  const group = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: 0xd9b48a, roughness: 0.5 })
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.4, metalness: 0.7 })
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9d1db, roughness: 0.3, metalness: 0.9 })
  const add = (geo, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    parent.add(m)
    return m
  }

  // ── Wall clock (faces +x, hangs on the left wall) ─────────
  const clock = new THREE.Group()
  clock.position.set(-3.96, 1.86, 2.0)
  clock.rotation.y = Math.PI / 2
  clock.userData = { kind: 'clock' }
  group.add(clock)
  const back = add(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.05, 96), metal, 0, 0, 0, clock)
  back.rotation.x = Math.PI / 2
  const rim = add(new THREE.TorusGeometry(R + 0.02, 0.022, 20, 120), steel, 0, 0, 0.03, clock)
  rim.castShadow = true

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')
  const faceTex = new THREE.CanvasTexture(canvas)
  faceTex.colorSpace = THREE.SRGBColorSpace
  faceTex.anisotropy = 8
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(R, 96),
    new THREE.MeshBasicMaterial({ map: faceTex, toneMapped: false, color: new THREE.Color(0.86, 0.86, 0.86) }),
  )
  face.position.z = 0.027
  clock.add(face)

  // sweeping hand shows the progress through the interval
  const hand = new THREE.Group()
  hand.position.z = 0.034
  clock.add(hand)
  const handMat = new THREE.MeshStandardMaterial({ color: 0x2b8cff, roughness: 0.3, metalness: 0.2, emissive: 0x2b8cff, emissiveIntensity: 0.4 })
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.008, R * 0.92, 0.004), handMat)
  needle.position.y = R * 0.36
  hand.add(needle)
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.014, R * 0.22, 0.004), handMat)
  tail.position.y = -R * 0.1
  hand.add(tail)
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 32), steel)
  cap.rotation.x = Math.PI / 2
  cap.position.z = 0.04
  clock.add(cap)
  // glass
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(R + 0.005, 96),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02, clearcoat: 1, envMapIntensity: 1.5 }),
  )
  glass.position.z = 0.048
  clock.add(glass)

  // ── Stool ─────────────────────────────────────────────
  const stool = new THREE.Group()
  stool.position.set(-3.0, 0, 2.05)
  group.add(stool)
  add(new THREE.CylinderGeometry(0.19, 0.18, 0.045, 48), wood, 0, 0.67, 0, stool)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const leg = add(new THREE.CylinderGeometry(0.014, 0.016, 0.68, 12), metal, Math.cos(a) * 0.14, 0.33, Math.sin(a) * 0.14, stool)
    leg.rotation.z = Math.cos(a) * -0.12
    leg.rotation.x = Math.sin(a) * 0.12
  }
  const ring = add(new THREE.TorusGeometry(0.15, 0.008, 8, 48), metal, 0, 0.24, 0, stool)
  ring.rotation.x = Math.PI / 2

  // ── Practice amp (faces +x) ───────────────────────────
  const amp = new THREE.Group()
  amp.position.set(-3.68, 0, 1.3)
  amp.rotation.y = Math.PI / 2 - 0.35
  group.add(amp)
  const tolex = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.85 })
  const grille = new THREE.MeshStandardMaterial({ map: grilleTex(), roughness: 0.9 })
  // faces: +x, -x, +y, -y, +z (front), -z
  add(new THREE.BoxGeometry(0.44, 0.36, 0.22), [tolex, tolex, tolex, tolex, grille, tolex], 0, 0.18, 0, amp)
  const panel = add(new THREE.BoxGeometry(0.42, 0.012, 0.08), steel, 0, 0.366, 0.06, amp)
  panel.castShadow = false
  for (let i = 0; i < 5; i++) {
    add(new THREE.CylinderGeometry(0.014, 0.016, 0.02, 20), new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.4 }), -0.15 + i * 0.06, 0.38, 0.06, amp)
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5cb6ff).multiplyScalar(4), toneMapped: false }))
  led.position.set(0.18, 0.38, 0.06)
  amp.add(led)
  const badge = add(new THREE.BoxGeometry(0.08, 0.018, 0.004), steel, 0.13, 0.31, 0.112, amp)
  badge.castShadow = false

  // ── Music stand ───────────────────────────────────────
  const stand = new THREE.Group()
  stand.position.set(-3.45, 0, 2.9)
  stand.rotation.y = Math.atan2(-3.0 - -3.45, 2.05 - 2.9) // the sheet faces the stool
  group.add(stand)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const leg = add(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 8), metal, Math.cos(a) * 0.13, 0.13, Math.sin(a) * 0.13, stand)
    leg.rotation.z = Math.cos(a) * 0.75
    leg.rotation.x = -Math.sin(a) * 0.75
  }
  add(new THREE.CylinderGeometry(0.011, 0.011, 0.9, 12), metal, 0, 0.7, 0, stand)
  const desk = new THREE.Group()
  desk.position.set(0, 1.15, 0.02)
  desk.rotation.x = -0.35
  stand.add(desk)
  add(new THREE.BoxGeometry(0.48, 0.32, 0.008), metal, 0, 0, 0, desk)
  add(new THREE.BoxGeometry(0.48, 0.03, 0.04), metal, 0, -0.16, 0.02, desk)
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.3), new THREE.MeshStandardMaterial({ map: sheetTex(), roughness: 0.9 }))
  sheet.position.z = 0.006
  desk.add(sheet)

  let lastKey = ''
  function update(dt, t, st, interval) {
    if (!st) return false
    const angle = -(st.go ? 1 : st.progress) * Math.PI * 2
    let changed = Math.abs(hand.rotation.z - angle) > 1e-4
    hand.rotation.z = angle
    const key = `${Math.floor(st.ms / 100)}|${st.go}|${st.running}|${interval}`
    if (key !== lastKey) {
      lastKey = key
      drawFace(ctx, st, interval)
      faceTex.needsUpdate = true
      changed = true
    }
    handMat.emissive.set(st.go ? GO : 0x2b8cff)
    handMat.color.set(st.go ? GO : 0x2b8cff)
    return changed
  }

  return { group, clock, update, redraw() { lastKey = '' } }
}
