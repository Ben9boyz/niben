<script setup>
import { computed } from 'vue'
import { User } from 'lucide-vue-next'
import { spotify } from '../composables/useSpotify'
import { groups } from '../composables/useGroups'

// The list on the left when the albums are grouped by artist: one row per artist with their picture
// (the cover of their first album). Click one to show only their albums, click again for all.
const emit = defineEmits(['pick'])
const nb = (a, b) => a.localeCompare(b, 'nb')
const artists = computed(() => {
  const by = new Map()
  for (const a of spotify.albums) {
    const k = a.artist || 'Ukjent artist'
    const e = by.get(k) || { name: k, n: 0, img: null }
    e.n++
    e.img ||= a.thumb || a.image
    by.set(k, e)
  }
  return [...by.values()].sort((a, b) => b.n - a.n || nb(a.name, b.name))
})
const pick = (name) => { groups.artist = groups.artist === name ? null : name; emit('pick') }
</script>

<template>
  <nav class="at" aria-label="Artister">
    <button v-for="a in artists" :key="a.name" class="f" :class="{ on: groups.artist === a.name }" @click="pick(a.name)">
      <img v-if="a.img" crossorigin="anonymous" :src="a.img" alt="" class="pic" loading="lazy" />
      <span v-else class="pic ph"><User :size="11" /></span>
      <span class="nm">{{ a.name }}</span><small>{{ a.n }}</small>
    </button>
  </nav>
</template>

<style scoped>
.at { display: grid; gap: 1px; }
.f { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 5px 9px; border: 0; border-radius: 10px; background: transparent; color: var(--text-2); font: 600 0.85rem var(--font); text-align: left; cursor: pointer; }
.f .nm { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.f small { font-weight: 500; opacity: 0.6; font-variant-numeric: tabular-nums; }
.f:hover { background: var(--accent-soft); color: var(--text); }
.f.on { background: var(--accent-soft); color: var(--accent); }
.pic { flex: none; width: 22px; height: 22px; border-radius: 50%; object-fit: cover; background: var(--glass-strong); }
.pic.ph { display: grid; place-items: center; color: var(--text-3); }
</style>
