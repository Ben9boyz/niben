<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { defineAsyncComponent } from 'vue'
import { Disc3, ListMusic, Library, Search, X, Sparkles } from 'lucide-vue-next'
import { room } from '../composables/useRoom'
import { spotify, useSpotify } from '../composables/useSpotify'
import { shell } from '../composables/useShell'
import NowPlaying from '../components/NowPlaying.vue'
import VinylPanel from '@/components/vinyl/VinylPanel.vue'
import PlaylistPanel from '../components/PlaylistPanel.vue'
import SpotifySearch from '../components/SpotifySearch.vue'
import MiniNowPlaying from '../components/MiniNowPlaying.vue'
import SegSwitch from '@/components/ui/SegSwitch.vue'
import FolderTree from '../components/FolderTree.vue'
import ArtistTree from '../components/ArtistTree.vue'
import AllPanel from '../components/AllPanel.vue'
const DiscoverContent = defineAsyncComponent(() => import('@/components/content/DiscoverContent.vue'))
import QueuePanel from '../components/QueuePanel.vue'
import { loadGroups, groups, select } from '../composables/useGroups'
import { peek, peekBack, peekClear } from '../composables/useBrowse'
import MusicDetail from '../components/MusicDetail.vue'
import ArtistPage from '../components/ArtistPage.vue'
import MobileMusicBar from '../components/MobileMusicBar.vue'

// Plain version, laid out like Spotify: the library on the left, search + the grid in the middle, what's
// playing on the right. Phones: the search and the Album/Spillelister switch stay at the top while the grid
// scrolls, and what's playing is a small player at the bottom (tap it for the full card).
useSpotify()
loadGroups()
const gq = ref('') // one search for playlists, albums and songs
// phones: laid out like Spotify – the library and the search are two tabs in a bar at the bottom, with the player on top of it
const phoneMq = window.matchMedia('(max-width: 820px)')
const phone = ref(phoneMq.matches)
const onMq = () => { phone.value = phoneMq.matches }
onMounted(() => phoneMq.addEventListener('change', onMq))
onBeforeUnmount(() => phoneMq.removeEventListener('change', onMq))
const tab = ref<'library' | 'search'>('library')
const ipod = computed(() => room.musicView.startsWith('ipod'))
const playing = computed(() => !!spotify.now?.name)
const sheet = ref(false) // phones: the full "now playing" card
const LIB = [{ id: 'vinyl', label: 'Album', icon: Disc3 }, { id: 'ipod', label: 'Spillelister', icon: ListMusic }]
// "Alt": playlists and albums together (remembered)
const allMode = ref((() => { try { return localStorage.getItem('niben-lib-all') === '1' } catch { return false } })())
const setAll = (v: boolean) => { allMode.value = v; try { localStorage.setItem('niben-lib-all', v ? '1' : '0') } catch {} }
const libView = computed<'all' | 'ipod' | 'vinyl'>({ get: () => (allMode.value ? 'all' : ipod.value ? 'ipod' : 'vinyl'), set: (v) => { gq.value = ''; if (v === 'all') { setAll(true); peekClear(); room.sel.musikk = null; room.ipod.playlist = null; room.ipod.view = 'menu' } else { setAll(false); show(v) } } })
const showAll = computed(() => allMode.value && !room.sel.musikk && !room.ipod.playlist)
const top = computed(() => peek.stack[peek.stack.length - 1] || null)
const backLabel = computed(() => (peek.stack.length > 1 ? 'Tilbake' : gq.value.trim() ? 'Tilbake til søket' : 'Tilbake'))

const byArtist = computed(() => !ipod.value && !showAll.value && !room.discover && groups.on && groups.view === 'artist')
const hasTree = computed(() => groups.on && groups.loaded && !byArtist.value && !room.discover) // ("Alt" has its folders too: they work across albums and playlists)

function setTab(t: 'library' | 'search') {
  if (t === tab.value && !top.value && !room.sel.musikk && !room.ipod.playlist) return
  tab.value = t
  peekClear()
  room.sel.musikk = null
  room.ipod.playlist = null
  room.ipod.view = 'menu'
  if (t === 'library') gq.value = ''
}
const chip = computed(() => (room.discover ? 'discover' : libView.value))
function pickChip(id: string) {
  peekClear()
  room.sel.musikk = null
  if (id === 'discover') { room.discover = true; return }
  room.discover = false
  if (id === 'all' || id === 'ipod' || id === 'vinyl') libView.value = id
}
const CHIPS = [{ id: 'vinyl', label: 'Album' }, { id: 'ipod', label: 'Spillelister' }, { id: 'all', label: 'Alt' }, { id: 'discover', label: 'Oppdag' }]

function show(view: 'vinyl' | 'ipod') {
  peekClear()
  room.musicView = view
  // tapping the tab you're on goes back to the grid
  if (view === 'vinyl') room.sel.musikk = null
  else { room.ipod.playlist = null; room.ipod.view = 'menu' }
}
</script>

<template>
  <div class="cpage music" :class="{ app: shell === 'player', phone }">
    <p v-if="spotify.denied" class="denied" role="alert">Spotify slipper ikke denne kontoen inn ennå, så hylla er tom. Eieren av siden må legge til e-posten din i Spotify-dashboardet – prøv deretter «Koble til på nytt» under Admin → Tilkoblinger.</p>
    <!-- phones: like Spotify – the library or the search fills the screen; the player + the two tabs sit together at the bottom -->
    <div v-if="phone" class="mobile">
      <main class="m-main">
        <div class="glass main-card">
          <template v-if="top">
            <MusicDetail v-if="top.kind === 'album'" :key="top.item.uri" :item="top.item" kind="album" :back-label="backLabel" @back="peekBack" />
            <ArtistPage v-else :key="top.item.id || top.item.name" :artist="top.item" :back-label="backLabel" @back="peekBack" />
          </template>
          <template v-else-if="tab === 'search'">
            <label class="gsearch big">
              <Search :size="18" aria-hidden="true" />
              <input v-model="gq" type="search" placeholder="Hva vil du høre?" aria-label="Søk i musikken" autofocus />
              <button v-if="gq" type="button" aria-label="Tøm søket" @click="gq = ''"><X :size="16" /></button>
            </label>
            <SpotifySearch v-if="gq.trim()" :q="gq" scope="all" :tab="ipod ? 'ipod' : 'vinyl'" />
            <p v-else class="m-hint">Søk etter album, spillelister og låter.</p>
          </template>
          <template v-else>
            <div v-if="!room.sel.musikk && !room.ipod.playlist" class="chips pills" role="tablist" aria-label="Bibliotek">
              <button v-for="c in CHIPS" :key="c.id" role="tab" :aria-selected="chip === c.id" :class="{ on: chip === c.id }" @click="pickChip(c.id)">{{ c.label }}</button>
            </div>
            <DiscoverContent v-if="room.discover" />
            <AllPanel v-else-if="showAll" />
            <PlaylistPanel v-else-if="ipod" :search="false" />
            <VinylPanel v-else :search="false" />
          </template>
        </div>
      </main>
      <MobileMusicBar :tab="tab" @tab="setTab" @open="sheet = true" />
    </div>

    <div v-else class="layout">
      <!-- library -->
      <aside class="lib-col">
        <div class="glass lib-card">
          <b class="lh">Biblioteket</b>
          <nav class="lib" role="tablist" aria-label="Bibliotek">
            <button role="tab" :aria-selected="!ipod && !allMode" :class="{ on: !ipod && !allMode && !gq && !room.discover }" @click="gq = ''; room.discover = false; setAll(false); show('vinyl')">
              <Disc3 class="ic" :size="19" aria-hidden="true" />Album<small>{{ spotify.albums.length || '' }}</small>
            </button>
            <button role="tab" :aria-selected="ipod && !allMode" :class="{ on: ipod && !allMode && !gq && !room.discover }" @click="gq = ''; room.discover = false; setAll(false); show('ipod')">
              <ListMusic class="ic" :size="19" aria-hidden="true" />Spillelister<small>{{ spotify.playlists.length || '' }}</small>
            </button>
            <button role="tab" :aria-selected="allMode" :class="{ on: allMode && !gq && !room.discover }" @click="room.discover = false; libView = 'all'">
              <Library class="ic" :size="19" aria-hidden="true" />Alt<small>{{ spotify.albums.length + spotify.playlists.length || '' }}</small>
            </button>
            <button role="tab" :aria-selected="room.discover" :class="{ on: room.discover && !gq }" @click="gq = ''; peekClear(); room.sel.musikk = null; room.discover = true">
              <Sparkles class="ic" :size="19" aria-hidden="true" />Oppdag
            </button>
          </nav>
          <!-- the folders of whatever I'm looking at: Album or Spillelister -->
          <div v-if="byArtist" class="mapper">
            <b class="lh">Artister</b>
            <ArtistTree @pick="gq = ''; peekClear()" />
          </div>
          <div v-else-if="hasTree" class="mapper">
            <b class="lh">Mapper</b>
            <FolderTree :kind="showAll ? 'all' : ipod ? 'playlist' : 'album'" @pick="gq = ''; peekClear(); select($event)" />
          </div>
          <a v-if="shell !== 'player'" href="#/musicplayer" class="as-player">Åpne som egen musikkspiller</a>
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
          <template v-if="top">
            <MusicDetail v-if="top.kind === 'album'" :key="top.item.uri" :item="top.item" kind="album" :back-label="backLabel" @back="peekBack" />
            <ArtistPage v-else :key="top.item.id || top.item.name" :artist="top.item" :back-label="backLabel" @back="peekBack" />
          </template>
          <SpotifySearch v-else-if="gq.trim()" :q="gq" scope="all" :tab="ipod ? 'ipod' : 'vinyl'" />
          <DiscoverContent v-else-if="room.discover" />
          <AllPanel v-else-if="showAll" />
          <template v-else>
            <PlaylistPanel v-if="ipod" :search="false" />
            <VinylPanel v-else :search="false" />
          </template>
        </div>
      </main>

      <!-- what's playing + the queue -->
      <aside class="now-col">
        <div class="glass now-card">
          <NowPlaying v-if="playing" stacked />
          <div v-else class="idle">
            <Disc3 :size="28" />
            <b>Ingenting spilles</b>
            <small>Velg et album eller en spilleliste.</small>
          </div>
          <!-- the queue is always there in this view -->
          <QueuePanel class="queue" always :flat="ipod" />
        </div>
      </aside>
    </div>

    <!-- phones: a small player above the menu; tap for the full card -->
    <teleport to="body">
      <transition name="fade">
        <div v-if="sheet" class="m-sheet-bg" @click.self="sheet = false">
          <div class="m-sheet glass">
            <button class="m-close" aria-label="Lukk" @click="sheet = false"><X :size="18" /></button>
            <NowPlaying stacked />
            <QueuePanel class="queue" collapsible :flat="ipod" />
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<style scoped>
.denied { margin: 0 0 10px; padding: 10px 14px; border-radius: 14px; background: color-mix(in srgb, #e0705f 18%, transparent); color: var(--text); font-size: 0.88rem; }
.music { width: min(1680px, 100%); padding-top: 20px; }
/* PC: the page is exactly one screen tall – nothing to scroll except inside the cards, so nothing jumps */
@media (min-width: 821px) { .music { padding-bottom: 20px; } }
.layout { display: grid; grid-template-columns: 210px minmax(0, 1fr) 300px; gap: 18px; align-items: start; }
.lib-col, .now-col { position: sticky; top: 20px; }
/* a card taller than the screen scrolls inside itself instead of being cut off */
.lib-card, .now-card { max-height: calc(100dvh - 40px); overflow-y: auto; overscroll-behavior: contain;  }
.lib-card { padding: 12px; border-radius: 20px; display: grid; gap: 8px; }
.lh { margin: 2px 6px; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
.lib { display: grid; gap: 2px; }
.mapper { display: grid; gap: 2px; padding-top: 8px; margin-top: 4px; border-top: 1px solid var(--glass-border); }
.lib button { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 0; border-radius: 12px; background: transparent; color: var(--text-2); font: 600 0.92rem var(--font); text-align: left; cursor: pointer; transition: background 0.2s, color 0.2s; }
.lib button:hover { background: var(--accent-soft); color: var(--text); }
.lib button.on { background: var(--accent-soft); color: var(--accent); }
.lib .ic { flex: none; }
.lib small { margin-left: auto; font-weight: 500; opacity: 0.6; font-variant-numeric: tabular-nums; }
.main-col { min-width: 0; display: grid; gap: 12px; }
.toolbar { display: flex; gap: 10px; align-items: center; }
/* PC: the search and the card stay put; the grid scrolls inside the card and disappears under its header
   (ALBUM + the group buttons) – nothing ever moves above the search line, the library or what's playing */
@media (min-width: 821px) {
  .main-col { position: sticky; top: 20px; height: calc(100dvh - 40px); grid-template-rows: auto minmax(0, 1fr); gap: 12px; }
  .main-card { overflow-y: auto; overscroll-behavior: contain;  min-height: 0; }
}
.seg { display: none !important; }
@media (max-width: 820px) { .seg { display: grid !important; } }
.gsearch { flex: 1; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text-3); box-shadow: var(--shadow-1, none); }
.gsearch:focus-within { border-color: var(--accent); color: var(--accent); }
.gsearch input::-webkit-search-cancel-button { display: none; }
.gsearch input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--text); font: 500 0.95rem var(--font); }
.gsearch button { display: grid; place-items: center; border: 0; background: transparent; color: var(--text-3); cursor: pointer; padding: 0; }
.main-card { padding: 16px; border-radius: 22px; container-type: inline-size; min-width: 0; }
.now-card { padding: 12px; border-radius: 22px; display: grid; gap: 12px; }
.queue { background: transparent; border: 0; padding: 0; }
.m-sheet { max-height: 88dvh; overflow-y: auto; }
.m-sheet .queue { margin-top: 12px; }
.idle { display: grid; justify-items: center; gap: 4px; padding: 28px 12px; text-align: center; color: var(--text-3); }
.idle b { color: var(--text-2); font-size: 0.95rem; }
.idle small { font-size: 0.8rem; }
.m-mini { display: none; }
/* phones, the Spotify-like layout */
.mobile { min-width: 0; }
.m-main { padding-bottom: calc(158px + env(safe-area-inset-bottom)); }
.chips { display: flex; gap: 6px; overflow-x: auto; padding: 0 0 10px; margin: 0 -2px; scrollbar-width: none; }
.chips::-webkit-scrollbar { display: none; }
.chips button { flex: none; }
.gsearch.big { margin-bottom: 12px; padding: 12px 16px; }
.m-hint { margin: 18px 4px; color: var(--text-3); font-size: 0.9rem; text-align: center; }
.as-player { display: block; width: max-content; margin: 10px auto 2px; font-size: 0.78rem; color: var(--text-3); opacity: 0.7; text-decoration: none; }
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
  .m-mini { display: flex; top: auto !important; bottom: calc(14px + env(safe-area-inset-bottom)); left: 16px; right: 16px; width: auto; transition: bottom 0.35s var(--ease, ease); }
}
.m-sheet-bg { position: fixed; inset: 0; z-index: 70; display: flex; align-items: flex-end; background: rgba(0, 0, 0, 0.35); }
.m-sheet { position: relative; width: 100%; padding: 56px 14px calc(18px + env(safe-area-inset-bottom)); border-radius: 24px 24px 0 0; background: var(--bg); }
.m-close { position: absolute; top: 10px; right: 10px; z-index: 2; display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 50%; background: var(--glass-strong); color: var(--text-2); cursor: pointer; }
</style>

<style>
@media (min-width: 821px) { html.player-shell .music.cpage { padding-top: 84px; padding-bottom: 20px; } }
/* the header of the grid (name + group buttons) sticks to the top of the card; tiles vanish under it */
@media (min-width: 821px) {
  .main-card .stick { position: sticky; top: -16px; z-index: 4; margin: -16px -16px 0; padding: 10px 16px 10px; background: linear-gradient(var(--glass), var(--glass)), var(--bg); }
  html.player-shell .music .main-col { top: 84px; height: calc(100dvh - 104px); }
}
/* player mode has a fixed top bar: the sticky columns stop below it */
@media (min-width: 821px) { html.player-shell .music .lib-col, html.player-shell .music .now-col { top: 84px; } html.player-shell .music .lib-card, html.player-shell .music .now-card { max-height: calc(100dvh - 104px); } }
/* phones: with the menu slid away, the mini player drops down to where the menu was */
/* the player view has no menu at the bottom: the mini player sits at the very bottom */
@media (max-width: 820px) { html.player-shell .music .m-mini { bottom: calc(14px + env(safe-area-inset-bottom)) !important; } }
@media (max-width: 820px) { html.nav-hidden .music .m-mini { bottom: calc(14px + env(safe-area-inset-bottom)) !important; } }
</style>
