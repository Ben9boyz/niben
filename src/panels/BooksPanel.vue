<script setup lang="ts">
import { hideImg } from '../lib/dom'
import { tx } from '../composables/useTexts'
import { computed } from 'vue'
import { useData, type Book } from '../composables/useData'
import { room } from '@/composables/room/useRoom'
import Stars from '@/components/ui/Stars.vue'

const data = useData()
const list = computed(() => data.boker || [])
const b = computed(() => list.value[room.sel.bok])
const cover = (book: Book, size = 'M') =>
  book.omslag || (book.isbn ? `https://covers.openlibrary.org/b/isbn/${String(book.isbn).replace(/[^0-9X]/gi, '')}-${size}.jpg` : null)
const avg = computed(() => {
  const r = list.value.filter((x) => x.vurdering)
  return r.length ? (r.reduce((s, x) => s + (x.vurdering ?? 0), 0) / r.length).toFixed(1) : null
})
</script>

<template>
  <section class="panel glass">
    <header class="panel-head">
      <div class="eyebrow">{{ tx('books.eyebrow') }}</div>
      <h2>{{ b ? b.tittel : tx('books.title') }}</h2>
      <p v-if="!b">{{ list.length }} bøker lest<span v-if="avg"> · snitt {{ avg }} / 5</span>. {{ tx('books.hint') }}</p>
    </header>

    <div class="panel-body">
      <transition name="fade" mode="out-in">
        <div v-if="b" :key="room.sel.bok" class="detail">
          <button class="back" @click="room.sel.bok = -1">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 6l-6 6 6 6" /></svg>
            Alle bøker
          </button>
          <img v-if="cover(b, 'L')" :src="cover(b, 'L') || undefined" alt="" class="big-cover" />
          <div class="muted">{{ b.forfatter }}<span v-if="b.lest"> · lest {{ b.lest }}</span></div>
          <div class="rating"><Stars :value="b.vurdering || 0" /></div>
          <p class="body">{{ b.tanker }}</p>
          <div v-if="b.sitat" class="quote">«{{ b.sitat }}»</div>
        </div>

        <div v-else class="list" key="list">
          <button v-for="(item, i) in list" :key="i" class="row" :style="{ '--i': i }" @click="room.sel.bok = i">
            <span class="thumb">
              <img v-if="cover(item, 'S')" :src="cover(item, 'S') || undefined" alt="" loading="lazy" @error="hideImg" />
            </span>
            <span class="meta">
              <span class="name">{{ item.tittel }}</span>
              <span class="sub">{{ item.forfatter }}</span>
            </span>
            <Stars v-if="item.vurdering" :value="item.vurdering" class="mini" />
          </button>
          <div v-if="!list.length" class="empty">Ingen bøker lagt inn ennå.</div>
        </div>
      </transition>
    </div>
  </section>
</template>

<style scoped>
.thumb {
  width: 34px;
  height: 48px;
  flex: none;
  border-radius: 6px;
  overflow: hidden;
  background: linear-gradient(135deg, var(--accent-2), var(--accent));
  box-shadow: 0 3px 8px rgba(0,0,0,.15);
}
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mini { transform: scale(0.75); transform-origin: right; }
.rating { margin-top: 10px; }
.quote {
  margin-top: 16px;
  padding: 14px 16px;
  border-left: 3px solid var(--accent);
  border-radius: 4px 14px 14px 4px;
  background: var(--accent-soft);
  font-style: italic;
  color: var(--text-2);
}
.big-cover { display: none; }
@container (min-width: 560px) {
  .big-cover { display: block; float: right; width: 180px; margin: 0 0 12px 18px; border-radius: 6px 12px 12px 6px; box-shadow: 0 14px 30px rgba(10, 30, 60, 0.25); }
}
</style>
