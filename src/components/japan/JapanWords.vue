<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Search, Plus, Pencil, Eraser, Trash2, Volume2 } from 'lucide-vue-next'
import { fetchWords, stateOf, STATE_LABEL, deckAction, type JpWord, type WordList } from '@/composables/japan/useJapanese'
import { admin, errorMessage, canManage } from '@/composables/useAdmin'
import { speak, canSpeak } from '@/lib/speak'
import JapanWord from './JapanWord.vue'
import type { Flash } from '@/types'

// Every word in my decks: search (kanji, kana or English), filter by how well I know it, sort.
const words = ref<JpWord[] | null>(null)
const error = ref('')
const q = ref('')
const filter = ref('all')
const sort = ref('freq')
const picked = ref<JpWord | null>(null)
const shown = ref(60)
const decks = ref<NonNullable<WordList['decks']>>([])
async function reload(force = false) {
  try { const r = await fetchWords(force); words.value = r.words; decks.value = r.decks || [] } catch (e) { error.value = errorMessage(e) }
}
onMounted(() => reload())

// my own decks on jpdb (admin): new / rename / empty / delete
const deckMsg = ref<Flash | null>(null)
type DeckOp = 'create' | 'rename' | 'clear' | 'delete'
async function deck(op: DeckOp, d?: { id: number | string; name: string }) {
  let extra: Record<string, unknown> = {}
  if (op === 'create' || op === 'rename') {
    const name = prompt(op === 'create' ? 'Navn på den nye kortstokken:' : 'Nytt navn:', d?.name || '')
    if (!name) return
    extra = { name }
  } else if (!confirm(op === 'clear' ? `Tømme «${d?.name}» for alle ord?` : `Slette kortstokken «${d?.name}» på jpdb?`)) return
  if (d) extra.id = d.id
  try {
    await deckAction(op, extra)
    deckMsg.value = { ok: { create: 'Kortstokken er laget.', rename: 'Navnet er endret.', clear: 'Kortstokken er tømt.', delete: 'Kortstokken er slettet.' }[op] }
    await reload(true)
  } catch (e) {
    deckMsg.value = { error: errorMessage(e) }
  }
}

const FILTERS: [string, string][] = [['all', 'Alle'], ['due', 'Repetisjon'], ['learning', 'Lærer'], ['known', 'Kan'], ['new', 'Nye']]
const counts = computed(() => {
  const c: Record<string, number> = { all: 0, due: 0, learning: 0, known: 0, new: 0 }
  for (const w of words.value || []) { const s = stateOf(w.state); c.all++; if (c[s] !== undefined) c[s] = (c[s] ?? 0) + 1 }
  return c
})
const list = computed(() => {
  const n = q.value.trim().toLowerCase()
  let l = (words.value || []).filter((w) => {
    const s = stateOf(w.state)
    if (s === 'blacklisted') return false
    if (filter.value !== 'all' && s !== filter.value) return false
    return !n || w.spelling.includes(n) || (w.reading || '').includes(n) || (w.meaning || '').toLowerCase().includes(n)
  })
  l = [...l].sort(sort.value === 'freq' ? (a, b) => (a.freq || 1e9) - (b.freq || 1e9) : (a, b) => a.reading.localeCompare(b.reading, 'ja'))
  return l
})
</script>

<template>
  <div class="words">
    <p v-if="error" class="notice error">{{ error }}</p>
    <p v-else-if="!words" class="muted">Henter ordene …</p>
    <template v-else>
      <section v-if="canManage" class="decks">
        <b>Mine kortstokker</b>
        <div class="dl">
          <div v-for="d in decks" :key="d.id" class="dk">
            <span translate="no">{{ d.name }}<small v-if="d.words != null"> · {{ d.words }} ord</small></span>
            <button title="Gi nytt navn" @click="deck('rename', d)"><Pencil :size="13" /></button>
            <button title="Tøm" @click="deck('clear', d)"><Eraser :size="13" /></button>
            <button title="Slett" @click="deck('delete', d)"><Trash2 :size="13" /></button>
          </div>
          <button class="new" @click="deck('create')"><Plus :size="13" />Ny kortstokk</button>
        </div>
        <p v-if="deckMsg?.ok" class="ok">{{ deckMsg.ok }}</p>
        <p v-if="deckMsg?.error" class="notice error">{{ deckMsg.error }}</p>
      </section>
      <label class="find"><Search :size="15" /><input v-model="q" placeholder="Søk: 猫, ねこ eller cat" @input="shown = 60" /></label>
      <div class="filters pills">
        <button v-for="[id, label] in FILTERS" :key="id" :class="{ on: filter === id, [id]: true }" @click="filter = id; shown = 60">{{ label }} <small>{{ counts[id] }}</small></button>
        <select v-model="sort" aria-label="Sorter"><option value="freq">Vanligste først</option><option value="kana">Etter lesning</option></select>
      </div>
      <JapanWord v-if="picked" :key="picked.vid + ':' + picked.sid" :word="picked" @close="picked = null" />
      <ul class="list">
        <li v-for="w in list.slice(0, shown)" :key="w.vid + ':' + w.sid">
          <button :class="{ on: picked === w }" @click="picked = picked === w ? null : w">
            <span class="dot" :class="stateOf(w.state)" :title="STATE_LABEL[stateOf(w.state)]"></span>
            <b lang="ja">{{ w.spelling }}</b>
            <small lang="ja">{{ w.reading !== w.spelling ? w.reading : '' }}</small>
            <span class="m" translate="no">{{ w.meaning }}</span>
            <span v-if="canSpeak()" class="say" role="button" aria-label="Hør ordet" @click.stop="speak(w.reading || w.spelling)"><Volume2 :size="14" /></span>
          </button>
        </li>
      </ul>
      <p v-if="!list.length" class="muted">Ingen ord passer.</p>
      <button v-if="list.length > shown" class="more-btn" @click="shown += 120">Vis flere ({{ list.length - shown }} igjen)</button>
    </template>
  </div>
</template>

<style scoped>
.words { display: grid; gap: 10px; }
.muted { color: var(--text-3); font-size: 0.85rem; margin: 0; }
.find { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 12px; background: var(--glass-strong); border: 1px solid var(--glass-border); color: var(--text-3); }
.find input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--text); font: 500 0.92rem var(--font); outline: none; }
.filters { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.filters select { margin-left: auto; padding: 5px 8px; border-radius: 10px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text); font: 500 0.78rem var(--font); }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.list button { display: grid; grid-template-columns: 10px auto auto minmax(0, 1fr) auto; align-items: baseline; gap: 8px; width: 100%; padding: 7px 10px; border: 0; border-radius: 10px; background: transparent; color: var(--text); text-align: left; cursor: pointer; }
.list button:hover, .list button.on { background: var(--accent-soft); }
.list b { font: 700 1.05rem "Hiragino Sans", "Noto Sans JP", sans-serif; }
.list small { font-size: 0.78rem; color: var(--text-3); }
.m { font-size: 0.8rem; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-3); align-self: center; }
.dot.known { background: #3aa76d; }
.dot.learning { background: #c9a227; }
.dot.due { background: #d24b4b; }
.dot.new { background: #2b6fd6; }
.decks { display: grid; gap: 6px; padding: 10px 12px; border-radius: 14px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.decks > b { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.dl { display: flex; flex-wrap: wrap; gap: 6px; }
.dk { display: inline-flex; align-items: center; gap: 2px; padding: 3px 4px 3px 10px; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--glass); font-size: 0.82rem; }
.dk small { color: var(--text-3); }
.dk button, .new { display: inline-grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 50%; background: transparent; color: var(--text-3); cursor: pointer; }
.dk button:hover { color: var(--accent); background: var(--accent-soft); }
.new { display: inline-flex; width: auto; gap: 4px; padding: 0 12px; border-radius: 999px; border: 1px dashed var(--glass-border); font: 600 0.8rem var(--font); color: var(--text-2); }
.ok { margin: 0; color: #3aa76d; font-size: 0.8rem; }
.say { display: grid; place-items: center; opacity: 0.5; padding: 0 4px; color: var(--accent); }
.say:hover { opacity: 1; }
</style>
