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
  add(new THREE.BoxGeometry(BOARD_W + 0.04, 0.03, 0.45), wood, 0, TOP_Y - 0.015, 0.225) // top
  add(new THREE.BoxGeometry(BOARD_W, 0.025, 0.42), white, 0, BOTTOM_Y - 0.0125, 0.24) // bottom
  add(new THREE.BoxGeometry(BOARD_W, TOP_Y - 0.08, 0.01), inner, 0, (TOP_Y + 0.08) / 2 - 0.015, 0.035) // back
  ;[-BOARD_W / 2 + 0.0075, 0, BOARD_W / 2 - 0.0075].forEach((x) =>
    add(new THREE.BoxGeometry(0.015, TOP_Y - 0.08, 0.42), white, x, (TOP_Y + 0.08) / 2 - 0.015, 0.24))
  ;[-0.7, 0.7].forEach((x) => [0.08, 0.42].forEach((z) => add(new THREE.CylinderGeometry(0.015, 0.012, 0.08, 10), wood, x, 0.04, z)))

  // ── Turntable ──
  const tt = new THREE.Group()
  tt.position.set(-0.42, TOP_Y, 0.24)
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
  screenCanvas.width = 512
  screenCanvas.height = 420 // same shape as the screen (SW : SH)
  const screenCtx = screenCanvas.getContext('2d')
  const screenTex = new THREE.CanvasTexture(screenCanvas)
  screenTex.colorSpace = THREE.SRGBColorSpace
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
    map: canvasTex(128, 128, (x, w) => {
      x.fillStyle = '#9aa0a8'
      x.font = '700 15px Inter, sans-serif'
      x.textAlign = 'center'
      x.fillText('MENU', w / 2, 22)
      x.fillText('▶❙❙', w / 2, w - 10)
      x.fillText('⏮', 16, w / 2 + 5)
      x.fillText('⏭', w - 16, w / 2 + 5)
    }),
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
    atlasTex.needsUpdate = true
  }

  /** A real mesh (with cover) for a record that leaves the shelf. */
  function makeLoose(r) {
    const coverMat = new THREE.MeshStandardMaterial({ map: placeholderCover(r.album), roughness: 0.55 })
    if (r.album.image) {
      loader.load(r.album.image, (t) => {
        t.colorSpace = THREE.SRGBColorSpace
        coverMat.map?.dispose()
        coverMat.map = t
        coverMat.needsUpdate = true
      }, undefined, () => {})
    }
    const backMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(r.color), roughness: 0.6 })
    const spineMat = new THREE.MeshStandardMaterial({ map: spineTex(r.album, r.color), roughness: 0.6 })
    // faces: +x front cover, -x back, +y/-y edges, +z spine, -z back edge
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(THICK, SLEEVE, SLEEVE), [coverMat, backMat, pageMat, pageMat, spineMat, pageMat])
    mesh.position.copy(r.home).setZ(r.home.z + r.out * 0.09)
    mesh.castShadow = mesh.receiveShadow = true
    mesh.userData = { kind: 'album', index: r.index }
    group.add(mesh)
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
    drawIpodScreen(screenCtx, 512, 420, screenNow, screenArt, p)
    screenTex.needsUpdate = true
    screenDrawn = performance.now()
  }

  function setState({ albums = [], now = null }) {
    setAlbums(albums)
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
        loader.load(now.image, (t) => {
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

  function update(dt, t, camera) {
    let moving = false
    if (playing) platter.rotation.y -= dt * (33.3 / 60) * Math.PI * 2
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
      const r = records.find((x) => x.album.uri === uri)
      if (r && !loose.has(uri)) loose.set(uri, makeLoose(r))
      else if (loose.has(uri)) loose.get(uri).returning = false
    }
    for (const [uri, l] of loose) {
      if (uri !== selectedUri && uri !== playingUri && uri !== peekUri) l.returning = true
    }

    // hover: slide the record out a little
    for (const r of records) {
      const target = r.album.uri === hoverUri ? 1 : 0
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
    setHoldIpod(v, big = false) { holdIpod = v; ipodBig = big },
    setFlip(v) { flipSel = v },
    isSpinning: () => playing,
    isHoldingIpod: () => holdIpod,
    ipodScreenRect,
    selectedRect,
    update,
  }
}
