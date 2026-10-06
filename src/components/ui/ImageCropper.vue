<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Check, X } from 'lucide-vue-next'

// A picture goes to the place it is for in exactly that shape: drag it to where you want it, zoom, and what is inside the
// frame is cut out (at `outWidth` pixels wide) and handed back as a JPEG.
const props = defineProps<{ file: File; aspect: number; outWidth: number; title: string }>()
const emit = defineEmits<{ done: [blob: Blob]; cancel: [] }>()

const url = URL.createObjectURL(props.file)
onBeforeUnmount(() => URL.revokeObjectURL(url))
const frame = ref<HTMLElement | null>(null)
const nat = ref({ w: 0, h: 0 })
const fr = ref({ w: 300, h: 300 / props.aspect })
const zoom = ref(1)
const off = ref({ x: 0, y: 0 }) // the image's top-left corner inside the frame (CSS px)

const scale = computed(() => (nat.value.w ? Math.max(fr.value.w / nat.value.w, fr.value.h / nat.value.h) * zoom.value : 1))
const clamp = (): void => {
  const w = nat.value.w * scale.value, h = nat.value.h * scale.value
  off.value = { x: Math.min(0, Math.max(fr.value.w - w, off.value.x)), y: Math.min(0, Math.max(fr.value.h - h, off.value.y)) }
}
function measure(): void {
  const el = frame.value
  if (!el) return
  fr.value = { w: el.clientWidth, h: el.clientHeight }
  // centred to begin with
  off.value = { x: (fr.value.w - nat.value.w * scale.value) / 2, y: (fr.value.h - nat.value.h * scale.value) / 2 }
  clamp()
}
onMounted(() => {
  const img = new Image()
  img.onload = () => { nat.value = { w: img.naturalWidth, h: img.naturalHeight }; measure() }
  img.src = url
})
function setZoom(z: number): void {
  const k = Math.min(4, Math.max(1, z)) / zoom.value
  // zoom around the middle of the frame
  const cx = fr.value.w / 2, cy = fr.value.h / 2
  off.value = { x: cx - (cx - off.value.x) * k, y: cy - (cy - off.value.y) * k }
  zoom.value = zoom.value * k
  clamp()
}
let drag: { x: number; y: number; ox: number; oy: number } | null = null
const down = (e: PointerEvent): void => { drag = { x: e.clientX, y: e.clientY, ox: off.value.x, oy: off.value.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
const move = (e: PointerEvent): void => { if (!drag) return; off.value = { x: drag.ox + e.clientX - drag.x, y: drag.oy + e.clientY - drag.y }; clamp() }
const up = (): void => { drag = null }
const wheel = (e: WheelEvent): void => { e.preventDefault(); setZoom(zoom.value * Math.exp(-e.deltaY * 0.0015)) }

function save(): void {
  const img = new Image()
  img.onload = () => {
    const w = props.outWidth, h = Math.round(w / props.aspect)
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const x = c.getContext('2d')
    if (!x) return
    const s = scale.value
    x.imageSmoothingQuality = 'high'
    x.drawImage(img, -off.value.x / s, -off.value.y / s, fr.value.w / s, fr.value.h / s, 0, 0, w, h)
    c.toBlob((b) => { if (b) emit('done', b) }, 'image/jpeg', 0.88)
  }
  img.src = url
}
const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') emit('cancel') }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="back" @click.self="emit('cancel')">
      <div class="box" role="dialog" aria-modal="true" :aria-label="title">
        <h3>{{ title }}</h3>
        <p class="hint">Dra bildet dit på plass og zoom. Det som er inni rammen blir bildet.</p>
        <div ref="frame" class="frame" :style="{ aspectRatio: String(aspect) }" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @wheel="wheel">
          <img :src="url" alt="" draggable="false" :style="{ width: nat.w * scale + 'px', height: nat.h * scale + 'px', transform: `translate(${off.x}px, ${off.y}px)` }" />
        </div>
        <label class="zoom">Zoom <input type="range" min="1" max="4" step="0.01" :value="zoom" @input="setZoom(Number(($event.target as HTMLInputElement).value))" /></label>
        <div class="row">
          <button type="button" class="btn soft" @click="emit('cancel')"><X :size="15" />Avbryt</button>
          <button type="button" class="btn primary" @click="save"><Check :size="15" />Bruk bildet</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.back { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; background: rgba(6, 10, 18, 0.62); padding: 16px; }
.box { width: min(720px, 100%); max-height: 100%; overflow: auto; background: var(--bg); color: var(--text); border-radius: 20px; padding: 18px; box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45); display: flex; flex-direction: column; gap: 10px; }
h3 { margin: 0; }
.hint { margin: 0; color: var(--text-3); font-size: 0.85rem; }
.frame { position: relative; width: 100%; max-height: 58dvh; overflow: hidden; border-radius: 10px; background: #000; cursor: grab; touch-action: none; margin: 0 auto; outline: 2px solid var(--accent, #2b8cff); }
.frame:active { cursor: grabbing; }
.frame img { position: absolute; left: 0; top: 0; max-width: none; user-select: none; -webkit-user-drag: none; }
.zoom { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; color: var(--text-3); }
.zoom input { flex: 1; }
.row { display: flex; gap: 8px; justify-content: flex-end; }
</style>
