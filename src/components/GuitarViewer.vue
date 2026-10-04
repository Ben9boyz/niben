<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildGuitar } from '../three/guitar'
import { prepareGuitarModel } from '../three/guitarModel'

// A single guitar on a turntable – used by the plain (non-3D-room) version of the site.
const props = defineProps({ guitar: { type: Object, default: null } })
const host = ref(null)
const loading = ref(false)
let renderer, scene, camera, controls, current, raf = 0, ro, io, visible = true
const loader = new GLTFLoader()
const cache = new Map()

function dispose(o) {
  o?.traverse((c) => {
    if (c.isMesh && !c.userData.shared) c.geometry?.dispose()
  })
}

async function show(spec) {
  if (!spec || !scene) return
  let model
  if (spec.modell) {
    loading.value = true
    try {
      if (!cache.has(spec.modell)) cache.set(spec.modell, loader.loadAsync(spec.modell))
      const gltf = await cache.get(spec.modell)
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
  current.userData.intro = 0
  scene.add(current)
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.toneMappingExposure = 1.2
  host.value.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  const key = new THREE.DirectionalLight(0xffffff, 2)
  key.position.set(2, 3, 3)
  const rim = new THREE.DirectionalLight(0x8fd3ff, 2)
  rim.position.set(-3, 1, -2)
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.3))

  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50)
  camera.position.set(0.6, 0.15, 2.2)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 1
  controls.maxDistance = 4
  controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  controls.autoRotateSpeed = 1.2
  controls.addEventListener('start', () => (controls.autoRotate = false))

  const resize = () => {
    const w = host.value.clientWidth || 1, h = host.value.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.position.setLength(w / h < 0.8 ? 2.8 : 2.2)
    camera.updateProjectionMatrix()
  }
  ro = new ResizeObserver(resize)
  ro.observe(host.value)
  resize()
  io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
  io.observe(host.value)

  const clock = new THREE.Timer()
  const loop = () => {
    raf = requestAnimationFrame(loop)
    if (!visible) return
    clock.update()
    const dt = Math.min(clock.getDelta(), 0.05)
    if (current) {
      current.userData.intro = Math.min(1, current.userData.intro + dt * 1.6)
      const e = 1 - Math.pow(1 - current.userData.intro, 3)
      current.scale.setScalar((current.userData.baseScale ??= current.scale.x) * (0.6 + 0.4 * e))
      current.position.y = Math.sin(clock.getElapsed() * 1.1) * 0.015
    }
    controls.update()
    renderer.render(scene, camera)
  }
  loop()
  show(props.guitar)
})

watch(() => props.guitar, (g) => show(g))

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
