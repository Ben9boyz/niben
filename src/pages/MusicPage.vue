<script setup>
import { ref } from 'vue'
import { Disc3, ListMusic, Search, X } from 'lucide-vue-next'
import { room } from '../composables/useRoom'
import { spotify, useSpotify } from '../composables/useSpotify'
import { shell } from '../composables/useShell'
import NowPlaying from '../components/NowPlaying.vue'
import VinylPanel from '../components/VinylPanel.vue'
import PlaylistPanel from '../components/PlaylistPanel.vue'
import SpotifySearch from '../components/SpotifySearch.vue'

// Plain version: "now playing" in a sidebar on the left, a Spotify-like library on the right.
// On phones everything stacks.
useSpotify()
const gq = ref('') // one search for playlists, albums and songs

function show(view) {
  room.musicView = view
  // tapping the tab you're on goes back to the grid
  if (view === 'vinyl') room.sel.musikk = null
  else { room.ipod.playlist = null; room.ipod.view = 'menu' }
}
</script>

<template>
  <div class="cpage music">
    <header v-if="shell !== 'player'" class="cpage-head">
      <div class="eyebrow">Musikk</div>
      <h1>Lytteplassen</h1>
    </header>

    <div class="layout">
      <aside class="side">
        <div class="glass side-card">
          <NowPlaying v-if="shell !== 'player'" stacked />
          <nav class="lib" role="tablist" aria-label="Bibliotek">
            <button role="tab" :aria-selected="!room.musicView.startsWith('ipod')" :class="{ on: !room.musicView.startsWith('ipod') }" @click="show('vinyl')">
              <Disc3 class="ic" :size="19" aria-hidden="true" />Album<small>{{ spotify.albums.length || '' }}</small>
            </button>
            <button role="tab" :aria-selected="room.musicView.startsWith('ipod')" :class="{ on: room.musicView.startsWith('ipod') }" @click="show('ipod')">
              <ListMusic class="ic" :size="19" aria-hidden="true" />Spillelister<small>{{ spotify.playlists.length || '' }}</small>
            </button>
          </nav>
        </div>
      </aside>

      <main class="glass main-card">
        <label class="gsearch">
          <Search :size="16" aria-hidden="true" />
          <input v-model="gq" type="search" placeholder="Søk i spillelister, album og låter …" aria-label="Søk i musikken" />
          <button v-if="gq" type="button" aria-label="Tøm søket" @click="gq = ''"><X :size="15" /></button>
        </label>
        <SpotifySearch v-if="gq.trim()" :q="gq" scope="all" />
        <template v-else>
          <PlaylistPanel v-if="room.musicView.startsWith('ipod')" :search="false" />
          <VinylPanel v-else :search="false" />
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.music { width: min(1180px, 100%); }
.layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 18px; align-items: start; }
.side { position: sticky; top: 24px; }
.side-card { display: grid; gap: 14px; padding: 14px; border-radius: 22px; }
.main-card { padding: 18px; border-radius: 22px; container-type: inline-size; min-width: 0; }
.lib { display: grid; gap: 4px; }
.gsearch { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; padding: 9px 14px; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text-3); }
.gsearch:focus-within { border-color: var(--accent); color: var(--accent); }
.gsearch input::-webkit-search-cancel-button { display: none; }
.gsearch input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--text); font: 500 0.95rem var(--font); }
.gsearch button { display: grid; place-items: center; border: 0; background: transparent; color: var(--text-3); cursor: pointer; padding: 0; }
.lib button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--text-2);
  font: 600 0.92rem var(--font);
  text-align: left;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.lib button:hover { background: var(--accent-soft); color: var(--text); }
.lib button.on { background: var(--accent-soft); color: var(--accent); }
.lib .ic { flex: none; }
.lib small { margin-left: auto; font-weight: 500; opacity: 0.6; font-variant-numeric: tabular-nums; }

/* phones / narrow: one column – now playing on top, the tabs side by side */
@media (max-width: 820px) {
  .layout { display: block; } /* (a grid would keep the sticky card inside its own row) */
  /* only the "now playing" card stays at the top while the grid scrolls underneath */
  .side, .side-card { display: contents; }
  .side-card :deep(.now) {
    position: sticky;
    top: 68px;
    z-index: 5;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    backdrop-filter: blur(18px) saturate(140%);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
  .lib { margin: 12px 0; grid-template-columns: 1fr 1fr; padding: 4px; border-radius: 16px; background: var(--glass); border: 1px solid var(--glass-border); }
  .lib button { justify-content: center; padding: 9px 10px; }
  .lib small { margin-left: 4px; }
  .main-card { padding: 12px; }
}
</style>

<style>
/* player mode has a fixed top bar: the sticky card must stop below it, not slide underneath */
@media (min-width: 821px) { html.player-shell .music .side { top: 84px; } }
</style>
