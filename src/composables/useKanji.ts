// Kanji practice: the kanji in my jpdb words, details from kanjiapi.dev, stroke order from KanjiVG,
// and a small spaced-repetition schedule kept in this browser.
import type { JpWord } from './useJapanese'

const INFO_KEY = 'niben-kanji-info2'
const SRS_KEY = 'niben-kanji-srs'
// days until the next review per box (box 0 = again in this session)
const BOX_DAYS = [0, 1, 3, 7, 16, 35, 90]

const isKanji = (ch: string): boolean => /[一-龯㐀-䶿]/.test(ch)

/** A word from my decks, as far as the kanji practice cares. */
export type KanjiWord = JpWord
export interface KanjiEntry { kanji: string; words: KanjiWord[] }
export type KanjiGrade = 'again' | 'hard' | 'good' | 'easy'
export interface KanjiInfo { keyword: string; meanings: string[]; on: string[]; kun: string[]; strokes?: number; jlpt?: number | null; grade?: number | null }
interface KanjiApiReply { heisig_en?: string | null; meanings?: string[]; on_readings?: string[]; kun_readings?: string[]; stroke_count?: number; jlpt?: number | null; grade?: number | null }
interface SrsEntry { box: number; due: number }

/** The kanji in my words, most useful first (the word's frequency), each with the words it's in. */
export function kanjiFromWords(words: KanjiWord[]): KanjiEntry[] {
  const map = new Map<string, KanjiEntry>()
  for (const w of [...words].sort((a, b) => (a.freq || 1e9) - (b.freq || 1e9))) {
    for (const ch of new Set(w.spelling)) {
      if (!isKanji(ch)) continue
      let e = map.get(ch)
      if (!e) { e = { kanji: ch, words: [] }; map.set(ch, e) }
      if (e.words.length < 6) e.words.push(w)
    }
  }
  return [...map.values()]
}

function read<T>(k: string, d: T): T { try { return (JSON.parse(localStorage.getItem(k) || 'null') as T | null) ?? d } catch { return d } }
function write(k: string, v: unknown): void { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

let infoCache = read<Record<string, KanjiInfo>>(INFO_KEY, {})
/** Meanings, on/kun readings, strokes, JLPT level (cached in this browser). */
export async function kanjiInfo(k: string): Promise<KanjiInfo> {
  const cached = infoCache[k]
  if (cached) return cached
  const r = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(k)}`)
  if (!r.ok) throw new Error('Fant ikke kanjien.')
  const j = (await r.json()) as KanjiApiReply
  // keyword: the same kind of one-word key jpdb uses (Heisig), else the first meaning
  const info: KanjiInfo = { keyword: j.heisig_en || (j.meanings ?? [])[0] || '', meanings: j.meanings ?? [], on: j.on_readings ?? [], kun: j.kun_readings ?? [], strokes: j.stroke_count, jlpt: j.jlpt, grade: j.grade }
  infoCache = { ...infoCache, [k]: info }
  write(INFO_KEY, infoCache)
  return info
}

// KanjiVG writes some parts in their "inside a kanji" shape – look them up as the stand-alone radical
const RADICAL: Record<string, string> = { '⺨': '犭', '⺅': '亻', '⺡': '氵', '⺘': '扌', '⺌': '小', '⺾': '艹', '⻌': '辶', '⻏': '阝', '⻖': '阝', '⺮': '竹', '⺗': '心', '⺣': '火', '⻊': '足', '⺼': '月', '⻗': '雨', '⺋': '卩', '⺊': '卜', '⻂': '衣', '⺪': '疋' }
export interface KanjiStrokes { paths: string[]; parts: string[] }
const svgCache = new Map<string, KanjiStrokes>()
/** Stroke paths in drawing order (KanjiVG, 109×109 box) and the parts the kanji is built from. */
export async function strokes(k: string): Promise<KanjiStrokes> {
  const hit = svgCache.get(k)
  if (hit) return hit
  const code = (k.codePointAt(0) ?? 0).toString(16).padStart(5, '0')
  const r = await fetch(`https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${code}.svg`)
  if (!r.ok) throw new Error('Ingen tegnerekkefølge for denne.')
  const txt = await r.text()
  const paths = [...txt.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1] ?? '')
  // the top-level parts: the groups directly inside the kanji's own group
  const doc = new DOMParser().parseFromString(txt, 'image/svg+xml')
  const root = doc.getElementById(`kvg:${code}`)
  const parts = [...(root?.children ?? [])]
    .map((g) => g.getAttribute('kvg:element'))
    .filter((p): p is string => !!p && p !== k)
    .map((p) => RADICAL[p] ?? p)
  const out: KanjiStrokes = { paths, parts: [...new Set(parts)] }
  svgCache.set(k, out)
  return out
}

// ── schedule ──
let srs = read<Record<string, SrsEntry>>(SRS_KEY, {}) // { 猫: { box, due } }
const day = 86400000
/** Today's session: kanji that are due, then up to `fresh` new ones. */
export function session(all: KanjiEntry[], fresh = 10): KanjiEntry[] {
  const now = Date.now()
  const dueAt = (x: KanjiEntry): number => srs[x.kanji]?.due ?? Infinity
  const due = all.filter((x) => dueAt(x) <= now).sort((a, b) => dueAt(a) - dueAt(b))
  const neu = all.filter((x) => !srs[x.kanji]).slice(0, fresh)
  return [...due, ...neu]
}
export function gradeKanji(k: string, grade: KanjiGrade): number {
  const cur = srs[k]?.box ?? 0
  const last = BOX_DAYS.length - 1
  const box = grade === 'again' ? 0 : grade === 'hard' ? Math.max(1, cur) : grade === 'good' ? Math.min(cur + 1, last) : Math.min(cur + 2, last)
  srs = { ...srs, [k]: { box, due: Date.now() + (BOX_DAYS[box] ?? 0) * day } }
  write(SRS_KEY, srs)
  return box
}
export function srsStats(all: KanjiEntry[]): { due: number; learned: number; seen: number; total: number } {
  const now = Date.now()
  let due = 0, learned = 0
  for (const x of all) { const s = srs[x.kanji]; if (!s) continue; if (s.due <= now) due++; if (s.box >= 3) learned++ }
  return { due, learned, seen: all.filter((x) => srs[x.kanji]).length, total: all.length }
}
