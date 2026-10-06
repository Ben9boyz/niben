<script setup lang="ts" generic="T extends GridItem">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { Music, Play, Pause } from 'lucide-vue-next'
import { libView } from '@/composables/music/useLibView'
import { spotify } from '@/composables/music/useSpotify'
import { playItem, itemMenu } from '@/lib/menus'
import { showMenu, longPress, type MenuPoint } from '@/composables/useContextMenu'
import { admin } from '@/composables/site/useAdmin'
import { selectOf } from '@/lib/dom'
import type { GridItem } from '@/types'

// Grid of square covers (records and playlists). The name shows on hover.
const props = withDefaults(defineProps<{
  items: T[]
  selectedUri?: string | null
  playingUri?: string | null
  cursorUri?: string | null // the iPod's highlighted row
  // groups: tiles can be dragged to a folder (PC); with `movable` each also gets a group picker (touch screens)
  draggable?: boolean
  movable?: boolean
  groups?: { id: string; name: string; depth?: number }[]
  groupOf?: ((uri: string) => string | null) | null // uri -> group id
  guessed?: string[] // uris whose group is only a guess
  why?: Record<string, string> // uri -> what the guess was based on
}>(), { selectedUri: null, playingUri: null, cursorUri: null, groups: () => [], groupOf: null, guessed: () => [], why: () => ({}) })
const emit = defineEmits<{ pick: [item: T]; hover: [item: T]; move: [uri: string, group: string]; dragitem: [item: T] }>()

// the little play button on a cover: starts the album from its first song (albums always play in order),
// a playlist the way it is set up. What's already playing just pauses / resumes. Right-click (long press on a
// phone) opens the menu with queue, artist, folder …
const go = playItem
const menu = (e: MenuPoint, it: T) => showMenu(e, it.name, itemMenu(it, () => emit('pick', it)))
const holds = (it: T) => longPress((e) => menu(e, it))
const playable = (it: T) => admin.mine && /^spotify:(album|playlist):/.test(it.uri || '')
// phones can show the library as a list (see useLibView)
const mq = window.matchMedia('(max-width: 820px)')
const small = ref(mq.matches)
const onMq = () => { small.value = mq.matches }
onMounted(() => mq.addEventListener('change', onMq))
onBeforeUnmount(() => mq.removeEventListener('change', onMq))
const asList = computed(() => libView.list && small.value && !props.movable)
</script>

<template>
  <div class="cgrid" :class="{ list: asList }">
    <slot name="lead" />
    <div v-for="it in items" :key="it.uri" class="cell" :class="{ row: asList }" :data-uri="it.uri" :draggable="draggable || undefined" @contextmenu="menu($event, it)" v-on="holds(it)">
      <button
        class="tile"
        :class="{ on: it.uri === selectedUri, playing: it.uri === playingUri, cursor: it.uri === cursorUri }"
        :aria-label="`${it.name}${it.sub ? ` – ${it.sub}` : ''}`"
        @click="emit('pick', it)"
        @mouseenter="emit('hover', it)"
      >
        <img crossorigin="anonymous" v-if="it.image" :src="it.image" alt="" loading="lazy" />
        <span v-else class="ph"><Music :size="28" /></span>
        <span v-if="!asList" class="cap" translate="no"><b>{{ it.name }}</b><small v-if="it.sub">{{ it.sub }}</small></span>
        <span v-if="it.uri === playingUri" class="live" title="Spilles nå"><i></i><i></i><i></i></span>
      </button>
      <span v-if="asList" class="lt" translate="no" @click="emit('pick', it)"><b>{{ it.name }}</b><small v-if="it.sub">{{ it.sub }}</small></span>
      <button v-if="playable(it)" class="pl" :class="{ now: it.uri === playingUri }" :title="it.uri === playingUri && spotify.now?.playing ? 'Pause' : 'Spill av fra første låt'" :aria-label="`Spill ${it.name}`" @click.stop="go(it)">
        <Pause v-if="it.uri === playingUri && spotify.now?.playing" :size="15" fill="currentColor" /><Play v-else :size="15" fill="currentColor" />
      </button>
      <template v-if="movable">
        <span v-if="guessed.includes(it.uri)" class="guess" :title="why[it.uri] ? `Gjettet ut fra: ${why[it.uri]}` : 'Gruppen er et gjett – flytt eller bekreft'">gjettet</span>
        <select class="mv" :value="groupOf?.(it.uri) || ''" :aria-label="`Gruppe for ${it.name}`" @change="emit('move', it.uri, selectOf($event).value)" @click.stop>
          <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.depth ? '↳ ' : '' }}{{ g.name }}</option>
        </select>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* list mode (phones): a row per album / playlist */
.cgrid.list { grid-template-columns: 1fr; gap: 2px; }
.cell.row { display: flex; align-items: center; gap: 12px; padding: 5px 4px; border-radius: 12px; }
.cell.row:active { background: var(--accent-soft); }
.cell.row .tile { flex: none; width: 56px; height: 56px; aspect-ratio: auto; border-radius: 8px; box-shadow: none; }
.cell.row .tile:hover { transform: none; box-shadow: none; }
.lt { display: grid; min-width: 0; flex: 1; line-height: 1.25; cursor: pointer; }
.lt b { font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lt small { font-size: 0.8rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cell.row .pl { position: static; opacity: 1; transform: none; flex: none; display: grid !important; width: 38px; height: 38px; box-shadow: none; }
/* touch screens: the names are always there (no hover) */
@media (hover: none) { .cgrid:not(.list) .cap { opacity: 1; transform: none; padding-top: 18px; } }
.cgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 10px; }
.cell { position: relative; min-width: 0; }
.cell[draggable="true"] { cursor: grab; }
/* drag & drop is how it works with a mouse; the picker is for touch screens */
@media (hover: hover) and (pointer: fine) { .mv { display: none; } }
.mv { position: absolute; left: 4px; right: 4px; bottom: 4px; z-index: 3; width: calc(100% - 8px); padding: 3px 4px; border: 0; border-radius: 6px; background: rgba(0, 0, 0, 0.72); color: #fff; font: 600 0.66rem var(--font); }
.guess { position: absolute; left: 4px; top: 4px; z-index: 3; padding: 1px 6px; border-radius: 999px; background: #f0a040; color: #fff; font: 700 0.6rem var(--font); }
.pl { position: absolute; right: 7px; bottom: 7px; z-index: 2; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: #1db954; color: #fff; box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4); cursor: pointer; opacity: 0; transform: translateY(6px); transition: opacity 0.18s, transform 0.18s, filter 0.15s; }
.cell:hover .pl, .pl:focus-visible { opacity: 1; transform: none; }
.pl:hover { filter: brightness(1.1); transform: scale(1.08); }
@media (hover: none) { .pl { opacity: 0.95; transform: none; width: 30px; height: 30px; } } /* touch screens without hover (tablets, touch laptops): always visible */
@media (hover: none) and (pointer: coarse) and (max-width: 720px) { .pl { display: none; } } /* phones only: just tap the cover to open it – no green play button */
.tile {
  position: relative;
  width: 100%;
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
