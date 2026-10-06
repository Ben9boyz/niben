import * as THREE from 'three'
import type { NowPlaying } from '../types'
import { context2d } from './textures'
import { meshAdder } from './helpers'
import { SLEEVE, THICK, SLEEVE_T, TOP_Y, FRONT_Z, LEAN_Q, LEAN_UP, LEAN_Z, TT_C, COMPARTMENT } from './listening/constants'
import type { ShelfAlbum, StackEntry, ShelfRecord, LooseRecord, ScreenRect, CoverJob } from './listening/constants'
import { averageColor } from './listening/textures'
import { drawIpodScreen } from './listening/ipodScreen'
import { hash01, wearAmount } from './listening/wear'
import type { Kit } from './listening/kit'
import { buildCabinet } from './listening/cabinet'
import { buildTurntable } from './listening/turntable'
import { buildDecor } from './listening/decor'
import { buildStack } from './listening/stack'
import { buildWall } from './listening/wall'
import { buildIpod } from './listening/ipod'
import { buildLiving } from './listening/living'
import { makeLooseRecord } from './listening/loose'

export type { StackEntry, ScreenRect }

// Listening corner on the back wall (the pieces it is made of are in ./listening/):
//  - an open sideboard that works as a record shelf (spines out, one record per saved Spotify album)
//  - a turntable and an iPod classic on top
// Selecting a record pulls it out and floats it in front of the camera; the album that is playing
// lies on top of the sideboard next to the turntable. The iPod can be "picked up" (held in front of the camera).

export function buildListeningCorner() {
  const group = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.45 })
  const inner = new THREE.MeshStandardMaterial({ color: 0xe4e7ec, roughness: 0.7 })
  const wood = new THREE.MeshStandardMaterial({ color: 0xc89b6d, roughness: 0.5 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x18191d, roughness: 0.4, metalness: 0.2 })
  const alu = new THREE.MeshStandardMaterial({ color: 0xd5dae0, roughness: 0.25, metalness: 0.9 })
  const grill = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.9 })
  const add = meshAdder(group)
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')
  let shelfDirty = false // a model has just arrived: the room must draw a frame (see update)
  const kit: Kit = { group, add, white, inner, wood, dark, alu, grill, loader, markDirty: () => { shelfDirty = true } }

  // ── the pieces, in the order they were always added to the group ──
  buildCabinet(kit)
  const turntable = buildTurntable(kit)
  const { platter, rec, flyDisc, arm, ttLed, labelMat, models, updateDeck } = turntable
  const { plantLeaves, flame, candleLight } = buildDecor(kit)
  const stack = buildStack(kit)
  const { stackGroup, setStack, stackSlot, setNext } = stack
  const { fairyMat, shadeMat } = buildWall(kit)
  const { ipod, ipodHome, body, stand, screen, screenCtx, screenTex, updateSound, halo, W, H, SW, SH } = buildIpod(kit)
  const { animateLife } = buildLiving(kit, { plantLeaves })

  // ── Records ──
  // All records on the shelf are ONE instanced mesh. Spines come from a shared texture atlas
  // (one 16-px column per record), so 65+ records cost a single draw call. Only a record that is
  // selected or playing becomes its own mesh with a real cover.
  const pageMat = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.8 })
  const COLW = 24 // px per record in the atlas (a spine is 9.5 mm wide)
  const AH = 1024 // atlas height: the spine fills the lower 90 %
  const MAX_RECORDS = Math.min(150, COMPARTMENT.reduce((n, c) => n + Math.floor((c.x1 - c.x0 - 0.01) / THICK), 0)) // (the texture atlas must stay under 4096 px wide)
  const atlas = document.createElement('canvas')
  atlas.width = COLW * MAX_RECORDS
  atlas.height = AH
  const atlasCtx = context2d(atlas)
  const atlasTex = new THREE.CanvasTexture(atlas)
  atlasTex.colorSpace = THREE.SRGBColorSpace
  atlasTex.anisotropy = 8
  let atlasTimer = 0
  // the flat sides of the sleeves (the cover face): a second atlas, one cell per record, so the slivers you see between the spines are the cover art
  const CELL = 96, CCOLS = 8, CROWS = Math.ceil(MAX_RECORDS / CCOLS)
  const facesCanvas = document.createElement('canvas')
  facesCanvas.width = CELL * CCOLS
  facesCanvas.height = CELL * CROWS
  const facesCtx = context2d(facesCanvas)
  const facesTex = new THREE.CanvasTexture(facesCanvas)
  facesTex.colorSpace = THREE.SRGBColorSpace
  facesTex.anisotropy = 4
  function drawFace(i: number, color: string, img: CanvasImageSource | null): void {
    const x = (i % CCOLS) * CELL, y = Math.floor(i / CCOLS) * CELL
    facesCtx.fillStyle = color
    facesCtx.fillRect(x, y, CELL, CELL)
    if (img) facesCtx.drawImage(img, x, y, CELL, CELL)
  }
  const atlasDirty = (): void => { clearTimeout(atlasTimer); atlasTimer = window.setTimeout(() => { atlasTex.needsUpdate = true; facesTex.needsUpdate = true }, 120) }

  const coverTex = new Map<string, THREE.Texture>() // uri -> texture of the cover, loaded in the background
  let coverJobs: CoverJob[] = []
  let coverActive = 0
  function pumpCovers(): void { // three at a time, so the shelf never hogs the connection
    while (coverActive < 3 && coverJobs.length) {
      const job = coverJobs.shift()
      if (!job) break
      coverActive++
      const img = new Image()
      img.crossOrigin = 'anonymous'
      const done = (): void => { coverActive--; pumpCovers() }
      img.onload = () => { try { job(img) } finally { done() } }
      img.onerror = done
      img.src = job.src ?? ''
    }
  }
  const spineCovers = new Map<number, HTMLImageElement>() // index -> the small cover (drawn at the top of the spine)
  function drawSpine(i: number, album: ShelfAlbum, color: string): void {
    const x = atlasCtx
    const x0 = i * COLW
    x.save()
    x.beginPath(); x.rect(x0, 0, COLW, AH); x.clip()
    x.fillStyle = color
    x.fillRect(x0, 0, COLW, AH)
    const g = x.createLinearGradient(x0, 0, x0 + COLW, 0)
    g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.25, 'rgba(0,0,0,0)')
    g.addColorStop(0.8, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.3)')
    x.fillStyle = g
    x.fillRect(x0, 70, COLW, AH - 70) // keep the top plain: other faces sample their colour there
    const m = String(color).match(/\d+/g)?.map(Number) ?? [60, 60, 60]
    const light = (0.299 * (m[0] ?? 0) + 0.587 * (m[1] ?? 0) + 0.114 * (m[2] ?? 0)) / 255 > 0.6
    // the spine is the edge of the cover: take the last few pixels of the cover (the side next to the spine) and stretch them along it
    const cov = spineCovers.get(i)
    const top = Math.round(AH * 0.1)
    if (cov) {
      const sw = Math.max(2, Math.min(10, Math.round(cov.width * 0.08)))
      x.drawImage(cov, cov.width - sw, 0, sw, cov.height, x0, top, COLW, AH - top)
      x.fillStyle = 'rgba(0,0,0,0.32)' // a veil so the name stays readable on any cover
      x.fillRect(x0, top, COLW, AH - top)
    }
    const dark = !cov && light
    x.translate(x0 + COLW / 2, (top + AH) / 2 + 6)
    x.rotate(Math.PI / 2)
    x.font = '700 17px Inter, sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    const room = AH - top - 40
    let t = album.name || ''
    const full = `${album.name}  ·  ${album.artist || ''}`
    if (x.measureText(full).width <= room) t = full // name and artist if there is room, otherwise the name
    while (x.measureText(t).width > room && t.length > 4) t = t.slice(0, -2)
    if (cov) { x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,0.55)'; x.strokeText(t, 0, 1) }
    x.fillStyle = dark ? 'rgba(0,0,0,0.78)' : 'rgba(255,255,255,0.92)'
    x.fillText(t, 0, 1)
    x.restore()
    // worn spine: pale scuffs at the top and bottom ends and along the edges
    x.save()
    x.beginPath(); x.rect(x0, 0, COLW, AH); x.clip()
    const wa = wearAmount(album)
    for (let k = 0; k < Math.round(14 * wa); k++) {
      const top = hash01(album.uri + 'sw' + k) < 0.5
      const yy = top ? AH * 0.1 + hash01(album.uri + 'sy' + k) * 36 : AH - hash01(album.uri + 'sz' + k) * 40
      x.fillStyle = `rgba(235,230,215,${(0.1 + hash01(album.uri + 'sa' + k) * 0.2) * wa})`
      x.fillRect(x0 + hash01(album.uri + 'sx' + k) * (COLW - 6), yy, 2 + hash01(album.uri + 'sl' + k) * 8, 1 + hash01(album.uri + 'sh' + k) * 3)
    }
    x.fillStyle = `rgba(235,230,215,${0.12 * wa})`; x.fillRect(x0, AH * 0.1, 1, AH); x.fillRect(x0 + COLW - 1, AH * 0.1, 1, AH)
    x.restore()
  }

  const recGeo = new THREE.BoxGeometry(THICK, SLEEVE, SLEEVE)
  // flag the spine face (+z = vertices 16..19 of a BoxGeometry) so the shader can map it into the atlas
  const spineFlag = new Float32Array(recGeo.attributes.position.count)
  for (let v = 16; v < 20; v++) spineFlag[v] = 1
  recGeo.setAttribute('spineFace', new THREE.BufferAttribute(spineFlag, 1))
  const colAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RECORDS), 1)
  recGeo.setAttribute('aCol', colAttr)
  const cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RECORDS * 2), 2) // where a record's cover cell sits in the faces atlas (uv)
  recGeo.setAttribute('aCell', cellAttr)
  const faceFlag = new Float32Array(recGeo.attributes.position.count)
  for (let v = 0; v < 4; v++) faceFlag[v] = 1 // +x = the cover face
  recGeo.setAttribute('coverFace', new THREE.BufferAttribute(faceFlag, 1))
  const shelfMat = new THREE.MeshStandardMaterial({ map: atlasTex, roughness: 0.6 })
  shelfMat.onBeforeCompile = (sh) => {
    sh.uniforms.uCols = { value: MAX_RECORDS }
    sh.uniforms.uFaces = { value: facesTex }
    sh.uniforms.uCell = { value: new THREE.Vector2(CELL / facesCanvas.width, CELL / facesCanvas.height) }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', 'attribute float spineFace;\nattribute float aCol;\nattribute float coverFace;\nattribute vec2 aCell;\nuniform float uCols;\nuniform vec2 uCell;\nvarying float vCF;\nvarying vec2 vCUv;\n#include <common>')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
      vCF = coverFace; vCUv = aCell + (uv * 0.96 + 0.02) * uCell;
      vMapUv = spineFace > 0.5 ? vec2((aCol + uv.x) / uCols, uv.y * 0.9) : vec2((aCol + 0.5) / uCols, 0.97);`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', 'uniform sampler2D uFaces;\nvarying float vCF;\nvarying vec2 vCUv;\n#include <common>')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
      vec4 sampledDiffuseColor = vCF > 0.5 ? texture2D(uFaces, vCUv) : texture2D(map, vMapUv);
      diffuseColor *= sampledDiffuseColor;
    #endif`)
  }
  const shelfMesh = new THREE.InstancedMesh(recGeo, shelfMat, MAX_RECORDS)
  shelfMesh.count = 0
  shelfMesh.castShadow = shelfMesh.receiveShadow = true
  shelfMesh.userData = { kind: 'album' }
  shelfMesh.frustumCulled = false
  group.add(shelfMesh)

  let records: ShelfRecord[] = []
  let albumsKey = ''
  const loose = new Map<string, LooseRecord>()
  // guests: albums from search that aren't on the shelf. They fly in through the window (the wall on the
  // right) and leave the same way when put back.
  const guestRecs = new Map<string, ShelfRecord>()
  let guestAlbums: ShelfAlbum[] = []
  let windowHome: THREE.Vector3 | null = null
  function guestHome(): THREE.Vector3 {
    if (!windowHome) {
      group.updateWorldMatrix(true, false)
      windowHome = group.worldToLocal(new THREE.Vector3(3.8, 1.55, 1.75))
    }
    return windowHome
  }
  function recordFor(uri: string): ShelfRecord | null {
    const r = records.find((x) => x.album.uri === uri)
    if (r) return r
    const known = guestRecs.get(uri)
    if (known) return known
    const album = guestAlbums.find((a) => a.uri === uri)
    if (!album) return null
    const g: ShelfRecord = { album, index: -1, guest: true, color: '#3a4352', out: 0, hidden: false, home: guestHome().clone() }
    const thumb = album.thumb || album.image
    if (thumb) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const col = averageColor(img)
        if (!col) return
        g.color = col
        loose.get(uri)?.tint?.(col)
      }
      img.src = thumb
    }
    guestRecs.set(uri, g)
    return g
  }
  // search in the shelf: the matching records slide out
  let filterSet: Set<string> | null = null
  const im = new THREE.Matrix4()
  const iq = new THREE.Quaternion()
  const is = new THREE.Vector3()
  const ipos = new THREE.Vector3()
  const ZERO = new THREE.Vector3(0, 0, 0)

  const ieu = new THREE.Euler(0, 0, 0, 'YXZ')
  function writeInstance(r: ShelfRecord): void {
    if (r.hidden) im.compose(r.home, iq.identity(), ZERO)
    else {
      // a little untidy, like a real shelf: some records stick out, some lean (the last one in a row leans a lot)
      const a = r.lean || 0
      ipos.copy(r.home).setZ(r.home.z + r.out * 0.09 + (r.dz || 0))
      ipos.x += -Math.sin(a) * (SLEEVE / 2) // (turns about the bottom edge, not the middle)
      ipos.y += (Math.cos(a) - 1) * (SLEEVE / 2)
      iq.setFromEuler(ieu.set(0, r.yaw || 0, a))
      im.compose(ipos, iq, is.set(1, 1, 1))
    }
    shelfMesh.setMatrixAt(r.index, im)
    shelfMesh.instanceMatrix.needsUpdate = true
  }

  function setAlbums(albums: ShelfAlbum[]): void {
    const key = albums.map((a) => a.uri).join('|')
    if (key === albumsKey) return
    albumsKey = key
    spineCovers.clear()
    for (const t of coverTex.values()) t.dispose()
    coverTex.clear()
    coverJobs = []
    for (const l of loose.values()) { group.remove(l.mesh); l.free?.() }
    loose.clear()
    // a little air before each new artist (not much – a few millimetres), so the shelf reads in groups
    const GAP = 0.012
    const room = COMPARTMENT.map((c) => c.x1 - c.x0 - 0.01)
    const per = Math.max(14, Math.ceil(Math.min(albums.length, MAX_RECORDS) / 3)) // spread over the top row first, then the bottom row
    const artistOf = (a: ShelfAlbum | undefined): string => String(a?.artist ?? '').split(',')[0]?.trim().toLowerCase() ?? ''
    let comp = 0, cursor = 0, inComp = 0
    const rnd = (seed: string): number => { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } return ((h >>> 0) % 10000) / 10000 }
    const lastOf = new Map<number, ShelfRecord[]>() // compartment -> its records
    records = albums.slice(0, MAX_RECORDS).map((album, i): ShelfRecord => {
      let gap = i > 0 && cursor > 0 && artistOf(album) !== artistOf(albums[i - 1]) ? GAP : 0
      const full = cursor + gap + THICK > (room[comp] ?? 0) + 1e-6 || inComp >= per
      if (full && comp < COMPARTMENT.length - 1) { comp++; cursor = 0; gap = 0; inComp = 0 }
      const off = cursor + gap
      cursor = off + THICK
      inComp++
      const cab = COMPARTMENT[comp] ?? { x0: 0, x1: 0, y: 0 }
      const color = album.color || '#3a4352'
      drawSpine(i, album, color)
      colAttr.setX(i, i)
      cellAttr.setXY(i, (i % CCOLS) * (CELL / facesCanvas.width), 1 - (Math.floor(i / CCOLS) + 1) * (CELL / facesCanvas.height))
      drawFace(i, color, null)
      const r = { album, index: i, color, out: 0, hidden: false, comp, end: off + THICK,
        dz: rnd(album.uri + 'z') < 0.2 ? 0.006 + rnd(album.uri + 'zz') * 0.016 : 0, yaw: (rnd(album.uri + 'y') - 0.5) * 0.05, lean: (rnd(album.uri + 'l') - 0.5) * 0.04,
        home: new THREE.Vector3(cab.x0 + 0.006 + THICK / 2 + off, cab.y + SLEEVE / 2 + 0.001, FRONT_Z - SLEEVE / 2 - 0.012) }
      const sameComp = lastOf.get(comp)
      if (sameComp) sameComp.push(r)
      else lastOf.set(comp, [r])
      writeInstance(r)
      // the cover (300 px) loads in the background: it goes on the spine, colours it if the album has no colour yet, and is
      // kept as a texture so that a record pulled out of the shelf already has its cover on it
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
      const src = (saveData ? album.thumb : album.image) || album.thumb || album.image
      if (src) {
        const job: CoverJob = (img) => {
          if (records[i] !== r) return // the shelf changed meanwhile
          spineCovers.set(i, img)
          if (!album.color) {
            const col = averageColor(img)
            if (col) {
              r.color = col
              const l = loose.get(album.uri)
              if (l) l.tint?.(col)
            }
          }
          drawSpine(i, album, r.color)
          drawFace(i, r.color, img)
          atlasDirty()
          const tex = new THREE.Texture(img)
          tex.colorSpace = THREE.SRGBColorSpace
          tex.anisotropy = 4
          tex.needsUpdate = true
          coverTex.set(album.uri, tex)
        }
        job.src = src
        coverJobs.push(job)
      }
      return r
    })
    // the last records in a row have room to lean: the very last one a lot, the one before it a little
    for (const [c, list] of lastOf) {
      const lastRec = list[list.length - 1]
      if (!lastRec) continue
      const free = (room[c] ?? 0) - (lastRec.end ?? 0)
      if (free < 0.03) continue
      const n = list.length
      const lean = -Math.min(0.42, 0.14 + free * 1.6 + rnd(lastRec.album.uri + 'e') * 0.1)
      lastRec.lean = lean
      const second = list[n - 2], third = list[n - 3]
      if (second) second.lean = lean * 0.45
      if (third && second && rnd(second.album.uri + 'f') < 0.5) third.lean = lean * 0.2
      for (const r of list.slice(-3)) writeInstance(r)
    }
    setTimeout(pumpCovers, 500) // after the first picture is up
    colAttr.needsUpdate = true
    cellAttr.needsUpdate = true
    facesTex.needsUpdate = true
    shelfMesh.count = records.length
    shelfMesh.computeBoundingSphere() // clicks/hover test against it – fit it to the records now on the shelf
    atlasTex.needsUpdate = true
  }

  function makeLoose(r: ShelfRecord): LooseRecord {
    return makeLooseRecord(r, { group, loader, coverTex, models, pageMat, stackSlot, writeInstance })
  }
  function dropLoose(uri: string): void {
    const l = loose.get(uri)
    if (!l) return
    group.remove(l.mesh)
    l.free?.()
    loose.delete(uri)
    if (l.rec.guest) { guestRecs.delete(uri); return }
    l.rec.hidden = false
    writeInstance(l.rec)
  }

  let hoverUri: string | null = null
  let dailyUri: string | null = null // the record of the day: always sticks out a little from the shelf
  let selectedUri: string | null = null
  let playingUri: string | null = null
  let peekUri: string | null = null // browsing the shelf: this record is pulled out, cover to the front
  let playing = false
  let press = 0 // 0..1: the iPod dips a hair when a wheel button is pressed
  let flipSel = false // the held-up record shows its back (the track list)
  let nowKey = ''
  let screenNow: NowPlaying | null = null
  let screenArt: HTMLImageElement | null = null // the cover, loaded for the screen
  let screenAt = 0 // performance.now() when screenNow.progress_ms was current
  let screenDrawn = 0
  function redrawScreen(): void {
    const p = screenNow?.duration_ms
      ? Math.min(screenNow.duration_ms, (screenNow.progress_ms || 0) + (screenNow.playing ? performance.now() - screenAt : 0))
      : 0
    drawIpodScreen(screenCtx, 2048, 1680, screenNow, screenArt, p)
    screenTex.needsUpdate = true
    screenDrawn = performance.now()
  }

  let screenImgSrc: string | null = null, labelSrc: string | null = null
  // ── the record goes from its sleeve to the turntable ──
  let recUri: string | null = null // the album whose record is (about to be) on the turntable
  let recOn = false // settled on the platter
  let recFlight: { t: number; wait: number } | null = null // while it travels (wait: until the sleeve has arrived by the turntable)
  const recEnd = new THREE.Vector3(-0.38 + TT_C.x, TOP_Y + 0.111, 0.24 + TT_C.z) // the platter's centre (group-local)
  const vA = new THREE.Vector3(), vB = new THREE.Vector3()
  const qStart = new THREE.Quaternion(), qId = new THREE.Quaternion()
  const qZ90 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2))
  const easeIO = (k: number): number => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
  function setState({ albums = [], now = null, guests = [], playOn = 'vinyl' }: { albums?: ShelfAlbum[]; now?: NowPlaying | null; guests?: ShelfAlbum[]; playOn?: string }): void {
    setAlbums(albums)
    guestAlbums = guests
    // what is playing belongs either to the turntable (an album) or to the iPod (a playlist, a found song): only that
    // one "plays" – the other stands still
    const onIpod = playOn === 'ipod'
    const vNow = onIpod ? null : now
    playing = !!vNow?.playing
    playingUri = vNow?.context && vNow.context.startsWith('spotify:album:') ? vNow.context : null
    // fall back to matching the album name when the context isn't an album (e.g. a track from it)
    if (!playingUri && vNow?.album) playingUri = albums.find((a) => a.name === vNow.album)?.uri || null
    screenNow = onIpod ? now : null
    screenAt = performance.now()
    const wantRec = vNow?.name && playingUri ? playingUri : null
    if (wantRec !== recUri) { // another record (or none): the platter is bare, and a new disc will come from its sleeve
      recUri = wantRec
      recOn = false
      rec.visible = false
      flyDisc.visible = false
      recFlight = wantRec ? { t: 0, wait: 1.0 } : null
    }
    if (screenNow?.image !== screenImgSrc) {
      screenImgSrc = screenNow?.image || null
      screenArt = null
      if (screenImgSrc) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        const src = screenImgSrc
        img.onload = () => { if (screenImgSrc === src) { screenArt = img; redrawScreen() } }
        img.src = src
      }
    }
    if (vNow?.image && vNow.image !== labelSrc) {
      labelSrc = vNow.image
      loader.load(vNow.image_large || vNow.image, (t) => {
        t.anisotropy = 16
        t.colorSpace = THREE.SRGBColorSpace
        turntable.setDiscLabel(t.image)
        labelMat.map?.dispose()
        labelMat.map = t
        labelMat.color.set(0xffffff)
        labelMat.needsUpdate = true
      }, undefined, () => {})
    }
    const key = `${vNow?.name}|${playing}|${screenNow?.image}|${screenNow?.name}|${screenNow?.playing}`
    if (key !== nowKey) { nowKey = key; redrawScreen() }
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
  let armAngle = 0.45
  // the record turns once per bar (4 beats): a 120 BPM song gives 30 rpm. Unknown tempo = 33⅓ rpm.
  let tempo = 0
  let calm = false // calm mode: the record doesn't turn, nothing drifts or pulses
  let spin = 0 // rad/s, eased so the record winds up and slows down
  const rpmFor = (bpm: number): number => {
    if (!(bpm > 30)) return 33.3
    let b = bpm
    while (b < 84) b *= 2
    while (b > 168) b /= 2
    return Math.min(42, Math.max(24, b / 4))
  }

  function update(dt: number, t: number, camera: THREE.PerspectiveCamera): boolean {
    let moving = false
    if (shelfDirty) { moving = true; shelfDirty = false } // the frame model has just arrived: draw it
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
    armAngle += ((playing ? 0 : 0.45) - armAngle) * Math.min(1, dt * 2) // 0 = the needle on the record, 0.45 = back on its rest
    arm.rotation.y = armAngle
    // the iPod's progress bar moves on once a second while something plays
    if (screenNow?.playing && performance.now() - screenDrawn > 1000) redrawScreen()
    if (updateSound(dt, t, camera, !!screenNow?.playing && !calm)) moving = true
    if (updateDeck(dt, t)) moving = true

    // the disc travels: out of the sleeve, in an arc, down onto the platter
    if (recFlight) {
      const l = recUri ? loose.get(recUri) : undefined
      moving = true
      if (recFlight.wait > 0) recFlight.wait -= dt
      else if (!l) { recFlight = null; recOn = true; rec.visible = true } // no sleeve to come from: it is just there
      else {
        recFlight.t = Math.min(1, recFlight.t + dt / 1.25)
        const k = easeIO(recFlight.t)
        vA.copy(l.mesh.position).add(vB.set(0, 0.05, 0).applyQuaternion(l.mesh.quaternion)) // where the disc sits in the sleeve
        qStart.copy(l.mesh.quaternion).multiply(qZ90)
        flyDisc.position.lerpVectors(vA, recEnd, k)
        flyDisc.position.y += Math.sin(Math.PI * k) * 0.16
        flyDisc.quaternion.slerpQuaternions(qStart, qId, k)
        flyDisc.visible = true
        if (recFlight.t >= 1) { recFlight = null; recOn = true; rec.visible = true; flyDisc.visible = false }
      }
    }

    camera.getWorldDirection(camFwd)
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
    group.getWorldQuaternion(groupQ).invert()

    // records that should be off the shelf get a loose mesh; the rest stay instanced
    for (const uri of [selectedUri, playingUri, peekUri]) {
      if (!uri) continue
      const r = recordFor(uri)
      if (r && !loose.has(uri)) loose.set(uri, makeLoose(r))
      else { const l = loose.get(uri); if (l) l.returning = false }
    }
    for (const [uri, l] of loose) {
      if (uri !== selectedUri && uri !== playingUri && uri !== peekUri) l.returning = true
    }

    // hover: slide the record out a little
    for (const r of records) {
      const target = r.album.uri === hoverUri || filterSet?.has(r.album.uri) || r.album.uri === dailyUri ? 1 : 0
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
      const slot = r.guest ? null : stackSlot(uri)
      const peek = uri === peekUri && uri !== playingUri && !slot && !sel && !l.returning // the album that's playing already lies on the table: browsing past it must not pull it back to the shelf
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
        targetPos.set(0.06, TOP_Y + LEAN_UP, LEAN_Z)
        targetQ.copy(LEAN_Q)
      } else if (slot) {
        // back on the table, in its place in the stack
        targetPos.copy(slot.pos)
        targetQ.copy(slot.q)
      } else {
        targetPos.copy(r.home)
        targetQ.identity()
      }
      // the vinyl slides out of the sleeve a little (held / browsed / playing) and back in
      const wantOut = sel ? 0.056 : peek ? 0.05 : isPlaying ? 0.042 : 0
      if (Math.abs(wantOut - l.disc.position.y) > 0.0004) { l.disc.position.y += (wantOut - l.disc.position.y) * Math.min(1, dt * 5); moving = true }
      // the record that is on the turntable is not in its sleeve any more
      l.disc.visible = !(uri === recUri && (recOn || (recFlight && recFlight.wait <= 0)))
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
      if (l.returning && l.mesh.position.distanceTo(targetPos) < 0.002 && l.mesh.quaternion.angleTo(targetQ) < 0.01) dropLoose(uri)
    }

    // a sleeve from the stack that has been picked up is not in the stack meanwhile
    for (const m of stackGroup.children) m.visible = !loose.has(stack.items()[m.userData.index]?.uri)

    // iPod: it never leaves its stand – a press on the wheel makes it dip a hair
    press = Math.max(0, press - dt * 7)
    halo.material.opacity += ((screenNow?.playing ? 0.2 : 0.09) - halo.material.opacity) * Math.min(1, dt * 2) // (the lit screen glows more while it plays)
    if (Math.abs((screenNow?.playing ? 0.2 : 0.09) - halo.material.opacity) > 0.004) moving = true
    body.rotation.x = -0.18 + press * 0.014
    body.position.y = 0.105 - press * 0.0015
    if (press > 0) moving = true
    return moving
  }

  /** Screen rectangle of the record held up to the camera (for the play button / caption overlay). */
  const boxCorner = new THREE.Vector3()
  function selectedRect(camera: THREE.Camera, width: number, height: number): ScreenRect | null {
    const l = selectedUri ? loose.get(selectedUri) : undefined
    if (!l || l.returning) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let i = 0; i < 8; i++) {
      boxCorner.set(i & 1 ? SLEEVE_T / 2 : -SLEEVE_T / 2, i & 2 ? SLEEVE / 2 : -SLEEVE / 2, i & 4 ? SLEEVE / 2 : -SLEEVE / 2)
      l.mesh.localToWorld(boxCorner).project(camera)
      const x = (boxCorner.x + 1) / 2 * width
      const y = (1 - boxCorner.y) / 2 * height
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }

  /** Where the camera stands to use the iPod on its stand: straight in front of its screen (so the HTML overlay lines up with it),
   *  at a distance that makes the iPod fill ~70 % of the view height (a phone: ~85 % and nearly all of the width). World coordinates. */
  const ipodC = new THREE.Vector3(), ipodN = new THREE.Vector3(), ipodUp = new THREE.Vector3(), ipodQ = new THREE.Quaternion()
  function ipodView(fovDeg: number, aspect: number): { pos: THREE.Vector3; target: THREE.Vector3 } {
    group.updateWorldMatrix(true, true)
    screen.getWorldPosition(ipodC)
    screen.getWorldQuaternion(ipodQ)
    ipodN.set(0, 0, 1).applyQuaternion(ipodQ) // out of the glass
    ipodUp.set(0, 1, 0).applyQuaternion(ipodQ)
    const target = ipodC.clone().addScaledVector(ipodUp, -screen.position.y) // the middle of the whole iPod (the screen sits above it)
    const tanH = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)
    const phone = aspect < 0.9
    const hf = phone ? 0.85 : 0.7
    const wf = phone ? 0.94 : 0.5
    const dist = Math.max(H / (hf * 2 * tanH), W / (wf * 2 * tanH * aspect))
    return { pos: target.clone().addScaledVector(ipodN, dist), target }
  }

  /** The iPod screen's rectangle on screen (CSS px relative to the canvas), for the HTML overlay. */
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  function ipodScreenRect(camera: THREE.Camera, width: number, height: number): ScreenRect {
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
    setHover(uri: string | null) { hoverUri = uri },
    setSelected(uri: string | null) { selectedUri = uri },
    setPeek(uri: string | null) { peekUri = uri },
    setFilter(list: string[] | null | undefined) { filterSet = list?.length ? new Set(list) : null },
    setDeck(v: boolean) { turntable.setDeck(!!v) },
    setFlip(v: boolean) { flipSel = v },
    setCalm(v: boolean) { calm = !!v },
    setDaily(uri: string | null | undefined) { dailyUri = uri ?? null },
    setStack,
    setNext,
    setTempo(bpm: number | string | null | undefined) { tempo = Number(bpm) || 0 },
    isSpinning: () => playing || spin > 0.02,
    /** A wheel button was pressed: the iPod dips a hair. */
    pressIpod() { press = 1 },
    ipodView,
    /** 0 = the needle is on the record, 0.45 = the tonearm rests (the vinyl sounds are timed to it). */
    tonearmAngle: () => armAngle,
    ipodScreenRect,
    selectedRect,
    update,
  }
}
