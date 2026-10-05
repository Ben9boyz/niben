<script setup>
import { ref, computed, onMounted } from 'vue'
import { ArrowUpRight, Plus, Check, X, Volume2, Infinity as Forever, EyeOff, Trash2, Quote } from 'lucide-vue-next'
import { jpdbUrl, pitchMorae, stateOf, STATE_LABEL, fetchWords, addWord, cardAction } from '../composables/useJapanese'
import { speak, canSpeak } from '../lib/speak'
import { admin } from '../composables/useAdmin'

// One word in detail (from the reader or the word list): spelling, reading with pitch accent,
// meanings, frequency, my card state – and for me, "add to a deck".
const props = defineProps({
  word: { type: Object, required: true },
  sentence: { type: String, default: '' }, // the sentence the word was found in (reader) – can go on its card
})
const emit = defineEmits(['close', 'added'])

const st = computed(() => stateOf(props.word.state))
const morae = computed(() => pitchMorae(props.word.reading, props.word.pitch))
const meanings = computed(() => (props.word.meanings || (props.word.meaning ? [props.word.meaning] : [])).map((m) => (Array.isArray(m) ? m.join('; ') : m)))

const decks = ref([])
const deck = ref('')
const msg = ref(null)
const busy = ref(false)
onMounted(async () => {
  if (!admin.loggedIn) return
  try {
    decks.value = (await fetchWords()).decks || []
    deck.value = decks.value[0]?.id ?? 'new'
  } catch {}
})
// what jpdb lets me do with a word I already have
const myDecks = computed(() => decks.value.filter((d) => (props.word.decks || []).includes(d.id)))
async function act(op, extra = {}, done = 'Gjort.') {
  busy.value = true
  msg.value = null
  try {
    await cardAction(props.word, op, extra)
    msg.value = { ok: done }
  } catch (e) {
    msg.value = { error: e.message }
  } finally {
    busy.value = false
  }
}
async function add() {
  busy.value = true
  msg.value = null
  try {
    await addWord(props.word, deck.value)
    msg.value = { ok: 'Lagt til – du får det som nytt kort på jpdb.' }
    emit('added', props.word)
  } catch (e) {
    msg.value = { error: e.message }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <article class="jw" lang="ja">
    <button class="x" aria-label="Lukk" @click="emit('close')"><X :size="15" /></button>
    <div class="sp">{{ word.spelling }}</div>
    <div v-if="word.reading && word.reading !== word.spelling" class="rd">
      <template v-if="morae"><span v-for="(p, k) in morae" :key="k" class="mora" :class="{ high: p.high, drop: p.drop }">{{ p.m }}</span></template>
      <template v-else>{{ word.reading }}</template>
    </div>
    <button v-if="canSpeak()" class="say" aria-label="Hør ordet" title="Hør ordet" @click="speak(word.reading || word.spelling)"><Volume2 :size="16" /></button>
    <p v-if="word.alt?.length" class="alt">Skrives også {{ word.alt.slice(0, 4).join('、') }}</p>
    <div class="tags" lang="nb">
      <span class="state" :class="st">{{ STATE_LABEL[st] }}</span>
      <span v-if="word.freq" class="tag">#{{ word.freq.toLocaleString('nb-NO') }} vanligst</span>
      <span v-for="p in (word.pos || []).slice(0, 3)" :key="p" class="tag">{{ p }}</span>
    </div>
    <ol class="mn" lang="en">
      <li v-for="(m, i) in meanings.slice(0, 4)" :key="i">{{ m }}</li>
    </ol>
    <div class="acts" lang="nb">
      <a :href="jpdbUrl(word)" target="_blank" rel="noopener" class="jl">jpdb <ArrowUpRight :size="13" /></a>
      <template v-if="admin.loggedIn && st === 'none'">
        <select v-model="deck" aria-label="Kortstokk">
          <option v-for="d in decks" :key="d.id" :value="d.id">{{ d.name }}</option>
          <option value="new">Ny kortstokk «niben.no»</option>
        </select>
        <button class="add" :disabled="busy || !!msg?.ok" @click="add"><Check v-if="msg?.ok" :size="14" /><Plus v-else :size="14" />{{ msg?.ok ? 'Lagt til' : 'Legg til' }}</button>
      </template>
    </div>
    <!-- more from jpdb, for me -->
    <div v-if="admin.loggedIn && st !== 'none'" class="more" lang="nb">
      <button v-if="st !== 'known'" :disabled="busy" title="Kortet regnes som lært for godt" @click="act('never-forget', {}, 'Merket som «glemmer aldri».')"><Forever :size="13" />Glemmer aldri</button>
      <button v-if="st !== 'blacklisted'" :disabled="busy" title="jpdb hopper over dette ordet" @click="act('blacklist', {}, 'Ordet ignoreres nå.')"><EyeOff :size="13" />Ignorer</button>
      <button v-else :disabled="busy" @click="act('unmark', {}, 'Ikke ignorert lenger.')">Ikke ignorer</button>
      <button v-for="d in myDecks" :key="d.id" :disabled="busy" @click="act('remove', { deck: d.id }, `Fjernet fra «${d.name}».`)"><Trash2 :size="13" />Fjern fra {{ d.name }}</button>
      <button v-if="sentence" :disabled="busy" title="Setningen fra teksten blir eksempelsetningen på kortet" @click="act('sentence', { sentence }, 'Setningen ligger nå på kortet.')"><Quote :size="13" />Bruk setningen på kortet</button>
    </div>
    <p v-if="msg?.ok" class="ok" lang="nb">{{ msg.ok }}</p>
    <p v-if="msg?.error" class="err" lang="nb">{{ msg.error }}</p>
  </article>
</template>

<style scoped>
.jw { position: relative; display: grid; gap: 6px; padding: 16px 18px; border-radius: 18px; background: #fbf7ee; color: #1a1a1a; border: 1px solid rgba(155, 44, 34, 0.2); box-shadow: 0 14px 34px rgba(0, 0, 0, 0.2); }
.say { position: absolute; top: 8px; right: 42px; display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 50%; background: rgba(155, 44, 34, 0.1); color: #9b2c22; cursor: pointer; }
.alt { margin: 0; font-size: 0.78rem; color: #666; }
.more { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 2px; }
.more button { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border: 1px solid rgba(0, 0, 0, 0.12); border-radius: 999px; background: #fff; color: #333; font: 600 0.74rem system-ui, sans-serif; cursor: pointer; }
.more button:hover:not(:disabled) { border-color: #9b2c22; color: #9b2c22; }
.x { position: absolute; top: 8px; right: 8px; display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 50%; background: rgba(0, 0, 0, 0.06); color: #555; cursor: pointer; }
.sp { font-family: "Hiragino Sans", "Noto Sans JP", sans-serif; font-size: 2.1rem; font-weight: 700; line-height: 1.15; padding-right: 74px; }
.rd { display: flex; gap: 1px; font-family: "Hiragino Sans", "Noto Sans JP", sans-serif; font-size: 1rem; color: #444; }
.mora { position: relative; padding-top: 4px; border-top: 2px solid transparent; }
.mora.high { border-top-color: #2b6fd6; }
.mora.drop::after { content: ''; position: absolute; right: -1px; top: -2px; height: 10px; border-right: 2px solid #2b6fd6; }
.tags { display: flex; flex-wrap: wrap; gap: 4px; }
.tag, .state { padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 700; background: rgba(0, 0, 0, 0.06); color: #555; }
.state.known { background: #d9f2e4; color: #1f7a48; }
.state.learning { background: #fbefc8; color: #8a6a00; }
.state.due { background: #fadcd8; color: #a3271b; }
.state.new { background: #dce9fb; color: #1d5bb8; }
.mn { margin: 4px 0 0; padding-left: 20px; font-size: 0.9rem; color: #333; line-height: 1.45; }
.acts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 4px; }
.jl { display: inline-flex; align-items: center; gap: 2px; margin-right: auto; font-size: 0.78rem; font-weight: 700; color: #9b2c22; text-decoration: none; }
select { padding: 6px 8px; border-radius: 10px; border: 1px solid rgba(0, 0, 0, 0.15); background: #fff; color: #1a1a1a; font: 500 0.8rem system-ui, sans-serif; max-width: 170px; }
.add { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border: 0; border-radius: 999px; background: #9b2c22; color: #fff; font: 700 0.8rem system-ui, sans-serif; cursor: pointer; }
.add:disabled { opacity: 0.7; cursor: default; }
.ok, .err { margin: 0; font-size: 0.78rem; }
.ok { color: #1f7a48; }
.err { color: #a3271b; }
</style>
