<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Figure } from '@/composables/site/useData'

// One figure on a little stage, turning slowly; drag to turn it yourself, scroll to come closer. Used by the figure tab
// (the side panel in the 3D room and the plain version).
const props = defineProps<{ figure: Figure | null }>()
const host = ref<HTMLElement | null>(null)
const loading = ref(false)
const failed = ref(false)
let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let current: THREE.Object3D | undefined
let controls: OrbitControls | undefined
let raf = 0
let ro: ResizeObserver | undefined
let io: IntersectionObserver | undefined
let visible = true
const loader = new GLTFLoader()
const cache = new Map<string, Promise<GLTF>>()

async function show(f: Figure | null) {
  failed.value = false
  if (current && scene) { scene.remove(current); current.traverse((c) => { if (c instanceof THREE.Mesh) c.geometry.dispose() }); current = undefined }
  if (!f || !scene) return
  loading.value = true
  try {
    let load = cache.get(f.file)
    if (!load) { load = loader.loadAsync(f.file); cache.set(f.file, load) }
    const gltf = await load
    if (f !== props.figure || !scene) return
    const m = gltf.scene.clone(true)
    const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3())
    m.scale.multiplyScalar(1 / Math.max(size.x, size.y, size.z, 1e-4)) // about one unit across, whatever the file
    m.updateMatrixWorld(true)
    const b = new THREE.Box3().setFromObject(m)
    const c = b.getCenter(new THREE.Vector3())
    m.position.sub(c)
    const wrap = new THREE.Group()
    wrap.add(m)
    current = wrap
    scene.add(wrap)
  } catch { failed.value = true } finally { loading.value = false }
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
  sc.environment = new THREE.PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture
  const key = new THREE.DirectionalLight(0xffffff, 2)
  key.position.set(2, 3, 3)
  sc.add(key, new THREE.AmbientLight(0xffffff, 0.35))
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50)
  cam.position.set(0.5, 0.25, 2.6)
  const ctl = new OrbitControls(cam, gl.domElement)
  controls = ctl
  ctl.enableDamping = true
  ctl.enablePan = false
  ctl.minDistance = 1.2
  ctl.maxDistance = 5
  ctl.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ctl.autoRotateSpeed = 1.6
  ctl.addEventListener('start', () => (ctl.autoRotate = false))
  const resize = () => {
    const w = el.clientWidth || 1, h = el.clientHeight || 1
    gl.setSize(w, h, false)
    cam.aspect = w / h
    cam.updateProjectionMatrix()
  }
  ro = new ResizeObserver(resize)
  ro.observe(el)
  resize()
  io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting })
  io.observe(el)
  const loop = () => {
    raf = requestAnimationFrame(loop)
    if (!visible) return
    ctl.update()
    gl.render(sc, cam)
  }
  loop()
  void show(props.figure)
})
watch(() => props.figure, (f) => void show(f))
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
  <div class="fv">
    <div ref="host" class="host" role="img" :aria-label="figure ? `3D-modell av ${figure.name}` : 'Ingen figur valgt'"></div>
    <span v-if="loading" class="note">Laster modell …</span>
    <span v-else-if="failed" class="note">Klarte ikke å vise modellen.</span>
  </div>
</template>

<style scoped>
.fv { position: relative; width: 100%; aspect-ratio: 1 / 1; max-height: 52vh; }
.host { position: absolute; inset: 0; touch-action: none; cursor: grab; }
.host :deep(canvas) { width: 100%; height: 100%; display: block; }
.note { position: absolute; inset: auto 0 10px; text-align: center; font-size: 0.8rem; color: var(--text-3); pointer-events: none; }
</style>
