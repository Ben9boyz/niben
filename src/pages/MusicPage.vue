<script setup>
import { ref, computed } from 'vue'
import { Disc3, ListMusic, Search, X } from 'lucide-vue-next'
import { room } from '../composables/useRoom'
import { spotify, useSpotify } from '../composables/useSpotify'
import { shell } from '../composables/useShell'
import NowPlaying from '../components/NowPlaying.vue'
import VinylPanel from '../components/VinylPanel.vue'
import PlaylistPanel from '../components/PlaylistPanel.vue'
import SpotifySearch from '../components/SpotifySearch.vue'
import MiniNowPlaying from '../components/MiniNowPlaying.vue'
import SegSwitch from '../components/SegSwitch.vue'

// Plain version, laid out like Spotify: the library on the left, search + the grid in the middle, what's
// playing on the right. Phones: the search and the Album/Spillelister switch stay at the top while the grid
// scrolls, and what's playing is a small player at the bottom (tap it for the full card).
useSpotify()
const gq = ref('') // one search for playlists, albums and songs
const ipod = computed(() => room.musicView.startsWith('ipod'))
const playing = computed(() => !!spotify.now?.name)
const sheet = ref(false) // phones: the full "now playing" card
const LIB = [{ id: 'vinyl', label: 'Album', icon: Disc3 }, { id: 'ipod', label: 'Spillelister', icon: ListMusic }]
const libView = computed({ get: () => (ipod.value ? 'ipod' : 'vinyl'), set: (v) => { gq.value = ''; show(v) } })

function show(view) {
  room.musicView = view
  // tapping the tab you're on goes back to the grid
  if (view === 'vinyl') room.sel.musikk = null
  else { room.ipod.playlist = null; room.ipod.view = 'menu' }
}
</script>

<template>
  <div class="cpage music" :class="{ app: shell === 'player' }">
    <div class="layout">
      <!-- library -->
      <aside class="lib-col">
        <div class="glass lib-card">
          <b class="lh">Biblioteket</b>
          <nav class="lib" role="tablist" aria-label="Bibliotek">
            <button role="tab" :aria-selected="!ipod" :class="{ on: !ipod && !gq }" @click="gq = ''; show('vinyl')">
              <Disc3 class="ic" :size="19" aria-hidden="true" />Album<small>{{ spotify.albums.length || '' }}</small>
            </button>
            <button role="tab" :aria-selected="ipod" :class="{ on: ipod && !gq }" @click="gq = ''; show('ipod')">
              <ListMusic class="ic" :size="19" aria-hidden="true" />Spillelister<small>{{ spotify.playlists.length || '' }}</small>
            </button>
          </nav>
        </div>
      </aside>

      <!-- search + grid -->
      <main class="main-col">
        <div class="toolbar">
          <SegSwitch v-model="libView" class="seg" :items="LIB" stretch label="Bibliotek" />
          <label class="gsearch">
            <Search :size="16" aria-hidden="true" />
            <input v-model="gq" type="search" placeholder="Søk i spillelister, album og låter …" aria-label="Søk i musikken" />
            <button v-if="gq" type="button" aria-label="Tøm søket" @click="gq = ''"><X :size="15" /></button>
          </label>
        </div>
        <div class="glass main-card">
          <SpotifySearch v-if="gq.trim()" :q="gq" scope="all" />
          <template v-else>
            <PlaylistPanel v-if="ipod" :search="false" />
            <VinylPanel v-else :search="false" />
          </template>
        </div>
      </main>

      <!-- what's playing (the player app has its own bar) -->
      <aside v-if="shell !== 'player'" class="now-col">
        <div class="glass now-card">
          <NowPlaying v-if="playing" stacked />
          <div v-else class="idle">
            <Disc3 :size="28" />
            <b>Ingenting spilles</b>
            <small>Velg et album eller en spilleliste.</small>
          </div>
        </div>
      </aside>
    </div>

    <a v-if="shell !== 'player'" href="#/musicplayer" class="as-player">Åpne som egen musikkspiller</a>

    <!-- phones: a small player above the menu; tap for the full card -->
    <MiniNowPlaying v-if="shell !== 'player' && playing" class="m-mini" @open="sheet = true" />
    <teleport to="body">
      <transition name="fade">
        <div v-if="sheet" class="m-sheet-bg" @click.self="sheet = false">
          <div class="m-sheet glass">
            <button class="m-close" aria-label="Lukk" @click="sheet = false"><X :size="18" /></button>
            <NowPlaying stacked />
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<style scoped>
.music { width: min(1680px, 100%); padding-top: 28px; }
.layout { display: grid; grid-template-columns: 210px minmax(0, 1fr) 300px; gap: 18px; align-items: start; }
.lib-col, .now-col { position: sticky; top: 24px; }
.lib-card { padding: 12px; border-radius: 20px; display: grid; gap: 8px; }
.lh { margin: 2px 6px; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
.lib { display: grid; gap: 2px; }
.lib button { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 0; border-radius: 12px; background: transparent; color: var(--text-2); font: 600 0.92rem var(--font); text-align: left; cursor: pointer; transition: background 0.2s, color 0.2s; }
.lib button:hover { background: var(--accent-soft); color: var(--text); }
.lib button.on { background: var(--accent-soft); color: var(--accent); }
.lib .ic { flex: none; }
.lib small { margin-left: auto; font-weight: 500; opacity: 0.6; font-variant-numeric: tabular-nums; }
.main-col { min-width: 0; display: grid; gap: 12px; }
.toolbar { display: flex; gap: 10px; align-items: center; }
.seg { display: none !important; }
@media (max-width: 820px) { .seg { display: grid !important; } }
.gsearch { flex: 1; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text-3); box-shadow: var(--shadow-1, none); }
.gsearch:focus-within { border-color: var(--accent); color: var(--accent); }
.gsearch input::-webkit-search-cancel-button { display: none; }
.gsearch input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--text); font: 500 0.95rem var(--font); }
.gsearch button { display: grid; place-items: center; border: 0; background: transparent; color: var(--text-3); cursor: pointer; padding: 0; }
.main-card { padding: 16px; border-radius: 22px; container-type: inline-size; min-width: 0; }
.now-card { padding: 12px; border-radius: 22px; }
.idle { display: grid; justify-items: center; gap: 4px; padding: 28px 12px; text-align: center; color: var(--text-3); }
.idle b { color: var(--text-2); font-size: 0.95rem; }
.idle small { font-size: 0.8rem; }
.m-mini { display: none; }
.as-player { display: block; width: max-content; margin: 18px auto 0; font-size: 0.78rem; color: var(--text-3); opacity: 0.7; text-decoration: none; }
.as-player:hover { opacity: 1; color: var(--accent); }

/* in-between widths: no right column – what's playing goes on top of the library */
@media (max-width: 1180px) {
  .layout { grid-template-columns: 250px minmax(0, 1fr); }
  .now-col { grid-column: 1; grid-row: 1; position: static; }
  .lib-col { grid-column: 1; grid-row: 2; top: 24px; }
  .main-col { grid-column: 2; grid-row: 1 / span 2; }
}

/* phones: one column; the switch + search stick under the top bar, a mini player above the menu */
@media (max-width: 820px) {
  .music { padding-top: calc(66px + env(safe-area-inset-top)); }
  .layout { display: block; }
  .lib-col, .now-col { display: none; }
  .toolbar {
    position: sticky; top: calc(60px + env(safe-area-inset-top)); z-index: 6;
    flex-direction: column; align-items: stretch; gap: 8px;
    margin: 0 -16px 12px; padding: 8px 16px 10px;
    background: color-mix(in srgb, var(--bg) 80%, transparent);
    -webkit-backdrop-filter: blur(18px) saturate(140%); backdrop-filter: blur(18px) saturate(140%);
  }
  .gsearch { padding: 9px 14px; }
  .main-card { padding: 10px; padding-bottom: 80px; }
  .m-mini { display: flex; top: auto !important; bottom: calc(72px + env(safe-area-inset-bottom)); left: 10px; right: 10px; width: auto; transition: bottom 0.35s var(--ease, ease); }
}
.m-sheet-bg { position: fixed; inset: 0; z-index: 70; display: flex; align-items: flex-end; background: rgba(0, 0, 0, 0.35); }
.m-sheet { position: relative; width: 100%; padding: 18px 14px calc(18px + env(safe-area-inset-bottom)); border-radius: 24px 24px 0 0; background: var(--bg); }
.m-close { position: absolute; top: 10px; right: 10px; z-index: 2; display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 50%; background: var(--glass-strong); color: var(--text-2); cursor: pointer; }
</style>

<style>
/* player mode has a fixed top bar: the sticky columns stop below it */
@media (min-width: 821px) { html.player-shell .music .lib-col, html.player-shell .music .now-col { top: 84px; } }
/* phones: with the menu slid away, the mini player drops down to where the menu was */
@media (max-width: 820px) { html.nav-hidden .music .m-mini { bottom: calc(14px + env(safe-area-inset-bottom)) !important; } }
</style>
