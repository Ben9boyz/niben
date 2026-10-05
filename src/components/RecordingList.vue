<script setup lang="ts">
import { ref, computed } from 'vue'
import { Play, ChevronDown } from 'lucide-vue-next'
import type { Recording } from '../composables/useData'

// A guitar's recordings. YouTube videos show as a thumbnail until clicked (a dozen embedded
// players made the page heavy and very long); long lists fold after the first few.
const props = withDefaults(defineProps<{ items?: Recording[] }>(), { items: () => [] })
const FIRST = 5

const all = ref(false)
const shown = computed(() => (all.value ? props.items : props.items.slice(0, FIRST)))
const playing = ref(new Set<string | number>())

function ytId(v: string | null | undefined) {
  if (!v) return null
  const m = String(v).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)
  return m ? m[1] : /^[\w-]{11}$/.test(v) ? v : null
}
function fmt(d: string | null | undefined) {
  if (!d) return ''
  const t = new Date(d)
  return Number.isNaN(+t) ? d : t.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}
const key = (o: Recording, i: number) => o.id || i
function play(o: Recording, i: number) { playing.value = new Set(playing.value).add(key(o, i)) }
</script>

<template>
  <div class="recs">
    <div v-for="(o, i) in shown" :key="key(o, i)" class="rec" :style="{ '--i': i }">
      <div class="rec-head">
        <b translate="no">{{ o.tittel }}</b>
        <span v-if="o.dato" class="date">{{ fmt(o.dato) }}</span>
      </div>
      <div v-if="ytId(o.youtube)" class="video">
        <iframe
          v-if="playing.has(key(o, i))"
          :src="`https://www.youtube-nocookie.com/embed/${ytId(o.youtube)}?autoplay=1`"
          :title="o.tittel"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
        ></iframe>
        <button v-else class="poster" :aria-label="`Spill av «${o.tittel}»`" @click="play(o, i)">
          <img :src="`https://i.ytimg.com/vi/${ytId(o.youtube)}/hqdefault.jpg`" alt="" loading="lazy" />
          <span class="pb"><Play :size="22" fill="currentColor" /></span>
        </button>
      </div>
      <audio v-else-if="o.lyd" :src="o.lyd" controls preload="none"></audio>
      <p v-if="o.notat" class="note">{{ o.notat }}</p>
    </div>
    <button v-if="items.length > FIRST" class="more-btn" @click="all = !all">
      <ChevronDown :size="16" :class="{ up: all }" />{{ all ? 'Vis færre' : `Vis alle ${items.length} opptak` }}
    </button>
  </div>
</template>

<style scoped>
.rec { padding: 12px 0; border-top: 1px solid var(--glass-border); }
.rec:first-child { border-top: 0; padding-top: 0; }
.rec-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 8px; }
.rec-head b { min-width: 0; }
.date { flex: none; white-space: nowrap; color: var(--text-3); font-size: 0.8rem; }
.video { position: relative; aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; background: #000; }
.video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.poster { position: absolute; inset: 0; padding: 0; border: 0; background: #000; cursor: pointer; }
.poster img { width: 100%; height: 100%; object-fit: cover; opacity: 0.85; transition: opacity 0.2s, transform 0.5s var(--ease, ease); }
.poster:hover img { opacity: 1; transform: scale(1.02); }
.pb { position: absolute; left: 50%; top: 50%; display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: rgba(0, 0, 0, 0.6); color: #fff; transform: translate(-50%, -50%); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.poster:hover .pb { background: #e5332a; }
audio { width: 100%; }
.note { margin: 6px 0 0; color: var(--text-3); font-size: 0.86rem; }
.more-btn { margin-top: 8px; }
</style>
