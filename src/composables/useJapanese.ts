import { reactive } from 'vue'
import { api } from './useAdmin'
import { roomKey } from '../lib/room'

// Japanese corner (jpdb.io via the server): public statistics + word of the day, and for the admin
// a review queue where each grade goes straight to jpdb.
export interface JpWord {
  vid: number
  sid: number
  spelling: string
  reading: string
  pitch?: string | null
  meanings?: string[][]
  pos?: string[]
  freq?: number | null
  state?: string[] | null
  meaning?: string
  decks?: (number | string)[]
  alt?: string[]
}
export interface JpCard extends JpWord { kind: 'due' | 'new' | 'again' }
export interface JpDeck { id: number | string; name: string; words: number; known: number; learning: number }
export interface JpAnime { anilist: number; title: string; en?: string; native?: string; year?: number; parts?: number; cover?: string; color?: string; known: number; learning: number; url: string }
export interface JpCount { due: number; learning: number; known: number; new: number }
interface JpPublicReply { configured?: boolean; error?: string; decks?: JpDeck[]; anime?: JpAnime[]; count?: JpCount; word?: JpWord | null }
export interface JpSnapshot { d: string; known: number; learning: number; new: number; due: number }

export const jp = reactive({
  loaded: false,
  configured: false,
  error: null as string | null,
  decks: [] as JpDeck[],
  anime: [] as JpAnime[], // shows from the decks, with cover (AniList) and coverage – best first
  count: { due: 0, learning: 0, known: 0, new: 0 } as JpCount,
  word: null as JpWord | null,
})

let loading: Promise<void> | null = null
export function loadJapanese(force = false): Promise<void> {
  if (loading && !force) return loading
  loading = fetch('api.php?action=jpdb_public', { cache: 'no-store' })
    .then((r) => r.json() as Promise<JpPublicReply>)
    .then((j) => {
      jp.configured = !!j.configured
      if (j.error) jp.error = j.error
      else {
        jp.error = null
        jp.decks = j.decks ?? []
        jp.anime = j.anime ?? []
        jp.count = j.count ?? jp.count
        jp.word = j.word ?? null
      }
    })
    .catch(() => { jp.error = 'Fikk ikke kontakt med jpdb.' })
    .finally(() => { jp.loaded = true })
  return loading
}

// ── vocabulary over time (the server saves one snapshot a day) ──
export const jpHistory = reactive({ loaded: false, points: [] as JpSnapshot[] })
export async function loadJapaneseHistory(): Promise<void> {
  try {
    const j = (await (await fetch('api.php?action=jpdb_history', { cache: 'no-cache' })).json()) as { points?: JpSnapshot[] }
    jpHistory.points = Array.isArray(j.points) ? j.points : []
  } catch { /* offline */ }
  jpHistory.loaded = true
}

/** Known coverage (%) at which a show is comfortable to watch. */
export const ANIME_READY = 80

// ── practice (admin) ──
const newKey = (): string => roomKey('niben-jp-new')
export function newPerSession(): number {
  try { const v = parseInt(localStorage.getItem(newKey()) ?? '', 10); return Number.isFinite(v) ? v : 10 } catch { return 10 }
}
export function setNewPerSession(n: number): void {
  try { localStorage.setItem(newKey(), String(n)) } catch { /* private mode */ }
}

/** Due cards (oldest first) followed by some new ones. */
export async function fetchQueue(newCount: number = newPerSession()): Promise<JpCard[]> {
  const r = await api<{ due?: JpWord[]; new?: JpWord[] }>('jpdb_queue', { new: newCount })
  return [...(r.due ?? []).map((c): JpCard => ({ ...c, kind: 'due' })), ...(r.new ?? []).map((c): JpCard => ({ ...c, kind: 'new' }))]
}

export type JpGrade = 'nothing' | 'something' | 'hard' | 'okay' | 'easy'
/** Grade a card on jpdb: nothing | something | hard | okay | easy. */
export async function gradeCard(card: { vid: number; sid: number }, grade: JpGrade): Promise<object> {
  return api('jpdb_review', { vid: card.vid, sid: card.sid, grade })
}

export const GRADES: { id: JpGrade; label: string; hint: string; key: string }[] = [
  { id: 'nothing', label: 'Ingenting', hint: 'husket ingenting', key: '1' },
  { id: 'something', label: 'Noe', hint: 'husket litt', key: '2' },
  { id: 'hard', label: 'Vanskelig', hint: 'riktig, men tungt', key: '3' },
  { id: 'okay', label: 'Greit', hint: 'riktig', key: '4' },
  { id: 'easy', label: 'Lett', hint: 'helt enkelt', key: '5' },
]

/** jpdb link for a word. */
export const jpdbUrl = (c: { vid: number; spelling: string }): string => `https://jpdb.io/vocabulary/${c.vid}/${encodeURIComponent(c.spelling)}`

/** Pitch accent "LHHL" → per-mora high/low flags for drawing. */
export function pitchMorae(reading: string | null | undefined, pitch: string | null | undefined): { m: string; high: boolean; drop: boolean }[] | null {
  if (!reading || !pitch) return null
  // split into morae: small kana (ゃゅょぁぃぅぇぉャュョァィゥェォ) join the previous one
  const morae: string[] = []
  for (const ch of reading) {
    if ('ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ'.includes(ch) && morae.length) morae[morae.length - 1] += ch
    else morae.push(ch)
  }
  if (pitch.length < morae.length) return null
  return morae.map((m, i) => ({ m, high: pitch[i] === 'H', drop: pitch[i] === 'H' && pitch[i + 1] === 'L' }))
}

// ── reader & word list ──
export type CardState = 'none' | 'new' | 'learning' | 'due' | 'known' | 'blacklisted' | 'suspended' | 'locked' | 'redundant'
/** A card state list from jpdb (["learning"], ["locked","new"], null …) → one state for colours/labels. */
export function stateOf(state: string[] | null | undefined): CardState {
  const s = state ?? []
  if (!s.length) return 'none' // not in any of my decks
  for (const k of ['blacklisted', 'failed', 'due', 'known', 'never-forget', 'learning', 'new', 'suspended', 'locked', 'redundant']) {
    if (s.includes(k)) return k === 'never-forget' ? 'known' : k === 'failed' ? 'due' : (k as CardState)
  }
  return 'none'
}
export const STATE_LABEL: Record<CardState, string> = { none: 'ikke i kortstokk', new: 'ny', learning: 'lærer', due: 'til repetisjon', known: 'kan', blacklisted: 'ignorert', suspended: 'pauset', locked: 'låst', redundant: 'overflødig' }

/** jpdb splits a Japanese text into words (readings, meanings, my card state). */
export interface ParsedToken { v: number; pos: number; len: number; furi: (string | [string, string])[] | null }
export interface ParsedText { tokens: ParsedToken[]; vocab: JpWord[] }
export async function parseText(text: string): Promise<ParsedText> {
  return api<ParsedText>('jpdb_parse', { text })
}

export interface WordList { words: JpWord[]; decks?: { id: number | string; name: string; own?: boolean; words?: number; known?: number; learning?: number }[]; [key: string]: unknown }
let wordsCache: Promise<WordList> | null = null
/** Every word in my decks + my own decks (that words can be added to). */
export async function fetchWords(force = false): Promise<WordList> {
  if (!wordsCache || force) {
    wordsCache = fetch('api.php?action=jpdb_words', { cache: 'no-store' })
      .then((r) => r.json() as Promise<WordList & { error?: string }>)
      .then((j) => { if (j.error) throw new Error(j.error); return j })
  }
  try { return await wordsCache } catch (e) { wordsCache = null; throw e }
}

/** Add a word to one of my decks ('new' = a new "niben.no" deck). */
export async function addWord(word: { vid: number; sid: number }, deck: number | string): Promise<object> {
  const r = await api('jpdb_add', { vid: word.vid, sid: word.sid, deck })
  wordsCache = null
  return r
}

/** jpdb on one word (admin): 'remove' (from deck) | 'never-forget' | 'blacklist' | 'unmark' | 'sentence'. */
export async function cardAction(word: { vid: number; sid: number }, op: string, extra: Record<string, unknown> = {}): Promise<object> {
  const r = await api('jpdb_card', { vid: word.vid, sid: word.sid, op, ...extra })
  wordsCache = null
  return r
}
/** My decks on jpdb (admin): 'create' | 'rename' | 'clear' | 'delete'. */
export async function deckAction(op: string, extra: Record<string, unknown> = {}): Promise<object> {
  const r = await api('jpdb_deck', { op, ...extra })
  wordsCache = null
  return r
}

/** Another room: its own words, decks and history. */
export function resetJapanese(): void {
  Object.assign(jp, { loaded: false, configured: false, error: null, decks: [], anime: [], count: { due: 0, learning: 0, known: 0, new: 0 }, word: null })
  Object.assign(jpHistory, { loaded: false, points: [] })
  loading = null
  wordsCache = null
}
