import { reactive } from 'vue'
import { api } from './useAdmin'

// Japanese corner (jpdb.io via the server): public statistics + word of the day, and for the admin
// a review queue where each grade goes straight to jpdb.
export const jp = reactive({
  loaded: false,
  configured: false,
  error: null,
  decks: [],
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
        jp.count = j.count || jp.count
        jp.word = j.word || null
      }
    })
    .catch(() => { jp.error = 'Fikk ikke kontakt med jpdb.' })
    .finally(() => { jp.loaded = true })
  return loading
}

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
