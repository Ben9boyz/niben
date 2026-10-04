<script setup>
import { ref, reactive, computed } from 'vue'
import { ChevronLeft, ArrowUpRight, Plus } from 'lucide-vue-next'
import { useData, reloadData } from '../../composables/useData'
import { api } from '../../composables/useAdmin'
import { parseProgression, findChord } from '../../lib/chords'
import ChordDiagram from '../ChordDiagram.vue'

// Songs to practise in the practice corner: chords, tempo, capo and a link to Ultimate Guitar.
const data = useData()
const songs = computed(() => data.sanger || [])
const editing = ref(null)
const msg = ref(null)
const busy = ref(false)

function edit(s) {
  msg.value = null
  editing.value = reactive(s
    ? { id: s.id, title: s.tittel, artist: s.artist || '', chords: s.akkorder, bpm: s.bpm || '', beats: s.slag || 4, capo: s.capo || 0, ug_url: s.ug || '', notes: s.notat || '', sheet: s.ark || '' }
    : { id: null, title: '', artist: '', chords: '', bpm: 80, beats: 4, capo: 0, ug_url: '', notes: '', sheet: '' })
}
const chordList = computed(() => [...new Set(parseProgression(editing.value?.chords))])
const ugSearch = computed(() => {
  const e = editing.value
  return `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(`${e?.artist || ''} ${e?.title || ''}`.trim())}`
})

async function save() {
  busy.value = true
  msg.value = null
  try {
    await api('song_save', { ...editing.value })
    await reloadData()
    editing.value = null
    msg.value = { ok: 'Lagret.' }
  } catch (e) {
    msg.value = { error: e.message }
  } finally {
    busy.value = false
  }
}
async function remove() {
  const e = editing.value
  if (!e.id || !confirm(`Slette «${e.title}»?`)) return
  try {
    await api('song_delete', { id: e.id })
    await reloadData()
    editing.value = null
  } catch (err) {
    msg.value = { error: err.message }
  }
}
</script>

<template>
  <div>
    <p v-if="msg?.ok && !editing" class="notice ok">{{ msg.ok }}</p>

    <div v-if="!editing">
      <div class="bar">
        <p class="muted">{{ songs.length }} sanger å øve på</p>
        <button class="btn primary small" @click="edit(null)"><Plus :size="15" />Ny sang</button>
      </div>
      <div v-if="!songs.length" class="empty">Ingen sanger ennå.</div>
      <button v-for="s in songs" :key="s.id" class="item" @click="edit(s)">
        <span class="meta"><b>{{ s.tittel }}</b><small>{{ s.artist || '—' }} · {{ s.akkorder }}</small></span>
      </button>
    </div>

    <form v-else class="form" @submit.prevent="save">
      <button type="button" class="back" @click="editing = null"><ChevronLeft :size="16" />Tilbake</button>
      <div class="form-row">
        <label class="field"><span>Tittel *</span><input v-model="editing.title" required placeholder="F.eks. Wonderwall" /></label>
        <label class="field"><span>Artist</span><input v-model="editing.artist" placeholder="Oasis" /></label>
      </div>
      <label class="field">
        <span>Akkorder * <small>i rekkefølgen de spilles, f.eks. «Em7 G Dsus4 A7sus4»</small></span>
        <input v-model="editing.chords" required placeholder="G D Em C" />
      </label>
      <div v-if="chordList.length" class="preview">
        <ChordDiagram v-for="c in chordList" :key="c" :name="c" :size="64" :class="{ missing: !findChord(c) }" />
      </div>
      <div class="form-row three">
        <label class="field"><span>Tempo (BPM)</span><input v-model.number="editing.bpm" type="number" min="30" max="260" /></label>
        <label class="field"><span>Slag per akkord</span><input v-model.number="editing.beats" type="number" min="1" max="16" /></label>
        <label class="field"><span>Capo</span><input v-model.number="editing.capo" type="number" min="0" max="12" /></label>
      </div>
      <label class="field">
        <span>Lenke til Ultimate Guitar</span>
        <input v-model="editing.ug_url" type="url" placeholder="https://tabs.ultimate-guitar.com/tab/…" />
        <small><a :href="ugSearch" target="_blank" rel="noopener">Søk etter sangen på Ultimate Guitar <ArrowUpRight :size="12" /></a> – kopier lenken til akkordene du bruker.</small>
      </label>
      <label class="field">
        <span>Akkordark <small>for deg selv – vises bare når du er innlogget</small></span>
        <textarea v-model="editing.sheet" placeholder="[Vers]&#10;Am  F  C  G&#10;(tekst under, hvis du vil)&#10;&#10;[Refreng]&#10;F  C  G  Am" style="min-height: 180px; font-family: ui-monospace, Menlo, monospace"></textarea>
        <small>Ei linje med bare akkorder blir uthevet og kan transponeres. «[Vers]» på egen linje starter en ny del.</small>
      </label>
      <label class="field"><span>Notat</span><textarea v-model="editing.notes" placeholder="Slagmønster, hva du øver på …" style="min-height: 70px"></textarea></label>
      <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>
      <div class="form-actions">
        <button class="btn primary" :disabled="busy">{{ busy ? 'Lagrer …' : 'Lagre' }}</button>
        <span class="spacer"></span>
        <button v-if="editing.id" type="button" class="btn danger small" @click="remove">Slett</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.bar .btn { display: inline-flex; align-items: center; gap: 4px; }
.muted { color: var(--text-3); font-size: 0.88rem; }
.item { display: flex; align-items: center; width: 100%; padding: 10px; margin-bottom: 4px; border: 0; border-radius: 12px; background: transparent; color: var(--text); text-align: left; cursor: pointer; }
.item:hover { background: var(--accent-soft); }
.meta { display: flex; flex-direction: column; min-width: 0; }
.meta small { color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.back { justify-self: start; border: 0; background: var(--accent-soft); color: var(--accent); padding: 6px 12px; border-radius: 999px; font-weight: 600; cursor: pointer; }
.field small { color: var(--text-3); font-weight: 500; }
.field small a { color: var(--accent); display: inline-flex; align-items: center; gap: 2px; }
.preview { display: flex; flex-wrap: wrap; gap: 8px; }
.preview .missing { opacity: 0.6; }
.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
</style>
