<script setup>
import { tick as metronomeTick } from '../lib/strum'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Play, Square, ArrowUpRight, Search, Trophy, ArrowLeftRight, BookOpen } from 'lucide-vue-next'
import ChordDiagram from './ChordDiagram.vue'
import ChordSheet from './ChordSheet.vue'
import { CHORDS, GROUPS, PAIRS, parseProgression, findChord } from '../lib/chords'
import { useData } from '../composables/useData'
import { room } from '../composables/useRoom'

// Chord practice in the practice corner: one-minute changes, a progression with a metronome,
// my songs (with links to Ultimate Guitar) and a chord library.
const data = useData()
const mode = computed({ get: () => room.chordMode, set: (v) => (room.chordMode = v) })
const songs = computed(() => data.sanger || [])
const names = Object.keys(CHORDS)
const sheetId = ref(null) // the song whose chord sheet is open
const sheetSong = computed(() => songs.value.find((x) => x.id === sheetId.value) || null)

// the metronome click is shared with the chord sheet (lib/strum)
const click = (accent) => metronomeTick(accent)

// ── one-minute changes ──
const BEST_KEY = 'niben-chord-best'
const pairA = ref('G')
const pairB = ref('C')
const changes = ref(0)
const left = ref(60)
const running = ref(false)
const best = ref(readBest())
let tick = 0
function readBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}') } catch { return {} } }
const pairKey = computed(() => [pairA.value, pairB.value].sort().join('↔'))
const bestHere = computed(() => best.value[pairKey.value] || 0)
const newRecord = ref(false)
function startChanges() {
  changes.value = 0
  left.value = 60
  newRecord.value = false
  running.value = true
  click(true)
  clearInterval(tick)
  tick = setInterval(() => {
    left.value--
    if (left.value <= 3 && left.value > 0) click(false)
    if (left.value <= 0) finishChanges()
  }, 1000)
}
function finishChanges() {
  clearInterval(tick)
  running.value = false
  click(true)
  if (changes.value > bestHere.value) {
    best.value = { ...best.value, [pairKey.value]: changes.value }
    newRecord.value = changes.value > 0
    try { localStorage.setItem(BEST_KEY, JSON.stringify(best.value)) } catch {}
  }
}
function countChange() { if (running.value) changes.value++ }
function pickPair(p) { if (!running.value) { pairA.value = p[0]; pairB.value = p[1] } }

// ── progression with a metronome ──
const progText = ref('G D Em C')
const bpm = ref(80)
const beats = ref(4)
const capo = ref(0)
const playing = ref(false)
const step = ref(0) // which chord
const beat = ref(0) // beat within the chord
let metro = 0
const prog = computed(() => parseProgression(progText.value))
const current = computed(() => prog.value[step.value % Math.max(1, prog.value.length)])
const next = computed(() => prog.value[(step.value + 1) % Math.max(1, prog.value.length)])
const unknown = computed(() => prog.value.filter((c) => !findChord(c)))
function startProg() {
  if (!prog.value.length) return
  stopProg()
  step.value = 0
  beat.value = 0
  playing.value = true
  click(true)
  metro = setInterval(() => {
    beat.value++
    if (beat.value >= beats.value) { beat.value = 0; step.value++ }
    click(beat.value === 0)
  }, 60000 / bpm.value)
}
function stopProg() { clearInterval(metro); playing.value = false }
function practiseSong(s) {
  progText.value = s.akkorder
  if (s.bpm) bpm.value = s.bpm
  if (s.slag) beats.value = s.slag
  capo.value = s.capo || 0
  mode.value = 'progresjon'
}
const ugLink = (s) => s.ug || `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(`${s.artist || ''} ${s.tittel}`.trim())}`

// ── library ──
const q = ref('')
const groups = computed(() => {
  const n = q.value.trim().toLowerCase()
  return GROUPS.map((g) => ({ ...g, chords: g.chords.filter((c) => !n || c.toLowerCase().startsWith(n)) })).filter((g) => g.chords.length)
})

// space counts a change / starts and stops the metronome
function onKey(e) {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return
  if (e.code !== 'Space') return
  e.preventDefault()
  if (mode.value === 'bytte') running.value ? countChange() : startChanges()
  else if (mode.value === 'progresjon') playing.value ? stopProg() : startProg()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); clearInterval(tick); stopProg() })
</script>

<template>
  <div class="cp">
    <nav class="sub" role="tablist">
      <button v-for="m in [['bytte', 'Bytte'], ['progresjon', 'Progresjon'], ['sanger', 'Sanger'], ['grep', 'Grep']]" :key="m[0]" role="tab" :aria-selected="mode === m[0]" :class="{ on: mode === m[0] }" @click="mode = m[0]">{{ m[1] }}</button>
    </nav>

    <!-- one-minute changes -->
    <section v-if="mode === 'bytte'" class="pane">
      <p class="hint">Bytt mellom to akkorder så mange ganger du klarer på ett minutt. Trykk på knappen for hvert bytte.</p>
      <div class="pair">
        <select v-model="pairA" :disabled="running" aria-label="Første akkord"><option v-for="n in names" :key="n">{{ n }}</option></select>
        <ChordDiagram :name="pairA" :size="110" />
        <ArrowLeftRight class="arrow" :size="24" />
        <ChordDiagram :name="pairB" :size="110" />
        <select v-model="pairB" :disabled="running" aria-label="Andre akkord"><option v-for="n in names" :key="n">{{ n }}</option></select>
      </div>
      <div class="quick">
        <button v-for="p in PAIRS" :key="p.join()" :class="{ on: p[0] === pairA && p[1] === pairB }" :disabled="running" @click="pickPair(p)">{{ p[0] }}–{{ p[1] }}</button>
      </div>
      <button class="counter" :class="{ running }" @click="running ? countChange() : startChanges()">
        <template v-if="running"><b>{{ changes }}</b><span>bytter · {{ left }} s igjen</span></template>
        <template v-else><b><Play :size="26" fill="currentColor" /></b><span>Start ett minutt</span></template>
      </button>
      <p class="score">
        <Trophy :size="15" /> Rekord {{ pairKey.replace('↔', '–') }}: <b>{{ bestHere }}</b>
        <span v-if="!running && changes" class="last">· sist {{ changes }}<template v-if="newRecord"> – ny rekord!</template></span>
      </p>
    </section>

    <!-- progression -->
    <section v-else-if="mode === 'progresjon'" class="pane">
      <label class="field"><span>Akkorder</span><input v-model="progText" :disabled="playing" placeholder="G D Em C" /></label>
      <p v-if="unknown.length" class="warn">Har ikke grep for: {{ unknown.join(', ') }} – de vises som «?».</p>
      <div class="controls">
        <label>Tempo <input v-model.number="bpm" type="range" min="40" max="200" step="2" :disabled="playing" /> <b>{{ bpm }}</b> BPM</label>
        <label>Slag per akkord <select v-model.number="beats" :disabled="playing"><option v-for="n in [1, 2, 3, 4, 6, 8]" :key="n" :value="n">{{ n }}</option></select></label>
        <span v-if="capo" class="capo">Capo {{ capo }}</span>
      </div>
      <div class="stage">
        <div class="now"><ChordDiagram v-if="current" :name="current" :size="170" /></div>
        <div class="next"><small>Neste</small><ChordDiagram v-if="next" :name="next" :size="92" /></div>
      </div>
      <div class="beats"><i v-for="n in beats" :key="n" :class="{ on: playing && n - 1 === beat, one: n === 1 }"></i></div>
      <div class="chips"><span v-for="(c, i) in prog" :key="i" :class="{ on: playing && i === step % prog.length }">{{ c }}</span></div>
      <button class="btn primary go" @click="playing ? stopProg() : startProg()">
        <Square v-if="playing" :size="15" fill="currentColor" /><Play v-else :size="15" fill="currentColor" />{{ playing ? 'Stopp' : 'Start' }}
      </button>
    </section>

    <!-- my songs -->
    <section v-else-if="mode === 'sanger' && sheetSong" class="pane">
      <ChordSheet :song="sheetSong" @back="sheetId = null" />
    </section>
    <section v-else-if="mode === 'sanger'" class="pane">
      <div v-if="!songs.length" class="empty">Ingen sanger ennå – legg dem til under «Sanger» på admin-siden.</div>
      <article v-for="s in songs" :key="s.id" class="song">
        <div class="sm">
          <b translate="no">{{ s.tittel }}</b>
          <small translate="no">{{ s.artist }}<template v-if="s.capo"> · capo {{ s.capo }}</template><template v-if="s.bpm"> · {{ s.bpm }} BPM</template></small>
          <div class="chips small"><span v-for="(c, i) in parseProgression(s.akkorder)" :key="i">{{ c }}</span></div>
          <p v-if="s.notat" class="note">{{ s.notat }}</p>
        </div>
        <div class="sa">
          <button class="btn small" :title="s.ark ? 'Akkordarket – med slagmønster og avspilling' : 'Slagmønster og avspilling av akkordene'" @click="sheetId = s.id"><BookOpen :size="14" />{{ s.ark ? 'Ark' : 'Slag' }}</button>
          <button class="btn primary small" @click="practiseSong(s)"><Play :size="14" fill="currentColor" />Øv</button>
          <a class="btn small" :href="ugLink(s)" target="_blank" rel="noopener">Ultimate Guitar <ArrowUpRight :size="14" /></a>
        </div>
      </article>
    </section>

    <!-- chord library -->
    <section v-else class="pane">
      <label class="search"><Search :size="15" /><input v-model="q" placeholder="Finn akkord …" /></label>
      <div v-for="g in groups" :key="g.root" class="group">
        <b class="gh">{{ g.root }}</b>
        <div class="grid"><ChordDiagram v-for="c in g.chords" :key="c" :name="c" :size="84" /></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cp { display: grid; gap: 14px; }
.sub { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--glass-strong); border: 1px solid var(--glass-border); justify-self: center; }
.sub button { padding: 7px 14px; border: 0; border-radius: 999px; background: transparent; color: var(--text-2); font: 600 0.85rem var(--font); cursor: pointer; }
.sub button.on { background: var(--accent); color: #fff; }
.pane { display: grid; gap: 14px; justify-items: center; }
.hint { margin: 0; font-size: 0.85rem; color: var(--text-2); text-align: center; max-width: 46ch; }
.pair { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; }
.pair select, .controls select { padding: 6px 8px; border-radius: 10px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text); font: 600 0.9rem var(--font); }
.arrow { color: var(--text-3); }
.quick { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; }
.quick button { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--glass-border); background: transparent; color: var(--text-2); font: 600 0.75rem var(--font); cursor: pointer; }
.quick button.on { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }
.counter { width: 180px; height: 180px; border-radius: 50%; border: 0; display: grid; place-items: center; align-content: center; gap: 4px; background: linear-gradient(135deg, var(--accent-2), var(--accent)); color: #fff; cursor: pointer; box-shadow: 0 14px 36px var(--accent-glow); transition: transform 0.12s; user-select: none; }
.counter:active { transform: scale(0.96); }
.counter b { font-size: 3.2rem; line-height: 1; font-variant-numeric: tabular-nums; }
.counter span { font-size: 0.8rem; opacity: 0.9; }
.counter.running { background: linear-gradient(135deg, #5be39a, #1db954); box-shadow: 0 14px 36px rgba(29, 185, 84, 0.4); }
.score { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 0.85rem; color: var(--text-2); }
.last { color: var(--text-3); }

.field { display: grid; gap: 4px; width: 100%; max-width: 420px; }
.field span { font-size: 0.75rem; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; }
.field input { padding: 10px 14px; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text); font: 700 1.1rem var(--font); letter-spacing: 0.04em; }
.warn { margin: 0; font-size: 0.78rem; color: #b8711a; }
.controls { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: center; font-size: 0.85rem; color: var(--text-2); }
.controls label { display: flex; align-items: center; gap: 6px; }
.controls input[type=range] { width: 130px; accent-color: var(--accent); }
.capo { padding: 3px 10px; border-radius: 999px; background: rgba(240, 160, 64, 0.15); color: #b8711a; font-weight: 700; }
.stage { display: flex; align-items: flex-end; gap: 22px; }
.now :deep(figcaption) { font-size: 1.5rem; }
.next { display: grid; justify-items: center; opacity: 0.6; }
.next small { font-size: 0.7rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; }
.beats { display: flex; gap: 8px; }
.beats i { width: 12px; height: 12px; border-radius: 50%; background: var(--accent-soft); transition: transform 0.08s, background 0.08s; }
.beats i.one { outline: 2px solid var(--accent-soft); outline-offset: 2px; }
.beats i.on { background: var(--accent); transform: scale(1.3); }
.chips { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; }
.chips span { padding: 3px 10px; border-radius: 8px; background: var(--glass-strong); border: 1px solid var(--glass-border); font-weight: 700; font-size: 0.85rem; }
.chips span.on { background: var(--accent); color: #fff; border-color: var(--accent); }
.chips.small { justify-content: flex-start; }
.chips.small span { font-size: 0.72rem; padding: 2px 7px; }
.go { display: inline-flex; align-items: center; gap: 6px; }

.song { width: 100%; display: flex; gap: 12px; align-items: center; padding: 12px 14px; border-radius: 14px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.sm { flex: 1; min-width: 0; display: grid; gap: 4px; }
.sm small { color: var(--text-3); font-size: 0.78rem; }
.note { margin: 0; font-size: 0.78rem; color: var(--text-2); }
.sa { display: flex; flex-direction: column; gap: 6px; }
.sa .btn { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }

.search { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text-3); }
.search input { border: 0; background: transparent; color: var(--text); font: 500 0.9rem var(--font); outline: none; width: 160px; }
.group { width: 100%; display: grid; gap: 6px; }
.gh { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.1em; color: var(--text-3); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 10px 8px; justify-items: center; }
@media (max-width: 520px) {
  .counter { width: 150px; height: 150px; }
  .stage { gap: 12px; }
  /* songs: buttons in a row under the text, so the title gets the full width */
  .song { flex-direction: column; align-items: stretch; }
  .sa { flex-direction: row; }
  .sa .btn { flex: 1; justify-content: center; }
}
</style>
