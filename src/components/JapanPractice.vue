<script setup>
import PitchReading from './PitchReading.vue'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ArrowUpRight, RotateCcw, X, Volume2 } from 'lucide-vue-next'
import { speak, canSpeak } from '../lib/speak'
import { fetchQueue, gradeCard, GRADES, jpdbUrl, loadJapanese, newPerSession, setNewPerSession } from '../composables/useJapanese'

// Flashcard review against jpdb: word → (space) reading, pitch, meanings → grade 1–5.
// Each grade is sent to jpdb right away. Cards you didn't remember come back at the end.
const emit = defineEmits(['close'])

const queue = ref([])
const i = ref(0)
const revealed = ref(false)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const tally = ref({ total: 0, remembered: 0, again: 0 })
const newCount = ref(newPerSession())

const card = computed(() => queue.value[i.value] || null)
const done = computed(() => !loading.value && !card.value)
const left = computed(() => Math.max(0, queue.value.length - i.value))

async function load() {
  loading.value = true
  error.value = ''
  i.value = 0
  revealed.value = false
  try {
    queue.value = await fetchQueue(newCount.value)
  } catch (e) {
    error.value = e.message
    queue.value = []
  } finally {
    loading.value = false
  }
}

async function grade(g) {
  if (!card.value || !revealed.value || busy.value) return
  busy.value = true
  error.value = ''
  const c = card.value
  try {
    await gradeCard(c, g)
    tally.value.total++
    if (g === 'nothing' || g === 'something') {
      tally.value.again++
      queue.value.push({ ...c, kind: 'again' }) // see it once more this session
    } else tally.value.remembered++
    i.value++
    revealed.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

function onKey(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
  if (e.code === 'Space' || e.key === 'Enter') {
    if (card.value && !revealed.value) { reveal(); e.preventDefault() }
  } else if (revealed.value && /^[1-5]$/.test(e.key)) {
    grade(GRADES[+e.key - 1].id)
    e.preventDefault()
  } else if ((e.key === 's' || e.key === 'S') && card.value) say()
  else if (e.key === 'Escape') emit('close')
}

// show the answer and say the word (the reading is what's spoken)
function reveal() {
  revealed.value = true
  say()
}
function say() { if (card.value) speak(card.value.reading || card.value.spelling) }

function changeNew(n) {
  newCount.value = n
  setNewPerSession(n)
}

onMounted(() => { load(); window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); loadJapanese(true) })
</script>

<template>
  <div class="jpp">
    <header class="top">
      <b>Øving</b>
      <span v-if="!loading && !done" class="left">{{ left }} igjen</span>
      <span class="spacer"></span>
      <button class="x" aria-label="Avslutt øving" title="Avslutt (Esc)" @click="emit('close')"><X :size="18" /></button>
    </header>

    <p v-if="error" class="notice error">{{ error }}</p>

    <div v-if="loading" class="msg">Henter kort fra jpdb …</div>

    <!-- finished -->
    <div v-else-if="done" class="done">
      <div class="big">お疲れ様！</div>
      <p v-if="tally.total">Du gikk gjennom {{ tally.total }} kort – {{ tally.remembered }} husket, {{ tally.again }} må øves mer.</p>
      <p v-else>Ingen kort å øve på akkurat nå. Ta noen nye ord?</p>
      <label class="newsel">
        Nye ord per runde
        <select :value="newCount" @change="changeNew(+$event.target.value)">
          <option v-for="n in [0, 5, 10, 20, 30]" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
      <div class="row">
        <button class="btn primary" @click="load"><RotateCcw :size="16" />Ny runde</button>
        <button class="btn" @click="emit('close')">Ferdig</button>
      </div>
    </div>

    <!-- the card -->
    <article v-else class="card" :class="{ revealed }" @click="!revealed && reveal()">
      <span class="kind" :class="card.kind">{{ card.kind === 'due' ? 'Repetisjon' : card.kind === 'again' ? 'Én gang til' : 'Nytt ord' }}</span>
      <div class="word" :lang="'ja'">{{ card.spelling }}</div>
      <button v-if="revealed && canSpeak()" class="say" aria-label="Hør ordet" title="Hør ordet (S)" @click.stop="say"><Volume2 :size="18" /></button>

      <template v-if="revealed">
        <div class="reading" lang="ja">
          <PitchReading :reading="card.reading" :pitch="card.pitch" />
        </div>
        <ol class="meanings" translate="no">
          <li v-for="(m, k) in card.meanings" :key="k">{{ m.join('; ') }}</li>
        </ol>
        <div class="meta">
          <span v-for="p in card.pos.slice(0, 4)" :key="p" class="tag">{{ p }}</span>
          <span v-if="card.freq" class="tag freq">#{{ card.freq }}</span>
          <a :href="jpdbUrl(card)" target="_blank" rel="noopener" class="jl" @click.stop>jpdb <ArrowUpRight :size="13" /></a>
        </div>
      </template>
      <button v-else class="reveal" @click.stop="reveal()">Vis svar <kbd>mellomrom</kbd></button>
    </article>

    <div v-if="card && revealed" class="grades">
      <button v-for="(g, k) in GRADES" :key="g.id" class="g" :class="g.id" :disabled="busy" :title="g.hint" @click="grade(g.id)">
        <b>{{ g.label }}</b><kbd>{{ k + 1 }}</kbd>
      </button>
    </div>
  </div>
</template>

<style scoped>
.jpp { display: grid; gap: 12px; }
.top { display: flex; align-items: center; gap: 10px; }
.top b { font-size: 1.05rem; }
.left { font-size: 0.8rem; color: var(--text-3); font-variant-numeric: tabular-nums; }
.spacer { flex: 1; }
.x { display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 50%; background: var(--accent-soft); color: var(--text-2); cursor: pointer; }
.msg { padding: 40px 0; text-align: center; color: var(--text-3); }

.card {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 38px 22px 26px;
  border-radius: 20px;
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(255, 255, 255, 0.5), transparent 60%),
    color-mix(in srgb, #fbf7ee 88%, var(--accent) 12%);
  color: #1a1a1a;
  border: 1px solid rgba(155, 44, 34, 0.18);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.14), inset 0 0 0 6px rgba(255, 255, 255, 0.35);
  cursor: pointer;
  min-height: 230px;
  text-align: center;
}
:root[data-theme="dark"] .card { background: #f4efe3; }
.card.revealed { cursor: default; }
.kind { position: absolute; top: 12px; left: 14px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #9b2c22; }
.kind.new { color: #2b6fd6; }
.kind.again { color: #b8711a; }
.word { font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif; font-size: clamp(2.6rem, 9cqi, 4.4rem); font-weight: 700; line-height: 1.15; word-break: keep-all; }
.reveal { margin-top: 18px; display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border: 0; border-radius: 999px; background: #1a1a1a; color: #fff; font: 600 0.9rem var(--font); cursor: pointer; }
.reveal kbd, .g kbd { font: 600 0.65rem var(--font); padding: 2px 6px; border-radius: 5px; background: rgba(255, 255, 255, 0.18); }
.reading { display: flex; gap: 1px; font-family: "Hiragino Sans", "Noto Sans JP", sans-serif; font-size: 1.35rem; color: #333; }
.meanings { margin: 4px 0 0; padding: 0; list-style: none; counter-reset: m; display: grid; gap: 4px; max-width: 46ch; }
.meanings li { counter-increment: m; font-size: 0.95rem; color: #333; }
.meanings li::before { content: counter(m) '. '; color: #9b2c22; font-weight: 700; }
.meta { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; margin-top: 4px; }
.tag { padding: 2px 8px; border-radius: 999px; background: rgba(0, 0, 0, 0.06); font-size: 0.7rem; color: #555; }
.tag.freq { background: rgba(43, 111, 214, 0.1); color: #2b6fd6; }
.jl { display: inline-flex; align-items: center; gap: 2px; font-size: 0.75rem; font-weight: 600; color: #9b2c22; text-decoration: none; }

.grades { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.g { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px; border: 0; border-radius: 14px; color: #fff; cursor: pointer; transition: transform 0.15s, filter 0.15s; }
.g b { font-size: 0.8rem; }
.g:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.07); }
.g:disabled { opacity: 0.6; cursor: wait; }
.g.nothing { background: #d24b4b; }
.g.something { background: #e07b39; }
.g.hard { background: #c9a227; }
.g.okay { background: #3aa76d; }
.g.easy { background: #2b8cff; }

.done { display: grid; justify-items: center; gap: 12px; padding: 26px 10px; text-align: center; }
.done .big { font-family: "Hiragino Mincho ProN", "Noto Serif JP", serif; font-size: 2.2rem; font-weight: 700; }
.done p { margin: 0; color: var(--text-2); }
.newsel { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-2); }
.newsel select { padding: 5px 8px; border-radius: 8px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text); }
.row { display: flex; gap: 8px; }
.row .btn { display: inline-flex; align-items: center; gap: 6px; }
@media (max-width: 520px) { .g b { font-size: 0.7rem; } .g { padding: 9px 2px; } }
.say { display: grid; place-items: center; width: 36px; height: 36px; margin-top: -4px; border: 0; border-radius: 50%; background: rgba(155, 44, 34, 0.1); color: #9b2c22; cursor: pointer; }
.say:hover { background: rgba(155, 44, 34, 0.18); }
</style>
