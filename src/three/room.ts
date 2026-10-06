import { accent, onAccent, setAccent3d } from './accent'
import { makeGltfLoader } from './gltf'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import type { Album, NowPlaying, Playlist } from '../types'
import type { Book, Guitar, Project, Trip } from '@/composables/site/useData'
import type { DecorItem } from '@/composables/room/useDecor'
import type { GfxMode, GfxValues } from '@/composables/ui/useGraphics'
import type { JpAnime, JpWord } from '@/composables/japan/useJapanese'
import type { RoomHover } from '@/composables/room/useRoom'
import type { TimerState } from '@/composables/site/useTimer'
import { buildGuitar } from './guitar'
import { prepareGuitarModel } from './guitarModel'
import { buildBookshelf } from './books'
import { buildDesk } from './desk'
import { buildGlobeTable } from './globe'
import { buildPracticeCorner } from './practice'
import { buildJapanCorner } from './japan'
import { buildListeningCorner, type StackEntry } from './listening'
import type { SteamScreenData } from './desk'
import { buildFigureShelf } from './figures'
import { woodFloor, wallTexture, skyTexture, canvasTex } from './textures'
import { atlasName, norskNavn } from './countries'

// ── Layout (metres). Room spans x -4..4, z -3.5..3.5, open towards +z. ──
const GLOBE_POS = new THREE.Vector3(0.12, 0, -2.95) // back wall, between the bookshelf and the desk
const GLOBE_VIEW_DIR = new THREE.Vector3(0.18, 0.34, 0.92).normalize()
const PORTRAIT = new THREE.Vector3(3.97, 1.62, -1.1)
const GUITAR_Z = -0.45

type Vec3 = [number, number, number]
/** Where the camera stands and what it looks at. */
interface Pose { pos: Vec3; target: Vec3 }
const STATIONS: Record<string, Pose | null> = {
  hjem: { pos: [0.6, 7.4, 15.2], target: [0, 0.5, -0.3] },
  gitar: { pos: [-0.75, 1.35, GUITAR_Z], target: [-4, 1.2, GUITAR_Z] },
  figurer: { pos: [0.4, 1.6, -1.75], target: [0.4, 1.5, -3.5] },
  boker: { pos: [-1.6, 1.5, -0.45], target: [-1.6, 1.45, -3.5] },
  kode: { pos: [2.0, 1.36, -1.25], target: [2.0, 1.08, -3.4] },
  reiser: null, // computed from globe position
  om: { pos: [1.45, 1.62, PORTRAIT.z], target: [4, 1.62, PORTRAIT.z] },
  ovelse: { pos: [-0.55, 1.55, 2.0], target: [-4, 1.4, 2.0] },
  lytte: { pos: [-0.35, 1.7, 0.95], target: [3.7, 0.55, 0.95] },
  japansk: { pos: [-0.9, 1.5, 4.85], target: [-1.2, 0.28, 2.8] },
  // the desk again, from the left and a little lower: the gamepad in front, Steam on the monitor
  gaming: { pos: [1.3, 1.22, -1.75], target: [2.05, 1.0, -3.25] },
}
// the listening corner while music plays: closer, from above at an angle – the turntable and the
// sleeve beside it in focus, the record shelf still visible underneath
const LYTTE_TOP: Pose = { pos: [2.55, 1.7, -0.2], target: [3.72, 0.75, -0.12] }
// a playlist playing: looking at the iPod back on its stand on the sideboard by the turntable (its screen shows the song)
// in front of the record shelf (under the turntable), to browse the spines
// from straight above: the turntable's buttons and the tonearm can be pressed
const LYTTE_DECK: Pose = { pos: [3.47, 1.5, -0.28], target: [3.71, 0.88, -0.28] }
const LYTTE_SHELF: Pose = { pos: [1.9, 0.95, 0.1], target: [3.6, 0.45, 0.1] }
// (the iPod pose is worked out from the iPod itself and the shape of the screen: see listening.ipodView)

export const STATION_LABELS: Record<string, string> = { gaming: 'Gaming', japansk: 'Japansk', lytte: 'Lytteplassen', ovelse: 'Øvingstimer', gitar: 'Gitarer', boker: 'Bokhylla', kode: 'Prosjekter', reiser: 'Reiser', om: 'Om meg', figurer: 'Figurer' }

/** The look of the room by day and by night. */
interface Theme {
  bg: number; wall: number; floor: number; hemi: number; sun: number; sunColor: number; lamp: number; env: number
  bloom: number; threshold: number; exposure: number; window: number; windowColor: number; screen: number; night: boolean
}
type ThemeName = 'light' | 'dark'
const THEMES: Record<ThemeName, Theme> = {
  light: { bg: 0xe9f1fa, wall: 0xe9eef5, floor: 0xffffff, hemi: 0.45, sun: 3.2, sunColor: 0xfff1dc, lamp: 0.3, env: 1.0, bloom: 0.35, threshold: 1.6, exposure: 1.25, window: 6, windowColor: 0xfff4e6, screen: 0.6, night: false },
  dark: { bg: 0x060a12, wall: 0x8e9bb0, floor: 0x7d746c, hemi: 0.1, sun: 0.55, threshold: 0.9, window: 1.2, windowColor: 0x9fc0ff, screen: 2.2, sunColor: 0x9fc0ff, lamp: 5.5, env: 0.55, bloom: 0.95, exposure: 1.1, night: true },
}

const easeInOut = (k: number): number => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

/** What a click in the room reports to the page. */
export interface PickEvent { station: string; kind: string; index?: number; name?: string; uri?: string; album?: StackEntry; then?: PickEvent /* a click from free roam: go to the station, then do this */ }
export interface RoomCallbacks {
  onPick?: (p: PickEvent) => void
  onHover?: (h: RoomHover | null) => void
  onReady?: () => void
  timerState?: () => TimerState
  onDecorChange?: (list: DecorItem[]) => void
  onDecorSelect?: (id: string | null) => void
}
/** What the room needs to know about the site's data. */
export interface RoomData { gitarer?: Guitar[]; boker?: Book[]; reiser?: Trip[]; prosjekter?: Project[]; om?: { bilde?: string | null }; site?: { navn?: string } }
/** The graphics settings as the room is told them (see useGraphics). */
export type GfxInput = Partial<Omit<GfxValues, 'res' | 'ao'>> & { mode?: GfxMode; res?: number | 'auto'; ao?: GfxValues['ao'] | 'auto'; showFps?: boolean }
interface Eff extends Omit<GfxValues, 'res' | 'ao'> { res: number | 'auto'; ao: GfxValues['ao'] | 'auto'; showFps: boolean; areaLights: boolean; smallLights: boolean }
/** One of my uploaded 3D models in the room. */
interface DecorObject { root: THREE.Group; item: DecorItem }
/** What the pointer rests on, found by raycasting. */
interface HitInfo { object: THREE.Object3D; kind?: string; index?: number; station?: string; country?: string }
interface Flight { from: Pose3; to: Pose3; t: number; dur: number; lift: number }
interface Pose3 { pos: THREE.Vector3; target: THREE.Vector3 }
interface GuitarEntry { holder: THREE.Group; model: THREE.Object3D; hook: THREE.Mesh; home: THREE.Vector3; vel: THREE.Vector3; rot: number; strum: number }
type LyttePose = 'top' | 'topipod' | 'shelf' | 'ipod' | 'deck'

export function createRoom(host: HTMLElement, { onPick, onHover, onReady, timerState, onDecorChange, onDecorSelect }: RoomCallbacks = {}) {
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const deviceReduced = reduced

  // ── Renderer ───────────────────────────────────────────
  // "low" on phones / weak machines: lower resolution and less MSAA.
  // "ultra" in the desktop app (window.nibenApp): full Retina sharpness, sharper shadows, finer reflections.
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const inApp = !!window.nibenApp
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
  renderer.info.autoReset = false // (the counters are reset by hand once a frame, so they add up over all the passes)
  // What is this running on? Look at the graphics chip, the CPU cores, the memory and the screen, and pick a
  // starting quality; while it runs, the frame time moves it up or down (see "Adaptive quality" below).
  const spec = (() => {
    let gpu = ''
    try {
      const gl = renderer.getContext()
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '').toLowerCase()
    } catch { /* no way to ask: judge by the cores and memory */ }
    const cores = navigator.hardwareConcurrency || 4
    const mem = navigator.deviceMemory || 0 // GB (Chromium only)
    const software = /swiftshader|llvmpipe|software|basic render|softpipe/.test(gpu)
    const strongGpu = /apple m\d|rtx|gtx 1[06]|gtx 9|radeon rx|radeon pro|arc a|nvidia|geforce|apple gpu/.test(gpu) && !/mali|adreno|powervr/.test(gpu)
    const weakGpu = /intel(?!.*arc).*(hd|uhd|iris|xe)|mali-[gt][1-6]\d\b|adreno \(?[1-5]\d\d\b|powervr|sgx|vivante|llvmpipe/.test(gpu)
    // a score from 0 (very weak) to 10
    let score = 5
    if (strongGpu) score += 3
    if (weakGpu) score -= 2
    if (cores >= 8) score += 1
    else if (cores <= 4) score -= 1
    if (mem && mem <= 2) score -= 2
    if (coarse && !strongGpu) score -= 1
    if (window.devicePixelRatio > 2.5 && !strongGpu) score -= 1 // lots of pixels, no muscle
    if (weakGpu) score = Math.min(score, 3) // a weak chip stays in the low class however many cores the CPU has
    if (software) score = 0
    score = Math.max(0, Math.min(10, score))
    return { gpu, cores, mem, score, software }
  })()
  const quality = inApp || spec.score >= 8 ? 'ultra' : spec.score >= 4 ? 'high' : 'low'
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.autoUpdate = false // redrawn only when something moves
  renderer.shadowMap.type = inApp ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap // app: softer penumbra
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const baseEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = baseEnv

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 60)
  camera.position.set(0.8, 9.5, 19)
  const lookAt = new THREE.Vector3(0, 1, -1)

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: quality === 'low' ? 2 : quality === 'ultra' ? Math.min(8, renderer.capabilities.maxSamples || 4) : 4,
  }))
  composer.addPass(new RenderPass(scene, camera))
  // Heavy shaders (ambient occlusion, light shafts, lamp shadows, full-size bloom) are on by themselves only in the
  // downloaded app – the web version stays light. Every one of them can be switched on / off in Innstillinger → Grafikk.
  const fancy = inApp
  const maxMsaa = renderer.capabilities.maxSamples || 4
  const maxTex = renderer.capabilities.maxTextureSize || 4096
  // what "Auto" means for this device (the user's own choices override any of these)
  const autoGfx = (): Eff => ({
    res: 'auto', fps: quality === 'low' ? 30 : 0, // (a weak machine moves at 30 fps at most – it rests the rest of the time)
    msaa: quality === 'low' ? 2 : 4, // 8× MSAA on a half-float target costs a lot and shows little – still available in the settings
    shadows: quality === 'ultra' ? 4096 : quality === 'low' ? 0 : 2048, // low: no shadow map at all – soft contact shadows on the floor instead
    soft: inApp, lamp: false, ao: fancy ? 'auto' : 'off', shafts: fancy, bloom: quality === 'low' ? 'off' : 'half', bloomMul: 1,
    vignette: true, reflections: quality === 'ultra' ? 512 : quality === 'high' ? 256 : 128,
    weather: true, ambient: true, exposure: 1, showFps: false,
    areaLights: quality !== 'low', smallLights: quality !== 'low', // area lights (window, LED strip) and the tiny point lights are the dearest to light with
  })
  let eff = autoGfx()
  let gfxIn: GfxInput | null = null // what the user chose in the settings (or null)
  let ao: GTAOPass | null = null
  let aoLoading = false
  function ensureAO(): void {
    if (ao || aoLoading) return
    aoLoading = true
    void import('three/examples/jsm/postprocessing/GTAOPass.js').then(({ GTAOPass: Pass }) => {
      const pass = new Pass(scene, camera, 256, 256)
      ao = pass
      pass.output = Pass.OUTPUT.Default
      composer.insertPass(pass, 1)
      applyGfx(gfxIn)
      resize()
      invalidate(0.5)
    })
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 0.88)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const vignette = new ShaderPass(VignetteShader)
  vignette.uniforms.offset.value = 1.0
  vignette.uniforms.darkness.value = 0.9
  composer.addPass(vignette)

  // ── Materials ──────────────────────────────────────────
  const wallTex = wallTexture()
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f4f8, map: wallTex, bumpMap: wallTex, bumpScale: 0.6, roughness: 0.9 })
  const floorTex = woodFloor()
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, bumpMap: floorTex, bumpScale: 0.8, roughness: 0.38 })
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ef, roughness: 0.8 })

  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene, shadow = true): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = shadow
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  // ── Shell: floor slab + walls (diorama cut-away) ───────────
  const slab = new THREE.Mesh(new THREE.BoxGeometry(8.3, 0.22, 7.15), [sideMat, sideMat, floorMat, sideMat, sideMat, sideMat])
  slab.position.set(0, -0.11, -0.075)
  slab.receiveShadow = true
  scene.add(slab)

  box(8.3, 3.2, 0.15, wallMat, 0, 1.6, -3.575)                     // back
  box(0.15, 3.2, 7.15, wallMat, -4.075, 1.6, -0.075)               // left
  // right wall with a window (z 1.0..2.4, y 0.9..2.3)
  box(0.15, 3.2, 4.65, wallMat, 4.075, 1.6, -1.325)
  box(0.15, 3.2, 1.1, wallMat, 4.075, 1.6, 2.95)
  box(0.15, 0.9, 1.4, wallMat, 4.075, 0.45, 1.7)
  box(0.15, 0.9, 1.4, wallMat, 4.075, 2.75, 1.7)
  // window frame + mullions
  box(0.06, 0.05, 1.44, trimMat, 4.0, 0.9, 1.7)
  box(0.18, 0.04, 1.5, trimMat, 3.98, 0.88, 1.7)                    // sill
  box(0.06, 0.05, 1.44, trimMat, 4.0, 2.3, 1.7)
  box(0.06, 1.44, 0.05, trimMat, 4.0, 1.6, 1.0)
  box(0.06, 1.44, 0.05, trimMat, 4.0, 1.6, 2.4)
  box(0.04, 1.4, 0.03, trimMat, 4.03, 1.6, 1.7)
  box(0.04, 0.03, 1.4, trimMat, 4.03, 1.6, 1.7)
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTexture(false), toneMapped: false })
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), skyMat)
  sky.position.set(4.2, 1.6, 1.7)
  sky.rotation.y = -Math.PI / 2
  scene.add(sky)
  // ── light shafts from the window (ultra only): a soft, dusty volume along the sun's direction ──
  const shaftU = { uTime: { value: 0 }, uStrength: { value: 0 }, uColor: { value: new THREE.Color(0xfff1dc) } }
  let shafts: THREE.Mesh | null = null
  function buildShafts(): void {
    if (shafts) return
    const dir = new THREE.Vector3(-10, -5.2, -3.2).normalize()
    const L = 6.5
    const c = ([[0.9, 2.3, 1.0], [0.9, 0.9, 1.0], [0.9, 0.9, 2.4], [0.9, 2.3, 2.4]] as Vec3[]).map(([, y, z]) => new THREE.Vector3(3.95, y, z))
    const far = c.map((v) => v.clone().addScaledVector(dir, L))
    const pos: number[] = [], uv: number[] = []
    const tri = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, ua: number, ub: number, ud: number): void => { pos.push(...a.toArray(), ...b.toArray(), ...d.toArray()); uv.push(ua, ub, ud) }
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      tri(c[i], c[j], far[j], 0, 0, 1); tri(c[i], far[j], far[i], 0, 1, 1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('along', new THREE.Float32BufferAttribute(uv, 1))
    g.computeVertexNormals()
    const m = new THREE.ShaderMaterial({
      uniforms: shaftU, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: `varying float vA; varying vec3 vW; varying vec3 vN;
        attribute float along;
        void main(){ vA = along; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; uniform float uStrength; uniform vec3 uColor;
        varying float vA; varying vec3 vW; varying vec3 vN;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
        float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
        void main(){
          vec3 V = normalize(cameraPosition - vW);
          float edge = pow(abs(dot(normalize(vN), V)), 1.6);          // soft sides, no hard silhouette
          float fade = pow(1. - vA, 1.4) * smoothstep(0., .06, vA);   // fades with distance from the window
          float dust = .55 + .45 * n(vW*2.2 + vec3(uTime*.05, uTime*.03, 0.));
          dust *= .75 + .25 * n(vW*7. - vec3(0., uTime*.08, 0.));
          gl_FragColor = vec4(uColor * uStrength * edge * fade * dust, 1.);
        }`,
    })
    shafts = new THREE.Mesh(g, m)
    shafts.frustumCulled = false
    shafts.renderOrder = 5
    shafts.visible = false
    scene.add(shafts)
    applyWeatherLight()
  }
  // ── weather outside the window: rain / snow falling in front of the sky, lightning, grey clouds ──
  let weather: { kind: string; day?: boolean } = { kind: 'clear', day: true }
  const RAIN_N = 110
  const wp = new Float32Array(RAIN_N * 6)
  const wseed = Array.from({ length: RAIN_N }, () => ({ z: 1.02 + Math.random() * 1.36, x: 4.06 + Math.random() * 0.12, y: 0.92 + Math.random() * 1.38, v: 0.8 + Math.random() * 0.8 }))
  const rainGeo = new THREE.BufferGeometry()
  rainGeo.setAttribute('position', new THREE.BufferAttribute(wp, 3))
  const rainMat = new THREE.LineBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.55 })
  const rain = new THREE.LineSegments(rainGeo, rainMat)
  rain.frustumCulled = false
  rain.visible = false
  scene.add(rain)
  const snowGeo = new THREE.BufferGeometry()
  const sp = new Float32Array(RAIN_N * 3)
  snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.02, transparent: true, opacity: 0.95, sizeAttenuation: true }))
  snow.frustumCulled = false
  snow.visible = false
  scene.add(snow)
  let flash = 0
  function stepWeather(dt: number, t: number): boolean {
    if (!eff.weather) { rain.visible = false; snow.visible = false; return false }
    const k = weather.kind
    const raining = k === 'rain' || k === 'drizzle' || k === 'thunder'
    rain.visible = raining
    snow.visible = k === 'snow'
    if (raining) {
      const speed = k === 'drizzle' ? 1.6 : 3.2
      for (let i = 0; i < RAIN_N; i++) {
        const d = wseed[i]
        if (!d) continue
        d.y -= d.v * speed * dt
        if (d.y < 0.9) { d.y = 2.3; d.z = 1.02 + Math.random() * 1.36 }
        wp.set([d.x, d.y, d.z, d.x, d.y + 0.1, d.z + 0.012], i * 6)
      }
      rainGeo.attributes.position.needsUpdate = true
    } else if (k === 'snow') {
      for (let i = 0; i < RAIN_N; i++) {
        const d = wseed[i]
        if (!d) continue
        d.y -= d.v * 0.28 * dt
        if (d.y < 0.9) { d.y = 2.3; d.z = 1.02 + Math.random() * 1.36 }
        sp.set([d.x, d.y, d.z + Math.sin(t * 0.8 + i) * 0.03], i * 3)
      }
      snowGeo.attributes.position.needsUpdate = true
    }
    // lightning: a short bright flash through the window
    if (k === 'thunder') {
      if (flash <= 0 && Math.random() < dt * 0.12) flash = 0.18
    }
    if (flash > 0) { flash -= dt; windowLight.intensity = THEMES[themeName].window * 3 + 8 * Math.max(0, flash / 0.18); skyMat.color.setScalar(1 + flash * 6); if (flash <= 0) { applyWeatherLight(); skyMat.color.setScalar(1) } }
    return raining || k === 'snow' || flash > 0
  }
  // baseboards
  box(8.0, 0.08, 0.02, trimMat, 0, 0.04, -3.49, scene, false)
  box(0.02, 0.08, 7.0, trimMat, -3.99, 0.04, 0, scene, false)
  box(0.02, 0.08, 4.5, trimMat, 3.99, 0.04, -1.25, scene, false)

  // rug
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.012, 96), new THREE.MeshStandardMaterial({ color: 0xcfdcec, roughness: 1 }))
  rug.scale.set(1.25, 1, 0.85)
  rug.position.set(0.1, 0.006, 0.55)
  rug.receiveShadow = true
  scene.add(rug)
  const rugRing = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.012, 8, 128), new THREE.MeshStandardMaterial({ color: 0x9ec2e6, roughness: 1 }))
  rugRing.rotation.x = Math.PI / 2
  rugRing.scale.set(1.25, 0.85, 1)
  rugRing.position.set(0.1, 0.013, 0.55)
  scene.add(rugRing)


  // floor lamp (arc lamp in the front-left corner)
  const lampGroup = new THREE.Group()
  lampGroup.position.set(-3.45, 0, -3.05)
  lampGroup.rotation.y = -Math.PI / 2
  scene.add(lampGroup)
  const lampMetal = new THREE.MeshStandardMaterial({ color: 0x1f242c, roughness: 0.4, metalness: 0.6 })
  box(0.32, 0.03, 0.32, lampMetal, 0, 0.015, 0, lampGroup)
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.014, 8, 64, Math.PI / 2), lampMetal)
  arc.position.set(0.9, 1.0, 0)
  arc.rotation.z = Math.PI / 2
  lampGroup.add(arc)
  box(0.028, 1.0, 0.028, lampMetal, 0, 0.5, 0, lampGroup)
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.18, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf6f3ee, roughness: 0.4, side: THREE.DoubleSide }))
  shade.position.set(0.9, 1.88, 0)
  shade.castShadow = true
  lampGroup.add(shade)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 2), toneMapped: false }))
  bulb.position.set(0.9, 1.84, 0)
  lampGroup.add(bulb)
  const lampLight = new THREE.PointLight(0xffd7a8, 0.4, 7, 1.6)
  lampLight.position.set(0.9, 1.78, 0)
  lampGroup.add(lampLight)
  lampLight.shadow.mapSize.set(1024, 1024) // (switched on by the graphics settings)
  lampLight.shadow.bias = -0.002
  lampLight.shadow.radius = 4

  // corner plant
  const plant = new THREE.Group()
  plant.position.set(3.55, 0, -3.15)
  scene.add(plant)
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.42, 32), new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.6 }))
  pot.position.y = 0.21
  pot.castShadow = true
  plant.add(pot)
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f9a62, roughness: 0.55, side: THREE.DoubleSide })
  for (let i = 0; i < 14; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), leafMat)
    const a = i * 2.4
    const h = 0.55 + (i % 5) * 0.16
    leaf.position.set(Math.cos(a) * 0.18, h, Math.sin(a) * 0.18)
    leaf.scale.set(0.45, 1.25, 0.12)
    leaf.rotation.set(Math.sin(a) * 0.7, a, Math.cos(a) * 0.7)
    leaf.castShadow = true
    plant.add(leaf)
  }

  // ── Lights ─────────────────────────────────────────────
  const hemi = new THREE.HemisphereLight(0xe8f3ff, 0xd8c3a5, 1.15)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.4)
  sun.position.set(10, 5.2, 3.2)
  sun.target.position.set(0, 0, 0)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048) // (the size follows the graphics settings)
  sun.shadow.radius = 3
  sun.shadow.camera.left = -6
  sun.shadow.camera.right = 6
  sun.shadow.camera.top = 5
  sun.shadow.camera.bottom = -5
  sun.shadow.camera.far = 25
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  scene.add(sun, sun.target)
  RectAreaLightUniformsLib.init()
  const windowLight = new THREE.RectAreaLight(0xfff4e6, 6, 1.4, 1.4)
  windowLight.position.set(3.97, 1.6, 1.7)
  windowLight.lookAt(0, 1.2, 1.7)
  scene.add(windowLight)
  const fill = new THREE.DirectionalLight(0xdfeeff, 0.6)
  fill.position.set(-2, 4, 8)
  scene.add(fill)

  // ── Stations ───────────────────────────────────────────
  const interactive: THREE.Object3D[] = []
  const tag = <T extends THREE.Object3D>(obj: T, station: string): T => { obj.userData.station = station; interactive.push(obj); return obj }

  // Guitars
  const guitarRoot = tag(new THREE.Group(), 'gitar')
  scene.add(guitarRoot)
  let guitars: GuitarEntry[] = []
  let selGuitar = -1
  let hoverGuitar = -1
  const hookMat = new THREE.MeshStandardMaterial({ color: 0xd7b56d, metalness: 1, roughness: 0.3 })

  const gltfLoader = makeGltfLoader()
  const gltfCache = new Map<string, Promise<GLTF>>()
  const loadModel = (url: string): Promise<GLTF> => {
    let p = gltfCache.get(url)
    if (!p) { p = gltfLoader.loadAsync(url); gltfCache.set(url, p) }
    return p
  }

  function buildGuitars(list: Guitar[]): void {
    guitars.forEach((g) => guitarRoot.remove(g.holder, g.hook))
    guitars = []
    const n = list.length
    const spacing = Math.min(0.85, 3.2 / Math.max(1, n))
    list.forEach((spec, i) => {
      // procedural guitar first; swapped for the real model once it has loaded
      const model = buildGuitar(spec)
      model.scale.setScalar(0.095)
      model.rotation.y = Math.PI / 2
      model.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true } })
      const holder = new THREE.Group()
      const z = GUITAR_Z - (i - (n - 1) / 2) * spacing
      const home = new THREE.Vector3(-3.9, 1.22, z)
      holder.position.copy(home)
      holder.add(model)
      holder.userData = { kind: 'guitar', index: i }
      guitarRoot.add(holder)
      const hook = box(0.08, 0.025, 0.06, hookMat, -3.97, 1.78, z, guitarRoot)
      const entry: GuitarEntry = { holder, model, hook, home, vel: new THREE.Vector3(), rot: 0, strum: 0 }
      guitars.push(entry)
      if (spec.modell) {
        loadModel(spec.modell).then((gltf) => {
          if (!guitars.includes(entry)) return
          const real = prepareGuitarModel(gltf.scene, spec)
          real.rotation.y = Math.PI / 2
          holder.remove(entry.model)
          holder.add(real)
          entry.model = real
          shadowsDirty = true
          scheduleEnvCapture(600)
        }).catch((e) => console.warn('Kunne ikke laste gitarmodell', spec.modell, e))
      }
    })
  }

  // Bookshelf
  const shelf = buildBookshelf()
  shelf.group.position.set(-1.6, 0, -3.5)
  tag(shelf.group, 'boker')
  scene.add(shelf.group)

  // Desk
  const desk = buildDesk()
  desk.group.position.set(2.0, 0, -3.1)
  tag(desk.group, 'kode')
  tag(desk.pad, 'gaming')
  scene.add(desk.group)

  // Globe
  const globeTable = buildGlobeTable()
  globeTable.group.position.copy(GLOBE_POS)
  globeTable.stand.rotation.y = Math.atan2(GLOBE_VIEW_DIR.x, GLOBE_VIEW_DIR.z)
  tag(globeTable.group, 'reiser')
  scene.add(globeTable.group)
  const globeCentre = GLOBE_POS.clone().setY(globeTable.centerY)
  STATIONS.reiser = {
    pos: globeCentre.clone().addScaledVector(GLOBE_VIEW_DIR, 1.35).toArray(),
    target: globeCentre.clone().add(new THREE.Vector3(0, 0.02, 0)).toArray(),
  }

  // Portrait
  const portrait = tag(new THREE.Group(), 'om')
  portrait.position.copy(PORTRAIT)
  portrait.rotation.y = -Math.PI / 2
  scene.add(portrait)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1d2128, roughness: 0.4, metalness: 0.2 })
  box(0.8, 1.0, 0.04, frameMat, 0, 0, 0, portrait)
  box(0.7, 0.9, 0.01, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), 0, 0, 0.022, portrait)
  const photoMat = new THREE.MeshStandardMaterial({ roughness: 0.5 })
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.74), photoMat)
  photo.position.z = 0.03
  portrait.add(photo)
  const picLight = box(0.3, 0.025, 0.04, frameMat, 0, 0.58, 0.07, portrait)
  picLight.castShadow = false
  const spot = new THREE.SpotLight(0xfff0dd, 1, 2.2, 0.75, 0.7, 1.2)
  spot.position.set(PORTRAIT.x - 0.25, PORTRAIT.y + 0.7, PORTRAIT.z)
  spot.target.position.copy(PORTRAIT)
  scene.add(spot, spot.target)

  // Listening corner (Spotify) on the back wall between the bookshelf and the desk
  const listening = buildListeningCorner()
  // sofa corner along the right wall: sideboard/record shelf under the portrait, sofa under the window
  listening.group.position.set(3.95, 0, 0.1)
  listening.group.rotation.y = -Math.PI / 2
  tag(listening.group, 'lytte')
  scene.add(listening.group)

  // a display shelf with Star Wars and anime figures on the back wall, between the bookshelf and the desk
  const figures = buildFigureShelf()
  figures.group.position.set(0.38, 1.28, -3.5)
  tag(figures.group, 'figurer')
  scene.add(figures.group)
  interface MusicState { albums: Album[]; playlists: Playlist[]; now: NowPlaying | null; guests?: Album[]; playOn?: string }
  let music: MusicState = { albums: [], playlists: [], now: null }
  let stack: StackEntry[] = [] // the records on the table (see setStack)
  let animeList: JpAnime[] = [] // the Japanese corner's DVDs (from jpdb)

  // Practice corner with the interval clock
  const practice = buildPracticeCorner()
  tag(practice.group, 'ovelse')
  scene.add(practice.group)

  // Japanese corner (jpdb): low table on a tatami mat at the front, left of the rug
  const japan = buildJapanCorner(() => invalidate(0.3))
  japan.group.position.set(-1.2, 0, 2.85)
  japan.group.rotation.y = 0.12
  tag(japan.group, 'japansk')
  scene.add(japan.group)
  let timerInterval = 10

  // Soft contact shadows on the floor under each corner – what stands in for the shadow map on a weak machine
  const contact = new THREE.Group()
  contact.name = 'contactShadows'
  {
    const tex = canvasTex(128, 128, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.55, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)')
      x.fillStyle = g; x.fillRect(0, 0, w, h)
    })
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })
    const b = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3()
    scene.updateMatrixWorld(true)
    for (const o of interactive) {
      if (o.userData.station === 'om') continue
      b.setFromObject(o)
      if (b.isEmpty() || b.min.y > 0.4) continue
      b.getSize(size); b.getCenter(mid)
      if (size.x * size.z > 40 || size.x * size.z < 0.05) continue
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
      m.rotation.x = -Math.PI / 2
      m.position.set(mid.x, 0.006, mid.z)
      m.scale.set(size.x * 1.3 + 0.2, size.z * 1.3 + 0.2, 1)
      m.renderOrder = -1
      m.userData.noCull = true
      contact.add(m)
    }
  }
  scene.add(contact)

  function setPortrait(om: RoomData['om'], navn: string | undefined): void {
    const initial = (navn || 'n').trim()[0]?.toUpperCase() || 'N'
    photoMat.map?.dispose()
    photoMat.map = canvasTex(560, 740, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, h)
      g.addColorStop(0, '#bfe6ff')
      g.addColorStop(1, '#2b8cff')
      x.fillStyle = g
      x.fillRect(0, 0, w, h)
      x.fillStyle = 'rgba(255,255,255,0.18)'
      x.beginPath(); x.arc(w * 0.8, h * 0.15, 160, 0, Math.PI * 2); x.fill()
      x.beginPath(); x.arc(w * 0.1, h * 0.9, 220, 0, Math.PI * 2); x.fill()
      // simple silhouette
      x.fillStyle = 'rgba(255,255,255,0.9)'
      x.beginPath(); x.arc(w / 2, h * 0.4, 105, 0, Math.PI * 2); x.fill()
      x.beginPath(); x.ellipse(w / 2, h * 0.92, 210, 190, 0, Math.PI, 0); x.fill()
      x.fillStyle = '#2b8cff'
      x.font = '800 120px "Inter Tight", Inter, sans-serif'
      x.textAlign = 'center'
      x.textBaseline = 'middle'
      x.fillText(initial, w / 2, h * 0.41)
    })
    photoMat.needsUpdate = true
    if (om?.bilde) {
      new THREE.TextureLoader().load(om.bilde, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        // cover-fit the photo into 0.56 x 0.74
        const img = tex.image as { width: number; height: number }
        const ia = img.width / img.height
        const fa = 0.56 / 0.74
        if (ia > fa) { tex.repeat.set(fa / ia, 1); tex.offset.set((1 - fa / ia) / 2, 0) }
        else { tex.repeat.set(1, ia / fa); tex.offset.set(0, (1 - ia / fa) / 2) }
        photoMat.map?.dispose()
        photoMat.map = tex
        photoMat.needsUpdate = true
      })
    }
  }

  // ── Camera flight ──────────────────────────────────────
  let station = 'hjem'
  let flight: Flight | null = null
  const camPos = new THREE.Vector3().copy(camera.position)
  const camTarget = lookAt.clone()

  let homeFit = 1 // distance of the overview camera relative to the standard (RoomLayout works it out from the panel)
  let lyttePose: LyttePose | null = null // null (sofa view) | 'top' (turntable) | 'shelf' (record shelf) | 'ipod' (iPod on its stand)
  function goTo(name: string, { instant = false, duration }: { instant?: boolean; duration?: number } = {}): void {
    if (name === 'admin') return // the admin covers the room: the camera stays where it is (and the X in the admin goes back to it)
    invalidate(0.5)
    stationBoxes.clear(); tinies = null // (the models may have been loaded since)
    station = STATIONS[name] ? name : 'hjem'
    zoomTarget = 1 // the zoom is for the globe only
    desk.setScreenMode(station === 'gaming' ? 'gaming' : 'code')
    let to: Pose3 | null = null
    if (station === 'lytte' && (lyttePose === 'ipod' || lyttePose === 'topipod')) {
      // the iPod stays on its stand: the camera comes to it (the lens on a narrow screen pushes the camera back by distK, so start nearer)
      const v = listening.ipodView(camera.fov, camera.aspect)
      // a phone: the iPod has to fit between the bar on top and the one at the bottom – not under them
      const fill = camera.aspect < 0.9 ? Math.max(0.45, Math.min(1, (host.clientHeight - bars.top - bars.bottom) / Math.max(1, host.clientHeight))) : 1
      const near = { pos: v.target.clone().add(v.pos.sub(v.target).divideScalar(distK * fill)), target: v.target }
      if (lyttePose === 'ipod') to = near
      else {
        // "Spiller nå" while a playlist plays on the iPod: the table as before, but turned and moved towards the iPod so it is a main part of the picture
        const top = { pos: new THREE.Vector3(...LYTTE_TOP.pos), target: new THREE.Vector3(...LYTTE_TOP.target) }
        to = { pos: top.pos.lerp(near.pos, 0.55), target: top.target.lerp(near.target, 0.7) }
      }
    } else {
      const s: Pose | null | undefined = station === 'lytte' && lyttePose ? { shelf: LYTTE_SHELF, top: LYTTE_TOP, deck: LYTTE_DECK }[lyttePose as 'shelf' | 'top' | 'deck'] : STATIONS[station]
      if (!s) return
      to = { pos: new THREE.Vector3(...s.pos), target: new THREE.Vector3(...s.target) }
      if (station === 'hjem' && homeFit !== 1) to.pos.sub(to.target).multiplyScalar(homeFit).add(to.target) // (the overview: nearer or farther so the room fills the space the panel leaves)
    }
    if (instant || reduced) {
      camPos.copy(to.pos)
      camTarget.copy(to.target)
      flight = null
      updateCull(true, to)
      return
    }
    const dist = camPos.distanceTo(to.pos)
    flight = {
      from: { pos: camPos.clone(), target: camTarget.clone() },
      to,
      t: 0,
      dur: duration ?? THREE.MathUtils.clamp(0.9 + dist * 0.18, 1.1, 2.0),
      lift: Math.min(0.6, dist * 0.07),
    }
  }

  // ── Only what is in view is drawn ──────────────────────
  // A corner far from where the camera looks (and from where it is flying) is switched off altogether: no draw calls, no
  // shadow casting, no lights, no animation. It comes back before it enters the picture (a wider lens than the real one is
  // tested, and both the camera now and where the flight ends) and goes a moment after it left, so nothing pops.
  // Tiny things (a few pixels on the screen) are left out too – in the overview that is a good share of the room.
  const cullFrustum = new THREE.Frustum()
  const cullM = new THREE.Matrix4()
  const wideNow = new THREE.PerspectiveCamera()
  const wideEnd = new THREE.PerspectiveCamera()
  const stationBoxes = new Map<THREE.Object3D, THREE.Box3>()
  let cullOn = true
  let cullAt = -1
  const boxOf = (o: THREE.Object3D): THREE.Box3 => {
    let b = stationBoxes.get(o)
    if (!b) { b = new THREE.Box3().setFromObject(o).expandByScalar(0.6); stationBoxes.set(o, b) } // (0.6 m around: a shadow or a glow thrown into view)
    return b
  }
  const sees = (cam: THREE.PerspectiveCamera, b: THREE.Box3): boolean => {
    cam.updateMatrixWorld()
    cullM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
    cullFrustum.setFromProjectionMatrix(cullM)
    return cullFrustum.intersectsBox(b)
  }
  const wideLens = (cam: THREE.PerspectiveCamera): void => { cam.fov = camera.fov * 1.3; cam.aspect = camera.aspect; cam.near = camera.near; cam.far = camera.far; cam.clearViewOffset(); cam.updateProjectionMatrix() }
  interface Tiny { m: THREE.Mesh; c: THREE.Vector3; r: number }
  let tinies: Tiny[] | null = null
  const collectTinies = (): Tiny[] => {
    const out: Tiny[] = []
    const c = new THREE.Vector3(), sc = new THREE.Vector3()
    scene.updateMatrixWorld()
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || !o.visible || !o.geometry) return
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
      const bs = o.geometry.boundingSphere
      if (!bs) return
      o.matrixWorld.decompose(c, new THREE.Quaternion(), sc)
      const r = bs.radius * Math.max(sc.x, sc.y, sc.z)
      if (r > 0.03) return
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.userData.kind !== undefined || p.userData.noCull) return // clickable / animated things stay
      out.push({ m: o, c: bs.center.clone().applyMatrix4(o.matrixWorld), r })
    })
    return out
  }
  /** immediate: no waiting before something is switched off (a jump, or a test). */
  function updateCull(immediate = false, end?: Pose3): void {
    let changed = false
    const t = simT
    wideNow.position.copy(camera.position); wideNow.quaternion.copy(camera.quaternion); wideLens(wideNow)
    const ahead = flight?.to ?? end
    if (ahead) { wideEnd.position.copy(ahead.pos); wideEnd.lookAt(ahead.target); wideLens(wideEnd) }
    for (const o of interactive) {
      const sec = o.userData.sec !== false
      let want = sec
      if (sec && cullOn && !roam.on) { // (walking around: you can turn faster than the culling can follow, so everything stays – nothing pops in)
        const b = boxOf(o)
        if (sees(wideNow, b) || (ahead && sees(wideEnd, b))) o.userData.out = undefined
        else {
          if (o.userData.out === undefined) o.userData.out = t
          want = !(immediate || (!flight && t - (o.userData.out as number) > 0.6))
        }
      }
      if (o.visible !== want) { o.visible = want; changed = true }
    }
    // little things far away: under ~2 px they cannot be seen anyway
    if (!tinies) tinies = collectTinies()
    const pxPerM = (host.clientHeight * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
    for (const ti of tinies) {
      const px = cullOn && !roam.on ? (ti.r * 2 * pxPerM) / Math.max(0.1, camera.position.distanceTo(ti.c)) : 99
      const hid = ti.m.userData.tinyHid === true
      if (!hid && px < 2) { if (ti.m.visible) { ti.m.visible = false; ti.m.userData.tinyHid = true; changed = true } }
      else if (hid && px > 2.6) { ti.m.visible = true; ti.m.userData.tinyHid = false; changed = true }
    }
    if (changed) { shadowsDirty = true; invalidate(0.3) }
  }

  // ── Insets (UI panels) shift the view so the subject stays centred in the free area ──
  const inset = { x: 0, y: 0, tx: 0, ty: 0 }
  const bars = { top: 0, bottom: 0 } // phones: the space taken by the bar on top and the one at the bottom (the iPod is fitted between them)
  function setInsets({ right = 0, bottom = 0, left = 0, top = 0 }: { right?: number; bottom?: number; left?: number; top?: number }): void {
    invalidate(0.3)
    inset.tx = right / 2 - left / 2
    inset.ty = (bottom - top) / 2
    const was = bars.top + bars.bottom
    bars.top = top; bars.bottom = bottom
    if (was !== top + bottom && station === 'lytte' && (lyttePose === 'ipod' || lyttePose === 'topipod') && camera.aspect < 0.9) goTo('lytte', { duration: 0.5 }) // (the iPod is fitted to the free height)
  }

  // ── Interaction ────────────────────────────────────────
  const ray = new THREE.Raycaster()
  ray.params.Line.threshold = 0.005 // metres – lines are only decoration
  const ndc = new THREE.Vector2()
  const pointer = { x: 0, y: 0, inside: false }
  let dragging: { x: number; startX: number; moved: boolean } | null = null
  let downAt: { x: number; y: number; t: number } | null = null

  function setNdc(e: { clientX: number; clientY: number }): void {
    const r = renderer.domElement.getBoundingClientRect()
    // (the camera's projection already includes the view offset)
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1
  }

  const shown = (o: THREE.Object3D | null): boolean => { for (; o; o = o.parent) if (!o.visible) return false; return true }
  function hitInfo(): HitInfo | null {
    ray.setFromCamera(ndc, camera)
    const hits = ray.intersectObjects(interactive, true)
    for (const h of hits) {
      if (h.object instanceof THREE.Points || h.object instanceof THREE.Sprite || !shown(h.object)) continue // the raycaster doesn't look at .visible: a hidden thing (the iPod's notes, a hidden station) and dust / sprites are only decoration (a Points hit has a 1 m tolerance by default!) must not eat the click
      let o: THREE.Object3D | null = h.object
      const info: HitInfo = { object: h.object }
      while (o) {
        if (o.userData.kind && info.kind === undefined) { info.kind = o.userData.kind as string; info.index = (o.userData.index as number | undefined) ?? h.instanceId }
        if (o.userData.station) { info.station = o.userData.station as string; break }
        o = o.parent
      }
      if (info.station) {
        if (info.station === 'reiser') {
          // outlines/graticule lines sit on top of the land – use the first hit that is a country
          for (const hh of hits) {
            const c = globeTable.countryFromHit(hh)
            if (c) { info.country = c; break }
          }
        }
        return info
      }
    }
    return null
  }

  let hoverInfo: HitInfo | null = null
  function onMove(e: PointerEvent): void {
    invalidate(0.4)
    setNdc(e)
    pointer.inside = true
    if (decorDrag) { moveDecorDrag(); return }
    if (decorEdit) { renderer.domElement.style.cursor = decorAt() ? 'grab' : 'default'; return }
    if (dragging) {
      const dx = (e.clientX - dragging.x) / renderer.domElement.clientWidth
      dragging.x = e.clientX
      if (Math.abs(e.clientX - dragging.startX) > 4) dragging.moved = true
      globeTable.drag(dx)
      return
    }
    hoverInfo = hitInfo()
    let label: string | null | undefined = null
    hoverGuitar = -1
    shelf.setHover(-1)
    globeTable.setHover(null)
    listening.setHover(null)
    japan.setAnimeHover(-1)
    const hi = hoverInfo
    if (hi) {
      const hIndex = hi.index ?? -1
      const album = music.albums[hIndex]
      if (hi.station !== station) label = hi.station ? STATION_LABELS[hi.station] : null
      else if (hi.kind === 'guitar') { hoverGuitar = hIndex; label = currentData.gitarer?.[hIndex]?.navn }
      else if (hi.kind === 'book') { shelf.setHover(hIndex); label = currentData.boker?.[hIndex]?.tittel }
      else if (hi.kind === 'album') { label = album?.name; listening.setHover(album?.uri ?? null) }
      else if (hi.kind === 'anime') {
        const a = animeList[hIndex]
        japan.setAnimeHover(hIndex)
        if (a) label = `${a.en || a.title} · ${String(a.known).replace('.', ',')} % kjent`
      }
      else if (hi.kind === 'ipod') label = 'Spillelister'
      else if (hi.kind === 'stack') { const st = stack[hIndex]; label = st ? `${st.queued ? 'Neste i køen: ' : 'Hørt sist: '}${st.name}` : null }
      else if (hi.kind === 'turntable') label = 'Se ovenfra'
      else if (hi.kind === 'tt-prev') label = 'Forrige låt'
      else if (hi.kind === 'tt-next') label = 'Neste låt'
      else if (hi.kind === 'tt-toggle') label = music.now?.playing ? 'Pause' : 'Spill'
      else if (hi.kind === 'tt-arm') label = music.now?.playing ? 'Løft nålen (pause)' : 'Sett ned nålen (spill)'
      else if (hi.kind === 'shelf' && lyttePose !== 'shelf') label = 'Bla i platehylla'
      else if (hi.station === 'reiser' && hi.country) { globeTable.setHover(hi.country); label = norskNavn(hi.country) }
    }
    renderer.domElement.style.cursor = hi ? 'pointer' : 'default'
    onHover?.(label && hi ? { label, x: e.clientX, y: e.clientY, station: hi.station, country: hi.country, uri: hi.kind === 'album' ? music.albums[hi.index ?? -1]?.uri ?? null : null } : null)
  }
  function onDown(e: PointerEvent): void {
    invalidate(0.6)
    setNdc(e)
    if (decorEdit) { startDecorDrag(e); return } // "Rediger rommet": my models are picked up and moved, nothing else reacts
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() }
    const info = hitInfo()
    if (station === 'reiser' && info?.station === 'reiser') {
      dragging = { x: e.clientX, startX: e.clientX, moved: false }
      globeTable.setDragging(true)
      renderer.domElement.setPointerCapture?.(e.pointerId)
    }
  }
  function onUp(e: PointerEvent): void {
    if (decorEdit) { if (decorDrag) endDecorDrag(); downAt = null; return }
    const wasDrag = dragging?.moved
    if (dragging) { globeTable.setDragging(false); dragging = null }
    if (!downAt || wasDrag) { downAt = null; return }
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y)
    downAt = null
    if (moved > 8) return
    setNdc(e)
    const info = hitInfo()
    if (!info) { onPick?.({ station, kind: 'empty' }); return }
    // walking around: a click flies to that station and then does what the click meant (picks the iPod up, takes the record out …)
    if (roam.on || info.station !== station) { onPick?.({ station: info.station ?? '', kind: 'station', then: roam.on ? pickOf(info, info.station ?? '') : undefined }); return }
    if (info.kind === 'guitar' && info.index === selGuitar) { const gt = guitars[info.index ?? -1]; if (gt) gt.strum = 1 }
    onPick?.(pickOf(info, station))
  }
  /** The page's name for what was clicked. */
  function pickOf(info: HitInfo, st: string): PickEvent {
    const gIndex = info.index ?? -1
    if (info.kind === 'guitar') return { station: st, kind: 'guitar', index: info.index }
    if (info.kind === 'book') return { station: st, kind: 'book', index: info.index }
    if (info.station === 'reiser' && info.country) return { station: st, kind: 'country', name: info.country }
    if (info.kind === 'screen') return { station: st, kind: 'screen' }
    if (info.station === 'ovelse') return { station: st, kind: 'clock' }
    if (info.kind === 'album') return { station: st, kind: 'album', uri: music.albums[gIndex]?.uri }
    if (info.kind === 'anime') return { station: st, kind: 'anime', index: info.index }
    if (info.kind === 'ipod') return { station: st, kind: 'ipod' }
    if (info.kind === 'turntable') return { station: st, kind: 'turntable' }
    if (info.kind?.startsWith('tt-')) return { station: st, kind: info.kind }
    if (info.kind === 'stack') return { station: st, kind: 'stackrecord', album: stack[gIndex] }
    if (info.kind === 'shelf') return { station: st, kind: 'shelf' }
    return { station: st, kind: 'object' }
  }
  function onLeave(): void {
    pointer.inside = false
    onHover?.(null)
  }
  const el = renderer.domElement
  function onWheel(e: WheelEvent): void {
    if (decorEdit && decorSel) { // the wheel turns the selected model (with Shift: makes it bigger / smaller)
      e.preventDefault()
      const o = decorObjs.get(decorSel)
      if (o) adjustDecor(decorSel, e.shiftKey ? { scale: (o.item.scale || 1) * Math.exp(-e.deltaY * 0.0015) } : { rot: (o.item.rot || 0) + e.deltaY * 0.003 })
      return
    }
    if (station !== 'reiser') return
    e.preventDefault()
    zoomTarget = Math.min(1.15, Math.max(0.3, zoomTarget * Math.exp(e.deltaY * 0.0012)))
    invalidate(0.6)
  }
  // ── My own 3D models (uploaded as .glb in Admin) – placed in the room, and moved around in "Rediger rommet" ──
  const decorGroup = new THREE.Group()
  scene.add(decorGroup)
  const decorObjs = new Map<string, DecorObject>()
  let decorEdit = false
  let decorSel: string | null = null
  let decorDrag: { id: string; ox: number; oz: number; moved: boolean } | null = null
  const selBox = new THREE.BoxHelper(new THREE.Object3D(), 0x2b8cff)
  onAccent(() => (selBox.material as THREE.LineBasicMaterial).color.copy(accent))
  const selMat = selBox.material as THREE.LineBasicMaterial
  selMat.depthTest = false
  selMat.transparent = true
  selBox.renderOrder = 30
  selBox.visible = false
  scene.add(selBox)
  const dPoint = new THREE.Vector3()
  const dPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const DECOR_X = 3.65, DECOR_Z = 3.2 // the floor (the walls are at ±4 and ±3.5)
  const clampN = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))

  function placeDecor(o: DecorObject): void {
    const it = o.item
    o.root.position.set(it.x, it.y || 0, it.z)
    o.root.rotation.y = it.rot || 0
    o.root.scale.setScalar(it.scale || 1)
    o.root.visible = it.visible !== false || decorEdit // hidden ones still show while editing, so they can be found again
  }
  function refreshSel(): void {
    const o = decorSel ? decorObjs.get(decorSel) : undefined
    selBox.visible = !!o && decorEdit
    if (o) selBox.setFromObject(o.root)
  }
  function serializeDecor(): DecorItem[] { return [...decorObjs.values()].map((o) => ({ ...o.item })) }
  function selectDecor(id: string | null): void {
    decorSel = id && decorObjs.has(id) ? id : null
    refreshSel()
    onDecorSelect?.(decorSel)
    invalidate(0.5)
  }
  function setDecor(list: DecorItem[]): void {
    const ids = new Set(list.map((i) => i.id))
    for (const [id, o] of decorObjs) {
      if (ids.has(id)) continue
      decorGroup.remove(o.root)
      decorObjs.delete(id)
      if (decorSel === id) selectDecor(null)
    }
    for (const it of list) {
      const existing = decorObjs.get(it.id)
      if (existing) { if (decorDrag?.id !== it.id) { existing.item = { ...it }; placeDecor(existing) } continue }
      const o: DecorObject = { root: new THREE.Group(), item: { ...it } }
      o.root.userData.decorId = it.id
      decorObjs.set(it.id, o)
      decorGroup.add(o.root)
      placeDecor(o)
      loadModel(it.file).then((g) => {
        if (decorObjs.get(it.id) !== o) return
        const m = g.scene.clone(true)
        // a handy size (the longest side ~ 50 cm; the scale in the list is relative to that), standing on the floor
        const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3())
        m.scale.multiplyScalar(0.5 / Math.max(size.x, size.y, size.z, 1e-4))
        m.updateMatrixWorld(true)
        const b = new THREE.Box3().setFromObject(m)
        const c = b.getCenter(new THREE.Vector3())
        m.position.set(-c.x, -b.min.y, -c.z)
        m.traverse((n) => { if (n instanceof THREE.Mesh) { n.castShadow = true; n.receiveShadow = true } })
        o.root.add(m)
        shadowsDirty = true
        scheduleEnvCapture(900)
        refreshSel()
        invalidate(1)
      }).catch(() => {})
    }
    refreshSel()
    shadowsDirty = true
    invalidate(0.6)
  }
  function decorAt(): string | null {
    ray.setFromCamera(ndc, camera)
    const hits = ray.intersectObjects(decorGroup.children.filter((c) => c.visible), true)
    for (const h of hits) {
      let n: THREE.Object3D | null = h.object
      while (n && !n.userData.decorId) n = n.parent
      if (n) return n.userData.decorId as string
    }
    return null
  }
  function startDecorDrag(e: PointerEvent): boolean {
    const id = decorAt()
    selectDecor(id)
    if (!id) return false
    const o = decorObjs.get(id)
    if (!o) return false
    dPlane.constant = -o.root.position.y
    ray.setFromCamera(ndc, camera)
    if (!ray.ray.intersectPlane(dPlane, dPoint)) return false
    decorDrag = { id, ox: o.root.position.x - dPoint.x, oz: o.root.position.z - dPoint.z, moved: false }
    renderer.domElement.setPointerCapture?.(e.pointerId)
    renderer.domElement.style.cursor = 'grabbing'
    return true
  }
  function moveDecorDrag(): void {
    if (!decorDrag) return
    const o = decorObjs.get(decorDrag.id)
    if (!o) return
    ray.setFromCamera(ndc, camera)
    if (!ray.ray.intersectPlane(dPlane, dPoint)) return
    o.item.x = clampN(dPoint.x + decorDrag.ox, -DECOR_X, DECOR_X)
    o.item.z = clampN(dPoint.z + decorDrag.oz, -DECOR_Z, DECOR_Z)
    decorDrag.moved = true
    placeDecor(o)
    selBox.setFromObject(o.root)
    shadowsDirty = true
    invalidate(0.3)
  }
  function endDecorDrag(): void {
    const moved = decorDrag?.moved
    decorDrag = null
    renderer.domElement.style.cursor = 'default'
    if (moved) onDecorChange?.(serializeDecor())
  }
  /** Turn / resize / lift / move / hide the selected (or a given) model. */
  function adjustDecor(id: string | null | undefined, patch: Partial<DecorItem>): void {
    const key = id || decorSel
    const o = key ? decorObjs.get(key) : undefined
    if (!o) return
    const it = o.item
    if (patch.rot !== undefined) it.rot = patch.rot
    if (patch.scale !== undefined) it.scale = clampN(patch.scale, 0.05, 8)
    if (patch.y !== undefined) it.y = clampN(patch.y, 0, 3)
    if (patch.x !== undefined) it.x = clampN(patch.x, -DECOR_X, DECOR_X)
    if (patch.z !== undefined) it.z = clampN(patch.z, -DECOR_Z, DECOR_Z)
    if (patch.visible !== undefined) it.visible = patch.visible
    if (patch.name !== undefined) it.name = patch.name
    placeDecor(o)
    refreshSel()
    shadowsDirty = true
    invalidate(0.5)
    onDecorChange?.(serializeDecor())
  }
  function setDecorEdit(on: boolean): void {
    decorEdit = !!on
    if (!decorEdit) { decorDrag = null; selectDecor(null) }
    for (const o of decorObjs.values()) placeDecor(o)
    refreshSel()
    renderer.domElement.style.cursor = 'default'
    invalidate(0.6)
  }

  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointerleave', onLeave)

  // ── Free roam: walk around in the room ──
  // WASD / arrows to walk (Shift to hurry), drag to look around; on a phone the joystick (RoamControls) walks and a drag looks.
  // Eye height 1.6 m; the walls and the furniture on the floor stop you. The camera goes back to its station when you leave.
  const roam = { on: false, x: 0.5, z: 2.7, yaw: 0, pitch: -0.05, mx: 0, mz: 0, crouch: false, duck: 0, keys: new Set<string>(), drag: null as { x: number; y: number; id: number } | null }
  const ROOM_BOX = { x0: -3.7, x1: 3.7, z0: -3.25, z1: 3.3 }
  const EYE = 1.6, EYE_LOW = 0.85, RADIUS = 0.28 // (C: crouch – the eyes go down to 85 cm, and you walk slower)
  let roamBoxes: THREE.Box3[] = []
  function buildRoamBoxes(): void {
    roamBoxes = []
    scene.updateMatrixWorld(true)
    const take = (o: THREE.Object3D, depth: number): void => {
      if (!o.visible) return
      const b = new THREE.Box3().setFromObject(o)
      if (b.isEmpty()) return
      const size = b.getSize(new THREE.Vector3())
      if (b.min.y > 1.0 || size.y < 0.3) return // (things up on the wall, and rugs and mats you can walk over)
      if (size.x * size.z > 14) { if (depth < 3) o.children.forEach((c) => take(c, depth + 1)); return } // a whole corner: look at its parts
      roamBoxes.push(b.expandByVector(new THREE.Vector3(RADIUS, 0, RADIUS)))
    }
    for (const o of interactive) if (o.userData.station !== 'om') o.children.forEach((c) => take(c, 1))
  }
  const blocked = (x: number, z: number): boolean => x < ROOM_BOX.x0 || x > ROOM_BOX.x1 || z < ROOM_BOX.z0 || z > ROOM_BOX.z1 || roamBoxes.some((b) => x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z)
  function stepRoam(dt: number): boolean {
    const k = roam.keys
    let ix = roam.mx, iz = roam.mz
    if (k.has('d') || k.has('arrowright')) ix += 1
    if (k.has('a') || k.has('arrowleft')) ix -= 1
    if (k.has('s') || k.has('arrowdown')) iz += 1
    if (k.has('w') || k.has('arrowup')) iz -= 1
    const len = Math.hypot(ix, iz)
    let moved = false
    if (len > 0.01) {
      if (len > 1) { ix /= len; iz /= len }
      const speed = (k.has('shift') && !roam.crouch ? 3.2 : roam.crouch ? 0.9 : 1.6) * dt
      const fx = -Math.sin(roam.yaw), fz = -Math.cos(roam.yaw)
      const rx = Math.cos(roam.yaw), rz = -Math.sin(roam.yaw)
      const dx = (rx * ix - fx * iz) * speed, dz = (rz * ix - fz * iz) * speed
      if (!blocked(roam.x + dx, roam.z)) roam.x += dx // (each way on its own: you slide along a wall)
      if (!blocked(roam.x, roam.z + dz)) roam.z += dz
      moved = true
    }
    const want = k.has('c') || roam.crouch ? 1 : 0
    const ducking = Math.abs(want - roam.duck) > 0.002
    roam.duck += (want - roam.duck) * Math.min(1, dt * 9) // (eases down and up)
    const eye = EYE + (EYE_LOW - EYE) * roam.duck
    camera.position.set(roam.x, eye + Math.sin(simT * 7) * (moved ? 0.012 : 0), roam.z)
    const cp = Math.cos(roam.pitch)
    camera.lookAt(roam.x - Math.sin(roam.yaw) * cp, eye + Math.sin(roam.pitch), roam.z - Math.cos(roam.yaw) * cp)
    lookAt.set(roam.x - Math.sin(roam.yaw), eye, roam.z - Math.cos(roam.yaw)) // (so the lerp back to a station starts from here)
    // …and any flight to a station starts from where you stand now (not from where the camera was before you began walking)
    camTarget.copy(lookAt)
    camPos.copy(camTarget).addScaledVector(tmp2.subVectors(camera.position, camTarget), 1 / distK)
    return moved || ducking
  }
  const roamKeys = (down: boolean) => (e: KeyboardEvent): void => {
    if (!roam.on || ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement | null)?.tagName ?? '')) return
    const key = e.key.toLowerCase()
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'c'].includes(key)) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (down) roam.keys.add(key); else roam.keys.delete(key)
    if (key.startsWith('arrow')) e.preventDefault()
    invalidate(0.5)
  }
  const onRoamKeyDown = roamKeys(true), onRoamKeyUp = roamKeys(false)
  window.addEventListener('keydown', onRoamKeyDown)
  window.addEventListener('keyup', onRoamKeyUp)
  window.addEventListener('blur', () => roam.keys.clear())
  const onRoamDown = (e: PointerEvent): void => { if (roam.on) roam.drag = { x: e.clientX, y: e.clientY, id: e.pointerId } }
  const onRoamMove = (e: PointerEvent): void => {
    const d = roam.drag
    if (!roam.on || !d || d.id !== e.pointerId) return
    roam.yaw -= (e.clientX - d.x) * 0.0042
    roam.pitch = Math.max(-1.2, Math.min(1.2, roam.pitch - (e.clientY - d.y) * 0.0042))
    d.x = e.clientX; d.y = e.clientY
    invalidate(0.3)
  }
  const onRoamUp = (): void => { roam.drag = null }
  el.addEventListener('pointerdown', onRoamDown)
  window.addEventListener('pointermove', onRoamMove)
  window.addEventListener('pointerup', onRoamUp)

  // ── Data ───────────────────────────────────────────────
  let currentData: RoomData = {}
  function setData(data: RoomData): void {
    currentData = data
    buildGuitars(data.gitarer || [])
    shelf.setBooks(data.boker || [])
    const visited = new Set((data.reiser ?? []).map((r) => atlasName(r.land)).filter((n): n is string => !!n))
    globeTable.setVisited(visited)
    setPortrait(data.om, data.site?.navn)
    setSelection({})
    scheduleEnvCapture(900)
    shadowsDirty = true
    invalidate(1)
  }

  function setSelection({ gitar = -1, bok = -1, land = null, prosjekt = 0 }: { gitar?: number; bok?: number; land?: string | null; prosjekt?: number }): void {
    invalidate(1)
    selGuitar = gitar
    shelf.setSelected(bok)
    globeTable.setSelected(land)
    const p = currentData.prosjekter || []
    desk.setProject(p[prosjekt] || null, prosjekt, p.length)
  }

  // ── Theme ──────────────────────────────────────────────
  let themeName: ThemeName = 'light'
  // grey weather dims the daylight coming in
  const DIM: Record<string, number> = { clear: 1, cloud: 0.7, fog: 0.55, drizzle: 0.5, rain: 0.4, thunder: 0.3, snow: 0.65 }
  function applyWeatherLight(): void {
    const t = THEMES[themeName]
    const d = t.night ? 1 : DIM[weather.kind] ?? 1
    windowLight.intensity = t.window * d
    sun.intensity = t.sun * d
    hemi.intensity = t.hemi * (t.night ? 1 : 0.7 + 0.3 * d) * (eff.areaLights ? 1 : 1.2) // (the window's area light is off: a little more soft light instead)
    // golden hour: the sun is warmer early and late in the day (free – just a colour)
    if (!t.night) {
      const hr = new Date().getHours() + new Date().getMinutes() / 60
      const warm = Math.min(1, Math.max(0, Math.abs(hr - 13) - 3.5) / 3) // 0 around midday, 1 at ~19:30 / ~6:30
      sun.color.set(t.sunColor).lerp(new THREE.Color(0xff9a52), warm * 0.7)
      windowLight.color.set(t.windowColor).lerp(new THREE.Color(0xffb27a), warm * 0.6)
    }
    if (shafts) {
      shafts.visible = eff.shafts && !reduced && (t.night ? true : weather.kind === 'clear' || weather.kind === 'cloud')
      shaftU.uStrength.value = t.night ? 0.035 : 0.16 * d * d
      shaftU.uColor.value.copy(t.night ? new THREE.Color(0x9fc0ff) : sun.color)
    }
  }
  function setTheme(name: string): void {
    themeName = name === 'dark' ? 'dark' : 'light'
    const t = THEMES[themeName]
    scene.background = new THREE.Color(t.bg)
    scene.fog = new THREE.Fog(t.bg, 26, 48)
    wallMat.color.set(t.wall)
    floorMat.color.set(t.floor)
    sideMat.color.set(t.night ? 0x1a2232 : 0xdfe6ef)
    hemi.intensity = t.hemi * (eff.areaLights ? 1 : 1.2)
    sun.intensity = t.sun
    sun.color.set(t.sunColor)
    fill.intensity = t.night ? 0.08 : 0.3
    lampLight.intensity = t.lamp
    spot.intensity = t.night ? 1.4 : 0.7
    scene.environmentIntensity = t.env
    bloom.strength = t.bloom * eff.bloomMul
    windowLight.intensity = t.window
    windowLight.color.set(t.windowColor)
    scheduleEnvCapture()
    invalidate(1)
    bloom.threshold = t.threshold
    renderer.toneMappingExposure = t.exposure * eff.exposure
    skyMat.map?.dispose()
    skyMat.map = skyTexture(t.night, weather.kind)
    skyMat.needsUpdate = true
    applyWeatherLight()
  }

  let distK = 1
  // scroll wheel over the globe zooms in and out (the camera moves along its line of sight; 1 = the usual distance)
  let zoom = 1, zoomTarget = 1

  // ── Render on demand ──
  let lastRender = 0
  let renderUntil = 0
  /** Keep rendering every frame for a while (after input, data or theme changes). */
  function invalidate(seconds = 0.6) { renderUntil = Math.max(renderUntil, performance.now() + seconds * 1000) }
  THREE.DefaultLoadingManager.onLoad = () => invalidate(0.5)

  // ── Environment from the room itself ──────────────────────
  // Rendering the room into a cube map gives realistic reflections and soft
  // bounce light (a cheap stand-in for global illumination).
  let envRT: THREE.WebGLRenderTarget | null = null
  let envTimer = 0
  const envPos = new THREE.Vector3(0, 1.4, 0)
  function captureEnv(): void {
    if (!eff.reflections) { // reflections off: the plain studio light instead of the room itself
      if (envRT) { scene.environment = baseEnv; envRT.dispose(); envRT = null }
      return
    }
    renderer.shadowMap.needsUpdate = true
    invalidate(0.5)
    const old = envRT
    const wasBloom = bloom.enabled
    envRT = pmrem.fromScene(scene, 0.035, 0.1, 30, { size: eff.reflections, position: envPos })
    scene.environment = envRT.texture
    old?.dispose()
    bloom.enabled = wasBloom
  }
  function scheduleEnvCapture(delay = 400): void {
    clearTimeout(envTimer)
    envTimer = window.setTimeout(captureEnv, delay)
  }

  // ── Graphics settings ─────────────────────────────────────
  // "Auto" = what autoGfx() says for this device (and the frame time moves the resolution up and down). In "custom"
  // every value comes from the settings; whatever the user left out stays automatic.
  function applyGfx(g: GfxInput | null): void {
    const prev = eff
    eff = g && g.mode === 'custom' ? { ...autoGfx(), ...g } : autoGfx()
    eff.showFps = !!g?.showFps // the frame counter works in Auto too
    // your own (or a preset's) choices decide how light the lighting is: no glow and little smoothing = the lean lighting (no area lights, no tiny point lights)
    if (g && g.mode === 'custom') { const lean = eff.bloom === 'off' && eff.msaa <= 2; eff.areaLights = !lean; eff.smallLights = !lean }
    const n = eff
    // picture sharpness: smoothing of the edges (MSAA) – the render targets are rebuilt with the new sample count
    if (n.msaa !== prev.msaa) {
      for (const t of [composer.renderTarget1, composer.renderTarget2]) { t.samples = Math.max(0, Math.min(n.msaa, maxMsaa)); t.dispose() }
    }
    // shadows: size (0 = off), softness and the lamp's own shadow
    const shadowsOn = n.shadows > 0
    sun.castShadow = shadowsOn
    const size = Math.min(n.shadows || 1024, maxTex)
    if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); sun.shadow.map?.dispose(); sun.shadow.map = null }
    lampLight.castShadow = shadowsOn && !!n.lamp
    if (!lampLight.castShadow && lampLight.shadow.map) { lampLight.shadow.map.dispose(); lampLight.shadow.map = null }
    const wantType = n.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap
    if (renderer.shadowMap.type !== wantType) {
      renderer.shadowMap.type = wantType
      scene.traverse((o) => { if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true })
    }
    shadowsDirty = true
    // lights: the area lights (window, LED strip) and the tiny point lights are the dearest per pixel – a weak machine goes without
    scene.traverse((o) => {
      if (o instanceof THREE.RectAreaLight) o.visible = n.areaLights
      else if (o instanceof THREE.PointLight && o.distance <= 0.7) o.visible = n.smallLights
    })
    contact.visible = !shadowsOn // no shadow map: soft contact shadows under the furniture instead
    // ambient occlusion (loaded the first time it is switched on) and the light shafts
    if (n.ao !== 'off') {
      ensureAO()
      if (ao) {
        ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.2, scale: 1.1, samples: n.ao === 'low' ? 8 : n.ao === 'auto' ? 12 : 24, distanceFallOff: 1, screenSpaceRadius: false })
        ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: n.ao === 'low' ? 4 : 6, rings: n.ao === 'low' ? 2 : 3, samples: n.ao === 'low' ? 8 : n.ao === 'auto' ? 10 : 16 })
        ao.enabled = n.ao !== 'auto' || level <= 3
      }
    } else if (ao) ao.enabled = false
    if (n.shafts) buildShafts()
    if (shafts) applyWeatherLight()
    // glow, vignette, reflections, exposure
    bloom.enabled = n.bloom !== 'off'
    vignette.enabled = !!n.vignette
    if (n.reflections !== prev.reflections) scheduleEnvCapture(60)
    // the frame counter in the corner
    if (n.showFps && !fpsEl) {
      fpsEl = document.createElement('div')
      fpsEl.style.cssText = 'position:fixed;left:104px;bottom:12px;z-index:60;padding:4px 9px;border-radius:8px;background:rgba(0,0,0,.62);color:#9fe6b0;font:600 12px ui-monospace,Menlo,monospace;pointer-events:none'
      document.body.appendChild(fpsEl)
    } else if (!n.showFps && fpsEl) { fpsEl.remove(); fpsEl = null }
    applyLevel() // resolution (also sets the AO rung and calls resize)
    setTheme(themeName) // glow strength and exposure
    invalidate(1)
  }

  // ── Resize ─────────────────────────────────────────────
  function resize(): void {
    const w = host.clientWidth || 1
    const h = host.clientHeight || 1
    renderer.setSize(w, h, false)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(w, h)
    bloom.resolution.set(eff.bloom === 'full' ? w : w / 2, eff.bloom === 'full' ? h : h / 2)
    camera.aspect = w / h
    // narrow screens: widen the lens so the subject fits
    camera.fov = roam.on ? 68 : w / h < 0.8 ? 62 : w / h < 1.2 ? 52 : 42
    distK = w / h < 0.8 ? 1.3 : 1
    camera.updateProjectionMatrix()
    if (station === 'lytte' && (lyttePose === 'ipod' || lyttePose === 'topipod')) goTo('lytte', { instant: true }) // (the iPod fills the same share of a new shape)
    invalidate(0.3)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  resize()

  // ── Loop ───────────────────────────────────────────────
  const clock = new THREE.Timer()
  const tmp = new THREE.Vector3()
  const tmp2 = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  let raf = 0
  let running = true
  let firstFrame = true

  let simT = 0
  // Adaptive quality: if frames get slow, lower the rendering resolution step by step.
  // The same ladder for everybody: sharpest first. The starting rung comes from the specs, the frame time moves
  // along it – down when frames are slow, back up when there is plenty of room.
  const LEVELS: { pr: number }[] = [{ pr: 3 }, { pr: 2 }, { pr: 1.6 }, { pr: 1.25 }, { pr: 1.0 }, { pr: 0.85 }, { pr: 0.7 }]
  const startLevel = spec.software ? 6 : quality === 'ultra' ? 0 : quality === 'high' ? 2 : 4
  let level = startLevel
  let upCooldown = 0 // windows to wait before trying a sharper rung again
  let fastWindows = 0
  let perfSum = 0
  let perfN = 0
  let perfSkip = 90 // ignore the first frames (shader compilation, intro)
  function applyLevel(): void {
    // "Auto": the ladder above (never more than the screen has); a number: exactly that – even supersampling
    renderer.setPixelRatio(eff.res === 'auto' ? Math.min(window.devicePixelRatio, (LEVELS[level]?.pr ?? 1)) : Number(eff.res))
    if (ao && eff.ao === 'auto') ao.enabled = level <= 3 // AO is the first thing to go when frames get slow
    resize()
  }
  applyLevel()
  function measure(raw: number): void {
    if (document.hidden || eff.res !== 'auto') return
    if (perfSkip > 0) { perfSkip--; return }
    perfSum += raw
    perfN++
    if (perfN >= 60) {
      const avg = perfSum / perfN
      perfSum = perfN = 0
      if (avg > 0.022 && level < LEVELS.length - 1) {
        level++
        applyLevel()
        perfSkip = 30
        fastWindows = 0
        upCooldown = 6 // slow just now: don't go back up for a while
      } else if (avg < 0.0125 && level > 0) {
        // lots of headroom (under ~12 ms a frame): after a few quiet windows, try a sharper picture
        if (upCooldown > 0) upCooldown--
        else if (++fastWindows >= 3) {
          level--
          applyLevel()
          perfSkip = 30
          fastWindows = 0
          upCooldown = 3
        }
      } else fastWindows = 0
    }
  }

  let shadowTick = 0
  function frame(): void {
    if (!running) return
    raf = requestAnimationFrame(frame)
    if (document.hidden || covered || warming) return // nobody sees the room: nothing is drawn (the last picture stays)
    // frame-rate cap. The weak class rests at 30 – but with a record turning (or the iPod playing) in front of you it goes
    // for 60: that is what you look at, and it is what makes it look good (a cap you chose yourself is kept)
    const cap = eff.fps && smooth && !(gfxIn?.mode === 'custom' && gfxIn.fps) ? 60 : eff.fps
    if (cap) {
      const t0 = performance.now()
      if (t0 - lastFrameAt < 1000 / cap - 1.5) return
      lastFrameAt = t0
    }
    clock.update()
    const raw = clock.getDelta()
    const active = step(Math.min(raw, 0.05))
    // Render on demand: only when something moves, plus a slow heartbeat (1/s) so late-loading
    // textures still show up. An idle room costs (almost) nothing.
    const now = performance.now()
    // little things move on their own (the cat breathes, dust drifts, steam rises …): a gentle ~20 frames a second while you can see them
    if (!active && !shadowsDirty && !(ambient && now - lastRender > (quality === 'low' ? 100 : 48)) && now - lastRender < 1000) return
    if (active) measure(raw)
    shaftU.uTime.value = simT
    // shadows are redrawn when something moved (and, for late-loading textures, now and then)
    if (shadowsDirty || ++shadowTick % 240 === 0) renderer.shadowMap.needsUpdate = true
    shadowsDirty = false
    renderer.info.reset() // (the counters add up over every pass of the frame: scene, glow, …)
    composer.render()
    drawn.calls = renderer.info.render.calls; drawn.triangles = renderer.info.render.triangles
    lastRender = now
    // the frame rate is read from frames while something moves (at rest the room draws only now and then, on purpose)
    if (active) { const dt = now - lastActiveAt; if (dt < 250) fpsVal = Math.round(fpsVal ? fpsVal * 0.8 + (1000 / dt) * 0.2 : 1000 / dt); lastActiveAt = now }
    if (now - fpsAt > 500) { fpsAt = now; if (fpsEl) fpsEl.textContent = `${fpsVal}${now - lastActiveAt > 1500 ? ' (hvile)' : ''} fps · ${Math.round(renderer.getPixelRatio() * 100) / 100}× · ${drawn.calls} anrop · ${Math.round(drawn.triangles / 1000)}k tri · ${countLights()} lys · ${quality}` }
  }
  let lastFrameAt = 0, lastActiveAt = 0, fpsAt = performance.now(), fpsVal = 0
  let fpsEl: HTMLDivElement | null = null
  let shadowsDirty = true
  let ambient = false
  let smooth = false // something you are looking at plays: the record turns
  let warming = false // (compiling the shaders for the lights of a hidden corner – nothing is drawn meanwhile)
  const drawn = { calls: 0, triangles: 0 } // what the last frame cost (all passes)
  let covered = false // a full-screen panel (admin, the 2D view) hides the room
  const countLights = (): number => { let n = 0; scene.traverse((o) => { if ((o as THREE.Light).isLight && shown(o)) n++ }); return n }

  function step(dt: number): boolean {
    simT += dt
    const t = simT

    // camera flight
    if (flight) {
      flight.t = Math.min(1, flight.t + dt / flight.dur)
      const k = easeInOut(flight.t)
      camPos.lerpVectors(flight.from.pos, flight.to.pos, k)
      camPos.y += Math.sin(Math.PI * k) * flight.lift
      camTarget.lerpVectors(flight.from.target, flight.to.target, k)
      if (flight.t >= 1) flight = null
    }
    // pointer parallax (camera-relative)
    const dir = tmp.subVectors(camTarget, camPos).normalize()
    right.crossVectors(dir, up).normalize()
    // the camera stays put: it does not follow the mouse
    // narrow screens: step back so the subject still fits
    zoom += (zoomTarget - zoom) * Math.min(1, dt * 8)
    const wantPos = camTarget.clone().addScaledVector(tmp2.subVectors(camPos, camTarget), distK * zoom)
    if (firstFrame) { camera.position.copy(wantPos); firstFrame = false }
    let active = !!flight || performance.now() < renderUntil || Math.abs(zoomTarget - zoom) > 0.0005
    if (camera.position.distanceToSquared(wantPos) > 1e-8 || lookAt.distanceToSquared(camTarget) > 1e-8) active = true
    camera.position.lerp(wantPos, Math.min(1, dt * 12)) // (follows the flight closely: a long, soft tail made short moves feel slow)
    lookAt.lerp(camTarget, Math.min(1, dt * 14))
    if (flight) lookAt.copy(camTarget)
    camera.lookAt(lookAt)

    // view offset for UI panels
    // walking around: the whole screen is the picture – no shift for a panel (it shifts the centre of the lens: everything looks off-axis)
    const itx = roam.on ? 0 : inset.tx, ity = roam.on ? 0 : inset.ty
    if (Math.abs(itx - inset.x) > 0.3 || Math.abs(ity - inset.y) > 0.3) active = true
    const ik = roam.on ? 1 : Math.min(1, dt * 5)
    inset.x += (itx - inset.x) * ik
    inset.y += (ity - inset.y) * ik
    const w = host.clientWidth, h = host.clientHeight
    if (Math.abs(inset.x) > 0.5 || Math.abs(inset.y) > 0.5) camera.setViewOffset(w, h, inset.x, inset.y, w, h)
    else camera.clearViewOffset()

    if (simT - cullAt > (flight ? 0.05 : 0.25)) { updateCull(); cullAt = simT }

    if (roam.on) { if (stepRoam(dt) || roam.drag || roam.mx || roam.mz || roam.keys.size) active = true }

    // guitars
    guitars.forEach((g, i) => {
      const sel = i === selGuitar
      const target = g.home.clone()
      let rot = 0
      if (sel) {
        target.set(-2.55, 1.2 + Math.sin(t * 1.2) * 0.02, GUITAR_Z)
        rot = Math.sin(t * 0.6) * 0.35
      } else if (i === hoverGuitar && station === 'gitar') {
        target.x += 0.06
      }
      g.vel.addScaledVector(tmp.subVectors(target, g.holder.position), 70 * dt)
      g.vel.multiplyScalar(Math.max(0, 1 - 12 * dt))
      g.holder.position.addScaledVector(g.vel, dt)
      g.rot += (rot - g.rot) * Math.min(1, dt * 3)
      g.holder.rotation.y = g.rot
      g.holder.rotation.x = sel ? 0 : 0
      if (g.vel.lengthSq() > 1e-6 || sel) { shadowsDirty = true; active = true }
      if (g.strum > 0.001) {
        active = true
        g.strum *= Math.pow(0.03, dt)
        g.holder.rotation.x = Math.sin(t * 38) * 0.02 * g.strum
        const strings = g.model.userData.strings as THREE.Mesh[] | undefined
        strings?.forEach((s, j) => {
          s.position.x = (s.userData.base as THREE.Vector3).x + Math.sin(t * (90 + j * 14)) * 0.06 * g.strum
        })
      }
    })

    if (shelf.group.visible && shelf.update(dt, t)) { shadowsDirty = true; active = true }
    // things that animate on their own only count where you can see them
    const near = (...st: string[]): boolean => st.includes(station) || !!flight || roam.on
    if (near('kode', 'gaming') && desk.group.visible && desk.update(dt, t)) active = true
    if (globeTable.update(dt, t, !reduced && near('reiser'))) active = true
    if (timerState && near('ovelse', 'hjem') && practice.update(dt, t, timerState(), timerInterval)) active = true
    ambient = eff.ambient && !reduced && !document.hidden && near('lytte', 'hjem', 'kode', 'gaming')
    if (!reduced && eff.weather && near('lytte', 'hjem') && stepWeather(dt, t)) { active = true; ambient = true }
    figures.update(t)
    if (listening.group.visible && listening.update(dt, t, camera)) { shadowsDirty = true; active = true }
    if (japan.group.visible && japan.update(dt)) { shadowsDirty = true; active = true }
    smooth = listening.isSpinning() && station === 'lytte'
    if (listening.isSpinning() && near('lytte', 'hjem')) active = true
    return active
  }

  setTheme('light')
  goTo('hjem', { duration: 2.6 })
  frame()
  document.fonts?.ready.then(() => { shelf.refreshSpines(); practice.redraw() })
  // ready after the first frame – or after a moment if the tab is in the background (no frames there)
  let readyFired = false
  const fireReady = (): void => { if (!readyFired) { readyFired = true; onReady?.() } }
  requestAnimationFrame(fireReady)
  setTimeout(fireReady, 1500)

  // compile every shader up front (in the background, in parallel) instead of stuttering when something first shows;
  // the browser / app keeps its own on-disk cache of the compiled shaders for the next start
  try { void renderer.compileAsync(scene, camera).catch(() => {}) } catch { /* the first frames compile them instead */ }
  // the corner with the most lights is switched off when you look elsewhere – that is another set of shaders: make them ready
  // beforehand, in the background, so it does not stutter the first time
  setTimeout(() => {
    if (!running) return
    const g = listening.group
    warming = true
    g.visible = false
    const done = (): void => { g.visible = true; warming = false; updateCull(true); invalidate(1) }
    try { void renderer.compileAsync(scene, camera).then(done, done) } catch { done() }
  }, 5000)
  applyGfx(null) // start with what "Auto" means for this device (the settings are sent in right after)

  return {
    goTo,
    get lyttePose() { return lyttePose },
    /** (dev/testing) what the pointer would hit at a screen position */
    pickAt(x: number, y: number) { setNdc({ clientX: x, clientY: y }); const h = hitInfo(); return h ? { kind: h.kind, index: h.index, station: h.station, obj: h.object.name || h.object.type, parent: h.object.parent?.name || h.object.parent?.type } : null },
    /** (dev/testing) every object in the scene: where it is, whether it shows, how big it is – to compare before / after a refactor */
    dumpScene() {
      const r3 = (n: number): number => Math.round(n * 1000) / 1000
      const out: [string, number, number, number, number, number, number, number, string][] = []
      cullOn = false; updateCull(true) // (everything shows, as if nothing were left out)
      scene.updateMatrixWorld(true)
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3()
      scene.traverse((o) => {
        o.matrixWorld.decompose(p, q, sc)
        const mesh = o as THREE.Mesh
        const verts = mesh.geometry?.attributes?.position?.count ?? 0
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        const colour = mat && 'color' in mat && mat.color instanceof THREE.Color ? mat.color.getHexString() : ''
        const path: string[] = []
        for (let n: THREE.Object3D | null = o; n && n !== scene; n = n.parent) path.unshift(n.name || n.type)
        out.push([path.join('/'), r3(p.x), r3(p.y), r3(p.z), r3(sc.x), r3(sc.y), r3(sc.z), o.visible ? verts : -verts - 1, colour])
      })
      cullOn = true; updateCull(true)
      return out
    },
    setData,
    setSelection,
    setTheme,
    setInsets,
    strum(i: number) { if (guitars[i]) { guitars[i].strum = 1; invalidate(1) } },
    setTimerInterval(v: number) { timerInterval = v },
    setMusicView({ selected = null, pose = null, flip = false, deck = false }: { selected?: string | null; pose?: LyttePose | null; flip?: boolean; deck?: boolean } = {}) {
      invalidate(1)
      listening.setSelected(selected)
      listening.setFlip(flip)
      listening.setDeck(deck)
      // where the camera looks in the listening corner
      if (pose !== lyttePose) {
        lyttePose = pose
        if (station === 'lytte') goTo('lytte', { duration: 0.95 })
      }
    },
    /** The tonearm's angle: 0 = needle on the record, 0.45 = resting. */
    tonearmAngle: (): number => listening.tonearmAngle(),
    /** The iPod screen's rectangle in viewport CSS px (for the HTML overlay), or null when the camera is not at the iPod. */
    pressIpod() { listening.pressIpod(); invalidate(0.4) },
    ipodScreenRect() {
      if (!(station === 'lytte' && lyttePose === 'ipod')) return null
      const r = renderer.domElement.getBoundingClientRect()
      const s = listening.ipodScreenRect(camera, r.width, r.height)
      return { x: r.left + s.x, y: r.top + s.y, w: s.w, h: s.h }
    },
    /** Word of the day on the card in the Japanese corner. */
    setJapanWord(word: JpWord | null) { japan.setWord(word); invalidate(0.2) },
    /** Steam data for the monitor in the gaming corner. */
    setSteam(d: SteamScreenData | null) { desk.setSteam(d); invalidate(0.3) },
    /** The anime from jpdb as DVDs on the mat; `selected` is pulled out of its stack. */
    setAnime(list: JpAnime[] | null | undefined, selected = -1) { animeList = list ?? []; japan.setAnime(animeList); japan.setAnimeSelected(selected); invalidate(0.6) },
    /** The held-up record's rectangle in viewport CSS px, or null. */
    recordScreenRect() {
      const r = renderer.domElement.getBoundingClientRect()
      const s = listening.selectedRect(camera, r.width, r.height)
      return s && { x: r.left + s.x, y: r.top + s.y, w: s.w, h: s.h }
    },
    /** The records matching the shelf search slide out of the shelf (null = no search). */
    /** The album queued up next (all of it): one sleeve leaning by the turntable, or null. */
    setNext(a: StackEntry | null | undefined) { listening.setNext(a, () => { shadowsDirty = true; invalidate(1) }) },
    /** Calm mode: no weather, no drifting things; the camera just cuts instead of flying. */
    setCalm(v: boolean) { reduced = deviceReduced || !!v; listening.setCalm(reduced); if (reduced) { rain.visible = false; snow.visible = false }; invalidate(1) },
    /** The weather where I live: { kind: clear | cloud | fog | drizzle | rain | thunder | snow }. */
    setWeather(w: { kind?: string } | null | undefined) { weather = { kind: w?.kind || 'clear' }; setTheme(themeName); invalidate(1) },
    /** The record of the day sticks out of the shelf. */
    setDaily(uri: string | null | undefined) { listening.setDaily(uri); invalidate(1) },
    /** The records on the table: queued albums on top (next first), then the ones I heard last. */
    setStack(list: StackEntry[] | null | undefined) { stack = list ?? []; listening.setStack(stack, () => { shadowsDirty = true; invalidate(1) }) },
    /** Tempo (BPM) of the song that's playing; 0 = unknown (the record turns at 33⅓ rpm). */
    setTempo(bpm: number | string | null | undefined) { listening.setTempo(bpm); invalidate(0.5) },
    setShelfFilter(list: string[] | null | undefined) { listening.setFilter(list); invalidate(1) },
    setMusic(state: Partial<MusicState>) {
      music = { albums: state.albums ?? [], playlists: state.playlists ?? [], now: state.now ?? null, guests: state.guests ?? [], playOn: state.playOn || 'vinyl' }
      listening.setState(music)
      shadowsDirty = true
      invalidate(1)
    },
    /** Screen position (CSS px, relative to the canvas) of the selected country, or null. */
    countryScreenPoint() {
      const v = globeTable.selectedWorld(new THREE.Vector3(), camera.position)
      if (!v) return null
      v.project(camera)
      if (v.z > 1) return null
      const r = renderer.domElement.getBoundingClientRect()
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }
    },
    /** My uploaded 3D models: [{ id, file, name, x, y, z, rot, scale, visible }]. */
    setDecor,
    /** The figures on the shelf (their own models); `keepBuiltin`: the built-in set stays while there are none (the owner's room). */
    setFigures(list: { id: string; file: string; name: string }[], keepBuiltin: boolean) { figures.setFigures(list, loadModel, () => { shadowsDirty = true; scheduleEnvCapture(900); invalidate(1) }, keepBuiltin) },
    setDecorEdit,
    selectDecor,
    adjustDecor,
    /** The user's graphics choices ({ mode: 'auto' | 'custom', … }); null = automatic. */
    /** Corners switched off in this room (a user can hide Japanese, Spotify …): they are not in the room at all. */
    setSections(on: Record<string, boolean> | null): void {
      for (const o of interactive) {
        const st = String(o.userData.station)
        let vis = !on || on[st === 'figurer' ? 'gitar' : st] !== false // (the figure shelf belongs to the guitar corner)
        if (st === 'kode' && on && on.gaming !== false) vis = true // the desk also carries the gaming monitor
        o.userData.sec = vis
      }
      updateCull(true)
      invalidate(0.5)
    },
    /** The room's accent colour (#rrggbb) for what glows and marks things in the room; null = the standard blue. */
    setAccent(hex: string | null) { setAccent3d(hex); invalidate(1) },
    /** How far the overview camera stands (1 = standard, less = nearer) so the room fills the free part of the screen next to the panel. */
    setHomeFit(k: number) { const v = Math.max(0.5, Math.min(1.3, k)); if (Math.abs(v - homeFit) < 0.02) return; homeFit = v; if (station === 'hjem') goTo('hjem', { duration: 0.7 }) },
    setGraphics(g: GfxInput | null) { gfxIn = g; applyGfx(g) },
    /** What the picture is made of right now (for the settings window): quality class, resolution, frame rate … */
    get gfxInfo() { return { calls: drawn.calls, triangles: drawn.triangles, lights: countLights(), quality, level, pixelRatio: renderer.getPixelRatio(), fps: fpsVal, maxMsaa, maxTex, dpr: window.devicePixelRatio, gpu: spec.gpu, score: spec.score, auto: autoGfx(), software: spec.software } },
    /** A full-screen panel covers the room (or not): nothing is drawn while it does. */
    /** Free roam on / off: walk around in the room (the camera leaves its station; `goTo` brings it back). */
    setRoam(on: boolean) {
      if (on === roam.on) return
      roam.on = on
      roam.keys.clear(); roam.mx = roam.mz = 0; roam.drag = null; roam.crouch = false; roam.duck = 0
      if (on) {
        updateCull(true) // (everything shows while walking – and then the furniture is there to be collided with)
        buildRoamBoxes()
        flight = null
        // start where the camera is, on the floor: out of anything it is standing in
        roam.x = Math.max(ROOM_BOX.x0, Math.min(ROOM_BOX.x1, camera.position.x)); roam.z = Math.max(ROOM_BOX.z0, Math.min(ROOM_BOX.z1, camera.position.z))
        if (blocked(roam.x, roam.z) || Math.abs(camera.position.x) > 4.2 || camera.position.z > 8) { roam.x = 0.5; roam.z = 2.7 }
        const d = tmp.subVectors(lookAt, camera.position)
        roam.yaw = Math.atan2(-d.x, -d.z); roam.pitch = -0.05
        zoomTarget = 1
        camera.fov = 68 // a natural view for walking (the stations use a narrow lens, which looks odd up close)
        camera.updateProjectionMatrix()
        invalidate(1)
      } else { resize(); goTo(station); invalidate(1) } // (resize puts the station lens back)
    },
    /** The joystick on a phone: x right / left, z back / forward, both −1 … 1. */
    /** Crouch on / off (the button on a phone; C on a keyboard). */
    roamCrouch(on: boolean) { roam.crouch = on; invalidate(0.5) },
    roamMove(x: number, z: number) { roam.mx = x; roam.mz = z; invalidate(0.4) },
    roamLook(dx: number, dy: number) { roam.yaw -= dx * 0.0042; roam.pitch = Math.max(-1.2, Math.min(1.2, roam.pitch - dy * 0.0042)); invalidate(0.3) },
    setCovered(v: boolean) { covered = !!v; if (!covered) invalidate(1) },
    /** Where on the screen a clickable thing of this kind is now (for the tests). */
    screenOf(kind: string): [number, number] | null {
      let hit: THREE.Object3D | null = null
      scene.traverse((o) => { if (!hit && o.userData.kind === kind) hit = o })
      if (!hit) return null
      const b = new THREE.Box3().setFromObject(hit as THREE.Object3D).getCenter(new THREE.Vector3()).project(camera)
      const r = renderer.domElement.getBoundingClientRect()
      return [r.left + ((b.x + 1) / 2) * r.width, r.top + ((1 - b.y) / 2) * r.height]
    },
    get debug() { return { station, camPos: camPos.toArray(), cam: camera.position.toArray(), flight: !!flight, spinning: listening.isSpinning(), covered, warming, groupVisible: listening.group.visible, figures: figures.shown(), builtinFigures: figures.builtinShown() } },
    // test helper: draw calls / triangles of one plain render (no post-processing)
    stats() {
      renderer.info.autoReset = false
      renderer.info.reset()
      renderer.render(scene, camera)
      const r = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, meshes: 0, lights: countLights() }
      scene.traverse((o) => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) r.meshes++ })
      renderer.info.autoReset = false
      return r
    },
    // test helper: what each top-level part of the scene costs on its own (draw calls / triangles of one plain render)
    breakdown() {
      cullOn = false; updateCull(true)
      const kids = scene.children.map((c) => [c, c.visible] as const)
      const out: { name: string; calls: number; triangles: number }[] = []
      renderer.info.autoReset = false
      for (const [c] of kids) {
        for (const [o] of kids) o.visible = o === c
        renderer.info.reset()
        renderer.render(scene, camera)
        if (renderer.info.render.calls) out.push({ name: c.name || c.type, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles })
      }
      renderer.info.autoReset = false
      for (const [c, v] of kids) c.visible = v
      cullOn = true; updateCull(true)
      return out.sort((x, y) => y.calls - x.calls)
    },
    // test helper: advance the simulation without waiting for real frames
    /** What the device was judged to be, and the picture quality now (for debugging). */
    get perf() { return { ...spec, quality, level, pixelRatio: renderer.getPixelRatio() } },
    fastForward(seconds = 3) { for (let i = 0; i < seconds * 60; i++) step(1 / 60); renderer.shadowMap.needsUpdate = true; composer.render() },
    dispose(): void {
      running = false
      fpsEl?.remove()
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('keydown', onRoamKeyDown); window.removeEventListener('keyup', onRoamKeyUp)
      el.removeEventListener('pointerdown', onRoamDown); window.removeEventListener('pointermove', onRoamMove); window.removeEventListener('pointerup', onRoamUp)
      renderer.dispose()
      el.remove()
    },
  }
}
