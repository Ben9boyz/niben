import { reactive } from 'vue'
import { api } from './useAdmin'

// Japanese corner (jpdb.io via the server): public statistics + word of the day, and for the admin
// a review queue where each grade goes straight to jpdb.
export const jp = reactive({
  loaded: false,
  configured: false,
  error: null,
  decks: [],
  anime: [], // shows from the decks, with cover (AniList) and coverage – best first
  count: { due: 0, learning: 0, known: 0, new: 0 },
  word: null,
})

let loading = null
export function loadJapanese(force = false) {
  if (loading && !force) return loading
  loading = fetch('api.php?action=jpdb_public', { cache: 'no-store' })
    .then((r) => r.json())
    .then((j) => {
      jp.configured = !!j.configured
      if (j.error) jp.error = j.error
      else {
        jp.error = null
        jp.decks = j.decks || []
        jp.anime = j.anime || []
        jp.count = j.count || jp.count
        jp.word = j.word || null
      }
    })
    .catch(() => { jp.error = 'Fikk ikke kontakt med jpdb.' })
    .finally(() => { jp.loaded = true })
  return loading
}

/** Known coverage (%) at which a show is comfortable to watch. */
export const ANIME_READY = 80

// ── practice (admin) ──
const NEW_KEY = 'niben-jp-new'
export function newPerSession() {
  try { const v = parseInt(localStorage.getItem(NEW_KEY), 10); return Number.isFinite(v) ? v : 10 } catch { return 10 }
}
export function setNewPerSession(n) {
  try { localStorage.setItem(NEW_KEY, String(n)) } catch {}
}

/** Due cards (oldest first) followed by some new ones. */
export async function fetchQueue(newCount = newPerSession()) {
  const r = await api('jpdb_queue', { new: newCount })
  return [...(r.due || []).map((c) => ({ ...c, kind: 'due' })), ...(r.new || []).map((c) => ({ ...c, kind: 'new' }))]
}

/** Grade a card on jpdb: nothing | something | hard | okay | easy. */
export async function gradeCard(card, grade) {
  return api('jpdb_review', { vid: card.vid, sid: card.sid, grade })
}

export const GRADES = [
  { id: 'nothing', label: 'Ingenting', hint: 'husket ingenting', key: '1' },
  { id: 'something', label: 'Noe', hint: 'husket litt', key: '2' },
  { id: 'hard', label: 'Vanskelig', hint: 'riktig, men tungt', key: '3' },
  { id: 'okay', label: 'Greit', hint: 'riktig', key: '4' },
  { id: 'easy', label: 'Lett', hint: 'helt enkelt', key: '5' },
]

/** jpdb link for a word. */
export const jpdbUrl = (c) => `https://jpdb.io/vocabulary/${c.vid}/${encodeURIComponent(c.spelling)}`

/** Pitch accent "LHHL" → per-mora high/low flags for drawing. */
export function pitchMorae(reading, pitch) {
  if (!reading || !pitch) return null
  // split into morae: small kana (ゃゅょぁぃぅぇぉャュョァィゥェォ) join the previous one
  const morae = []
  for (const ch of reading) {
    if ('ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ'.includes(ch) && morae.length) morae[morae.length - 1] += ch
    else morae.push(ch)
  }
  if (pitch.length < morae.length) return null
  return morae.map((m, i) => ({ m, high: pitch[i] === 'H', drop: pitch[i] === 'H' && pitch[i + 1] === 'L' }))
}

// ── reader & word list ──
/** A card state list from jpdb (["learning"], ["locked","new"], null …) → one state for colours/labels. */
export function stateOf(state) {
  const s = state || []
  if (!s.length) return 'none' // not in any of my decks
  for (const k of ['blacklisted', 'failed', 'due', 'known', 'never-forget', 'learning', 'new', 'suspended', 'locked', 'redundant']) if (s.includes(k)) return k === 'never-forget' ? 'known' : k === 'failed' ? 'due' : k
  return 'none'
}
export const STATE_LABEL = { none: 'ikke i kortstokk', new: 'ny', learning: 'lærer', due: 'til repetisjon', known: 'kan', blacklisted: 'ignorert', suspended: 'pauset', locked: 'låst', redundant: 'overflødig' }

/** jpdb splits a Japanese text into words (readings, meanings, my card state). */
export async function parseText(text) {
  return api('jpdb_parse', { text })
}

let wordsCache = null
/** Every word in my decks + my own decks (that words can be added to). */
export async function fetchWords(force = false) {
  if (!wordsCache || force) wordsCache = fetch('api.php?action=jpdb_words', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.error) throw new Error(j.error); return j })
  try { return await wordsCache } catch (e) { wordsCache = null; throw e }
}

/** Add a word to one of my decks ('new' = a new "niben.no" deck). */
export async function addWord(word, deck) {
  const r = await api('jpdb_add', { vid: word.vid, sid: word.sid, deck })
  wordsCache = null
  return r
}

/** jpdb on one word (admin): 'remove' (from deck) | 'never-forget' | 'blacklist' | 'unmark' | 'sentence'. */
export async function cardAction(word, op, extra = {}) {
  const r = await api('jpdb_card', { vid: word.vid, sid: word.sid, op, ...extra })
  wordsCache = null
  return r
}
/** My decks on jpdb (admin): 'create' | 'rename' | 'clear' | 'delete'. */
export async function deckAction(op, extra = {}) {
  const r = await api('jpdb_deck', { op, ...extra })
  wordsCache = null
  return r
}
