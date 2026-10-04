<script setup>
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import { ref, onMounted, onBeforeUnmount } from 'vue'

defineProps({ trips: { type: Array, default: () => [] } })

function year(t) { return t.aar || (t.dato ? Number(String(t.dato).slice(0, 4)) : null) }
function when(t) {
  const fmt = (d) => new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
  if (t.dato && t.til && t.til !== t.dato) {
    const a = new Date(t.dato), b = new Date(t.til)
    const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    return sameMonth ? `${a.getDate()}.–${fmt(t.til)}` : `${fmt(t.dato)} – ${fmt(t.til)}`
  }
  return t.dato ? fmt(t.dato) : ''
}

const lb = ref(null) // { list, i }
function open(list, i) { lb.value = { list, i } }
function step(d) { if (lb.value) lb.value.i = (lb.value.i + d + lb.value.list.length) % lb.value.list.length }
function onKey(e) {
  if (!lb.value) return
  if (e.key === 'Escape') lb.value = null
  else if (e.key === 'ArrowRight') step(1)
  else if (e.key === 'ArrowLeft') step(-1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="trips">
    <article v-for="(t, i) in trips" :key="t.id || i" class="trip" :style="{ '--i': i }">
      <div class="trip-body">
        <div class="muted">
          <span v-if="year(t)" class="year">{{ year(t) }}</span>
          {{ [t.sted, when(t)].filter(Boolean).join(' · ') }}
        </div>
        <h3>{{ t.tittel }}</h3>
        <p v-if="t.tekst" class="body">{{ t.tekst }}</p>
      </div>
      <!-- every photo is shown inline – just scroll; tapping one opens it full screen -->
      <div v-if="t.bilder?.length" class="photos">
        <figure v-for="(b, j) in t.bilder" :key="b.id || j" :class="{ wide: j === 0 || (b.w && b.h && b.w / b.h > 1.6) }">
          <button class="ph" @click="open(t.bilder, j)" :aria-label="b.tekst || 'Vis bildet større'">
            <img :src="b.src" :alt="b.tekst || ''" loading="lazy" />
          </button>
          <figcaption v-if="b.tekst">{{ b.tekst }}</figcaption>
        </figure>
      </div>
    </article>

    <teleport to="body">
      <transition name="fade">
        <div v-if="lb" class="lightbox" @click.self="lb = null">
          <img :src="lb.list[lb.i].src" :alt="lb.list[lb.i].tekst || ''" />
          <p v-if="lb.list[lb.i].tekst" class="cap">{{ lb.list[lb.i].tekst }}</p>
          <button class="nav prev" @click="step(-1)" v-if="lb.list.length > 1" aria-label="Forrige"><ChevronLeft :size="24" /></button>
          <button class="nav next" @click="step(1)" v-if="lb.list.length > 1" aria-label="Neste"><ChevronRight :size="24" /></button>
          <button class="close" @click="lb = null" aria-label="Lukk"><X :size="20" /></button>
          <span class="count">{{ lb.i + 1 }} / {{ lb.list.length }}</span>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<style scoped>
.trip {
  margin-bottom: 12px; border-radius: 20px; overflow: hidden; background: var(--glass-strong); border: 1px solid var(--glass-border);
  animation: rowIn 0.6s var(--ease) both; animation-delay: calc(var(--i) * 70ms);
}
.photos { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 0 8px 8px; }
figure { margin: 0; }
figure.wide { grid-column: 1 / -1; }
.ph { display: block; width: 100%; padding: 0; border: 0; border-radius: 12px; overflow: hidden; cursor: zoom-in; background: #000; }
.ph img { display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; transition: transform 0.6s var(--ease); }
figure.wide .ph img { aspect-ratio: 16 / 10; }
.ph:hover img { transform: scale(1.03); }
figcaption { font-size: 0.8rem; color: var(--text-3); padding: 4px 4px 2px; }
.trip-body { padding: 14px 16px 16px; }
.muted { color: var(--text-3); font-size: 0.88rem; }
.year { display: inline-block; padding: 2px 8px; margin-right: 4px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-weight: 700; font-size: 0.75rem; }
.trip h3 { font-size: 1.15rem; margin-top: 6px; }
.body { margin-top: 6px; font-size: 0.94rem; color: var(--text-2); white-space: pre-line; }

.lightbox { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; background: rgba(3, 7, 15, 0.9);  }
.lightbox img { max-width: 92vw; max-height: 84vh; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,.5); animation: zoomIn 0.35s var(--ease); }
@keyframes zoomIn { from { transform: scale(0.94); opacity: 0; } }
.cap { position: absolute; bottom: 4vh; left: 50%; transform: translateX(-50%); color: #e8eef7; font-size: 0.95rem; text-align: center; max-width: 80vw; }
.nav, .close { position: absolute; border: 0; cursor: pointer; color: #fff; background: rgba(255,255,255,0.12); width: 48px; height: 48px; border-radius: 50%; font-size: 1.6rem; transition: background 0.2s; }
.nav:hover, .close:hover { background: rgba(255,255,255,0.25); }
.prev { left: 3vw; top: 50%; transform: translateY(-50%); }
.next { right: 3vw; top: 50%; transform: translateY(-50%); }
.close { top: 20px; right: 20px; font-size: 1.1rem; }
.count { position: absolute; top: 30px; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,.7); font-size: 0.85rem; }

@container (min-width: 560px) {
  .photos { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .trip h3 { font-size: 1.5rem; }
  .body { font-size: 1.02rem; }
}
</style>
