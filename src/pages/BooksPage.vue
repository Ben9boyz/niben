<script setup>
import { X } from 'lucide-vue-next'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useData } from '../composables/useData'
import Stars from '../components/Stars.vue'

const data = useData()
const books = computed(() => data.boker || [])
const open = ref(null)
const cover = (b) => b.omslag || (b.isbn ? `https://covers.openlibrary.org/b/isbn/${String(b.isbn).replace(/[^0-9X]/gi, '')}-L.jpg` : null)
const fmt = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }) : d)
const onKey = (e) => e.key === 'Escape' && (open.value = null)
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="cpage">
    <header class="cpage-head">
      <div class="eyebrow">Bøker</div>
      <h1>Bokhylla</h1>
      <p>{{ books.length }} bøker lest. Trykk på en bok for å se hva jeg syntes.</p>
    </header>
    <div class="shelf">
      <button v-for="(b, i) in books" :key="b.id || b.tittel" class="book rise" :style="{ '--i': Math.min(i, 12) }" @click="open = b">
        <span class="cov">
          <img v-if="cover(b)" :src="cover(b)" alt="" loading="lazy" @error="(e) => (e.target.style.display = 'none')" />
          <span class="fallback">{{ b.tittel }}</span>
        </span>
        <b>{{ b.tittel }}</b>
        <small>{{ b.forfatter }}</small>
        <Stars v-if="b.vurdering" :value="b.vurdering" class="st" />
      </button>
      <div v-if="!books.length" class="empty">Ingen bøker ennå.</div>
    </div>

    <teleport to="body">
      <transition name="fade">
        <div v-if="open" class="modal-bg" @click.self="open = null">
          <article class="modal glass">
            <button class="x" @click="open = null" aria-label="Lukk"><X :size="18" /></button>
            <img v-if="cover(open)" :src="cover(open)" alt="" />
            <div>
              <h2>{{ open.tittel }}</h2>
              <p class="muted">{{ open.forfatter }}<template v-if="open.lest"> · lest {{ fmt(open.lest) }}</template></p>
              <Stars v-if="open.vurdering" :value="open.vurdering" />
              <p class="body">{{ open.tanker }}</p>
              <blockquote v-if="open.sitat">«{{ open.sitat }}»</blockquote>
            </div>
          </article>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<style scoped>
.shelf { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 22px 18px; }
.book { display: flex; flex-direction: column; gap: 4px; padding: 0; border: 0; background: none; color: var(--text); text-align: left; cursor: pointer; }
.cov { position: relative; aspect-ratio: 2 / 3; border-radius: 6px 12px 12px 6px; overflow: hidden; background: linear-gradient(135deg, var(--accent-2), var(--accent)); box-shadow: 0 10px 24px rgba(10, 30, 60, 0.2), inset 4px 0 6px rgba(0,0,0,.15); transition: transform 0.5s var(--spring), box-shadow 0.3s; margin-bottom: 6px; }
.book:hover .cov { transform: translateY(-6px) rotate(-1.5deg); box-shadow: 0 18px 34px rgba(10, 30, 60, 0.28); }
.cov img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; }
.fallback { position: absolute; inset: 0; display: grid; place-items: center; padding: 12px; text-align: center; color: #fff; font: 700 1rem var(--font-display); }
.book b { font-size: 0.92rem; line-height: 1.3; }
.book small { color: var(--text-3); font-size: 0.8rem; }
.st { transform: scale(0.8); transform-origin: left; }
.modal-bg { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: rgba(5, 10, 20, 0.45);  }
.modal { position: relative; display: grid; grid-template-columns: 200px 1fr; gap: 24px; width: min(720px, 100%); max-height: 86vh; overflow-y: auto; padding: 26px; border-radius: 28px; animation: pop 0.45s var(--spring); }
@keyframes pop { from { transform: scale(0.92); opacity: 0; } }
.modal img { width: 100%; border-radius: 8px; box-shadow: 0 12px 30px rgba(0,0,0,.25); }
.modal h2 { font-size: 1.7rem; }
.muted { color: var(--text-3); margin: 4px 0 10px; }
.body { color: var(--text-2); margin-top: 14px; white-space: pre-line; }
blockquote { margin: 16px 0 0; padding: 12px 16px; border-left: 3px solid var(--accent); background: var(--accent-soft); border-radius: 4px 12px 12px 4px; font-style: italic; color: var(--text-2); }
.x { position: absolute; top: 14px; right: 14px; width: 36px; height: 36px; border-radius: 50%; border: 0; background: var(--accent-soft); color: var(--text); cursor: pointer; }
@media (max-width: 600px) { .modal { grid-template-columns: 1fr; } .modal img { width: 140px; } .shelf { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); } }
</style>
