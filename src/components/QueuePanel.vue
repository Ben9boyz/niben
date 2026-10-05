<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { ListMusic, Music } from 'lucide-vue-next'
import { spotify, fetchQueue, fetchTracks, fmtClock } from '../composables/useSpotify'

// Under "now playing": what comes next, and – for an album – where you are in it ("Låt 5 av 12"). For an album
// the queue is simply the rest of the album, so there is nothing to skip to; for a playlist it shows what's coming.
const queue = ref(null)
const pos = ref(null) // { n, of } while an album plays
let timer = 0
let soon = 0

async function load() { queue.value = await fetchQueue() }
async function where() {
  const ctx = spotify.now?.context
  if (!ctx?.startsWith('spotify:album:')) { pos.value = null; return }
  const list = (await fetchTracks(ctx)).tracks || []
  const i = list.findIndex((t) => t.uri === spotify.now?.uri)
  pos.value = i >= 0 ? { n: i + 1, of: list.length } : null
}
// a new song: look again (a moment later, once Spotify has caught up)
watch(() => spotify.now?.uri, () => { clearTimeout(soon); soon = setTimeout(() => { load(); where() }, 700) }, { immediate: true })
onMounted(() => { timer = setInterval(() => { if (!document.hidden && spotify.now?.playing) load() }, 15000) })
onBeforeUnmount(() => { clearInterval(timer); clearTimeout(soon) })
</script>

<template>
  <section v-if="spotify.now?.name" class="qp">
    <header>
      <b class="label-caps"><ListMusic :size="13" aria-hidden="true" />Neste i køen</b>
      <small v-if="pos" class="pos">Låt {{ pos.n }} av {{ pos.of }}</small>
    </header>
    <p v-if="!queue" class="muted">Henter …</p>
    <p v-else-if="!queue.length" class="muted">Ingenting mer i køen.</p>
    <ol v-else>
      <li v-for="(t, i) in queue.slice(0, 12)" :key="t.uri + i">
        <img v-if="t.img" crossorigin="anonymous" :src="t.img" alt="" /><span v-else class="ph"><Music :size="13" /></span>
        <span class="t" translate="no"><b>{{ t.name }}</b><small>{{ t.artist }}</small></span>
        <small class="d">{{ fmtClock(t.ms / 1000) }}</small>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.qp { display: grid; gap: 8px; padding: 12px; border-radius: 18px; background: var(--glass-strong); border: 1px solid var(--glass-border); min-width: 0; }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
header b { display: inline-flex; align-items: center; gap: 6px; }
.pos { padding: 2px 9px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font: 700 0.7rem var(--font); }
.muted { margin: 0; color: var(--text-3); font-size: 0.82rem; }
ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; max-height: 340px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
li { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; align-items: center; gap: 9px; padding: 3px 4px; border-radius: 8px; }
li img, .ph { width: 32px; height: 32px; border-radius: 5px; object-fit: cover; background: var(--accent-soft); }
.ph { display: grid; place-items: center; color: var(--text-3); }
.t { display: grid; min-width: 0; }
.t b { font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t small, .d { font-size: 0.72rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.d { font-variant-numeric: tabular-nums; }
</style>
