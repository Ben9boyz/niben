<script setup lang="ts">
import { errorMessage } from '@/composables/useAdmin'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Play, Volume2, RotateCcw, ArrowUpRight } from 'lucide-vue-next'
import { fetchWords, stateOf } from '@/composables/japan/useJapanese'
import { kanjiFromWords, kanjiInfo, strokes, session, gradeKanji, srsStats, type KanjiEntry, type KanjiInfo, type KanjiGrade } from '@/composables/japan/useKanji'
import { speak, canSpeak } from '@/lib/speak'
import { targetEl } from '@/lib/dom'

// Kanji cards from the kanji in my own words: the kanji → (space) meaning, on/kun readings, the
// stroke order drawn out, and my words that use it → how well did I know it. The schedule lives in
// this browser (spaced repetition: again / hard / good / easy).
const all = ref<KanjiEntry[]>([])
const queue = ref<KanjiEntry[]>([])
const i = ref(0)
const revealed = ref(false)
const info = ref<KanjiInfo | null>(null)
const paths = ref<string[]>([])
const parts = ref<{ p: string; m: string }[]>([]) // what the kanji is built from, with a meaning each
const drawn = ref(0) // strokes shown so far (animation)
const error = ref('')
const loading = ref(true)
const fresh = ref(10)
const stats = ref<ReturnType<typeof srsStats> | null>(null)

const card = computed(() => queue.value[i.value] || null)
const done = computed(() => !loading.value && !card.value)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { words } = await fetchWords()
    all.value = kanjiFromWords(words.filter((w) => stateOf(w.state) !== 'blacklisted'))
    queue.value = session(all.value, fresh.value)
    i.value = 0
    revealed.value = false
    stats.value = srsStats(all.value)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

// details + stroke order for the current card
let timer: ReturnType<typeof setInterval> | undefined
watch(card, async (c) => {
  info.value = null
  paths.value = []
  drawn.value = 0
  clearInterval(timer)
  if (!c) return
  const k = c.kanji
  kanjiInfo(k).then((x) => { if (card.value?.kanji === k) info.value = x }).catch(() => {})
  parts.value = []
  strokes(k).then(async (st) => {
    if (card.value?.kanji !== k) return
    paths.value = st.paths
    drawn.value = st.paths.length
    const withMeaning = await Promise.all(st.parts.map(async (p) => ({ p, m: await kanjiInfo(p).then((x) => x.keyword).catch(() => '') })))
    if (card.value?.kanji === k) parts.value = withMeaning
  }).catch(() => {})
}, { immediate: true })
function animate() {
  clearInterval(timer)
  drawn.value = 0
  timer = setInterval(() => {
    drawn.value++
    if (drawn.value >= paths.value.length) clearInterval(timer)
  }, 450)
}

function reveal() {
  revealed.value = true
  animate()
}
function grade(g: KanjiGrade) {
  if (!card.value || !revealed.value) return
  gradeKanji(card.value.kanji, g)
  if (g === 'again') queue.value.push(card.value) // once more this session
  i.value++
  revealed.value = false
  stats.value = srsStats(all.value)
}
function onKey(e: KeyboardEvent) {
  if (targetEl(e).closest('input, textarea, select')) return
  if (e.key === ' ' && !revealed.value) { e.preventDefault(); reveal() }
  else if (revealed.value && ['1', '2', '3', '4'].includes(e.key)) grade(GRADE_KEYS[+e.key - 1] ?? 'again')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); clearInterval(timer) })
const GRADE_KEYS: KanjiGrade[] = ['again', 'hard', 'good', 'easy']
const GR: [KanjiGrade, string, string][] = [['again', 'Igjen', '1'], ['hard', 'Vanskelig', '2'], ['good', 'Greit', '3'], ['easy', 'Lett', '4']]
</script>

<template>
  <div class="kp">
    <p v-if="error" class="notice error">{{ error }}</p>
    <p v-else-if="loading" class="muted">Finner kanjiene i ordene dine …</p>

    <template v-else>
      <div v-if="stats" class="kstats">
        <span><b>{{ stats.total }}</b> kanji i ordene dine</span>
        <span><b>{{ stats.seen }}</b> øvd på</span>
        <span><b>{{ stats.learned }}</b> sitter</span>
        <span class="left">{{ Math.max(0, queue.length - i) }} igjen nå</span>
      </div>

      <div v-if="done" class="done">
        <b>Ferdig for nå 🎉</b>
        <p class="muted">Kanjiene kommer tilbake når det er tid for å repetere dem.</p>
        <label class="fresh">Nye per økt <input v-model.number="fresh" type="number" min="0" max="50" /></label>
        <button class="btn primary small" @click="load"><RotateCcw :size="14" /> Én økt til</button>
      </div>

      <article v-else-if="card" class="kcard" @click="!revealed && reveal()">
        <div class="glyph" lang="ja">
          <svg v-if="paths.length" viewBox="0 0 109 109" class="strokes" aria-hidden="true">
            <path v-for="(d, n) in paths" :key="n" :d="d" :class="{ on: n < drawn, last: n === drawn - 1 }" />
          </svg>
          <span v-else class="char">{{ card.kanji }}</span>
        </div>
        <p v-if="!revealed" class="hint">Hva betyr den, og hvordan leses den? Trykk for svaret.</p>

        <div v-else class="kback" @click.stop>
          <div class="keyword" lang="en">{{ info ? info.keyword : '…' }}</div>
          <div v-if="info && info.meanings.length > 1" class="meanings" lang="en">{{ info.meanings.slice(0, 4).join(', ') }}</div>
          <div v-if="parts.length" class="parts" lang="ja">
            <span v-for="(x, n) in parts" :key="x.p"><template v-if="n"> + </template><b>{{ x.p }}</b><small lang="en">{{ x.m }}</small></span>
          </div>
          <div v-if="info" class="readings" lang="ja">
            <span v-if="info.on.length"><small lang="nb">on</small> {{ info.on.slice(0, 4).join('・') }}</span>
            <span v-if="info.kun.length"><small lang="nb">kun</small> {{ info.kun.slice(0, 4).join('・') }}</span>
          </div>
          <div v-if="info" class="meta" lang="nb">
            <span>{{ info.strokes }} strøk</span>
            <span v-if="info.jlpt">JLPT N{{ info.jlpt }}</span>
            <button v-if="paths.length" class="redraw" @click="animate"><Play :size="12" /> Tegn på nytt</button>
            <a class="redraw" :href="`https://jpdb.io/kanji/${encodeURIComponent(card.kanji)}`" target="_blank" rel="noopener" title="Kanjien på jpdb – huskeregel, lesninger, og repetisjon der">Øv på jpdb <ArrowUpRight :size="12" /></a>
          </div>
          <ul class="words">
            <li v-for="w in card.words" :key="w.vid + ':' + w.sid">
              <b lang="ja">{{ w.spelling }}</b><small lang="ja">{{ w.reading }}</small><span translate="no">{{ w.meaning }}</span>
              <button v-if="canSpeak()" class="say" aria-label="Hør ordet" @click="speak(w.reading)"><Volume2 :size="14" /></button>
            </li>
          </ul>
          <div class="grades">
            <button v-for="[g, label] in GR" :key="g" :class="g" @click="grade(g)">{{ label }}</button>
          </div>
        </div>
      </article>
      <p class="src">Kanji-data fra kanjiapi.dev, tegnerekkefølge fra KanjiVG.</p>
    </template>
  </div>
</template>

<style scoped>
.kp { display: grid; gap: 12px; }
.muted { color: var(--text-3); font-size: 0.85rem; margin: 0; }
.kstats { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 0.8rem; color: var(--text-3); }
.kstats b { color: var(--text); }
.kstats .left { margin-left: auto; }
.kcard { display: grid; justify-items: center; gap: 10px; padding: 20px 18px; border-radius: 20px; background: #fbf7ee; color: #1a1a1a; border: 1px solid rgba(155, 44, 34, 0.2); cursor: pointer; }
:root[data-theme="dark"] .kcard { background: #f4efe3; }
.glyph { width: 170px; height: 170px; display: grid; place-items: center; border-radius: 16px; background: repeating-linear-gradient(90deg, transparent 0 84px, rgba(155, 44, 34, 0.12) 84px 85px, transparent 85px), repeating-linear-gradient(0deg, transparent 0 84px, rgba(155, 44, 34, 0.12) 84px 85px, transparent 85px), #fff; }
.char { font: 700 120px/1 "Hiragino Sans", "Noto Sans JP", sans-serif; }
.strokes { width: 150px; height: 150px; }
.strokes path { fill: none; stroke: #1a1a1a; stroke-width: 3.4; stroke-linecap: round; stroke-linejoin: round; opacity: 0.08; transition: opacity 0.25s; }
.strokes path.on { opacity: 1; }
.strokes path.last { stroke: #c0392b; }
.hint { margin: 0; font-size: 0.82rem; color: #666; text-align: center; }
.kback { display: grid; gap: 8px; width: 100%; cursor: default; }
.keyword { text-align: center; font: 800 1.5rem system-ui, sans-serif; text-transform: lowercase; }
.meanings { text-align: center; font: 500 0.88rem system-ui, sans-serif; color: #555; }
.parts { display: flex; justify-content: center; flex-wrap: wrap; gap: 4px; font-size: 1.05rem; color: #333; }
.parts b { font: 700 1.15rem "Hiragino Sans", "Noto Sans JP", sans-serif; }
.parts small { margin-left: 3px; font: 600 0.72rem system-ui, sans-serif; color: #9b2c22; }
a.redraw { text-decoration: none; }
.readings { display: flex; justify-content: center; flex-wrap: wrap; gap: 14px; font: 600 1.05rem "Hiragino Sans", "Noto Sans JP", sans-serif; }
.readings small { font: 700 0.65rem system-ui, sans-serif; text-transform: uppercase; color: #9b2c22; margin-right: 3px; }
.meta { display: flex; justify-content: center; align-items: center; gap: 12px; font-size: 0.78rem; color: #666; }
.redraw { display: inline-flex; align-items: center; gap: 3px; border: 0; background: rgba(155, 44, 34, 0.1); color: #9b2c22; padding: 3px 9px; border-radius: 999px; font: 700 0.72rem system-ui, sans-serif; cursor: pointer; }
.words { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 2px; }
.words li { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: baseline; gap: 8px; padding: 5px 8px; border-radius: 8px; background: rgba(0, 0, 0, 0.03); }
.words b { font: 700 1.05rem "Hiragino Sans", "Noto Sans JP", sans-serif; }
.words small { color: #666; font-size: 0.8rem; }
.words span { font-size: 0.8rem; color: #444; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.say { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 50%; background: rgba(155, 44, 34, 0.1); color: #9b2c22; cursor: pointer; align-self: center; }
.grades { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 4px; }
.grades button { display: grid; justify-items: center; gap: 3px; padding: 9px 4px; border: 0; border-radius: 12px; color: #fff; font: 700 0.82rem system-ui, sans-serif; cursor: pointer; }
.grades .again { background: #d24b4b; }
.grades .hard { background: #c98a27; }
.grades .good { background: #3aa76d; }
.grades .easy { background: #2b6fd6; }
.done { display: grid; justify-items: center; gap: 8px; padding: 26px; text-align: center; border-radius: 18px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.fresh { display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--text-2); }
.fresh input { width: 60px; padding: 4px 8px; border-radius: 8px; border: 1px solid var(--glass-border); background: var(--glass); color: var(--text); }
.src { font-size: 0.72rem; color: var(--text-3); margin: 0; }
</style>
