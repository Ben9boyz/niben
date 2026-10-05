// Kanji practice: the kanji in my jpdb words, details from kanjiapi.dev, stroke order from KanjiVG,
// and a small spaced-repetition schedule kept in this browser.
const INFO_KEY = 'niben-kanji-info2'
const SRS_KEY = 'niben-kanji-srs'
// days until the next review per box (box 0 = again in this session)
export const BOX_DAYS = [0, 1, 3, 7, 16, 35, 90]

export const isKanji = (ch) => /[一-龯㐀-䶿]/.test(ch)

/** The kanji in my words, most useful first (the word's frequency), each with the words it's in. */
export function kanjiFromWords(words) {
  const map = new Map()
  for (const w of [...words].sort((a, b) => (a.freq || 1e9) - (b.freq || 1e9))) {
    for (const ch of new Set(w.spelling)) {
      if (!isKanji(ch)) continue
      if (!map.has(ch)) map.set(ch, { kanji: ch, words: [] })
      const e = map.get(ch)
      if (e.words.length < 6) e.words.push(w)
    }
  }
  return [...map.values()]
}

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

let infoCache = read(INFO_KEY, {})
/** Meanings, on/kun readings, strokes, JLPT level (cached in this browser). */
export async function kanjiInfo(k) {
  if (infoCache[k]) return infoCache[k]
  const r = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(k)}`)
  if (!r.ok) throw new Error('Fant ikke kanjien.')
  const j = await r.json()
  // keyword: the same kind of one-word key jpdb uses (Heisig), else the first meaning
  const info = { keyword: j.heisig_en || (j.meanings || [])[0] || '', meanings: j.meanings || [], on: j.on_readings || [], kun: j.kun_readings || [], strokes: j.stroke_count, jlpt: j.jlpt, grade: j.grade }
  infoCache = { ...infoCache, [k]: info }
  write(INFO_KEY, infoCache)
  return info
}

// KanjiVG writes some parts in their "inside a kanji" shape – look them up as the stand-alone radical
const RADICAL = { '⺨': '犭', '⺅': '亻', '⺡': '氵', '⺘': '扌', '⺌': '小', '⺾': '艹', '⻌': '辶', '⻏': '阝', '⻖': '阝', '⺮': '竹', '⺗': '心', '⺣': '火', '⻊': '足', '⺼': '月', '⻗': '雨', '⺋': '卩', '⺊': '卜', '⻂': '衣', '⺪': '疋' }
const svgCache = new Map()
/** Stroke paths in drawing order (KanjiVG, 109×109 box) and the parts the kanji is built from. */
export async function strokes(k) {
  if (svgCache.has(k)) return svgCache.get(k)
  const code = k.codePointAt(0).toString(16).padStart(5, '0')
  const r = await fetch(`https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${code}.svg`)
  if (!r.ok) throw new Error('Ingen tegnerekkefølge for denne.')
  const txt = await r.text()
  const paths = [...txt.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])
  // the top-level parts: the groups directly inside the kanji's own group
  const doc = new DOMParser().parseFromString(txt, 'image/svg+xml')
  const root = doc.getElementById(`kvg:${code}`)
  const parts = [...(root?.children || [])].map((g) => g.getAttribute('kvg:element')).filter((p) => p && p !== k).map((p) => RADICAL[p] || p)
  const out = { paths, parts: [...new Set(parts)] }
  svgCache.set(k, out)
  return out
}

// ── schedule ──
let srs = read(SRS_KEY, {}) // { 猫: { box, due } }
const day = 86400000
export function srsOf(k) { return srs[k] || null }
/** Today's session: kanji that are due, then up to `fresh` new ones. */
export function session(all, fresh = 10) {
  const now = Date.now()
  const due = all.filter((x) => srs[x.kanji] && srs[x.kanji].due <= now).sort((a, b) => srs[a.kanji].due - srs[b.kanji].due)
  const neu = all.filter((x) => !srs[x.kanji]).slice(0, fresh)
  return [...due, ...neu]
}
/** grade: 'again' | 'hard' | 'good' | 'easy' */
export function gradeKanji(k, grade) {
  const cur = srs[k]?.box ?? 0
  const box = grade === 'again' ? 0 : grade === 'hard' ? Math.max(1, cur) : grade === 'good' ? Math.min(cur + 1, BOX_DAYS.length - 1) : Math.min(cur + 2, BOX_DAYS.length - 1)
  srs = { ...srs, [k]: { box, due: Date.now() + BOX_DAYS[box] * day } }
  write(SRS_KEY, srs)
  return box
}
export function srsStats(all) {
  const now = Date.now()
  let due = 0, learned = 0
  for (const x of all) { const s = srs[x.kanji]; if (!s) continue; if (s.due <= now) due++; if (s.box >= 3) learned++ }
  return { due, learned, seen: all.filter((x) => srs[x.kanji]).length, total: all.length }
}
