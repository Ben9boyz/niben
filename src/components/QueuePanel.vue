<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ListMusic, Music, ChevronRight, Pencil, Check, X, ArrowUp, ArrowDown, GripVertical, Trash2 } from 'lucide-vue-next'
import { spotify, fetchQueue, fetchTracks, fmtClock, queueState, queueSave } from '../composables/useSpotify'
import { queueDrop, queueOver, drag } from '../composables/useDrag'
import { admin } from '../composables/useAdmin'

// Under "now playing": what plays next, grouped by album. First what I've queued ("Din kø"), then the rest of the album
// / playlist that is playing. Tap an album to see its songs. As admin: "Rediger" – drag albums (or songs) around, move
// them with the arrows, or delete them. Everything is sent to Spotify as one list (see _queue.inc.php).
const props = defineProps({ flat: Boolean, collapsible: Boolean }) // flat: every song on its own (playlists) · collapsible: can be folded away (3D panel, mini player)
const pos = ref(null) // { n, of } while an album plays
let timer = 0
let soon = 0
const KEY = 'niben-queue-open'
const shut = ref(props.collapsible && (() => { try { return localStorage.getItem(KEY) === '0' } catch { return false } })())
function toggleShut() { if (!props.collapsible) return; shut.value = !shut.value; try { localStorage.setItem(KEY, shut.value ? '0' : '1') } catch {} }
const open = ref(new Set()) // groups that are unfolded (by key)
const editing = ref(false)

const items = computed(() => queueState.items)
const nq = computed(() => queueState.nq)

// the list as groups: songs that directly follow each other on the same album (and in the album's order) are one tile.
// A group never spans the line between "my queue" and "the rest".
const groups = computed(() => {
  const out = []
  items.value.forEach((t, idx) => {
    const last = out[out.length - 1]
    const prev = last?.tracks[last.tracks.length - 1]
    const inOrder = !prev || prev.item.no == null || t.no == null || (t.disc === prev.item.disc ? t.no === prev.item.no + 1 : t.no === 1)
    const sameSeg = last && (last.mine === idx < nq.value)
    if (!props.flat && last && sameSeg && t.album_uri && last.uri === t.album_uri && inOrder) last.tracks.push({ item: t, idx })
    else out.push({ key: `${t.uri}#${idx}`, uri: t.album_uri, name: props.flat ? t.name : t.album || t.name, image: t.album_image || t.img, mine: idx < nq.value, tracks: [{ item: t, idx }] })
  })
  return out
})
const mineGroups = computed(() => groups.value.filter((g) => g.mine))
const restGroups = computed(() => groups.value.filter((g) => !g.mine))
const restLabel = computed(() => (spotify.now?.album ? `Resten av «${spotify.now.album}»` : 'Det som kommer etterpå'))
const minutes = (g) => fmtClock(g.tracks.reduce((a, t) => a + (t.item.ms || 0), 0) / 1000)
const single = (g) => g.tracks.length === 1
function toggle(g) { const o = new Set(open.value); o.has(g.key) ? o.delete(g.key) : o.add(g.key); open.value = o }

// ── editing: rebuild the list from the groups (with a divider between "mine" and "the rest") and save ──
const DIV = { divider: true }
function commit(seq) {
  const flat = []
  let n = 0, seen = false
  for (const g of seq) {
    if (g === DIV) { seen = true; continue }
    for (const t of g.tracks) flat.push(t.item)
    if (!seen) n = flat.length
  }
  queueSave(flat, seen ? n : flat.length)
}
const seqNow = () => [...mineGroups.value, DIV, ...restGroups.value]
function moveGroup(g, d) {
  const seq = seqNow()
  const i = seq.indexOf(g)
  const j = i + d
  if (i < 0 || j < 0 || j >= seq.length) return
  ;[seq[i], seq[j]] = [seq[j], seq[i]]
  commit(seq)
}
function removeGroup(g) { commit(seqNow().filter((x) => x !== g)) }
function removeTrack(g, j) {
  if (single(g)) return removeGroup(g)
  const seq = seqNow()
  const k = seq.indexOf(g)
  seq[k] = { ...g, tracks: g.tracks.filter((_, x) => x !== j) }
  commit(seq)
}
function moveTrack(g, j, d) {
  const k = j + d
  if (k < 0 || k >= g.tracks.length) return
  const seq = seqNow()
  const tr = [...g.tracks]
  ;[tr[j], tr[k]] = [tr[k], tr[j]]
  seq[seq.indexOf(g)] = { ...g, tracks: tr }
  commit(seq)
}
function clearAll() { if (confirm('Tømme hele køen?')) queueSave([], 0) }
// drag & drop (PC): drop a group on another group to put it there; the arrows do the same on touch screens
const dragging = ref(null)
const overKey = ref(null)
function onDragStart(e, g) { dragging.value = g; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', g.key) }
function onDragOver(e, key) { if (!dragging.value) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; overKey.value = key }
function onDrop(e, target) {
  e.preventDefault()
  const g = dragging.value
  dragging.value = overKey.value = null
  if (!g || g === target) return
  const seq = seqNow().filter((x) => x !== g)
  const at = target === DIV ? seq.indexOf(DIV) : seq.indexOf(target)
  const before = seqNow().indexOf(g) < seqNow().indexOf(target) // dragged down: after the target; dragged up: before it
  seq.splice(before && target !== DIV ? at + 1 : at, 0, g)
  commit(seq)
}
const onDragEnd = () => { dragging.value = overKey.value = null }

async function load() { await fetchQueue() }
async function where() {
  const ctx = spotify.now?.context
  if (!ctx?.startsWith('spotify:album:')) { pos.value = null; return }
  const list = (await fetchTracks(ctx)).tracks || []
  const i = list.findIndex((t) => t.uri === spotify.now?.uri)
  pos.value = i >= 0 ? { n: i + 1, of: list.length } : null
}
watch(() => spotify.now?.uri, () => { open.value = new Set(); clearTimeout(soon); soon = setTimeout(() => { load(); where() }, 600) }, { immediate: true })
watch(() => spotify.queueV, () => { if (!editing.value) load() })
onMounted(() => { timer = setInterval(() => { if (!document.hidden && spotify.now?.playing && !editing.value) load() }, 15000) })
onBeforeUnmount(() => { clearInterval(timer); clearTimeout(soon) })
</script>

<template>
  <section v-if="spotify.now?.name" class="qp" :class="{ over: queueOver, armed: drag.track || drag.item, editing }" v-on="queueDrop">
    <header :class="{ tap: collapsible }" :role="collapsible ? 'button' : null" :tabindex="collapsible ? 0 : null" :aria-expanded="collapsible ? !shut : null" @click="toggleShut" @keydown.enter="toggleShut">
      <b class="label-caps"><ListMusic :size="13" aria-hidden="true" />Neste i køen<small v-if="items.length" class="cnt">{{ items.length }}</small></b>
      <small v-if="pos" class="pos">Låt {{ pos.n }} av {{ pos.of }}</small>
      <button v-if="admin.loggedIn && !shut && items.length" class="edit" :class="{ on: editing }" :aria-pressed="editing" @click.stop="editing = !editing"><Check v-if="editing" :size="13" /><Pencil v-else :size="13" />{{ editing ? 'Ferdig' : 'Rediger' }}</button>
      <ChevronRight v-if="collapsible" :size="15" class="fold" :class="{ open: !shut }" aria-hidden="true" />
    </header>
    <p v-if="queueOver" class="drophint">Slipp for å legge sist i køen</p>
    <template v-if="!shut">
      <p v-if="!queueState.loaded" class="muted">Henter …</p>
      <p v-else-if="!items.length" class="muted">Ingenting mer i køen.</p>
      <div v-else class="lists">
        <p v-if="editing" class="hint">Dra et album opp eller ned, eller bruk pilene. ✕ tar det bort.<button class="lnk" @click="clearAll"><Trash2 :size="12" />Tøm køen</button></p>
        <template v-for="(g, gi) in groups" :key="g.key">
          <div v-if="!g.mine && mineGroups.length && (gi === 0 || groups[gi - 1].mine)" class="div" :class="{ over: overKey === 'div' }" @dragover="onDragOver($event, 'div')" @drop="onDrop($event, DIV)">{{ mineGroups.length ? restLabel : '' }}</div>
          <div v-else-if="gi === 0 && g.mine" class="div mine">Din kø</div>
          <div class="grp" :class="{ over: overKey === g.key, dragging: dragging === g }" @dragover="onDragOver($event, g.key)" @drop="onDrop($event, g)">
            <div class="gh">
              <span v-if="editing" class="grip" draggable="true" title="Dra for å flytte" @dragstart="onDragStart($event, g)" @dragend="onDragEnd"><GripVertical :size="15" /></span>
              <button class="open" :aria-expanded="open.has(g.key)" @click="toggle(g)">
                <img v-if="g.image" crossorigin="anonymous" :src="g.image" alt="" /><span v-else class="ph"><Music :size="13" /></span>
                <span class="t" translate="no"><b>{{ g.name }}</b><small>{{ single(g) ? g.tracks[0].item.artist : `${g.tracks.length} låter` }} · {{ minutes(g) }}</small></span>
                <ChevronRight v-if="!single(g)" :size="15" class="chev" :class="{ on: open.has(g.key) }" aria-hidden="true" />
              </button>
              <span v-if="editing" class="acts">
                <button aria-label="Flytt opp" title="Opp" @click="moveGroup(g, -1)"><ArrowUp :size="14" /></button>
                <button aria-label="Flytt ned" title="Ned" @click="moveGroup(g, 1)"><ArrowDown :size="14" /></button>
                <button class="x" aria-label="Fjern" title="Fjern" @click="removeGroup(g)"><X :size="14" /></button>
              </span>
            </div>
            <ol v-if="open.has(g.key) && !single(g)" class="songs">
              <li v-for="(t, j) in g.tracks" :key="t.idx">
                <span class="n">{{ t.item.no || j + 1 }}</span>
                <span class="t" translate="no"><b>{{ t.item.name }}</b></span>
                <small class="d">{{ fmtClock(t.item.ms / 1000) }}</small>
                <span v-if="editing" class="acts s">
                  <button aria-label="Opp" @click="moveTrack(g, j, -1)"><ArrowUp :size="12" /></button>
                  <button aria-label="Ned" @click="moveTrack(g, j, 1)"><ArrowDown :size="12" /></button>
                  <button class="x" aria-label="Fjern" @click="removeTrack(g, j)"><X :size="12" /></button>
                </span>
              </li>
            </ol>
          </div>
        </template>
      </div>
    </template>
  </section>
</template>

<style scoped>
.qp { display: grid; gap: 8px; padding: 12px; border-radius: 18px; background: var(--glass-strong); border: 1px solid var(--glass-border); min-width: 0; }
.qp.armed { border-style: dashed; border-color: #1db954; }
.qp.over { background: color-mix(in srgb, #1db954 14%, var(--glass-strong)); }
.drophint { margin: 0; padding: 8px; border-radius: 10px; text-align: center; font-weight: 700; font-size: 0.82rem; color: #1db954; background: color-mix(in srgb, #1db954 12%, transparent); }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
header.tap { cursor: pointer; border-radius: 10px; margin: -4px -6px; padding: 4px 6px; }
header.tap:hover { background: var(--accent-soft); }
header b { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.cnt { margin-left: 4px; padding: 0 7px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 0.68rem; letter-spacing: 0; }
.fold { margin-left: auto; color: var(--text-3); transition: transform 0.2s; }
.fold.open { transform: rotate(90deg); }
.pos { white-space: nowrap; padding: 2px 9px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font: 700 0.7rem var(--font); }
.edit { white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; margin-left: auto; padding: 3px 10px; border: 0; border-radius: 999px; background: var(--glass); color: var(--text-2); font: 600 0.72rem var(--font); cursor: pointer; }
.edit.on { background: var(--accent); color: #fff; }
.muted { margin: 0; color: var(--text-3); font-size: 0.82rem; }
.hint { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 4px; padding: 6px 10px; border-radius: 10px; background: var(--accent-soft); color: var(--text-2); font-size: 0.74rem; line-height: 1.35; }
.lnk { display: inline-flex; align-items: center; gap: 3px; flex: none; padding: 0; border: 0; background: none; color: #d24b4b; font: 600 0.74rem var(--font); cursor: pointer; }
.lists { display: grid; gap: 3px; max-height: 440px; overflow-y: auto; overscroll-behavior: contain; }
.div { padding: 8px 4px 2px; font-size: 0.66rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); border-top: 1px solid var(--glass-border); margin-top: 4px; }
.div.mine { border-top: 0; margin-top: 0; padding-top: 0; color: var(--accent); }
.div.over { background: var(--accent-soft); }
.grp { border-radius: 10px; transition: background 0.15s; }
.grp.over { box-shadow: inset 0 2px 0 var(--accent); }
.grp.dragging { opacity: 0.4; }
.gh { display: flex; align-items: center; gap: 4px; }
.grip { display: grid; place-items: center; width: 20px; height: 36px; flex: none; color: var(--text-3); cursor: grab; }
.open { flex: 1; min-width: 0; display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 4px; border: 0; border-radius: 10px; background: transparent; color: var(--text); text-align: left; cursor: pointer; font: inherit; }
.open:hover { background: var(--accent-soft); }
.open img, .ph { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; background: var(--accent-soft); }
.ph { display: grid; place-items: center; color: var(--text-3); }
.t { display: grid; min-width: 0; }
.t b { font-size: 0.84rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t small, .d { font-size: 0.72rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.d { font-variant-numeric: tabular-nums; }
.chev { color: var(--text-3); transition: transform 0.2s; }
.chev.on { transform: rotate(90deg); }
.acts { display: inline-flex; gap: 2px; flex: none; }
.acts button { display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 8px; background: var(--glass); color: var(--text-2); cursor: pointer; }
.acts button:hover { background: var(--accent-soft); color: var(--accent); }
.acts .x:hover { background: rgba(210, 75, 75, 0.16); color: #d24b4b; }
.acts.s button { width: 22px; height: 22px; border-radius: 6px; }
.songs { list-style: none; display: grid; gap: 1px; margin: 2px 0 6px 52px; padding: 0; }
.songs li { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto auto; align-items: center; gap: 8px; padding: 3px 4px; border-radius: 8px; }
.n { font-size: 0.7rem; color: var(--text-3); text-align: right; font-variant-numeric: tabular-nums; }
</style>
