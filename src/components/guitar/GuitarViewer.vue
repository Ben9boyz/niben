<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { makeGltfLoader } from '@/three/gltf'
import { buildGuitar } from '@/three/guitar'
import { prepareGuitarModel } from '@/three/guitarModel'
import type { Guitar } from '@/composables/site/useData'

// A single guitar on a turntable – used by the plain (non-3D-room) version of the site.
const props = withDefaults(defineProps<{ guitar?: Guitar | null }>(), { guitar: null })
const host = ref<HTMLElement | null>(null)
const loading = ref(false)
let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let current: THREE.Object3D | undefined
let intro = 0 // 0 → 1 while the new guitar grows into place
let baseScale: number | undefined
let raf = 0
let ro: ResizeObserver | undefined
let io: IntersectionObserver | undefined
let visible = true
const loader = makeGltfLoader()
const cache = new Map<string, Promise<GLTF>>()

function dispose(o: THREE.Object3D | undefined) {
  o?.traverse((c) => {
    if (c instanceof THREE.Mesh && !c.userData.shared) c.geometry.dispose()
  })
}

async function show(spec: Guitar | null | undefined) {
  if (!spec || !scene) return
  let model: THREE.Object3D | null = null
  if (spec.modell) {
    loading.value = true
    try {
      let load = cache.get(spec.modell)
      if (!load) { load = loader.loadAsync(spec.modell); cache.set(spec.modell, load) }
      const gltf = await load
      if (spec !== props.guitar) return
      model = prepareGuitarModel(gltf.scene, spec)
    } catch {
      model = null
    } finally {
      loading.value = false
    }
  }
  if (!model) {
    model = buildGuitar(spec)
    model.scale.setScalar(0.095)
  }
  if (current) { scene.remove(current); dispose(current) }
  current = model
  intro = 0
  baseScale = undefined
  scene.add(current)
}

onMounted(() => {
  const el = host.value
  if (!el) return
  const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer = gl
  gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  gl.outputColorSpace = THREE.SRGBColorSpace
  gl.toneMapping = THREE.AgXToneMapping
  gl.toneMappingExposure = 1.2
  el.appendChild(gl.domElement)

  const sc = new THREE.Scene()
  scene = sc
  const pmrem = new THREE.PMREMGenerator(gl)
  sc.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  const key = new THREE.DirectionalLight(0xffffff, 2)
  key.position.set(2, 3, 3)
  const rim = new THREE.DirectionalLight(0x8fd3ff, 2)
  rim.position.set(-3, 1, -2)
  sc.add(key, rim, new THREE.AmbientLight(0xffffff, 0.3))

  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50)
  camera = cam
  cam.position.set(0.6, 0.15, 2.2)
  const ctl = new OrbitControls(cam, gl.domElement)
  controls = ctl
  ctl.enableDamping = true
  ctl.enablePan = false
  ctl.minDistance = 1
  ctl.maxDistance = 4
  ctl.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ctl.autoRotateSpeed = 1.2
  ctl.addEventListener('start', () => (ctl.autoRotate = false))

  const resize = () => {
    const w = el.clientWidth || 1, h = el.clientHeight || 1
    gl.setSize(w, h, false)
    cam.aspect = w / h
    cam.position.setLength(w / h < 0.8 ? 2.8 : 2.2)
    cam.updateProjectionMatrix()
  }
  ro = new ResizeObserver(resize)
  ro.observe(el)
  resize()
  io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting })
  io.observe(el)

  const clock = new THREE.Timer()
  const loop = () => {
    raf = requestAnimationFrame(loop)
    if (!visible) return
    clock.update()
    const dt = Math.min(clock.getDelta(), 0.05)
    if (current) {
      intro = Math.min(1, intro + dt * 1.6)
      const e = 1 - Math.pow(1 - intro, 3)
      baseScale ??= current.scale.x
      current.scale.setScalar(baseScale * (0.6 + 0.4 * e))
      current.position.y = Math.sin(clock.getElapsed() * 1.1) * 0.015
    }
    ctl.update()
    gl.render(sc, cam)
  }
  loop()
  void show(props.guitar)
})

watch(() => props.guitar, (g) => void show(g))

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  controls?.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<template>
  <div class="viewer">
    <div ref="host" class="canvas-host"></div>
    <span v-if="loading" class="loading">Laster modell …</span>
    <span class="hint">Dra for å snu · scroll for å zoome</span>
  </div>
</template>

<style scoped>
.viewer { position: relative; width: 100%; height: 100%; cursor: grab; }
.viewer:active { cursor: grabbing; }
.loading, .hint {
  position: absolute; left: 50%; transform: translateX(-50%); font-size: 0.78rem; color: var(--text-3);
  pointer-events: none; white-space: nowrap;
}
.loading { top: 50%; }
.hint { bottom: 10px; }
</style>
