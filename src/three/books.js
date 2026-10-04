import * as THREE from 'three'
import { canvasTex, wrapText, hash, shade, luminance } from './textures'

const SPINE_COLORS = ['#1f4e8c', '#2b8cff', '#0f2a4a', '#6aa9e9', '#24476b', '#8bb8e8', '#13355e', '#3d6fa8', '#e4eef8', '#0b3d6b', '#b9d7f2']
const SHELF_W = 1.7
const SHELF_YS = [0.95, 1.45, 1.95, 0.45]

function spineTex(book, color) {
  return canvasTex(128, 1024, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0)
    g.addColorStop(0, shade(color, -0.28))
    g.addColorStop(0.35, color)
    g.addColorStop(0.65, shade(color, 0.08))
    g.addColorStop(1, shade(color, -0.32))
    x.fillStyle = g
    x.fillRect(0, 0, w, h)
    const light = luminance(color) > 0.6
    const ink = light ? '#0b1424' : '#f5f8fc'
    x.fillStyle = light ? '#2b8cff' : '#9fd8ff'
    x.fillRect(0, 64, w, 6); x.fillRect(0, 78, w, 2); x.fillRect(0, 944, w, 2); x.fillRect(0, 954, w, 6)
    x.save()
    x.translate(w / 2, h / 2)
    x.rotate(Math.PI / 2)
    x.fillStyle = ink
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    let size = 60
    x.font = `700 ${size}px "Inter Tight", Inter, sans-serif`
    while (x.measureText(book.tittel).width > 700 && size > 26) {
      size -= 2
      x.font = `700 ${size}px "Inter Tight", Inter, sans-serif`
    }
    x.fillText(book.tittel, 0, -12)
    x.globalAlpha = 0.7
    x.font = '500 28px Inter, sans-serif'
    x.fillText(book.forfatter || '', 0, 34)
    x.restore()
  })
}

function coverTex(book, color) {
  return canvasTex(600, 900, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, shade(color, 0.18))
    g.addColorStop(1, shade(color, -0.32))
    x.fillStyle = g
    x.fillRect(0, 0, w, h)
    x.strokeStyle = 'rgba(255,255,255,.35)'
    x.lineWidth = 3
    x.strokeRect(40, 40, w - 80, h - 80)
    x.fillStyle = luminance(color) > 0.6 ? '#0b1424' : '#ffffff'
    x.textAlign = 'center'
    x.font = '800 62px "Inter Tight", Inter, sans-serif'
    wrapText(x, book.tittel, w / 2, 300, 470, 72, 5)
    x.globalAlpha = 0.75
    x.font = '500 32px Inter, sans-serif'
    x.fillText(book.forfatter || '', w / 2, 780)
  })
}

const pagesTex = () => canvasTex(64, 256, (x, w, h) => {
  x.fillStyle = '#f4efe4'
  x.fillRect(0, 0, w, h)
  for (let i = 0; i < w; i += 2) {
    x.fillStyle = `rgba(120,100,70,${0.05 + ((i * 37) % 11) / 100})`
    x.fillRect(i, 0, 1, h)
  }
})

export function buildBookshelf() {
  const group = new THREE.Group()
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xf3f6fa, roughness: 0.55 })
  const pageMat = new THREE.MeshStandardMaterial({ map: pagesTex(), roughness: 0.9 })
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')

  const boards = []
  function board(y) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(SHELF_W + 0.1, 0.035, 0.3), boardMat)
    b.position.set(0, y, 0.15)
    b.castShadow = b.receiveShadow = true
    group.add(b)
    boards.push(b)
  }

  const endMat = new THREE.MeshStandardMaterial({ color: 0x2b8cff, roughness: 0.35, metalness: 0.3 })
  const decoMats = [
    new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.4 }),
    new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.05, transmission: 0.8, thickness: 0.05 }),
  ]
  function bookend(x, y, dir) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.12), endMat)
    m.position.set(x, y + 0.0175 + 0.08, 0.14)
    m.castShadow = true
    group.add(m)
    boards.push(m)
  }
  function decor(shelf, x) {
    const y = SHELF_YS[shelf] + 0.0175
    let m
    if (shelf === 0) {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.16, 32), decoMats[0])
      m.position.set(x, y + 0.08, 0.14)
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshStandardMaterial({ color: 0x5aa66b, roughness: 0.6 }))
      leaf.position.set(x, y + 0.2, 0.14)
      leaf.scale.set(1, 0.8, 1)
      group.add(leaf)
      boards.push(leaf)
    } else if (shelf === 1) {
      m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), decoMats[1])
      m.position.set(x, y + 0.06, 0.14)
    } else {
      m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.035, 0.012, 64, 8), endMat)
      m.position.set(x, y + 0.06, 0.14)
    }
    m.castShadow = true
    group.add(m)
    boards.push(m)
  }

  let items = []
  let selected = -1
  let hover = -1
  let elapsed = 0

  function setBooks(books) {
    items.forEach((it) => group.remove(it.mesh))
    boards.forEach((b) => group.remove(b))
    boards.length = 0
    items = []
    elapsed = 0

    // spread the books evenly over the shelves (top three first)
    const shelvesN = books.length > 54 ? 4 : Math.min(3, Math.max(1, Math.ceil(books.length / 4)))
    const per = Math.ceil(books.length / shelvesN)
    const used = new Set()
    const rows = []
    books.forEach((b, i) => {
      const h1 = hash(b.tittel)
      const h2 = hash((b.forfatter || '') + b.tittel)
      const t = 0.034 + h2 * 0.03 + Math.min(0.02, (b.sider || 0) / 30000)
      const h = 0.22 + h1 * 0.08
      const r = Math.min(shelvesN - 1, Math.floor(i / per))
      ;(rows[r] ||= []).push({ b, i, t, h })
    })
    // fill from the middle shelf outwards so a short list still looks styled
    const order = shelvesN === 1 ? [1] : shelvesN === 2 ? [1, 0] : shelvesN === 3 ? [1, 0, 2] : [1, 0, 2, 3]
    rows.forEach((row, r) => {
      const shelf = order[r]
      used.add(shelf)
      const gap = 0.004
      const width = row.reduce((s, x) => s + x.t + gap, 0)
      // alternate alignment per shelf for a lived-in look
      let x = r % 2 === 0 ? -SHELF_W / 2 + 0.12 : SHELF_W / 2 - 0.12 - width
      bookend(x - 0.012, SHELF_YS[shelf], 1)
      row.forEach(({ b, i, t, h }) => {
        const d = 0.17
        const color = b.farge || SPINE_COLORS[Math.floor(hash(b.tittel + 'c') * SPINE_COLORS.length)]
        const coverMat = new THREE.MeshStandardMaterial({ map: coverTex(b, color), roughness: 0.5 })
        const setCover = (url) => loader.load(url, (tex) => {
          if (tex.image?.width > 10) {
            tex.colorSpace = THREE.SRGBColorSpace
            coverMat.map?.dispose()
            coverMat.map = tex
            coverMat.needsUpdate = true
          }
        }, undefined, () => {})
        if (b.omslag) setCover(b.omslag)
        else if (b.isbn) setCover(`https://covers.openlibrary.org/b/isbn/${String(b.isbn).replace(/[^0-9X]/gi, '')}-L.jpg?default=false`)
        const spineMat = new THREE.MeshStandardMaterial({ map: spineTex(b, color), roughness: 0.55 })
        const backMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6 })
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), [coverMat, backMat, pageMat, pageMat, spineMat, pageMat])
        mesh.castShadow = mesh.receiveShadow = true
        const home = new THREE.Vector3(x + t / 2, SHELF_YS[shelf] + 0.0175 + h / 2, 0.05 + d / 2)
        x += t + gap
        mesh.position.copy(home)
        mesh.userData = { kind: 'book', index: i }
        group.add(mesh)
        items.push({ mesh, home, vel: new THREE.Vector3(), rotVel: 0, book: b, color, spineMat })
      })
      bookend(x + 0.008, SHELF_YS[shelf], -1)
      decor(shelf, r % 2 === 0 ? SHELF_W / 2 - 0.25 : -SHELF_W / 2 + 0.25)
    })
    ;[...used].forEach((s) => board(SHELF_YS[s]))
  }

  function refreshSpines() {
    items.forEach((it) => {
      it.spineMat.map?.dispose()
      it.spineMat.map = spineTex(it.book, it.color)
      it.spineMat.needsUpdate = true
    })
  }

  const target = new THREE.Vector3()
  // returns true while any book is still moving (so shadows need refreshing)
  function update(dt, t) {
    elapsed += dt
    let moving = selected !== -1
    for (const it of items) {
      const i = it.mesh.userData.index
      const sel = i === selected
      let rotY = 0, rotX = 0, rotZ = 0, scale = 1
      if (sel) {
        target.set(0, 1.5, 1.45)
        rotY = -Math.PI / 2 + 0.25 + Math.sin(t * 0.9) * 0.12
        rotX = Math.sin(t * 0.7) * 0.05
        scale = 2.1
      } else {
        target.copy(it.home)
        if (i === hover) { target.z += 0.06; target.y += 0.02 }
      }
      const k = sel ? 60 : 110, c = sel ? 12 : 15
      it.vel.x += ((target.x - it.mesh.position.x) * k - it.vel.x * c) * dt
      it.vel.y += ((target.y - it.mesh.position.y) * k - it.vel.y * c) * dt
      it.vel.z += ((target.z - it.mesh.position.z) * k - it.vel.z * c) * dt
      it.mesh.position.addScaledVector(it.vel, dt)
      it.rotVel += ((rotY - it.mesh.rotation.y) * 55 - it.rotVel * 10) * dt
      it.mesh.rotation.y += it.rotVel * dt
      it.mesh.rotation.x += (rotX - it.mesh.rotation.x) * Math.min(1, dt * 8)
      it.mesh.rotation.z += (rotZ - it.mesh.rotation.z) * Math.min(1, dt * 8)
      it.mesh.scale.setScalar(it.mesh.scale.x + (scale - it.mesh.scale.x) * Math.min(1, dt * 5))
      if (it.vel.lengthSq() > 1e-6 || Math.abs(it.rotVel) > 1e-3) moving = true
    }
    return moving
  }

  return {
    group,
    get meshes() { return items.map((it) => it.mesh) },
    setBooks,
    refreshSpines,
    setSelected(i) { selected = i },
    setHover(i) { hover = i },
    update,
  }
}
