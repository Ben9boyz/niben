import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { wrapText, canvasTex } from './textures'

const W = 1280, H = 720

function roundRect(x, px, py, w, h, r) {
  x.beginPath()
  x.roundRect(px, py, w, h, r)
}

function drawScreen(ctx, project, index, total, t) {
  const x = ctx
  // background
  const g = x.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#0a1222')
  g.addColorStop(1, '#0f1d38')
  x.fillStyle = g
  x.fillRect(0, 0, W, H)
  // glow blobs
  const rg = x.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, 500)
  rg.addColorStop(0, 'rgba(92,182,255,0.35)')
  rg.addColorStop(1, 'rgba(92,182,255,0)')
  x.fillStyle = rg
  x.fillRect(0, 0, W, H)

  // window chrome
  x.fillStyle = 'rgba(255,255,255,0.06)'
  roundRect(x, 40, 34, W - 80, H - 68, 26)
  x.fill()
  x.strokeStyle = 'rgba(255,255,255,0.12)'
  x.lineWidth = 2
  x.stroke()
  ;['#ff6b6b', '#ffd166', '#4cd97b'].forEach((c, i) => {
    x.fillStyle = c
    x.beginPath()
    x.arc(78 + i * 30, 70, 9, 0, Math.PI * 2)
    x.fill()
  })
  x.fillStyle = 'rgba(255,255,255,0.5)'
  x.font = '500 22px "JetBrains Mono", ui-monospace, Menlo, monospace'
  x.textAlign = 'center'
  x.fillText(project ? `~/prosjekter/${slug(project.navn)}` : '~/prosjekter', W / 2, 78)
  x.textAlign = 'left'

  if (!project) {
    x.fillStyle = '#eaf4ff'
    x.font = '700 64px "Inter Tight", Inter, sans-serif'
    x.fillText('Ingen prosjekter ennå', 90, 360)
    return
  }

  // counter
  x.fillStyle = '#7cd0ff'
  x.font = '600 24px Inter, sans-serif'
  x.fillText(`PROSJEKT ${index + 1} / ${total}`, 90, 160)

  x.fillStyle = '#ffffff'
  x.font = '800 82px "Inter Tight", Inter, sans-serif'
  wrapText(x, project.navn, 90, 250, 760, 88, 2)

  x.fillStyle = 'rgba(220,235,255,0.75)'
  x.font = '400 30px Inter, sans-serif'
  wrapText(x, project.beskrivelse, 90, 360, 720, 44, 4)

  // tags
  let tx = 90
  x.font = '600 24px Inter, sans-serif'
  for (const tag of project.teknologi || []) {
    const w = x.measureText(tag).width + 36
    if (tx + w > 860) break
    x.fillStyle = 'rgba(92,182,255,0.18)'
    roundRect(x, tx, 560, w, 46, 23)
    x.fill()
    x.fillStyle = '#9fdcff'
    x.fillText(tag, tx + 18, 591)
    tx += w + 12
  }

  // fake code panel on the right
  x.fillStyle = 'rgba(0,0,0,0.25)'
  roundRect(x, 900, 130, 320, 520, 18)
  x.fill()
  const lines = [
    ['const', ' prosjekt = {'], ['  navn', `: '${(project.navn || '').slice(0, 10)}',`], ['  år', `: ${project.aar || 2026},`],
    ['  status', ": 'live',"], ['}', ''], ['', ''], ['export', ' default'], ['  ', 'prosjekt'],
  ]
  x.font = '500 22px "JetBrains Mono", ui-monospace, Menlo, monospace'
  lines.forEach(([a, b], i) => {
    x.fillStyle = 'rgba(255,255,255,0.25)'
    x.fillText(String(i + 1).padStart(2, ' '), 920, 180 + i * 38)
    x.fillStyle = '#c792ea'
    x.fillText(a, 960, 180 + i * 38)
    x.fillStyle = '#d6e6ff'
    x.fillText(b, 960 + x.measureText(a).width, 180 + i * 38)
  })
  if (Math.floor(t * 2) % 2 === 0) {
    x.fillStyle = '#7cd0ff'
    x.fillRect(960 + x.measureText('  prosjekt').width + 4, 180 + 7 * 38 - 20, 12, 26)
  }
}

// ── the monitor in the gaming corner: a Steam-like screen with what's being played ──
const imgCache = new Map()
function steamImg(appid, kind, onLoad) {
  const url = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/${kind}.jpg`
  let e = imgCache.get(url)
  if (!e) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    e = { img, ok: false }
    img.onload = () => { e.ok = true; onLoad() }
    img.src = url
    imgCache.set(url, e)
  }
  return e.ok ? e.img : null
}

function drawGaming(x, data, t, onLoad) {
  x.fillStyle = '#171a21'
  x.fillRect(0, 0, W, H)
  // top bar
  x.fillStyle = '#0e1116'
  x.fillRect(0, 0, W, 64)
  x.fillStyle = '#c7d5e0'
  x.font = '800 30px system-ui, sans-serif'
  x.textBaseline = 'middle'
  x.textAlign = 'left'
  x.fillText('STEAM', 40, 33)
  x.fillStyle = '#8f98a0'
  x.font = '600 22px system-ui, sans-serif'
  x.fillText('BIBLIOTEK', 190, 34)
  x.fillText('PROFIL', 340, 34)
  const p = data?.profile
  if (p) {
    x.textAlign = 'right'
    x.fillStyle = p.playing ? '#90ba3c' : p.online ? '#57cbde' : '#8f98a0'
    x.fillText(p.name || '', W - 40, 34)
  }
  const lib = data?.library
  const hero = p?.playing ? (lib?.recent?.find((g) => g.appid === p.playing.appid) || p.playing) : lib?.recent?.[0]
  if (!hero) {
    x.textAlign = 'center'
    x.fillStyle = '#8f98a0'
    x.font = '600 34px system-ui, sans-serif'
    x.fillText('Kobler til Steam …', W / 2, H / 2)
    return
  }
  // the big banner (460×215 → 760×355)
  const bx = 40, by = 96, bw = 760, bh = 355
  const banner = steamImg(hero.appid, 'header', onLoad)
  x.fillStyle = '#2a475e'
  roundRect(x, bx, by, bw, bh, 14)
  x.fill()
  if (banner) {
    x.save()
    roundRect(x, bx, by, bw, bh, 14)
    x.clip()
    x.drawImage(banner, bx, by, bw, bh)
    x.restore()
  }
  // status + name
  x.textAlign = 'left'
  const live = !!p?.playing
  x.fillStyle = live ? '#90ba3c' : '#8f98a0'
  x.font = '800 22px system-ui, sans-serif'
  if (live && Math.floor(t * 1.5) % 2 === 0) { x.beginPath(); x.arc(bx + 8, by + bh + 42, 8, 0, Math.PI * 2); x.fill() }
  x.fillText(live ? 'SPILLER NÅ' : 'SIST SPILT', bx + 26, by + bh + 43)
  x.fillStyle = '#ffffff'
  x.font = '800 46px system-ui, sans-serif'
  let name = hero.name || ''
  while (name.length > 3 && x.measureText(name).width > bw) name = name.slice(0, -2)
  x.fillText(name === hero.name ? name : `${name}…`, bx, by + bh + 98)
  x.fillStyle = '#8f98a0'
  x.font = '600 26px system-ui, sans-serif'
  const hrs = hero.hours ? `${Math.round(hero.hours)} timer spilt` : ''
  const ach = hero.ach ? `  ·  ${hero.ach.done}/${hero.ach.total} prestasjoner` : ''
  x.fillText(hrs + ach, bx, by + bh + 142)
  // recently played, on the right
  const list = (lib?.recent || []).filter((g) => g.appid !== hero.appid).slice(0, 4)
  const lx = 840, lw = W - lx - 40
  x.fillStyle = '#8f98a0'
  x.font = '700 20px system-ui, sans-serif'
  x.fillText('NYLIG SPILT', lx, 112)
  list.forEach((g, i) => {
    const y = 136 + i * 136
    const img = steamImg(g.appid, 'header', onLoad)
    x.fillStyle = '#2a475e'
    roundRect(x, lx, y, lw, lw * 215 / 460, 8)
    x.fill()
    if (img) {
      x.save()
      roundRect(x, lx, y, lw, lw * 215 / 460, 8)
      x.clip()
      x.drawImage(img, lx, y, lw, lw * 215 / 460)
      x.restore()
    }
  })
  if (lib && !lib.hidden) {
    x.fillStyle = '#c7d5e0'
    x.font = '700 24px system-ui, sans-serif'
    x.fillText(`${lib.count} spill  ·  ${lib.hours.toLocaleString('nb-NO')} timer`, lx, H - 40)
  }
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function buildDesk() {
  const group = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: 0xd9b48a, roughness: 0.55 })
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.5 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.45, metalness: 0.2 })
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9d1db, roughness: 0.3, metalness: 0.9 })
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5cb6ff).multiplyScalar(3.4), toneMapped: false })

  const add = (geo, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    parent.add(m)
    return m
  }

  // desk
  add(new THREE.BoxGeometry(2.0, 0.04, 0.78), wood, 0, 0.74, 0)
  ;[[-0.94, -0.33], [0.94, -0.33], [-0.94, 0.33], [0.94, 0.33]].forEach(([x, z]) =>
    add(new THREE.BoxGeometry(0.04, 0.72, 0.04), white, x, 0.36, z))
  add(new THREE.BoxGeometry(1.84, 0.02, 0.03), white, 0, 0.7, -0.33)


  // monitor
  const monitor = new THREE.Group()
  monitor.position.set(0, 0.76, -0.16)
  group.add(monitor)
  add(new THREE.BoxGeometry(0.28, 0.012, 0.18), metal, 0, 0.006, 0, monitor)
  add(new THREE.BoxGeometry(0.05, 0.3, 0.025), metal, 0, 0.16, -0.04, monitor)
  const bezel = add(new THREE.BoxGeometry(1.0, 0.58, 0.035), dark, 0, 0.42, 0, monitor)
  bezel.castShadow = true

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.82, 0.82, 0.82) })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.54), screenMat)
  screen.position.set(0, 0.42, 0.0185)
  screen.userData = { kind: 'screen' }
  monitor.add(screen)

  // soundbar under the monitor
  const barBody = add(new RoundedBoxGeometry(0.64, 0.052, 0.085, 3, 0.012), new THREE.MeshStandardMaterial({ color: 0x1d1f26, roughness: 0.45, metalness: 0.2 }), 0, 0.786, -0.025)
  barBody.castShadow = true
  add(new THREE.BoxGeometry(0.6, 0.036, 0.004), new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.95 }), 0, 0.786, 0.019) // grille cloth
  ;[-0.27, 0.27].forEach((x) => add(new THREE.CylinderGeometry(0.014, 0.014, 0.003, 18), new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.6 }), x, 0.786, 0.022).rotation.x = Math.PI / 2)
  const barLed = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 8, 6), new THREE.MeshBasicMaterial({ color: 0x6fd0ff, toneMapped: false }))
  barLed.position.set(0.29, 0.775, 0.0225)
  group.add(barLed)
  // keyboard + mouse
  add(new THREE.BoxGeometry(0.44, 0.018, 0.14), white, -0.05, 0.769, 0.17)
  // 56 keys as one instanced mesh (one draw call instead of 56)
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(0.024, 0.008, 0.024), white, 56)
  const km = new THREE.Matrix4()
  for (let r = 0, i = 0; r < 4; r++) {
    for (let c = 0; c < 14; c++, i++) keys.setMatrixAt(i, km.makeTranslation(-0.25 + c * 0.0295, 0.782, 0.122 + r * 0.03))
  }
  keys.castShadow = keys.receiveShadow = true
  group.add(keys)
  const mouse = add(new THREE.CapsuleGeometry(0.025, 0.04, 6, 12), white, 0.3, 0.77, 0.18)
  mouse.rotation.x = Math.PI / 2
  mouse.scale.set(1, 1, 0.45)
  // desk mat
  add(new THREE.BoxGeometry(0.8, 0.004, 0.32), new THREE.MeshStandardMaterial({ color: 0x2a3446, roughness: 0.9 }), 0.05, 0.762, 0.16)

  // mug
  add(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 24), white, -0.8, 0.805, 0.08)

  // small plant
  add(new THREE.CylinderGeometry(0.055, 0.045, 0.09, 24), white, -0.55, 0.805, -0.22)
  const leaf = new THREE.MeshStandardMaterial({ color: 0x5aa66b, roughness: 0.6 })
  for (let i = 0; i < 7; i++) {
    const l = add(new THREE.SphereGeometry(0.05, 12, 12), leaf, -0.55 + Math.cos(i) * 0.03, 0.88 + (i % 3) * 0.03, -0.22 + Math.sin(i * 2) * 0.03)
    l.scale.set(0.5, 1.2, 0.3)
    l.rotation.set(Math.sin(i) * 0.6, i, Math.cos(i) * 0.6)
  }

  // gamepad (its own group: clicking it goes to the gaming corner)
  const pad = new THREE.Group()
  pad.position.set(-0.6, 0.762, 0.14)
  pad.rotation.y = 0.35
  group.add(pad)
  const padMat = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.55 })
  const padBody = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.03, 0.075, 4, 0.014), padMat)
  padBody.position.y = 0.02
  padBody.castShadow = padBody.receiveShadow = true
  pad.add(padBody)
  ;[-1, 1].forEach((side) => {
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.05, 6, 12), padMat)
    grip.rotation.set(Math.PI / 2, 0, side * 0.5)
    grip.position.set(side * 0.06, 0.018, 0.035)
    grip.castShadow = true
    pad.add(grip)
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.014, 16), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.8 }))
    stick.position.set(side * 0.028, 0.04, side < 0 ? -0.006 : 0.016)
    pad.add(stick)
  })
  ;[[0.052, -0.012, 0x3fbf6a], [0.064, 0, 0xe5533d], [0.04, 0, 0x2b8cff], [0.052, 0.012, 0xf5c542]].forEach(([bx, bz, c]) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, emissive: c, emissiveIntensity: 0.25 }))
    b.position.set(bx, 0.036, bz - 0.01)
    pad.add(b)
  })
  const padLight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.002, 0.004), glow)
  padLight.position.set(0, 0.036, -0.03)
  pad.add(padLight)

  // FormD T1 (small-form-factor case in steel) on the desk
  const pc = new THREE.Group()
  pc.position.set(0.74, 0.76, -0.12)
  pc.rotation.y = -0.25
  group.add(pc)
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9bfc6, metalness: 0.85, roughness: 0.32 })
  const CW = 0.16, CH = 0.25, CD = 0.22
  const shell = new THREE.Mesh(new RoundedBoxGeometry(CW, CH, CD, 4, 0.012), steel)
  shell.position.y = CH / 2 + 0.006
  shell.castShadow = shell.receiveShadow = true
  pc.add(shell)
  // perforated side panels
  const holes = canvasTex(256, 512, (x, w, h) => {
    x.fillStyle = '#ffffff'
    x.fillRect(0, 0, w, h)
    x.fillStyle = '#20242a'
    for (let yy = 24; yy < h - 20; yy += 14) {
      for (let xx = 20 + ((yy / 14) % 2) * 7; xx < w - 16; xx += 14) {
        x.beginPath(); x.arc(xx, yy, 4, 0, Math.PI * 2); x.fill()
      }
    }
  })
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0xaab1b9, metalness: 0.85, roughness: 0.35,
    map: holes,
  })
  ;[-1, 1].forEach((side) => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(CD - 0.03, CH - 0.03), panelMat)
    panel.position.set(side * (CW / 2 + 0.0005), CH / 2 + 0.006, 0)
    panel.rotation.y = side * Math.PI / 2
    pc.add(panel)
  })
  // top vent strip, power button and feet
  const ventMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.6, metalness: 0.4 })
  const vent = new THREE.Mesh(new THREE.BoxGeometry(CW - 0.03, 0.002, CD - 0.05), ventMat)
  vent.position.y = CH + 0.007
  pc.add(vent)
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 20), glow)
  btn.rotation.x = Math.PI / 2
  btn.position.set(0, CH - 0.02, CD / 2 + 0.002)
  pc.add(btn)
  ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 12), ventMat)
    f.position.set(a * (CW / 2 - 0.02), 0.003, b * (CD / 2 - 0.03))
    pc.add(f)
  })
  const fans = []

  // chair
  const chair = new THREE.Group()
  chair.position.set(-0.75, 0, 0.85)
  chair.rotation.y = 0.9
  group.add(chair)
  const fabric = new THREE.MeshStandardMaterial({ color: 0x2f3a4d, roughness: 0.85 })
  add(new THREE.BoxGeometry(0.5, 0.07, 0.48), fabric, 0, 0.48, 0, chair)
  const back = add(new THREE.BoxGeometry(0.48, 0.6, 0.06), fabric, 0, 0.84, 0.24, chair)
  back.rotation.x = -0.12
  add(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 12), metal, 0, 0.28, 0, chair)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const leg = add(new THREE.BoxGeometry(0.3, 0.025, 0.04), metal, Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15, chair)
    leg.rotation.y = -a
    add(new THREE.SphereGeometry(0.025, 10, 10), dark, Math.cos(a) * 0.3, 0.025, Math.sin(a) * 0.3, chair)
  }

  let current = { project: null, index: 0, total: 0 }
  let lastBlink = -1
  function setProject(project, index, total) {
    current = { project, index, total }
    lastBlink = -1
  }
  // 'code' (projects) or 'gaming' (Steam)
  let screenMode = 'code'
  let steamData = null
  function setScreenMode(m) { if (m !== screenMode) { screenMode = m; lastBlink = -1 } }
  function setSteam(d) { steamData = d; lastBlink = -1 }
  const redraw = () => { lastBlink = -1 }

  function update(dt, t) {
    fans.forEach((f) => (f.rotation.x += dt * 14))
    const blink = Math.floor(t * 2)
    if (blink !== lastBlink) {
      lastBlink = blink
      if (screenMode === 'gaming') drawGaming(ctx, steamData, t, redraw)
      else drawScreen(ctx, current.project, current.index, current.total, t)
      tex.needsUpdate = true
      return true
    }
    return fans.length > 0
  }

  return { group, screen, pad, setProject, setScreenMode, setSteam, update }
}
