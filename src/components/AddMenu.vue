<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Search, ListEnd, ListMusic } from 'lucide-vue-next'
import { spotify } from '../composables/useSpotify'
import { groups, sectionsOf, loadGroups } from '../composables/useGroups'
import type { Playlist } from '../types'
import { roomKey } from '../lib/room'

// "Add this song": play it next (the queue) at the very top, then a searchable list of my own playlists –
// the ones used lately first. Enter adds to the first match, Esc closes.
const props = withDefaults(defineProps<{ exclude?: string /* the playlist we're looking at */ }>(), { exclude: '' })
const emit = defineEmits<{ queue: []; pick: [playlist: Playlist]; close: [] }>()

const recentKey = (): string => roomKey('niben-recent-playlists')
const q = ref('')
const input = ref<HTMLInputElement | null>(null)
const recentUris = ref<string[]>([])
onMounted(() => {
  loadGroups()
  try { recentUris.value = JSON.parse(localStorage.getItem(recentKey()) || '[]') as string[] } catch {}
  input.value?.focus({ preventScroll: true })
})

const all = computed(() => spotify.playlists.filter((p) => p.editable !== false && p.uri !== props.exclude))
const needle = computed(() => q.value.trim().toLowerCase())
const recents = computed(() => (needle.value ? [] : recentUris.value.map((u) => all.value.find((p) => p.uri === u)).filter((p): p is Playlist => !!p).slice(0, 5)))
const rest = computed(() => (needle.value ? all.value.filter((p) => p.name.toLowerCase().includes(needle.value)) : all.value.filter((p) => !recents.value.includes(p))))
// grouped (when grouping is on and nothing is typed): a heading per group
const sections = computed(() => (groups.on && groups.loaded && !needle.value ? sectionsOf(rest.value, false, true) : null))
const first = computed(() => (needle.value ? rest.value[0] : null))

function pick(p: Playlist) {
  try { localStorage.setItem(recentKey(), JSON.stringify([p.uri, ...recentUris.value.filter((u) => u !== p.uri)].slice(0, 8))) } catch {}
  emit('pick', p)
}
</script>

<template>
  <div class="am" @keydown.esc.stop="emit('close')">
    <button class="queue" @click="emit('queue')"><ListEnd :size="15" />Spill etterpå (kø)</button>
    <label class="search">
      <Search :size="14" aria-hidden="true" />
      <input ref="input" v-model="q" type="search" placeholder="Legg i spilleliste – søk …" aria-label="Søk i spillelistene" @keydown.enter.prevent="first && pick(first)" />
    </label>
    <div class="list">
      <template v-if="recents.length">
        <small>Nylig brukt</small>
        <button v-for="p in recents" :key="'r' + p.uri" class="row" @click="pick(p)"><img v-if="p.thumb || p.image" crossorigin="anonymous" :src="p.thumb || p.image || undefined" alt="" class="cv" loading="lazy" /><span v-else class="cv ph"><ListMusic :size="13" aria-hidden="true" /></span><span>{{ p.name }}</span></button>
        <small v-if="rest.length">Alle spillelister</small>
      </template>
      <template v-if="sections">
        <template v-for="sec in sections" :key="sec.group.id">
          <small>{{ sec.label }}</small>
          <button v-for="p in sec.items" :key="p.uri" class="row" @click="pick(p)"><img v-if="p.thumb || p.image" crossorigin="anonymous" :src="p.thumb || p.image || undefined" alt="" class="cv" loading="lazy" /><span v-else class="cv ph"><ListMusic :size="13" aria-hidden="true" /></span><span>{{ p.name }}</span><i v-if="p.count">{{ p.count }}</i></button>
        </template>
      </template>
      <button v-for="p in (sections ? [] : rest)" :key="p.uri" class="row" :class="{ first: p === first }" @click="pick(p)">
        <img v-if="p.thumb || p.image" crossorigin="anonymous" :src="p.thumb || p.image || undefined" alt="" class="cv" loading="lazy" /><span v-else class="cv ph"><ListMusic :size="13" aria-hidden="true" /></span><span>{{ p.name }}</span><i v-if="p.count">{{ p.count }}</i>
      </button>
      <p v-if="!rest.length && !recents.length" class="none">{{ needle ? 'Ingen treff.' : 'Ingen spillelister du kan legge til i.' }}</p>
    </div>
  </div>
</template>

<style scoped>
.am { display: grid; gap: 6px; padding: 8px; border-radius: 14px; background: var(--glass-strong); border: 1px solid var(--glass-border); min-width: 0; }
.queue { display: flex; align-items: center; gap: 7px; padding: 8px 12px; border: 1px solid #1db954; border-radius: 10px; background: color-mix(in srgb, #1db954 12%, transparent); color: #1db954; font: 700 0.84rem var(--font); cursor: pointer; }
.queue:hover { background: color-mix(in srgb, #1db954 22%, transparent); }
.search { display: flex; align-items: center; gap: 7px; padding: 6px 12px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--bg); color: var(--text-3); }
.search:focus-within { border-color: var(--accent); color: var(--accent); }
.search input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--text); font: 500 0.85rem var(--font); }
.search input::-webkit-search-cancel-button { display: none; }
.list { display: grid; gap: 1px; max-height: 210px; overflow-y: auto; overscroll-behavior: contain; }
.list small { padding: 6px 8px 2px; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.row { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 0; border-radius: 8px; background: transparent; color: var(--text); font: 500 0.85rem var(--font); text-align: left; cursor: pointer; }
.cv { width: 30px; height: 30px; flex: none; border-radius: 5px; object-fit: cover; background: var(--glass-strong); }
.cv.ph { display: grid; place-items: center; color: var(--text-3); }
.row { padding: 5px 8px; }
.row span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row i { font-style: normal; font-size: 0.72rem; color: var(--text-3); font-variant-numeric: tabular-nums; }
.row:hover, .row.first { background: var(--accent-soft); color: var(--accent); }
.none { margin: 0; padding: 8px 10px; color: var(--text-3); font-size: 0.82rem; }
</style>
