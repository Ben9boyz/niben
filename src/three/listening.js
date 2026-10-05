import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { canvasTex, wrapText } from './textures'

// Listening corner on the back wall:
//  - an open sideboard that works as a record shelf (spines out, one record per saved Spotify album)
//  - a turntable and an iPod classic on top
// Selecting a record pulls it out and floats it in front of the camera; the album that is playing
// lies on top of the sideboard next to the turntable. The iPod can be "picked up" (held in front of the camera).

const SLEEVE = 0.31
const THICK = 0.0095
const BOARD_W = 1.5
const BOTTOM_Y = 0.0925 // top of the bottom board
const TOP_Y = 0.61 // top of the sideboard
const FRONT_Z = 0.45
// the playing record's sleeve leans against the wall: tilted back LEAN rad, turned a bit towards the room
const LEAN = 0.26
const LEAN_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-LEAN, -Math.PI / 2 - 0.25, 0, 'XYZ'))
const LEAN_UP = (SLEEVE / 2) * Math.cos(LEAN) + 0.002 // centre height above the top
const LEAN_Z = 0.165 - (SLEEVE / 2) * Math.sin(LEAN) // bottom edge ~16 cm from the wall
const COMPARTMENT = [[-0.735, -0.012], [0.012, 0.735]] // inner x ranges

function averageColor(img) {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 8
    const x = c.getContext('2d', { willReadFrequently: true })
    x.drawImage(img, 0, 0, 8, 8)
    const d = x.getImageData(0, 0, 8, 8).data
    let r = 0, g = 0, b = 0
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
    const n = d.length / 4
    return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`
  } catch {
    return null
  }
}

function spineTex(album, color) {
  return canvasTex(32, 512, (x, w, h) => {
    x.fillStyle = color
    x.fillRect(0, 0, w, h)
    // subtle edge shading so neighbouring spines read as separate records
    const g = x.createLinearGradient(0, 0, w, 0)
    g.addColorStop(0, 'rgba(0,0,0,0.35)')
    g.addColorStop(0.2, 'rgba(0,0,0,0)')
    g.addColorStop(0.8, 'rgba(255,255,255,0.06)')
    g.addColorStop(1, 'rgba(0,0,0,0.3)')
    x.fillStyle = g
    x.fillRect(0, 0, w, h)
    const m = color.match(/\d+/g)?.map(Number) || [60, 60, 60]
    const light = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255 > 0.6
    x.save()
    x.translate(w / 2, h / 2)
    x.rotate(Math.PI / 2)
    x.fillStyle = light ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)'
    x.font = '700 15px Inter, sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    let t = `${album.name}  ·  ${album.artist || ''}`
    while (x.measureText(t).width > h - 30 && t.length > 4) t = t.slice(0, -2)
    x.fillText(t, 0, 1)
    x.restore()
  })
}

function placeholderCover(album) {
  return canvasTex(256, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, album.color || '#3a4a6b')
    g.addColorStop(1, '#10151f')
    x.fillStyle = g
    x.fillRect(0, 0, w, h)
    x.fillStyle = '#fff'
    x.textAlign = 'center'
    x.font = '700 26px "Inter Tight", Inter, sans-serif'
    wrapText(x, album.name, w / 2, h / 2 - 10, 210, 30, 3)
    x.globalAlpha = 0.7
    x.font = '500 16px Inter, sans-serif'
    x.fillText(album.artist || '', w / 2, h - 30)
  })
}

function grooves() {
  return canvasTex(512, 512, (x, w) => {
    const c = w / 2
    x.fillStyle = '#0c0c0e'
    x.fillRect(0, 0, w, w)
    for (let r = 70; r < c - 4; r += 2.2) {
      x.strokeStyle = `rgba(255,255,255,${0.03 + ((r * 7) % 5) / 100})`
      x.lineWidth = 0.8
      x.beginPath()
      x.arc(c, c, r, 0, Math.PI * 2)
      x.stroke()
    }
    const g = x.createLinearGradient(0, 0, w, w)
    g.addColorStop(0.35, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.08)')
    g.addColorStop(0.65, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, w, w)
  })
}

// The iPod's own screen in the room (on its stand): the same "now playing" view as the iPod in hand –
// cover, song, artist, album and a progress bar.
const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`
function fitText(x, text, maxW) {
  let t = text || ''
  if (x.measureText(t).width <= maxW) return t
  while (t.length > 1 && x.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}
function drawIpodScreen(ctx, w, h, now, art, progressMs) {
  const x = ctx
  const u = h / 100
  x.fillStyle = '#eef3f8'
  x.fillRect(0, 0, w, h)
  // header bar
  const tb = x.createLinearGradient(0, 0, 0, 13 * u)
  tb.addColorStop(0, '#fefefe')
  tb.addColorStop(1, '#ccd4dd')
  x.fillStyle = tb
  x.fillRect(0, 0, w, 13 * u)
  x.fillStyle = '#a9b3bf'
  x.fillRect(0, 13 * u - 1, w, 1)
  x.fillStyle = '#111'
  x.font = `700 ${6.4 * u}px Inter, -apple-system, sans-serif`
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(now?.name ? (now.playing ? 'Spilles nå' : 'Pause') : 'iPod', w / 2, 6.8 * u)
  if (now?.shuffle) {
    // small shuffle mark at the left of the header
    x.strokeStyle = '#2b7ff0'
    x.lineWidth = 0.9 * u
    x.lineCap = 'round'
    const sx = 5 * u, sy = 6.8 * u, d = 2.2 * u
    x.beginPath(); x.moveTo(sx, sy - d); x.bezierCurveTo(sx + 2.5 * u, sy - d, sx + 2.5 * u, sy + d, sx + 5 * u, sy + d); x.stroke()
    x.beginPath(); x.moveTo(sx, sy + d); x.bezierCurveTo(sx + 2.5 * u, sy + d, sx + 2.5 * u, sy - d, sx + 5 * u, sy - d); x.stroke()
  }
  if (now?.playing) {
    x.fillStyle = '#1db954'
    x.beginPath(); x.moveTo(w - 9 * u, 4.3 * u); x.lineTo(w - 9 * u, 9.3 * u); x.lineTo(w - 4.8 * u, 6.8 * u); x.fill()
  }
  if (!now?.name) {
    x.font = `600 ${6.4 * u}px Inter, -apple-system, sans-serif`
    x.fillStyle = '#556'
    x.fillText('Spillelister ›', w / 2, 55 * u)
    return
  }
  // cover
  const pad = 4 * u
  const aw = w * 0.42 - pad
  const ay = 13 * u + pad
  const ah = Math.min(aw, h - ay - 22 * u)
  x.save()
  x.shadowColor = 'rgba(0,0,0,0.25)'
  x.shadowBlur = 2 * u
  x.shadowOffsetY = u
  if (art) x.drawImage(art, pad, ay, ah, ah)
  else { x.fillStyle = '#c9d1db'; x.fillRect(pad, ay, ah, ah) }
  x.restore()
  // text
  const tx = pad + ah + 3 * u
  const tw = w - tx - pad
  x.textAlign = 'left'
  x.textBaseline = 'alphabetic'
  x.fillStyle = '#111'
  x.font = `700 ${6.6 * u}px Inter, -apple-system, sans-serif`
  x.fillText(fitText(x, now.name, tw), tx, ay + ah * 0.38)
  x.font = `500 ${5.4 * u}px Inter, -apple-system, sans-serif`
  x.fillStyle = '#445'
  x.fillText(fitText(x, now.artist, tw), tx, ay + ah * 0.38 + 7.5 * u)
  x.fillStyle = '#778'
  x.fillText(fitText(x, now.album, tw), tx, ay + ah * 0.38 + 14 * u)
  // progress
  if (now.duration_ms) {
    const by = h - 15 * u
    const bw = w - pad * 2
    const r = 1.1 * u
    x.fillStyle = '#cfd6de'
    x.beginPath(); x.roundRect(pad, by, bw, 2.2 * u, r); x.fill()
    const g = x.createLinearGradient(0, by, 0, by + 2.2 * u)
    g.addColorStop(0, '#6cbcff'); g.addColorStop(1, '#2b7ff0')
    x.fillStyle = g
    x.beginPath(); x.roundRect(pad, by, Math.max(2 * r, bw * Math.min(1, progressMs / now.duration_ms)), 2.2 * u, r); x.fill()
    x.fillStyle = '#556'
    x.font = `500 ${4.8 * u}px Inter, -apple-system, sans-serif`
    x.fillText(fmt(progressMs), pad, by + 9 * u)
    x.textAlign = 'right'
    x.fillText('-' + fmt(Math.max(0, now.duration_ms - progressMs)), w - pad, by + 9 * u)
  }
}

export function buildListeningCorner() {
  const group = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.45 })
  const inner = new THREE.MeshStandardMaterial({ color: 0xe4e7ec, roughness: 0.7 })
  const wood = new THREE.MeshStandardMaterial({ color: 0xc89b6d, roughness: 0.5 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x18191d, roughness: 0.4, metalness: 0.2 })
  const alu = new THREE.MeshStandardMaterial({ color: 0xd5dae0, roughness: 0.25, metalness: 0.9 })
  const add = (geo, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    parent.add(m)
    return m
  }

  // ── Open sideboard = record shelf ──
  const sideboardStart = group.children.length
  add(new THREE.BoxGeometry(BOARD_W + 0.04, 0.03, 0.45), wood, 0, TOP_Y - 0.015, 0.225) // top
  add(new THREE.BoxGeometry(BOARD_W, 0.025, 0.42), white, 0, BOTTOM_Y - 0.0125, 0.24) // bottom
  add(new THREE.BoxGeometry(BOARD_W, TOP_Y - 0.08, 0.01), inner, 0, (TOP_Y + 0.08) / 2 - 0.015, 0.035) // back
  ;[-BOARD_W / 2 + 0.0075, 0, BOARD_W / 2 - 0.0075].forEach((x) =>
    add(new THREE.BoxGeometry(0.015, TOP_Y - 0.08, 0.42), white, x, (TOP_Y + 0.08) / 2 - 0.015, 0.24))
  ;[-0.7, 0.7].forEach((x) => [0.08, 0.42].forEach((z) => add(new THREE.CylinderGeometry(0.015, 0.012, 0.08, 10), wood, x, 0.04, z)))

  // ── lighting for the records ──
  // a warm spot from above onto the turntable and the sleeve that's playing
  const spot = new THREE.SpotLight(0xffd9a8, 9, 3.2, 0.62, 0.85, 1.6)
  spot.position.set(-0.15, 2.15, 0.95)
  spot.target.position.set(-0.2, TOP_Y, 0.2)
  group.add(spot, spot.target)
  // an LED strip under the top board, washing down over the record spines
  const led = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W - 0.06, 0.008, 0.012), new THREE.MeshBasicMaterial({ color: 0xffe2b8, toneMapped: false }))
  led.position.set(0, TOP_Y - 0.03, FRONT_Z - 0.03)
  group.add(led)
  const ledLight = new THREE.RectAreaLight(0xffd9a8, 5, BOARD_W - 0.06, 0.06)
  ledLight.position.copy(led.position)
  ledLight.lookAt(led.position.x, 0, led.position.z - 0.12) // shine down and slightly back onto the spines
  group.add(ledLight)

  // the whole sideboard is clickable ("go to the shelf"), not just the records in it
  for (const m of group.children.slice(sideboardStart)) m.userData.kind = 'shelf'
  // ── Turntable ──
  const tt = new THREE.Group()
  tt.position.set(-0.42, TOP_Y, 0.24)
  tt.userData = { kind: 'turntable' } // click: pause / play
  group.add(tt)
  add(new RoundedBoxGeometry(0.46, 0.08, 0.36, 3, 0.012), wood, 0, 0.04, 0, tt)
  add(new THREE.CylinderGeometry(0.155, 0.155, 0.016, 64), dark, -0.04, 0.088, 0, tt)
  const platter = new THREE.Group()
  platter.position.set(-0.04, 0.099, 0)
  tt.add(platter)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.004, 96), [
    new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ map: grooves(), roughness: 0.35, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: 0x0c0c0e }),
  ])
  disc.castShadow = true
  platter.add(disc)
  const labelMat = new THREE.MeshStandardMaterial({ color: 0xd33a2c, roughness: 0.6 })
  const label = new THREE.Mesh(new THREE.CircleGeometry(0.048, 48), labelMat)
  label.rotation.x = -Math.PI / 2
  label.position.y = 0.0025
  platter.add(label)
  add(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 8), alu, -0.04, 0.11, 0, tt)
  add(new THREE.CylinderGeometry(0.025, 0.028, 0.03, 24), alu, 0.16, 0.095, -0.1, tt)
  const arm = new THREE.Group()
  arm.position.set(0.16, 0.12, -0.1)
  tt.add(arm)
  const armRod = add(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 8), alu, -0.06, 0, 0.1, arm)
  armRod.rotation.x = Math.PI / 2
  armRod.rotation.z = 0.5
  add(new THREE.BoxGeometry(0.018, 0.01, 0.03), dark, -0.115, -0.006, 0.205, arm)
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 16), alu, 0.17, 0.09, 0.13, tt)

  // ── Decor: speakers, a plant, a candle, frames, fairy lights, headphones, a floor lamp ──
  const terracotta = new THREE.MeshStandardMaterial({ color: 0xc9774f, roughness: 0.85 })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f8a5b, roughness: 0.7 })
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x66a06d, roughness: 0.7 })
  const speakerWood = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.5 })
  const grill = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.9 })
  // floor-standing speakers either side of the sideboard
  ;[-1, 1].forEach((side) => {
    const sp = new THREE.Group()
    sp.position.set(side * 1.0, 0, 0.2)
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
  const plantLeaves = []
  const plant = new THREE.Group()
  plant.position.set(0.67, TOP_Y, 0.14)
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
  candle.position.set(0.62, TOP_Y, 0.37)
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
  // ── The stack of records on the table: the albums coming up in the queue on top (next one first), the albums
  // I listened to last below them. Any height: the sleeves get thinner the more there are. ──
  const stackGroup = new THREE.Group()
  stackGroup.position.set(0.42, TOP_Y, 0.27)
  group.add(stackGroup)
  let stackItems = []
  const stackTex = new Map()
  const hueOf = (str) => { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360; return h }
  function setStack(list, onChange) {
    const key = list.map((x) => x.uri + (x.queued ? 'q' : '')).join('|')
    if (key === stackKey) return
    stackKey = key
    stackItems = list.slice(0, 30)
    for (const m of [...stackGroup.children]) { stackGroup.remove(m); m.geometry.dispose(); for (const mt of m.material) if (!mt.map) mt.dispose() }
    const n = stackItems.length
    const t = Math.min(0.0095, 0.26 / Math.max(n, 1)) // 30 sleeves still fit in 26 cm
    stackItems.forEach((it, i) => {
      const fromBottom = n - 1 - i
      const hue = hueOf(it.uri)
      const edge = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue / 360, it.queued ? 0.55 : 0.4, it.queued ? 0.5 : 0.42), roughness: 0.75 })
      let top = edge
      if (i === 0) { // only the top sleeve shows its cover
        top = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
        const src = it.image_large || it.image
        if (src) {
          const apply = (tex) => { top.map = tex; top.needsUpdate = true; onChange?.() }
          if (stackTex.has(src)) apply(stackTex.get(src))
          else loader.load(src, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; stackTex.set(src, tex); apply(tex) }, undefined, () => {})
        } else top.color.setHSL(hue / 360, 0.4, 0.55)
      }
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, t * 0.92, 0.3), [edge, edge, top, edge, edge, edge])
      const j = ((hueOf(it.uri + i) % 100) / 100 - 0.5)
      m.position.set(j * 0.02, t * fromBottom + t / 2, ((hueOf(it.name || it.uri) % 100) / 100 - 0.5) * 0.02)
      m.rotation.y = j * 0.16
      m.castShadow = m.receiveShadow = true
      m.userData = { kind: 'stack', index: i }
      stackGroup.add(m)
    })
    onChange?.()
  }
  let stackKey = ''
  // the next album (all of it is in the queue): one sleeve leaning against the wall at the left of the plant
  const nextMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
  const nextEdge = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.8 })
  const nextMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.008), [nextEdge, nextEdge, nextEdge, nextEdge, nextMat, nextEdge])
  nextMesh.position.set(0.1, TOP_Y + 0.15 * Math.cos(0.26) + 0.002, 0.11)
  nextMesh.rotation.x = -0.26
  nextMesh.castShadow = nextMesh.receiveShadow = true
  nextMesh.userData = { kind: 'next' }
  nextMesh.visible = false
  group.add(nextMesh)
  let nextUri = null
  function setNext(a, onChange) {
    const uri = a?.uri || null
    if (uri === nextUri) return
    nextUri = uri
    nextMesh.visible = !!a
    if (!a) { onChange?.(); return }
    const src = a.image_large || a.image
    if (src) loader.load(src, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; nextMat.map?.dispose(); nextMat.map = tex; nextMat.needsUpdate = true; onChange?.() }, undefined, () => {})
    onChange?.()
  }
  // frames on the wall above (abstract "records at sunset")
  const art = (seed) => canvasTex(300, 380, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h)
    const pal = [['#f6c177', '#d9694f'], ['#8fb8de', '#3f5f93'], ['#cfe3c0', '#5c8a6a']][seed % 3]
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
  const wirePts = []
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
  const startBtn = add(new THREE.CylinderGeometry(0.011, 0.011, 0.009, 18), alu, -0.2, 0.0845, 0.12, tt)
  const ttLed = new THREE.Mesh(new THREE.SphereGeometry(0.0033, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3be08a, toneMapped: false }))
  ttLed.position.set(-0.2, 0.0905, 0.1)
  tt.add(ttLed)
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

  // ── iPod classic ──
  const ipodHome = { pos: new THREE.Vector3(1.92, 0.43, 1.3), rotY: -0.45 }
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
  add(new RoundedBoxGeometry(W, H, D, 4, 0.008), new THREE.MeshPhysicalMaterial({ color: 0xe2e4e8, roughness: 0.18, clearcoat: 1, metalness: 0.05 }), 0, 0, 0, body)
  const screenCanvas = document.createElement('canvas')
  screenCanvas.width = 1024
  screenCanvas.height = 840 // same shape as the screen (SW : SH), at 2× for a crisp screen
  const screenCtx = screenCanvas.getContext('2d')
  const screenTex = new THREE.CanvasTexture(screenCanvas)
  screenTex.colorSpace = THREE.SRGBColorSpace
  screenTex.anisotropy = 8
  const SW = W * 0.84, SH = W * 0.84 * 0.82
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) }))
  screen.position.set(0, H * 0.22, D / 2 + 0.0006)
  body.add(screen)
  const wheel = new THREE.Mesh(new THREE.CircleGeometry(W * 0.36, 48), new THREE.MeshStandardMaterial({ color: 0xcfd3d9, roughness: 0.55 }))
  wheel.position.set(0, -H * 0.2, D / 2 + 0.0006)
  body.add(wheel)
  const center = new THREE.Mesh(new THREE.CircleGeometry(W * 0.13, 32), new THREE.MeshStandardMaterial({ color: 0xf7f7f5, roughness: 0.3 }))
  center.position.set(0, -H * 0.2, D / 2 + 0.0012)
  body.add(center)
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
        const tri = (cx, cy, dir, sz) => { x.beginPath(); x.moveTo(cx - dir * sz * 0.5, cy - sz * 0.6); x.lineTo(cx + dir * sz * 0.5, cy); x.lineTo(cx - dir * sz * 0.5, cy + sz * 0.6); x.closePath(); x.fill() }
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
  body.add(wheelText)

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
  const catHead = add(new THREE.SphereGeometry(0.055, 16, 12), fur, -0.15, 0.05, 0.04, cat)
  ;[-1, 1].forEach((s) => { const e = add(new THREE.ConeGeometry(0.02, 0.04, 6), fur, -0.16 + s * 0.03, 0.1, 0.045, cat); e.rotation.z = s * 0.12 })
  add(new THREE.SphereGeometry(0.03, 10, 8), furLight, -0.188, 0.04, 0.045, cat) // muzzle
  const tail = add(new THREE.TorusGeometry(0.09, 0.016, 8, 22, 4.2), fur, 0.02, 0.025, 0.05, cat)
  tail.rotation.x = Math.PI / 2
  tail.rotation.z = 0.4
  ;[0.0, 0.05, 0.1].forEach((x) => add(new THREE.BoxGeometry(0.012, 0.004, 0.04), furLight, x - 0.02, 0.1, 0.0, cat).rotation.y = 0.3) // stripes
  const steam = []
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
  const dustSeed = []
  for (let i = 0; i < DUST; i++) {
    dustSeed.push({ x: 1.6 + Math.random() * 1.8, y: 0.5 + Math.random() * 1.5, z: 0.1 + Math.random() * 1.1, p: Math.random() * 6.28, sp: 0.04 + Math.random() * 0.08 })
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xfff1d6, size: 0.012, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, sizeAttenuation: true }))
  dust.frustumCulled = false
  group.add(dust)
  function animateLife(t) {
    catBody.scale.y = 0.62 + Math.sin(t * 1.6) * 0.035 // breathing
    catBody.scale.x = 1.5 + Math.sin(t * 1.6) * 0.015
    cat.children[0].position.y = 0.055 + Math.sin(t * 1.6) * 0.003
    steam.forEach((s) => {
      const k = (t * 0.25 + s.userData.phase) % 1
      s.position.set(2.17 + Math.sin(t * 1.3 + s.userData.phase * 9) * 0.01 * k, 0.5 + k * 0.16, 1.42 + Math.cos(t * 1.1 + s.userData.phase * 7) * 0.008 * k)
      s.material.opacity = Math.sin(k * Math.PI) * 0.16
      s.scale.setScalar(0.8 + k * 1.1)
    })
    for (let i = 0; i < DUST; i++) {
      const d = dustSeed[i]
      dustPos[i * 3] = d.x + Math.sin(t * d.sp * 3 + d.p) * 0.12
      dustPos[i * 3 + 1] = d.y + ((t * d.sp + d.p) % 1.5) * 0.1 + Math.sin(t * 0.6 + d.p) * 0.03
      dustPos[i * 3 + 2] = d.z + Math.cos(t * d.sp * 2 + d.p) * 0.1
    }
    dustGeo.attributes.position.needsUpdate = true
    plantLeaves.forEach((l, i) => { l.rotation.z = l.userData.rz + Math.sin(t * 0.9 + i) * 0.045; l.rotation.x = l.userData.rx + Math.cos(t * 0.7 + i * 1.3) * 0.03 })
  }

  // ── Records ──
  // All records on the shelf are ONE instanced mesh. Spines come from a shared texture atlas
  // (one 16-px column per record), so 65+ records cost a single draw call. Only a record that is
  // selected or playing becomes its own mesh with a real cover.
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')
  const pageMat = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.8 })
  const COLW = 16
  const MAX_RECORDS = COMPARTMENT.reduce((n, [a, b]) => n + Math.floor((b - a - 0.01) / THICK), 0)
  const atlas = document.createElement('canvas')
  atlas.width = COLW * MAX_RECORDS
  atlas.height = 512
  const atlasCtx = atlas.getContext('2d')
  const atlasTex = new THREE.CanvasTexture(atlas)
  atlasTex.colorSpace = THREE.SRGBColorSpace
  atlasTex.anisotropy = 8
  let atlasTimer = 0
  const atlasDirty = () => { clearTimeout(atlasTimer); atlasTimer = setTimeout(() => (atlasTex.needsUpdate = true), 120) }

  function drawSpine(i, album, color) {
    const x = atlasCtx
    const x0 = i * COLW
    x.save()
    x.beginPath(); x.rect(x0, 0, COLW, 512); x.clip()
    x.fillStyle = color
    x.fillRect(x0, 0, COLW, 512)
    const g = x.createLinearGradient(x0, 0, x0 + COLW, 0)
    g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.25, 'rgba(0,0,0,0)')
    g.addColorStop(0.8, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.3)')
    x.fillStyle = g
    x.fillRect(x0, 44, COLW, 468) // keep the top 44 px plain: other faces sample their colour there
    const m = String(color).match(/\d+/g)?.map(Number) || [60, 60, 60]
    const light = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255 > 0.6
    x.translate(x0 + COLW / 2, 280)
    x.rotate(Math.PI / 2)
    x.fillStyle = light ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)'
    x.font = '700 10px Inter, sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    let t = `${album.name}  ·  ${album.artist || ''}`
    while (x.measureText(t).width > 420 && t.length > 4) t = t.slice(0, -2)
    x.fillText(t, 0, 1)
    x.restore()
  }

  const recGeo = new THREE.BoxGeometry(THICK, SLEEVE, SLEEVE)
  // flag the spine face (+z = vertices 16..19 of a BoxGeometry) so the shader can map it into the atlas
  const spineFlag = new Float32Array(recGeo.attributes.position.count)
  for (let v = 16; v < 20; v++) spineFlag[v] = 1
  recGeo.setAttribute('spineFace', new THREE.BufferAttribute(spineFlag, 1))
  const colAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RECORDS), 1)
  recGeo.setAttribute('aCol', colAttr)
  const shelfMat = new THREE.MeshStandardMaterial({ map: atlasTex, roughness: 0.6 })
  shelfMat.onBeforeCompile = (sh) => {
    sh.uniforms.uCols = { value: MAX_RECORDS }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', 'attribute float spineFace;\nattribute float aCol;\nuniform float uCols;\n#include <common>')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
      vMapUv = spineFace > 0.5 ? vec2((aCol + uv.x) / uCols, uv.y * 0.9) : vec2((aCol + 0.5) / uCols, 0.97);`)
  }
  const shelfMesh = new THREE.InstancedMesh(recGeo, shelfMat, MAX_RECORDS)
  shelfMesh.count = 0
  shelfMesh.castShadow = shelfMesh.receiveShadow = true
  shelfMesh.userData = { kind: 'album' }
  shelfMesh.frustumCulled = false
  group.add(shelfMesh)

  let records = [] // { album, index, home, out, hidden, color }
  let albumsKey = ''
  const loose = new Map() // uri -> { mesh, rec, vel, returning }
  // guests: albums from search that aren't on the shelf. They fly in through the window (the wall on the
  // right) and leave the same way when put back.
  const guestRecs = new Map() // uri -> record
  let guestAlbums = []
  let windowHome = null
  function guestHome() {
    if (!windowHome) {
      group.updateWorldMatrix(true, false)
      windowHome = group.worldToLocal(new THREE.Vector3(3.8, 1.55, 1.75))
    }
    return windowHome
  }
  function recordFor(uri) {
    const r = records.find((x) => x.album.uri === uri)
    if (r) return r
    if (guestRecs.has(uri)) return guestRecs.get(uri)
    const album = guestAlbums.find((a) => a.uri === uri)
    if (!album) return null
    const g = { album, index: -1, guest: true, color: '#3a4352', out: 0, hidden: false, home: guestHome().clone() }
    const thumb = album.thumb || album.image
    if (thumb) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const col = averageColor(img)
        if (!col) return
        g.color = col
        loose.get(uri)?.mesh.material[1].color.set(col)
      }
      img.src = thumb
    }
    guestRecs.set(uri, g)
    return g
  }
  // search in the shelf: the matching records slide out
  let filterSet = null
  const im = new THREE.Matrix4()
  const iq = new THREE.Quaternion()
  const is = new THREE.Vector3()
  const ipos = new THREE.Vector3()
  const ZERO = new THREE.Vector3(0, 0, 0)

  function writeInstance(r) {
    if (r.hidden) im.compose(r.home, iq.identity(), ZERO)
    else im.compose(ipos.copy(r.home).setZ(r.home.z + r.out * 0.09), iq.identity(), is.set(1, 1, 1))
    shelfMesh.setMatrixAt(r.index, im)
    shelfMesh.instanceMatrix.needsUpdate = true
  }

  function setAlbums(albums) {
    const key = albums.map((a) => a.uri).join('|')
    if (key === albumsKey) return
    albumsKey = key
    for (const l of loose.values()) group.remove(l.mesh)
    loose.clear()
    const capacity = COMPARTMENT.map(([a, b]) => Math.floor((b - a - 0.01) / THICK))
    records = albums.slice(0, MAX_RECORDS).map((album, i) => {
      const comp = i < capacity[0] ? 0 : 1
      const slot = comp === 0 ? i : i - capacity[0]
      const [x0] = COMPARTMENT[comp]
      const color = album.color || '#3a4352'
      drawSpine(i, album, color)
      colAttr.setX(i, i)
      const r = { album, index: i, color, out: 0, hidden: false,
        home: new THREE.Vector3(x0 + 0.006 + THICK / 2 + slot * THICK, BOTTOM_Y + SLEEVE / 2 + 0.001, FRONT_Z - SLEEVE / 2 - 0.012) }
      writeInstance(r)
      // colour the spine from the small cover thumbnail
      const thumb = album.thumb || album.image
      if (thumb && !album.color) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const col = averageColor(img)
          if (!col) return
          r.color = col
          drawSpine(i, album, col)
          atlasDirty()
          const l = loose.get(album.uri)
          if (l) l.mesh.material[1].color.set(col)
        }
        img.src = thumb
      }
      return r
    })
    colAttr.needsUpdate = true
    shelfMesh.count = records.length
    shelfMesh.computeBoundingSphere() // clicks/hover test against it – fit it to the records now on the shelf
    atlasTex.needsUpdate = true
  }

  /** A real mesh (with cover) for a record that leaves the shelf. */
  function makeLoose(r) {
    // the cover glows a touch on its own so it stays readable in the shade of the shelf
    const coverMat = new THREE.MeshStandardMaterial({ map: placeholderCover(r.album), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.16 })
    coverMat.emissiveMap = coverMat.map
    const src = r.album.image_large || r.album.image // the 640 px cover: sharp even when held up close
    if (src) {
      loader.load(src, (t) => {
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 16 // stays crisp at a distance and at an angle (clamped to what the GPU allows)
        coverMat.map?.dispose()
        coverMat.map = t
        coverMat.emissiveMap = t
        coverMat.needsUpdate = true
      }, undefined, () => {})
    }
    const backMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(r.color), roughness: 0.6 })
    const spineMat = new THREE.MeshStandardMaterial({ map: spineTex(r.album, r.color), roughness: 0.6 })
    // faces: +x front cover, -x back, +y/-y edges, +z spine, -z back edge
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(THICK, SLEEVE, SLEEVE), [coverMat, backMat, pageMat, pageMat, spineMat, pageMat])
    mesh.position.copy(r.home).setZ(r.home.z + r.out * 0.09)
    mesh.castShadow = mesh.receiveShadow = true
    mesh.userData = { kind: r.guest ? 'guest' : 'album', index: r.index }
    group.add(mesh)
    if (r.guest) {
      // tumbling in from the window
      mesh.quaternion.setFromEuler(new THREE.Euler(0.8, -1.2, 0.5))
      return { mesh, rec: r, vel: new THREE.Vector3(0, 0.4, 0), returning: false }
    }
    r.hidden = true
    writeInstance(r)
    return { mesh, rec: r, vel: new THREE.Vector3(), returning: false }
  }
  function dropLoose(uri) {
    const l = loose.get(uri)
    if (!l) return
    group.remove(l.mesh)
    l.mesh.geometry.dispose()
    l.mesh.material.forEach((m) => { if (m !== pageMat) { m.map?.dispose(); m.dispose() } })
    loose.delete(uri)
    if (l.rec.guest) { guestRecs.delete(uri); return }
    l.rec.hidden = false
    writeInstance(l.rec)
  }

  let hoverUri = null
  let selectedUri = null
  let playingUri = null
  let peekUri = null // browsing the shelf: this record is pulled out, cover to the front
  let playing = false
  let holdIpod = false
  let flipSel = false // the held-up record shows its back (the track list)
  let ipodBig = false // panel hidden: hold it bigger
  let nowKey = ''
  let screenNow = null
  let screenArt = null // the cover, loaded for the screen
  let screenAt = 0 // performance.now() when screenNow.progress_ms was current
  let screenDrawn = 0
  function redrawScreen() {
    const p = screenNow?.duration_ms
      ? Math.min(screenNow.duration_ms, (screenNow.progress_ms || 0) + (screenNow.playing ? performance.now() - screenAt : 0))
      : 0
    drawIpodScreen(screenCtx, 1024, 840, screenNow, screenArt, p)
    screenTex.needsUpdate = true
    screenDrawn = performance.now()
  }

  function setState({ albums = [], now = null, guests = [] }) {
    setAlbums(albums)
    guestAlbums = guests
    playing = !!now?.playing
    playingUri = now?.context && now.context.startsWith('spotify:album:') ? now.context : null
    // fall back to matching the album name when the context isn't an album (e.g. a track from it)
    if (!playingUri && now?.album) playingUri = albums.find((a) => a.name === now.album)?.uri || null
    screenNow = now
    screenAt = performance.now()
    const key = `${now?.image}|${now?.name}|${playing}`
    if (key !== nowKey) {
      const imageChanged = !nowKey.startsWith(`${now?.image}|`)
      nowKey = key
      if (imageChanged) {
        screenArt = null
        if (now?.image) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => { if (screenNow?.image === now.image) { screenArt = img; redrawScreen() } }
          img.src = now.image
        }
      }
      redrawScreen()
      if (now?.image) {
        loader.load(now.image_large || now.image, (t) => {
          t.anisotropy = 16
          t.colorSpace = THREE.SRGBColorSpace
          labelMat.map?.dispose()
          labelMat.map = t
          labelMat.color.set(0xffffff)
          labelMat.needsUpdate = true
        }, undefined, () => {})
      }
    }
  }
  redrawScreen()

  // world → group-local helpers for things placed relative to the camera
  const tmpV = new THREE.Vector3()
  const tmpQ = new THREE.Quaternion()
  const camFwd = new THREE.Vector3()
  const camUp = new THREE.Vector3()
  const targetPos = new THREE.Vector3()
  const targetRot = new THREE.Euler()
  const targetQ = new THREE.Quaternion()
  const groupQ = new THREE.Quaternion()
  const basis = new THREE.Matrix4()
  const ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3()
  let armAngle = 0
  // the record turns once per bar (4 beats): a 120 BPM song gives 30 rpm. Unknown tempo = 33⅓ rpm.
  let tempo = 0
  let calm = false // calm mode: the record doesn't turn, nothing drifts or pulses
  let spin = 0 // rad/s, eased so the record winds up and slows down
  const rpmFor = (bpm) => {
    if (!(bpm > 30)) return 33.3
    let b = bpm
    while (b < 84) b *= 2
    while (b > 168) b /= 2
    return Math.min(42, Math.max(24, b / 4))
  }

  function update(dt, t, camera) {
    let moving = false
    if (!calm) animateLife(t)
    ttLed.visible = playing
    const spinTarget = playing && !calm ? (rpmFor(tempo) / 60) * Math.PI * 2 : 0
    spin += (spinTarget - spin) * Math.min(1, dt * (playing ? 1.4 : 0.9))
    if (spin > 0.002) platter.rotation.y -= dt * spin
    if (Math.abs(spinTarget - spin) > 0.05) moving = true
    // lights pulse softly on the beat while a song plays; the candle flickers
    const beat = playing && !calm && tempo > 30 ? Math.exp(-5 * (((t * tempo) / 60) % 1)) : 0
    const glow = playing ? 0.82 + 0.38 * beat : 0.7
    fairyMat.color.setRGB(1, 0.85, 0.66).multiplyScalar(glow)
    shadeMat.color.setRGB(1, 0.86, 0.68).multiplyScalar(0.8 + 0.25 * beat)
    flame.scale.y = 1.7 + Math.sin(t * 9) * 0.18 + Math.sin(t * 23) * 0.1
    candleLight.intensity = 0.045 + Math.sin(t * 7) * 0.008 + Math.sin(t * 19) * 0.005
    armAngle += ((playing ? -0.42 : 0) - armAngle) * Math.min(1, dt * 2)
    arm.rotation.y = armAngle
    // the iPod's progress bar moves on once a second while something plays
    if (screenNow?.playing && performance.now() - screenDrawn > 1000) redrawScreen()

    camera.getWorldDirection(camFwd)
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
    group.getWorldQuaternion(groupQ).invert()

    // records that should be off the shelf get a loose mesh; the rest stay instanced
    for (const uri of [selectedUri, playingUri, peekUri]) {
      if (!uri) continue
      const r = recordFor(uri)
      if (r && !loose.has(uri)) loose.set(uri, makeLoose(r))
      else if (loose.has(uri)) loose.get(uri).returning = false
    }
    for (const [uri, l] of loose) {
      if (uri !== selectedUri && uri !== playingUri && uri !== peekUri) l.returning = true
    }

    // hover: slide the record out a little
    for (const r of records) {
      const target = r.album.uri === hoverUri || filterSet?.has(r.album.uri) ? 1 : 0
      if (Math.abs(target - r.out) > 0.001) {
        r.out += (target - r.out) * Math.min(1, dt * 10)
        if (!r.hidden) writeInstance(r)
        moving = true
      }
    }

    for (const [uri, l] of loose) {
      const r = l.rec
      const sel = uri === selectedUri && !l.returning
      const isPlaying = uri === playingUri && !sel && !l.returning
      const peek = uri === peekUri && !sel && !l.returning
      let scale = 1
      if (sel) {
        // hold still in front of the camera, cover (local +x) facing it – or flipped over to its back
        tmpV.copy(camera.position).addScaledVector(camFwd, 0.95).addScaledVector(camUp, -0.03)
        targetPos.copy(group.worldToLocal(tmpV))
        ax.copy(camFwd)
        if (!flipSel) ax.negate()
        ay.copy(camUp)
        az.crossVectors(ax, ay)
        basis.makeBasis(ax, ay, az)
        targetQ.setFromRotationMatrix(basis).premultiply(groupQ)
        scale = 1.05
      } else if (peek) {
        // pulled out in front of its slot and turned so the cover faces the room
        targetPos.set(r.home.x, r.home.y + 0.06, FRONT_Z + 0.1)
        targetQ.setFromEuler(targetRot.set(0, -Math.PI / 2, 0))
      } else if (isPlaying) {
        // "now playing" display: standing next to the turntable, leaning back against the wall,
        // cover facing the room and turned a little towards the listening spot
        targetPos.set(0.0, TOP_Y + LEAN_UP, LEAN_Z)
        targetQ.copy(LEAN_Q)
      } else {
        targetPos.copy(r.home)
        targetQ.identity()
      }
      const k = sel ? 55 : 90, c = sel ? 11 : 14
      l.vel.x += ((targetPos.x - l.mesh.position.x) * k - l.vel.x * c) * dt
      l.vel.y += ((targetPos.y - l.mesh.position.y) * k - l.vel.y * c) * dt
      l.vel.z += ((targetPos.z - l.mesh.position.z) * k - l.vel.z * c) * dt
      l.mesh.position.addScaledVector(l.vel, dt)
      const e = Math.min(1, dt * 6)
      l.mesh.quaternion.slerp(targetQ, e)
      l.mesh.scale.setScalar(l.mesh.scale.x + (scale - l.mesh.scale.x) * e)
      if (l.vel.lengthSq() > 1e-6 || l.mesh.quaternion.angleTo(targetQ) > 0.002) moving = true
      // back home: hand it back to the instanced shelf
      if (l.returning && l.mesh.position.distanceTo(r.home) < 0.002 && l.mesh.quaternion.angleTo(targetQ) < 0.01) dropLoose(uri)
    }

    // iPod: on its stand, or held in front of the camera
    if (holdIpod) {
      // distance chosen so the whole iPod (click wheel included) fills ~64 % of the view height,
      // nudged up a little to leave room for the "put down" button underneath
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
      const fitH = H / ((ipodBig ? 0.76 : 0.6) * 2 * tanH)
      const fitW = W / ((ipodBig ? 0.6 : 0.42) * 2 * tanH * camera.aspect)
      const dist = Math.max(fitH, fitW)
      tmpV.copy(camera.position).addScaledVector(camFwd, dist).addScaledVector(camUp, (ipodBig ? 0.01 : -0.03) * dist * tanH * 2)
      targetPos.copy(group.worldToLocal(tmpV))
      ipod.position.lerp(targetPos, Math.min(1, dt * 7))
      tmpQ.copy(camera.quaternion).premultiply(groupQ)
      ipod.quaternion.slerp(tmpQ, Math.min(1, dt * 7))
      body.rotation.x += (0 - body.rotation.x) * Math.min(1, dt * 7)
      body.position.y += (-0.0 - body.position.y) * Math.min(1, dt * 7)
      stand.visible = false
      if (ipod.position.distanceTo(targetPos) > 0.0005 || ipod.quaternion.angleTo(tmpQ) > 0.002) moving = true
    } else {
      ipod.position.lerp(ipodHome.pos, Math.min(1, dt * 6))
      tmpQ.setFromEuler(new THREE.Euler(0, ipodHome.rotY, 0))
      ipod.quaternion.slerp(tmpQ, Math.min(1, dt * 6))
      body.rotation.x += (-0.18 - body.rotation.x) * Math.min(1, dt * 6)
      body.position.y += (0.105 - body.position.y) * Math.min(1, dt * 6)
      stand.visible = ipod.position.distanceTo(ipodHome.pos) < 0.02
      if (ipod.position.distanceTo(ipodHome.pos) > 0.002) moving = true
    }
    return moving
  }

  /** Screen rectangle of the record held up to the camera (for the play button / caption overlay). */
  const boxCorner = new THREE.Vector3()
  function selectedRect(camera, width, height) {
    const l = selectedUri && loose.get(selectedUri)
    if (!l || l.returning) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let i = 0; i < 8; i++) {
      boxCorner.set(i & 1 ? THICK / 2 : -THICK / 2, i & 2 ? SLEEVE / 2 : -SLEEVE / 2, i & 4 ? SLEEVE / 2 : -SLEEVE / 2)
      l.mesh.localToWorld(boxCorner).project(camera)
      const x = (boxCorner.x + 1) / 2 * width
      const y = (1 - boxCorner.y) / 2 * height
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }

  /** The iPod screen's rectangle on screen (CSS px relative to the canvas), for the HTML overlay. */
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  function ipodScreenRect(camera, width, height) {
    const hw = SW / 2, hh = SH / 2
    corners[0].set(-hw, hh, 0); corners[1].set(hw, hh, 0); corners[2].set(-hw, -hh, 0); corners[3].set(hw, -hh, 0)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const c of corners) {
      screen.localToWorld(c)
      c.project(camera)
      const x = (c.x + 1) / 2 * width
      const y = (1 - c.y) / 2 * height
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }

  return {
    group,
    setState,
    setHover(uri) { hoverUri = uri },
    setSelected(uri) { selectedUri = uri },
    setPeek(uri) { peekUri = uri },
    setFilter(list) { filterSet = list?.length ? new Set(list) : null },
    setHoldIpod(v, big = false) { holdIpod = v; ipodBig = big },
    setFlip(v) { flipSel = v },
    setCalm(v) { calm = !!v },
    setStack,
    setNext,
    setTempo(bpm) { tempo = Number(bpm) || 0 },
    isSpinning: () => playing || spin > 0.02,
    isHoldingIpod: () => holdIpod,
    ipodScreenRect,
    selectedRect,
    update,
  }
}
