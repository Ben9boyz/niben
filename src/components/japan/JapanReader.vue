<script setup lang="ts">
import { errorMessage } from '@/composables/useAdmin'
import { ref, computed } from 'vue'
import { ScanText, Eye, EyeOff } from 'lucide-vue-next'
import { parseText, stateOf, type ParsedText, type JpWord, type CardState } from '@/composables/japan/useJapanese'
import JapanWord from './JapanWord.vue'

// Paste Japanese text: jpdb splits it into words. Each word is coloured by how well I know it,
// with furigana over the kanji; tap a word for its meaning (and to add it to a deck).
const EXAMPLE = '今日は友達と一緒に東京の新しいカフェに行きました。コーヒーがとても美味しかったです。'
const text = ref('')
const result = ref<(ParsedText & { text: string }) | null>(null)
const busy = ref(false)
const error = ref('')
const furigana = ref(true)
const picked = ref<JpWord | null>(null)
const pickedAt = ref(0) // position of the picked word in the text
// the sentence around the picked word (for "use the sentence on the card")
const sentence = computed(() => {
  const t = result.value?.text || ''
  const at = pickedAt.value
  const start = Math.max(...['。', '！', '？', '\n'].map((c) => t.lastIndexOf(c, at - 1))) + 1
  const ends = ['。', '！', '？', '\n'].map((c) => t.indexOf(c, at)).filter((n) => n >= 0)
  const end = ends.length ? Math.min(...ends) + 1 : t.length
  return t.slice(start, end).trim()
})

async function read() {
  const t = text.value.trim() || EXAMPLE
  if (!text.value.trim()) text.value = EXAMPLE
  busy.value = true
  error.value = ''
  picked.value = null
  try {
    const r = await parseText(t)
    result.value = { text: t, ...r }
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

// the text as runs: plain text between words, and words (with furigana parts)
interface Run { plain?: string; word?: JpWord; state?: CardState; parts?: { base: string; rt?: string }[]; key?: number }
const runs = computed<Run[]>(() => {
  const r = result.value
  if (!r) return []
  const out: Run[] = []
  let at = 0
  for (const t of [...r.tokens].sort((a, b) => a.pos - b.pos)) {
    if (t.pos > at) out.push({ plain: r.text.slice(at, t.pos) })
    const v = r.vocab[t.v]
    const surface = r.text.slice(t.pos, t.pos + t.len)
    const parts = (t.furi || [surface]).map((f): { base: string; rt?: string } => (Array.isArray(f) ? { base: f[0], rt: f[1] } : { base: f }))
    out.push({ word: v, state: stateOf(v?.state), parts, key: t.pos })
    at = t.pos + t.len
  }
  if (at < r.text.length) out.push({ plain: r.text.slice(at) })
  return out
})
// how much of the text I know (counted per word in the text, ignoring ignored ones)
const coverage = computed(() => {
  const ws = runs.value.filter((x) => x.word && x.state !== 'blacklisted')
  if (!ws.length) return null
  const known = ws.filter((x) => x.state === 'known').length
  const learning = ws.filter((x) => x.state === 'learning' || x.state === 'due').length
  return { known: Math.round((known / ws.length) * 100), learning: Math.round((learning / ws.length) * 100), total: ws.length }
})
</script>

<template>
  <div class="reader">
    <label class="box">
      <textarea v-model="text" lang="ja" rows="4" :placeholder="`Lim inn japansk tekst … (f.eks. ${EXAMPLE.slice(0, 18)}…)`"></textarea>
    </label>
    <div class="bar">
      <button class="go" :disabled="busy" @click="read"><ScanText :size="16" />{{ busy ? 'Leser …' : text.trim() ? 'Les teksten' : 'Prøv et eksempel' }}</button>
      <button v-if="result" class="tog" :title="furigana ? 'Skjul furigana' : 'Vis furigana'" @click="furigana = !furigana"><component :is="furigana ? Eye : EyeOff" :size="15" />Furigana</button>
    </div>
    <p v-if="error" class="notice error">{{ error }}</p>

    <template v-if="result">
      <div v-if="coverage" class="cov">
        <div class="cbar"><i class="known" :style="{ width: `${coverage.known}%` }"></i><i class="learning" :style="{ width: `${coverage.learning}%` }"></i></div>
        <small><b>{{ coverage.known }} %</b> kjente ord · {{ coverage.learning }} % lærer · {{ coverage.total }} ord</small>
      </div>
      <p class="out" lang="ja" :class="{ nofuri: !furigana }">
        <template v-for="(r, i) in runs" :key="i">
          <span v-if="r.plain">{{ r.plain }}</span>
          <button v-else class="tok" :class="[r.state, { on: picked === r.word }]" @click="picked = picked === r.word ? null : r.word ?? null; pickedAt = r.key ?? 0">
            <template v-for="(p, k) in r.parts" :key="k"><ruby v-if="p.rt">{{ p.base }}<rt>{{ p.rt }}</rt></ruby><template v-else>{{ p.base }}</template></template>
          </button>
        </template>
      </p>
      <div class="legend"><span class="known">kan</span><span class="learning">lærer</span><span class="due">repetisjon</span><span class="new">ny</span><span class="none">ikke i kortstokk</span></div>
      <JapanWord v-if="picked" :key="picked.vid + ':' + picked.sid" :word="picked" :sentence="sentence" @close="picked = null" />
    </template>
  </div>
</template>

<style scoped>
.reader { display: grid; gap: 10px; }
.box textarea { width: 100%; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text); font: 500 1.05rem "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif; line-height: 1.6; resize: vertical; }
.bar { display: flex; gap: 8px; }
.go { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border: 0; border-radius: 999px; background: linear-gradient(135deg, #c0392b, #9b2c22); color: #fff; font: 700 0.88rem var(--font); cursor: pointer; }
.go:disabled { opacity: 0.7; }
.tog { display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass-strong); color: var(--text-2); font: 600 0.8rem var(--font); cursor: pointer; }
.cov { display: grid; gap: 4px; }
.cbar { display: flex; height: 6px; border-radius: 6px; background: var(--accent-soft); overflow: hidden; }
.cbar .known { background: #3aa76d; }
.cbar .learning { background: #c9a227; }
.cov small { font-size: 0.78rem; color: var(--text-3); }
.out { margin: 0; padding: 16px 18px; border-radius: 16px; background: #fbf7ee; color: #1a1a1a; font: 500 1.35rem/2.3 "Hiragino Sans", "Noto Sans JP", sans-serif; }
:root[data-theme="dark"] .out { background: #f4efe3; }
.tok { padding: 0 1px; margin: 0; border: 0; border-bottom: 3px solid transparent; border-radius: 3px; background: none; color: inherit; font: inherit; cursor: pointer; line-height: inherit; }
.tok:hover, .tok.on { background: rgba(155, 44, 34, 0.1); }
.tok.known { border-bottom-color: rgba(58, 167, 109, 0.55); }
.tok.learning { border-bottom-color: #c9a227; }
.tok.due { border-bottom-color: #d24b4b; }
.tok.new { border-bottom-color: #2b6fd6; }
.tok.none { border-bottom-color: rgba(0, 0, 0, 0.2); border-bottom-style: dashed; }
.tok.blacklisted { border-bottom-color: transparent; color: #666; }
rt { font-size: 0.48em; color: #777; }
.nofuri rt { visibility: hidden; }
.legend { display: flex; flex-wrap: wrap; gap: 10px; font-size: 0.72rem; color: var(--text-3); }
.legend span { display: inline-flex; align-items: center; gap: 4px; }
.legend span::before { content: ''; width: 14px; height: 3px; border-radius: 2px; }
.legend .known::before { background: #3aa76d; }
.legend .learning::before { background: #c9a227; }
.legend .due::before { background: #d24b4b; }
.legend .new::before { background: #2b6fd6; }
.legend .none::before { background: repeating-linear-gradient(90deg, #999 0 3px, transparent 3px 5px); }
</style>
