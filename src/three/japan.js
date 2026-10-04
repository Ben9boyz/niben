import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { canvasTex } from './textures'

// The Japanese corner: a tatami mat with a low round table (chabudai), two cushions, a paper lantern,
// a small bonsai, a cup of tea – and a washi card on the table with the word of the day from jpdb.
// Everything is low so it doesn't hide the rest of the room.

function tatamiTexture() {
  return canvasTex(512, 340, (x, w, h) => {
    x.fillStyle = '#cdbf86'
    x.fillRect(0, 0, w, h)
    // woven rush: fine lengthwise lines
    for (let i = 0; i < w; i += 3) {
      x.fillStyle = i % 6 ? 'rgba(120,110,60,0.10)' : 'rgba(255,255,230,0.12)'
      x.fillRect(i, 0, 1, h)
    }
    // cloth borders (heri) along the long sides
    x.fillStyle = '#2d3b2a'
    x.fillRect(0, 0, w, 16)
    x.fillRect(0, h - 16, w, 16)
    x.fillStyle = 'rgba(255,255,255,0.08)'
    x.fillRect(0, 6, w, 2)
    x.fillRect(0, h - 8, w, 2)
  })
}

function drawWordCard(x, w, h, word) {
  x.fillStyle = '#fbf7ee'
  x.fillRect(0, 0, w, h)
  // washi fibres
  for (let i = 0; i < 160; i++) {
    x.strokeStyle = `rgba(150,130,100,${0.04 + Math.random() * 0.05})`
    x.beginPath()
    const sx = Math.random() * w, sy = Math.random() * h
    x.moveTo(sx, sy)
    x.lineTo(sx + (Math.random() - 0.5) * 40, sy + (Math.random() - 0.5) * 12)
    x.stroke()
  }
  x.strokeStyle = '#c0392b'
  x.lineWidth = 6
  x.strokeRect(14, 14, w - 28, h - 28)
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillStyle = '#9b2c22'
  x.font = '600 26px "Hiragino Sans", "Noto Sans JP", sans-serif'
  x.fillText('今日の言葉', w / 2, 52)
  if (!word) {
    x.fillStyle = '#1a1a1a'
    x.font = '700 120px "Hiragino Mincho ProN", "Noto Serif JP", serif'
    x.fillText('日本語', w / 2, h / 2 + 10)
    return
  }
  const sp = word.spelling || ''
  const size = Math.min(150, Math.floor((w - 70) / Math.max(1, sp.length)))
  x.fillStyle = '#1a1a1a'
  x.font = `700 ${size}px "Hiragino Mincho ProN", "Noto Serif JP", serif`
  x.fillText(sp, w / 2, h / 2 + 4)
  if (word.reading && word.reading !== sp) {
    x.fillStyle = '#555'
    x.font = '500 34px "Hiragino Sans", "Noto Sans JP", sans-serif'
    x.fillText(word.reading, w / 2, h / 2 - size / 2 - 26)
  }
  const meaning = (word.meanings?.[0] || []).slice(0, 2).join('; ')
  x.fillStyle = '#444'
  x.font = 'italic 500 28px Georgia, serif'
  let m = meaning
  while (m.length > 4 && x.measureText(m).width > w - 60) m = m.slice(0, -2)
  if (m !== meaning) m += '…'
  x.fillText(m, w / 2, h - 58)
}

// ── anime DVDs: the shows from the jpdb decks, in cases stacked on the tatami ──
const DVD = { w: 0.17, d: 0.24, h: 0.019 } // a DVD case (a bit larger than life), lying down: cover on top, spine on the left
const PER_STACK = 5
const STACKS = [[0.5, 0.4], [0.78, 0.18], [-0.56, 0.45], [0.66, -0.1]] // spots on the mat, clear of the table

function drawSpine(x, w, h, anime) {
  const bg = anime.color || '#33415c'
  x.fillStyle = bg
  x.fillRect(0, 0, w, h)
  // light or dark text depending on the colour
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16) || 0)
  const light = r * 0.3 + g * 0.59 + b * 0.11 > 150
  x.fillStyle = light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.16)'
  x.fillRect(0, 0, 46, h)
  x.fillStyle = light ? '#1a1a1a' : '#fff'
  x.textBaseline = 'middle'
  x.font = '800 22px system-ui, sans-serif'
  x.textAlign = 'center'
  x.fillText('DVD', 23, h / 2 + 1)
  x.textAlign = 'left'
  const title = anime.native || anime.en || anime.title
  x.font = '700 26px "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif'
  let t = title
  while (t.length > 2 && x.measureText(t).width > w - 150) t = t.slice(0, -1)
  x.fillText(t === title ? t : `${t}…`, 58, h / 2 + 1)
  // coverage at the end of the spine
  x.textAlign = 'right'
  x.font = '700 20px system-ui, sans-serif'
  x.fillText(`${Math.round(anime.known)}%`, w - 12, h / 2 + 1)
}

function buildDvds(onChange) {
  const group = new THREE.Group()
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')
  const geo = new THREE.BoxGeometry(DVD.w, DVD.h, DVD.d)
  const plastic = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.35 })
  const edge = new THREE.MeshStandardMaterial({ color: 0xd9dbe0, roughness: 0.5 })
  let items = []
  let key = ''
  let hover = -1
  let selected = -1

  function set(list) {
    const k = (list || []).map((a) => `${a.anilist}:${Math.round(a.known)}`).join(',')
    if (k === key) return
    key = k
    for (const it of items) {
      group.remove(it.mesh)
      it.mesh.material.forEach((m) => { m.map?.dispose(); if (m !== plastic && m !== edge) m.dispose() })
    }
    items = []
    const shows = (list || []).slice(0, PER_STACK * STACKS.length)
    shows.forEach((a, i) => {
      const stack = Math.floor(i / PER_STACK)
      const level = i % PER_STACK
      const top = level === Math.min(PER_STACK, shows.length - stack * PER_STACK) - 1
      const spine = canvasTex(512, 40, (x, w, h) => drawSpine(x, w, h, a))
      const cover = new THREE.MeshStandardMaterial({ color: a.color || 0x33415c, roughness: 0.32 })
      if (a.cover) {
        // the same CORS-safe URL as the panel's <img>, so a copy cached without CORS headers is never reused
        loader.load(`${a.cover}?cors`, (t) => {
          t.colorSpace = THREE.SRGBColorSpace
          t.anisotropy = 8
          cover.map = t
          cover.color.set(0xffffff)
          cover.needsUpdate = true
          onChange()
        })
      }
      // faces: +x (opening edge), -x (spine), +y (front cover), -y, +z, -z
      const mesh = new THREE.Mesh(geo, [edge, new THREE.MeshStandardMaterial({ map: spine, roughness: 0.4 }), cover, plastic, plastic, plastic])
      mesh.castShadow = mesh.receiveShadow = true
      mesh.userData.kind = 'anime'
      mesh.userData.index = i
      // spines towards the room, a little untidy; the top one is turned so its cover faces you
      const seed = Math.sin(i * 12.9898 + 4.1) * 43758.5453
      const jit = (seed - Math.floor(seed) - 0.5)
      const rot = top ? 0.18 + jit * 0.3 : Math.PI / 2 + jit * 0.22
      const [sx, sz] = STACKS[stack]
      const base = new THREE.Vector3(sx + jit * 0.012, 0.03 + DVD.h / 2 + level * (DVD.h + 0.0008), sz - jit * 0.01)
      mesh.position.copy(base)
      mesh.rotation.y = rot
      group.add(mesh)
      items.push({ mesh, base, lift: 0 })
    })
    onChange()
  }

  /** Lift and slide out the hovered / picked one. Returns true while moving. */
  function update(dt) {
    let moving = false
    items.forEach((it, i) => {
      const want = i === selected ? 1 : i === hover ? 0.45 : 0
      const d = want - it.lift
      if (Math.abs(d) < 0.001) return
      it.lift += d * Math.min(1, dt * 10)
      // pull it out towards the room (+z) and up a touch
      it.mesh.position.set(it.base.x, it.base.y + it.lift * 0.035, it.base.z + it.lift * 0.09)
      moving = true
    })
    return moving
  }

  return {
    group,
    set,
    update,
    setHover(i) { hover = i ?? -1 },
    setSelected(i) { selected = i ?? -1 },
  }
}

export function buildJapanCorner(onChange = () => {}) {
  const group = new THREE.Group()
  const add = (geo, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    parent.add(m)
    return m
  }
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.45 })
  const woodLight = new THREE.MeshStandardMaterial({ color: 0xb98a5b, roughness: 0.55 })

  // tatami
  add(new THREE.BoxGeometry(1.9, 0.03, 1.25), new THREE.MeshStandardMaterial({ map: tatamiTexture(), roughness: 0.85 }), 0, 0.015, 0)

  // chabudai: low round table on four short legs
  add(new THREE.CylinderGeometry(0.44, 0.44, 0.035, 48), wood, 0, 0.31, 0)
  ;[[0.25, 0.25], [-0.25, 0.25], [0.25, -0.25], [-0.25, -0.25]].forEach(([x, z]) =>
    add(new THREE.BoxGeometry(0.05, 0.28, 0.05), wood, x, 0.155, z))

  // zabuton cushions
  const cushion = (color, x, z, rot) => {
    const c = add(new RoundedBoxGeometry(0.5, 0.07, 0.5, 3, 0.03), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }), x, 0.065, z)
    c.rotation.y = rot
    add(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshStandardMaterial({ color: 0xeee6d0 }), 0, 0.04, 0, c) // the tuft
  }
  cushion(0x2f4a7a, 0, 0.62, 0.08)
  cushion(0x9b2c22, -0.66, -0.05, 0.9)

  // andon: paper lantern on a wooden frame, glowing warm
  const andon = new THREE.Group()
  andon.position.set(0.72, 0, -0.38)
  group.add(andon)
  const paper = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffb45e, emissiveIntensity: 1.25, roughness: 0.9 })
  add(new THREE.BoxGeometry(0.2, 0.34, 0.2), paper, 0, 0.27, 0, andon)
  ;[[0.1, 0.1], [-0.1, 0.1], [0.1, -0.1], [-0.1, -0.1]].forEach(([x, z]) =>
    add(new THREE.BoxGeometry(0.018, 0.48, 0.018), wood, x, 0.24, z, andon))
  add(new THREE.BoxGeometry(0.24, 0.018, 0.24), wood, 0, 0.45, 0, andon)
  add(new THREE.BoxGeometry(0.24, 0.018, 0.24), wood, 0, 0.1, 0, andon)

  // bonsai in a shallow pot
  const bonsai = new THREE.Group()
  bonsai.position.set(-0.7, 0, -0.45)
  group.add(bonsai)
  add(new THREE.CylinderGeometry(0.11, 0.09, 0.06, 24), new THREE.MeshStandardMaterial({ color: 0x3b4a5c, roughness: 0.4 }), 0, 0.03, 0, bonsai)
  const trunk = add(new THREE.CylinderGeometry(0.012, 0.022, 0.2, 8), woodLight, 0.01, 0.15, 0, bonsai)
  trunk.rotation.z = 0.35
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4f7d3a, roughness: 0.8 })
  ;[[-0.05, 0.25, 0, 0.07], [0.04, 0.27, 0.02, 0.06], [-0.01, 0.31, -0.02, 0.055]].forEach(([x, y, z, r]) =>
    add(new THREE.IcosahedronGeometry(r, 1), leaf, x, y, z, bonsai))

  // tea: a small cup
  add(new THREE.CylinderGeometry(0.03, 0.024, 0.05, 20), new THREE.MeshStandardMaterial({ color: 0x6f8f6a, roughness: 0.35 }), 0.24, 0.355, 0.12)

  // the word card, propped up on the table facing the room
  const cardCanvas = document.createElement('canvas')
  cardCanvas.width = 512
  cardCanvas.height = 360
  const cardCtx = cardCanvas.getContext('2d')
  const cardTex = new THREE.CanvasTexture(cardCanvas)
  cardTex.colorSpace = THREE.SRGBColorSpace
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.295), new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.9 }))
  card.position.set(-0.04, 0.47, -0.12)
  card.rotation.x = -0.32
  card.castShadow = true
  group.add(card)
  const stand = add(new THREE.BoxGeometry(0.3, 0.02, 0.05), wood, -0.04, 0.338, -0.04)
  stand.rotation.x = -0.3
  drawWordCard(cardCtx, 512, 360, null)
  cardTex.needsUpdate = true

  let wordKey = ''
  function setWord(word) {
    const key = word ? `${word.vid}:${word.sid}` : ''
    if (key === wordKey) return
    wordKey = key
    drawWordCard(cardCtx, 512, 360, word)
    cardTex.needsUpdate = true
  }

  const dvds = buildDvds(onChange)
  group.add(dvds.group)

  return { group, setWord, setAnime: dvds.set, setAnimeHover: dvds.setHover, setAnimeSelected: dvds.setSelected, update: dvds.update }
}
