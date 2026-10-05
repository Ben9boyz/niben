import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildGuitar } from './guitar'
import { prepareGuitarModel } from './guitarModel'
import { buildBookshelf } from './books'
import { buildDesk } from './desk'
import { buildGlobeTable } from './globe'
import { buildPracticeCorner } from './practice'
import { buildJapanCorner } from './japan'
import { buildListeningCorner } from './listening'
import { buildFigureShelf } from './figures'
import { woodFloor, wallTexture, skyTexture, canvasTex } from './textures'
import { atlasName, norskNavn } from './countries'

// ── Layout (metres). Room spans x -4..4, z -3.5..3.5, open towards +z. ──
const GLOBE_POS = new THREE.Vector3(0.12, 0, -2.95) // back wall, between the bookshelf and the desk
const GLOBE_VIEW_DIR = new THREE.Vector3(0.18, 0.34, 0.92).normalize()
const PORTRAIT = new THREE.Vector3(3.97, 1.62, -1.1)
const GUITAR_Z = -0.45

const STATIONS = {
  hjem: { pos: [0.6, 7.4, 15.2], target: [0, 0.5, -0.3] },
  gitar: { pos: [-0.75, 1.35, GUITAR_Z], target: [-4, 1.2, GUITAR_Z] },
  boker: { pos: [-1.6, 1.5, -0.45], target: [-1.6, 1.45, -3.5] },
  kode: { pos: [2.0, 1.36, -1.25], target: [2.0, 1.08, -3.4] },
  reiser: null, // computed from globe position
  om: { pos: [1.45, 1.62, PORTRAIT.z], target: [4, 1.62, PORTRAIT.z] },
  ovelse: { pos: [-0.55, 1.55, 2.0], target: [-4, 1.4, 2.0] },
  lytte: { pos: [-0.35, 1.65, 0.95], target: [3.7, 0.42, 0.95] },
  japansk: { pos: [-0.9, 1.5, 4.85], target: [-1.2, 0.28, 2.8] },
  // the desk again, from the left and a little lower: the gamepad in front, Steam on the monitor
  gaming: { pos: [1.3, 1.22, -1.75], target: [2.05, 1.0, -3.25] },
}
// the listening corner while music plays: closer, from above at an angle – the turntable and the
// sleeve beside it in focus, the record shelf still visible underneath
const LYTTE_TOP = { pos: [2.55, 1.55, -0.2], target: [3.72, 0.5, -0.12] }
// a playlist playing: looking at the iPod back on its stand on the sideboard by the turntable (its screen shows the song)
// in front of the record shelf (under the turntable), to browse the spines
const LYTTE_SHELF = { pos: [2.12, 0.8, 0.1], target: [3.6, 0.3, 0.1] }
// (close up, so what's on the iPod's little screen can be read when it stands there)
const LYTTE_IPOD = { pos: [2.95, 0.9, 0.16], target: [3.59, 0.62, 0.08] }

export const STATION_LABELS = { gaming: 'Gaming', japansk: 'Japansk', lytte: 'Lytteplassen', ovelse: 'Øvingstimer', gitar: 'Gitarer', boker: 'Bokhylla', kode: 'Prosjekter', reiser: 'Reiser', om: 'Om meg' }

const THEMES = {
  light: { bg: 0xe9f1fa, wall: 0xe9eef5, floor: 0xffffff, hemi: 0.45, sun: 3.2, sunColor: 0xfff1dc, lamp: 0.3, env: 1.0, bloom: 0.35, threshold: 1.6, exposure: 1.25, window: 6, windowColor: 0xfff4e6, screen: 0.6, night: false },
  dark: { bg: 0x060a12, wall: 0x8e9bb0, floor: 0x7d746c, hemi: 0.1, sun: 0.55, threshold: 0.9, window: 1.2, windowColor: 0x9fc0ff, screen: 2.2, sunColor: 0x9fc0ff, lamp: 5.5, env: 0.55, bloom: 0.95, exposure: 1.1, night: true },
}

const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

export function createRoom(host, { onPick, onHover, onReady, timerState } = {}) {
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const deviceReduced = reduced

  // ── Renderer ───────────────────────────────────────────
  // "low" on phones / weak machines: lower resolution and less MSAA.
  // "ultra" in the desktop app (window.nibenApp): full Retina sharpness, sharper shadows, finer reflections.
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const inApp = !!window.nibenApp
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
  // What is this running on? Look at the graphics chip, the CPU cores, the memory and the screen, and pick a
  // starting quality; while it runs, the frame time moves it up or down (see "Adaptive quality" below).
  const spec = (() => {
    let gpu = ''
    try {
      const gl = renderer.getContext()
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '').toLowerCase()
    } catch {}
    const cores = navigator.hardwareConcurrency || 4
    const mem = navigator.deviceMemory || 0 // GB (Chromium only)
    const software = /swiftshader|llvmpipe|software|basic render|softpipe/.test(gpu)
    const strongGpu = /apple m\d|rtx|gtx 1[06]|gtx 9|radeon rx|radeon pro|arc a|nvidia|geforce|apple gpu/.test(gpu) && !/mali|adreno|powervr/.test(gpu)
    const weakGpu = /intel.*(hd|uhd|iris plus)|mali-[gt][1-6]\d\b|adreno \(?[1-5]\d\d\b|powervr|sgx|vivante|llvmpipe/.test(gpu)
    // a score from 0 (very weak) to 10
    let score = 5
    if (strongGpu) score += 3
    if (weakGpu) score -= 2
    if (cores >= 8) score += 1
    else if (cores <= 4) score -= 1
    if (mem && mem <= 2) score -= 2
    if (coarse && !strongGpu) score -= 1
    if (window.devicePixelRatio > 2.5 && !strongGpu) score -= 1 // lots of pixels, no muscle
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
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 60)
  camera.position.set(0.8, 9.5, 19)
  const lookAt = new THREE.Vector3(0, 1, -1)

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: quality === 'low' ? 2 : quality === 'ultra' ? Math.min(8, renderer.capabilities.maxSamples || 4) : 4,
  }))
  composer.addPass(new RenderPass(scene, camera))
  // Heavy shaders (ambient occlusion, light shafts, lamp shadows, full-size bloom) only in the downloaded app.
  // The web version stays light: no extra code is even downloaded for it.
  const fancy = inApp
  let ao = null
  if (fancy) {
    import('three/examples/jsm/postprocessing/GTAOPass.js').then(({ GTAOPass }) => {
      ao = new GTAOPass(scene, camera, 256, 256)
      ao.output = GTAOPass.OUTPUT.Default
      ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.2, scale: 1.1, samples: 24, distanceFallOff: 1, screenSpaceRadius: false })
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 3, samples: 16 })
      composer.insertPass(ao, 1)
      ao.enabled = level <= 3
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

  const box = (w, h, d, mat, x, y, z, parent = scene, shadow = true) => {
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
  let shafts = null
  if (fancy) {
    const dir = new THREE.Vector3(-10, -5.2, -3.2).normalize()
    const L = 6.5
    const c = [[0.9, 2.3, 1.0], [0.9, 0.9, 1.0], [0.9, 0.9, 2.4], [0.9, 2.3, 2.4]].map(([, y, z]) => new THREE.Vector3(3.95, y, z))
    const far = c.map((v) => v.clone().addScaledVector(dir, L))
    const pos = [], uv = []
    const tri = (a, b, d, ua, ub, ud) => { pos.push(...a.toArray(), ...b.toArray(), ...d.toArray()); uv.push(ua, ub, ud) }
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
  }
  // ── weather outside the window: rain / snow falling in front of the sky, lightning, grey clouds ──
  let weather = { kind: 'clear', day: true }
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
  function stepWeather(dt, t) {
    const k = weather.kind
    const raining = k === 'rain' || k === 'drizzle' || k === 'thunder'
    rain.visible = raining
    snow.visible = k === 'snow'
    if (raining) {
      const speed = k === 'drizzle' ? 1.6 : 3.2
      for (let i = 0; i < RAIN_N; i++) {
        const d = wseed[i]
        d.y -= d.v * speed * dt
        if (d.y < 0.9) { d.y = 2.3; d.z = 1.02 + Math.random() * 1.36 }
        wp.set([d.x, d.y, d.z, d.x, d.y + 0.1, d.z + 0.012], i * 6)
      }
      rainGeo.attributes.position.needsUpdate = true
    } else if (k === 'snow') {
      for (let i = 0; i < RAIN_N; i++) {
        const d = wseed[i]
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
    if (flash > 0) { flash -= dt; windowLight.intensity = (THEMES[themeName]?.window ?? 6) * 3 + 8 * Math.max(0, flash / 0.18); skyMat.color.setScalar(1 + flash * 6); if (flash <= 0) { applyWeatherLight(); skyMat.color.setScalar(1) } }
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
  if (inApp) { // the lamp casts real shadows in the app
    lampLight.castShadow = true
    lampLight.shadow.mapSize.set(1024, 1024)
    lampLight.shadow.bias = -0.002
    lampLight.shadow.radius = 4
  }

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
  const shadowRes = quality === 'ultra' ? 4096 : quality === 'low' ? 1024 : 2048 // sharper shadows on strong machines
  sun.shadow.mapSize.set(shadowRes, shadowRes)
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
  const interactive = []
  const tag = (obj, station) => { obj.userData.station = station; interactive.push(obj); return obj }

  // Guitars
  const guitarRoot = tag(new THREE.Group(), 'gitar')
  scene.add(guitarRoot)
  let guitars = [] // { holder, model, home, vel, strum }
  let selGuitar = -1
  let hoverGuitar = -1
  const hookMat = new THREE.MeshStandardMaterial({ color: 0xd7b56d, metalness: 1, roughness: 0.3 })

  const gltfLoader = new GLTFLoader()
  const gltfCache = new Map()
  const loadModel = (url) => {
    if (!gltfCache.has(url)) gltfCache.set(url, gltfLoader.loadAsync(url))
    return gltfCache.get(url)
  }

  function buildGuitars(list) {
    guitars.forEach((g) => guitarRoot.remove(g.holder, g.hook))
    guitars = []
    const n = list.length
    const spacing = Math.min(0.85, 3.2 / Math.max(1, n))
    list.forEach((spec, i) => {
      // procedural guitar first; swapped for the real model once it has loaded
      const model = buildGuitar(spec)
      model.scale.setScalar(0.095)
      model.rotation.y = Math.PI / 2
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
      const holder = new THREE.Group()
      const z = GUITAR_Z - (i - (n - 1) / 2) * spacing
      const home = new THREE.Vector3(-3.9, 1.22, z)
      holder.position.copy(home)
      holder.add(model)
      holder.userData = { kind: 'guitar', index: i }
      guitarRoot.add(holder)
      const hook = box(0.08, 0.025, 0.06, hookMat, -3.97, 1.78, z, guitarRoot)
      const entry = { holder, model, hook, home, vel: new THREE.Vector3(), rot: 0, strum: 0 }
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
  scene.add(figures.group)
  let music = { albums: [], playlists: [], now: null }
  let stack = [] // the records on the table (see setStack)
  let animeList = [] // the Japanese corner's DVDs (from jpdb)

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

  function setPortrait(om, navn) {
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
        const ia = tex.image.width / tex.image.height
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
  let flight = null
  const camPos = new THREE.Vector3().copy(camera.position)
  const camTarget = lookAt.clone()

  let lyttePose = null // null (sofa view) | 'top' (turntable) | 'shelf' (record shelf) | 'ipod' (iPod on its stand)
  function goTo(name, { instant = false, duration } = {}) {
    invalidate(0.5)
    station = STATIONS[name] ? name : 'hjem'
    zoomTarget = 1 // the zoom is for the globe only
    desk.setScreenMode(station === 'gaming' ? 'gaming' : 'code')
    const s = station === 'lytte' && lyttePose ? { ipod: LYTTE_IPOD, shelf: LYTTE_SHELF, top: LYTTE_TOP }[lyttePose] : STATIONS[station]
    const to = { pos: new THREE.Vector3(...s.pos), target: new THREE.Vector3(...s.target) }
    if (instant || reduced) {
      camPos.copy(to.pos)
      camTarget.copy(to.target)
      flight = null
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

  // ── Insets (UI panels) shift the view so the subject stays centred in the free area ──
  const inset = { x: 0, y: 0, tx: 0, ty: 0 }
  function setInsets({ right = 0, bottom = 0, left = 0 }) {
    invalidate(0.3)
    inset.tx = right / 2 - left / 2
    inset.ty = bottom / 2
  }

  // ── Interaction ────────────────────────────────────────
  const ray = new THREE.Raycaster()
  ray.params.Line.threshold = 0.005 // metres – lines are only decoration
  const ndc = new THREE.Vector2()
  const pointer = { x: 0, y: 0, inside: false }
  let dragging = null
  let downAt = null

  function setNdc(e) {
    const r = renderer.domElement.getBoundingClientRect()
    // (the camera's projection already includes the view offset)
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1
  }

  function hitInfo() {
    ray.setFromCamera(ndc, camera)
    const hits = ray.intersectObjects(interactive, true)
    for (const h of hits) {
      let o = h.object
      let info = { object: h.object }
      while (o) {
        if (o.userData.kind && info.kind === undefined) { info.kind = o.userData.kind; info.index = o.userData.index ?? h.instanceId }
        if (o.userData.station) { info.station = o.userData.station; break }
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

  let hoverInfo = null
  function onMove(e) {
    invalidate(0.4)
    setNdc(e)
    pointer.inside = true
    if (dragging) {
      const dx = (e.clientX - dragging.x) / renderer.domElement.clientWidth
      dragging.x = e.clientX
      if (Math.abs(e.clientX - dragging.startX) > 4) dragging.moved = true
      globeTable.drag(dx)
      return
    }
    hoverInfo = hitInfo()
    let label = null
    hoverGuitar = -1
    shelf.setHover(-1)
    globeTable.setHover(null)
    listening.setHover(null)
    japan.setAnimeHover(-1)
    if (hoverInfo) {
      if (hoverInfo.station !== station) label = STATION_LABELS[hoverInfo.station]
      else if (hoverInfo.kind === 'guitar') { hoverGuitar = hoverInfo.index; label = currentData.gitarer?.[hoverInfo.index]?.navn }
      else if (hoverInfo.kind === 'book') { shelf.setHover(hoverInfo.index); label = currentData.boker?.[hoverInfo.index]?.tittel }
      else if (hoverInfo.kind === 'album') { label = music.albums[hoverInfo.index]?.name; listening.setHover(music.albums[hoverInfo.index]?.uri) }
      else if (hoverInfo.kind === 'anime') {
        const a = animeList[hoverInfo.index]
        japan.setAnimeHover(hoverInfo.index)
        if (a) label = `${a.en || a.title} · ${String(a.known).replace('.', ',')} % kjent`
      }
      else if (hoverInfo.kind === 'ipod') label = 'Spillelister'
      else if (hoverInfo.kind === 'stack') label = stack[hoverInfo.index] ? `${stack[hoverInfo.index].queued ? 'Neste i køen: ' : 'Hørt sist: '}${stack[hoverInfo.index].name}` : null
      else if (hoverInfo.kind === 'turntable' && music.now?.name) label = music.now.playing ? 'Pause' : 'Spill videre'
      else if (hoverInfo.kind === 'shelf' && lyttePose !== 'shelf') label = 'Bla i platehylla'
      else if (hoverInfo.station === 'reiser' && hoverInfo.country) { globeTable.setHover(hoverInfo.country); label = norskNavn(hoverInfo.country) }
    }
    renderer.domElement.style.cursor = hoverInfo ? 'pointer' : 'default'
    onHover?.(label ? { label, x: e.clientX, y: e.clientY, station: hoverInfo.station, country: hoverInfo.country, uri: hoverInfo.kind === 'album' ? music.albums[hoverInfo.index]?.uri : null } : null)
  }
  function onDown(e) {
    invalidate(0.6)
    setNdc(e)
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() }
    const info = hitInfo()
    if (station === 'reiser' && info?.station === 'reiser') {
      dragging = { x: e.clientX, startX: e.clientX, moved: false }
      globeTable.setDragging(true)
      renderer.domElement.setPointerCapture?.(e.pointerId)
    }
  }
  function onUp(e) {
    const wasDrag = dragging?.moved
    if (dragging) { globeTable.setDragging(false); dragging = null }
    if (!downAt || wasDrag) { downAt = null; return }
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y)
    downAt = null
    if (moved > 8) return
    setNdc(e)
    const info = hitInfo()
    if (!info) { onPick?.({ station, kind: 'empty' }); return }
    if (info.station !== station) { onPick?.({ station: info.station, kind: 'station' }); return }
    if (info.kind === 'guitar') {
      if (info.index === selGuitar) guitars[info.index].strum = 1
      onPick?.({ station, kind: 'guitar', index: info.index })
    } else if (info.kind === 'book') onPick?.({ station, kind: 'book', index: info.index })
    else if (info.station === 'reiser' && info.country) onPick?.({ station, kind: 'country', name: info.country })
    else if (info.kind === 'screen') onPick?.({ station, kind: 'screen' })
    else if (info.station === 'ovelse') onPick?.({ station, kind: 'clock' })
    else if (info.kind === 'album') onPick?.({ station, kind: 'album', uri: music.albums[info.index]?.uri })
    else if (info.kind === 'anime') onPick?.({ station, kind: 'anime', index: info.index })
    else if (info.kind === 'ipod') onPick?.({ station, kind: 'ipod' })
    else if (info.kind === 'turntable') onPick?.({ station, kind: 'turntable' })
    else if (info.kind === 'stack') onPick?.({ station, kind: 'stackrecord', album: stack[info.index] })
    else if (info.kind === 'shelf') onPick?.({ station, kind: 'shelf' })
    else onPick?.({ station, kind: 'object' })
  }
  function onLeave() {
    pointer.inside = false
    onHover?.(null)
  }
  const el = renderer.domElement
  function onWheel(e) {
    if (station !== 'reiser') return
    e.preventDefault()
    zoomTarget = Math.min(1.15, Math.max(0.3, zoomTarget * Math.exp(e.deltaY * 0.0012)))
    invalidate(0.6)
  }
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointerleave', onLeave)

  // ── Data ───────────────────────────────────────────────
  let currentData = {}
  function setData(data) {
    currentData = data
    buildGuitars(data.gitarer || [])
    shelf.setBooks(data.boker || [])
    const visited = new Set((data.reiser || []).map((r) => atlasName(r.land)))
    globeTable.setVisited(visited)
    setPortrait(data.om, data.site?.navn)
    setSelection({})
    scheduleEnvCapture(900)
    shadowsDirty = true
    invalidate(1)
  }

  function setSelection({ gitar = -1, bok = -1, land = null, prosjekt = 0 }) {
    invalidate(1)
    selGuitar = gitar
    shelf.setSelected(bok)
    globeTable.setSelected(land)
    const p = currentData.prosjekter || []
    desk.setProject(p[prosjekt] || null, prosjekt, p.length)
  }

  // ── Theme ──────────────────────────────────────────────
  let themeName = 'light'
  // grey weather dims the daylight coming in
  const DIM = { clear: 1, cloud: 0.7, fog: 0.55, drizzle: 0.5, rain: 0.4, thunder: 0.3, snow: 0.65 }
  function applyWeatherLight() {
    const t = THEMES[themeName] || THEMES.light
    const d = t.night ? 1 : DIM[weather.kind] ?? 1
    windowLight.intensity = t.window * d
    sun.intensity = t.sun * d
    hemi.intensity = t.hemi * (t.night ? 1 : 0.7 + 0.3 * d)
    // golden hour: the sun is warmer early and late in the day (free – just a colour)
    if (!t.night) {
      const hr = new Date().getHours() + new Date().getMinutes() / 60
      const warm = Math.min(1, Math.max(0, Math.abs(hr - 13) - 3.5) / 3) // 0 around midday, 1 at ~19:30 / ~6:30
      sun.color.set(t.sunColor).lerp(new THREE.Color(0xff9a52), warm * 0.7)
      windowLight.color.set(t.windowColor).lerp(new THREE.Color(0xffb27a), warm * 0.6)
    }
    if (shafts) {
      shafts.visible = !reduced && (t.night ? true : weather.kind === 'clear' || weather.kind === 'cloud')
      shaftU.uStrength.value = t.night ? 0.035 : 0.16 * d * d
      shaftU.uColor.value.copy(t.night ? new THREE.Color(0x9fc0ff) : sun.color)
    }
  }
  function setTheme(name) {
    themeName = THEMES[name] ? name : 'light'
    const t = THEMES[name] || THEMES.light
    scene.background = new THREE.Color(t.bg)
    scene.fog = new THREE.Fog(t.bg, 26, 48)
    wallMat.color.set(t.wall)
    floorMat.color.set(t.floor)
    sideMat.color.set(t.night ? 0x1a2232 : 0xdfe6ef)
    hemi.intensity = t.hemi
    sun.intensity = t.sun
    sun.color.set(t.sunColor)
    fill.intensity = t.night ? 0.08 : 0.3
    lampLight.intensity = t.lamp
    spot.intensity = t.night ? 1.4 : 0.7
    scene.environmentIntensity = t.env
    bloom.strength = t.bloom
    windowLight.intensity = t.window
    windowLight.color.set(t.windowColor)
    scheduleEnvCapture()
    invalidate(1)
    bloom.threshold = t.threshold
    renderer.toneMappingExposure = t.exposure
    skyMat.map.dispose()
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
  let envRT = null
  let envTimer = 0
  const envPos = new THREE.Vector3(0, 1.4, 0)
  function captureEnv() {
    renderer.shadowMap.needsUpdate = true
    invalidate(0.5)
    const old = envRT
    const wasBloom = bloom.enabled
    envRT = pmrem.fromScene(scene, 0.035, 0.1, 30, { size: quality === 'ultra' ? 512 : quality === 'high' ? 256 : 128, position: envPos })
    scene.environment = envRT.texture
    old?.dispose()
    bloom.enabled = wasBloom
  }
  function scheduleEnvCapture(delay = 400) {
    clearTimeout(envTimer)
    envTimer = setTimeout(captureEnv, delay)
  }

  // ── Resize ─────────────────────────────────────────────
  function resize() {
    const w = host.clientWidth || 1
    const h = host.clientHeight || 1
    renderer.setSize(w, h, false)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(w, h)
    bloom.resolution.set(fancy ? w : w / 2, fancy ? h : h / 2) // ultra: bloom at full resolution
    camera.aspect = w / h
    // narrow screens: widen the lens so the subject fits
    camera.fov = w / h < 0.8 ? 62 : w / h < 1.2 ? 52 : 42
    distK = w / h < 0.8 ? 1.3 : 1
    camera.updateProjectionMatrix()
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
  const LEVELS = [{ pr: 3 }, { pr: 2 }, { pr: 1.6 }, { pr: 1.25 }, { pr: 1.0 }, { pr: 0.85 }, { pr: 0.7 }]
  const startLevel = spec.software ? 6 : quality === 'ultra' ? 0 : quality === 'high' ? 2 : 4
  let level = startLevel
  let upCooldown = 0 // windows to wait before trying a sharper rung again
  let fastWindows = 0
  let perfSum = 0
  let perfN = 0
  let perfSkip = 90 // ignore the first frames (shader compilation, intro)
  function applyLevel() {
    const l = LEVELS[level]
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, l.pr))
    if (ao) ao.enabled = level <= 3 // AO is the first thing to go when frames get slow
    resize()
  }
  applyLevel()
  function measure(raw) {
    if (document.hidden) return
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
  function frame() {
    if (!running) return
    raf = requestAnimationFrame(frame)
    clock.update()
    const raw = clock.getDelta()
    const active = step(Math.min(raw, 0.05))
    // Render on demand: only when something moves, plus a slow heartbeat (1/s) so late-loading
    // textures still show up. An idle room costs (almost) nothing.
    const now = performance.now()
    // little things move on their own (the cat breathes, dust drifts, steam rises …): a gentle ~20 frames a second while you can see them
    if (!active && !shadowsDirty && !(ambient && now - lastRender > 48) && now - lastRender < 1000) return
    if (active) measure(raw)
    shaftU.uTime.value = simT
    if (shadowsDirty || ++shadowTick % 30 === 0) renderer.shadowMap.needsUpdate = true
    shadowsDirty = false
    composer.render()
    lastRender = now
  }
  let shadowsDirty = true
  let ambient = false

  function step(dt) {
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
    // the listening corner holds perfectly still so records and the iPod are easy to click
    const par = station === 'hjem' ? 0.35 : station === 'lytte' ? 0 : 0.06
    const px = pointer.inside && !dragging ? pointer.x : 0
    const py = pointer.inside && !dragging ? pointer.y : 0
    // narrow screens: step back so the subject still fits
    zoom += (zoomTarget - zoom) * Math.min(1, dt * 8)
    const wantPos = camTarget.clone().addScaledVector(tmp2.subVectors(camPos, camTarget), distK * zoom)
      .addScaledVector(right, px * par).addScaledVector(up, py * par * 0.6)
    if (firstFrame) { camera.position.copy(wantPos); firstFrame = false }
    let active = !!flight || performance.now() < renderUntil || Math.abs(zoomTarget - zoom) > 0.0005
    if (camera.position.distanceToSquared(wantPos) > 1e-8 || lookAt.distanceToSquared(camTarget) > 1e-8) active = true
    camera.position.lerp(wantPos, Math.min(1, dt * 4))
    lookAt.lerp(camTarget, Math.min(1, dt * 6))
    if (flight) lookAt.copy(camTarget)
    camera.lookAt(lookAt)

    // view offset for UI panels
    if (Math.abs(inset.tx - inset.x) > 0.3 || Math.abs(inset.ty - inset.y) > 0.3) active = true
    inset.x += (inset.tx - inset.x) * Math.min(1, dt * 5)
    inset.y += (inset.ty - inset.y) * Math.min(1, dt * 5)
    const w = host.clientWidth, h = host.clientHeight
    if (Math.abs(inset.x) > 0.5 || Math.abs(inset.y) > 0.5) camera.setViewOffset(w, h, inset.x, inset.y, w, h)
    else camera.clearViewOffset()

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
        g.model.userData.strings?.forEach((s, j) => {
          s.position.x = s.userData.base.x + Math.sin(t * (90 + j * 14)) * 0.06 * g.strum
        })
      }
    })

    if (shelf.update(dt, t)) { shadowsDirty = true; active = true }
    // things that animate on their own only count where you can see them
    const near = (...st) => st.includes(station) || !!flight
    if (near('kode', 'gaming') && desk.update(dt, t)) active = true
    if (globeTable.update(dt, t, !reduced && near('reiser'))) active = true
    if (timerState && near('ovelse', 'hjem') && practice.update(dt, t, timerState(), timerInterval)) active = true
    ambient = !reduced && !document.hidden && near('lytte', 'hjem', 'kode', 'gaming')
    if (!reduced && near('lytte', 'hjem') && stepWeather(dt, t)) { active = true; ambient = true }
    figures.update(t)
    if (listening.update(dt, t, camera)) { shadowsDirty = true; active = true }
    if (japan.update(dt)) { shadowsDirty = true; active = true }
    if (listening.isSpinning() && near('lytte', 'hjem')) active = true
    return active
  }

  setTheme('light')
  goTo('hjem', { duration: 2.6 })
  frame()
  document.fonts?.ready.then(() => { shelf.refreshSpines(); practice.redraw() })
  // ready after the first frame – or after a moment if the tab is in the background (no frames there)
  let readyFired = false
  const fireReady = () => { if (!readyFired) { readyFired = true; onReady?.() } }
  requestAnimationFrame(fireReady)
  setTimeout(fireReady, 1500)

  return {
    goTo,
    setData,
    setSelection,
    setTheme,
    setInsets,
    strum(i) { if (guitars[i]) { guitars[i].strum = 1; invalidate(1) } },
    setTimerInterval(v) { timerInterval = v },
    setMusicView({ selected = null, ipod = false, big = false, pose = null, flip = false, peek = null } = {}) {
      invalidate(1)
      listening.setSelected(selected)
      listening.setPeek(peek)
      listening.setFlip(flip)
      listening.setHoldIpod(ipod, big)
      // where the camera looks in the listening corner
      if (pose !== lyttePose) {
        lyttePose = pose
        if (station === 'lytte') goTo('lytte', { duration: 1.3 })
      }
    },
    /** iPod screen rectangle in viewport CSS px (for the HTML overlay), or null when not held. */
    ipodScreenRect() {
      if (!listening.isHoldingIpod()) return null
      const r = renderer.domElement.getBoundingClientRect()
      const s = listening.ipodScreenRect(camera, r.width, r.height)
      return { x: r.left + s.x, y: r.top + s.y, w: s.w, h: s.h }
    },
    /** Word of the day on the card in the Japanese corner. */
    setJapanWord(word) { japan.setWord(word); invalidate(0.2) },
    /** Steam data for the monitor in the gaming corner. */
    setSteam(d) { desk.setSteam(d); invalidate(0.3) },
    /** The anime from jpdb as DVDs on the mat; `selected` is pulled out of its stack. */
    setAnime(list, selected = -1) { animeList = list || []; japan.setAnime(animeList); japan.setAnimeSelected(selected); invalidate(0.6) },
    /** The held-up record's rectangle in viewport CSS px, or null. */
    recordScreenRect() {
      const r = renderer.domElement.getBoundingClientRect()
      const s = listening.selectedRect(camera, r.width, r.height)
      return s && { x: r.left + s.x, y: r.top + s.y, w: s.w, h: s.h }
    },
    /** The records matching the shelf search slide out of the shelf (null = no search). */
    /** The album queued up next (all of it): one sleeve leaning by the turntable, or null. */
    setNext(a) { listening.setNext(a, () => { shadowsDirty = true; invalidate(1) }) },
    /** Calm mode: no weather, no drifting things; the camera just cuts instead of flying. */
    setCalm(v) { reduced = deviceReduced || !!v; listening.setCalm(reduced); if (reduced) { rain.visible = false; snow.visible = false }; invalidate(1) },
    /** The weather where I live: { kind: clear | cloud | fog | drizzle | rain | thunder | snow }. */
    setWeather(w) { weather = { kind: w?.kind || 'clear' }; setTheme(themeName); invalidate(1) },
    /** The records on the table: queued albums on top (next first), then the ones I heard last. */
    setStack(list) { stack = list || []; listening.setStack(stack, () => { shadowsDirty = true; invalidate(1) }) },
    /** Tempo (BPM) of the song that's playing; 0 = unknown (the record turns at 33⅓ rpm). */
    setTempo(bpm) { listening.setTempo(bpm); invalidate(0.5) },
    setShelfFilter(list) { listening.setFilter(list); invalidate(1) },
    setMusic(state) {
      music = { albums: state.albums || [], playlists: state.playlists || [], now: state.now || null, guests: state.guests || [] }
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
    get debug() { return { station, camPos: camPos.toArray(), cam: camera.position.toArray(), flight: !!flight } },
    // test helper: draw calls / triangles of one plain render (no post-processing)
    stats() {
      renderer.info.autoReset = false
      renderer.info.reset()
      renderer.render(scene, camera)
      const r = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, meshes: 0 }
      scene.traverse((o) => { if (o.isMesh || o.isLine) r.meshes++ })
      renderer.info.autoReset = true
      return r
    },
    // test helper: advance the simulation without waiting for real frames
    /** What the device was judged to be, and the picture quality now (for debugging). */
    get perf() { return { ...spec, quality, level, pixelRatio: renderer.getPixelRatio() } },
    fastForward(seconds = 3) { for (let i = 0; i < seconds * 60; i++) step(1 / 60); renderer.shadowMap.needsUpdate = true; composer.render() },
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onLeave)
      renderer.dispose()
      el.remove()
    },
  }
}
