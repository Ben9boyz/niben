<script setup>
import { Music } from 'lucide-vue-next'
// Grid of square covers (records and playlists). The name shows on hover.
defineProps({
  items: { type: Array, required: true }, // [{ uri, name, sub, image }]
  selectedUri: { type: String, default: null },
  playingUri: { type: String, default: null },
  cursorUri: { type: String, default: null }, // the iPod's highlighted row
})
const emit = defineEmits(['pick', 'hover'])
</script>

<template>
  <div class="cgrid">
    <button
      v-for="it in items"
      :key="it.uri"
      class="tile"
      :class="{ on: it.uri === selectedUri, playing: it.uri === playingUri, cursor: it.uri === cursorUri }"
      :aria-label="`${it.name}${it.sub ? ` – ${it.sub}` : ''}`"
      @click="emit('pick', it)"
      @mouseenter="emit('hover', it)"
    >
      <img crossorigin="anonymous" v-if="it.image" :src="it.image" alt="" loading="lazy" />
      <span v-else class="ph"><Music :size="28" /></span>
      <span class="cap"><b>{{ it.name }}</b><small v-if="it.sub">{{ it.sub }}</small></span>
      <span v-if="it.uri === playingUri" class="live" title="Spilles nå"><i></i><i></i><i></i></span>
    </button>
  </div>
</template>

<style scoped>
.cgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 10px; }
.tile {
  position: relative;
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--glass-strong);
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18);
  transition: transform 0.2s var(--ease, ease), box-shadow 0.2s;
}
.tile:hover, .tile.cursor { transform: translateY(-3px); box-shadow: 0 10px 22px rgba(0, 0, 0, 0.28); }
.tile.on { outline: 3px solid var(--accent); outline-offset: 2px; }
.tile.playing { outline: 3px solid #1db954; outline-offset: 2px; }
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ph { display: grid; place-items: center; height: 100%; font-size: 1.6rem; color: var(--text-3); }
.cap {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  flex-direction: column;
  padding: 22px 8px 7px;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.78));
  color: #fff;
  text-align: left;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.2s, transform 0.2s;
}
.tile:hover .cap, .tile.cursor .cap, .tile:focus-visible .cap { opacity: 1; transform: none; }
/* no cover: always show the name */
.tile:not(:has(img)) .cap { opacity: 1; transform: none; }
.cap b { font-size: 0.74rem; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cap small { font-size: 0.66rem; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.live { position: absolute; right: 6px; top: 6px; display: flex; gap: 2px; align-items: flex-end; height: 18px; padding: 3px 5px; border-radius: 6px; background: #1db954; }
.live i { width: 3px; background: #fff; border-radius: 2px; animation: eq 0.9s ease-in-out infinite; }
.live i:nth-child(2) { animation-delay: -0.3s; }
.live i:nth-child(3) { animation-delay: -0.6s; }
@keyframes eq { 0%, 100% { height: 4px; } 50% { height: 12px; } }

@container (min-width: 560px) {
  .cgrid { grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 12px; }
  .cap b { font-size: 0.82rem; }
}
</style>
