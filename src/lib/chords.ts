// Common guitar chord shapes. frets: low E → high e ("x" = not played, "0" = open), fingers: 1–4
// (0 = none). Barres are found from the fingers (same finger on several strings at the same fret).
// Chord shapes are standard musical facts – drawn here by the site itself.
const RAW: Record<string, [string, string]> = {
  // C
  C: ['x32010', '032010'], C7: ['x32310', '032410'], Cmaj7: ['x32000', '032000'], Cadd9: ['x32033', '021034'],
  Cm: ['x35543', '013421'], C5: ['x355xx', '0134xx'],
  // D
  D: ['xx0232', '000132'], D7: ['xx0212', '000213'], Dmaj7: ['xx0222', '000123'], Dm: ['xx0231', '000231'],
  Dm7: ['xx0211', '000211'], Dsus2: ['xx0230', '000130'], Dsus4: ['xx0233', '000134'], D5: ['xx023x', '00013x'],
  // E
  E: ['022100', '023100'], E7: ['020100', '020100'], Em: ['022000', '023000'], Em7: ['020000', '020000'],
  Esus4: ['022200', '023400'], E5: ['022xxx', '012xxx'],
  // F
  F: ['133211', '134211'], Fm: ['133111', '134111'], Fmaj7: ['xx3210', '003210'], 'F#m': ['244222', '134111'],
  'F#': ['244322', '134211'],
  // G
  G: ['320003', '210003'], G7: ['320001', '320001'], Gmaj7: ['320002', '320001'], Gm: ['355333', '134111'],
  G5: ['355xxx', '134xxx'], Gsus4: ['330013', '230014'],
  // A
  A: ['x02220', '001230'], A7: ['x02020', '002030'], A7sus4: ['x02030', '002040'], Am: ['x02210', '002310'], Am7: ['x02010', '002010'],
  Amaj7: ['x02120', '002130'], Asus2: ['x02200', '002300'], Asus4: ['x02230', '002340'], A5: ['x022xx', '0012xx'],
  // B
  B: ['x24442', '012341'], B7: ['x21202', '021304'], Bm: ['x24432', '013421'], Bm7: ['x24232', '013141'],
  Bb: ['x13331', '012341'], 'C#m': ['x46654', '013421'], 'G#m': ['466444', '134111'],
}

/** A chord shape: the fret per string (null = not played, 0 = open) and the finger per string (0 = none). */
export interface ChordShape { name: string; frets: (number | null)[]; fingers: (number | null)[] }
const parse = (s: string): (number | null)[] => [...s].map((c) => (c === 'x' ? null : parseInt(c, 10)))

export const CHORDS: Record<string, ChordShape> = Object.fromEntries(
  Object.entries(RAW).map(([name, [f, g]]): [string, ChordShape] => [name, { name, frets: parse(f), fingers: parse(g) }]),
)

// a few spellings people use for the same thing
const ALIAS: Record<string, string> = { 'A#': 'Bb', Hm: 'Bm', H: 'B', H7: 'B7', Emin: 'Em', Amin: 'Am', Dmin: 'Dm', Cmaj: 'C', Gmaj: 'G', Dbm: 'C#m', 'Gb m': 'F#m', Gbm: 'F#m', Abm: 'G#m' }

/** The shape for a chord name ("G", "Em7", "G/B" → G), or null if it isn't in the library. */
export function findChord(name: string | null | undefined): ChordShape | null {
  if (!name) return null
  const n = name.trim()
  const direct = CHORDS[n]
  if (direct) return direct
  const alias = ALIAS[n]
  if (alias) return CHORDS[alias] ?? null
  const root = n.split('/')[0] ?? n // slash chords: play the main chord
  const viaAlias = ALIAS[root]
  return CHORDS[root] ?? (viaAlias ? CHORDS[viaAlias] : undefined) ?? null
}

/** "G D Em C" / "G - D | Em, C" → ['G', 'D', 'Em', 'C'] */
export function parseProgression(text: string | null | undefined): string[] {
  return (text ?? '').split(/[\s,|–-]+/).map((s) => s.trim()).filter(Boolean)
}

/** Chords grouped for the library view. */
export const GROUPS: { root: string; chords: string[] }[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((root) => ({
  root,
  chords: Object.keys(RAW).filter((k) => k[0] === root || (root === 'B' && (k.startsWith('Bb'))) || (root === 'C' && k.startsWith('C#')) || (root === 'G' && k.startsWith('G#'))),
}))

/** Handy pairs for one-minute changes (classic beginner switches first). */
export const PAIRS: [string, string][] = [['G', 'C'], ['C', 'D'], ['G', 'D'], ['Em', 'C'], ['A', 'D'], ['E', 'A'], ['Am', 'C'], ['D', 'Em'], ['G', 'Em'], ['F', 'C'], ['Am', 'F'], ['Bm', 'G']]

// ── chord sheets: recognising and transposing chord names in free text ──
const SHARP: string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT: string[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const CHORD_RE = /^([A-G][#b]?)((?:m|min|maj|dim|aug|sus|add|M)?\d{0,2}(?:sus[24]|add\d+|[+°ø]|\(\w+\))*)(?:\/([A-G][#b]?))?$/

const isChord = (t: string): boolean => CHORD_RE.test(t)

function shiftNote(n: string, by: number, preferFlat: boolean): string {
  const i = SHARP.indexOf(n) >= 0 ? SHARP.indexOf(n) : FLAT.indexOf(n)
  if (i < 0) return n
  return (preferFlat ? FLAT : SHARP)[(((i + by) % 12) + 12) % 12] ?? n
}

/** "Am7/G" up 2 half steps → "Bm7/A" (flats if the original used them or going down in flat keys) */
export function transposeChord(chord: string, by: number): string {
  const m = CHORD_RE.exec(chord)
  const root = m?.[1]
  if (!m || !root || !by) return chord
  const bass = m[3]
  const flat = root.includes('b') || (bass ?? '').includes('b')
  return shiftNote(root, by, flat) + (m[2] ?? '') + (bass ? '/' + shiftNote(bass, by, flat) : '')
}

/** Splits a sheet into sections ("[Vers]" lines start a new one) and each line into chord / text tokens. */
export interface SheetToken { t: string; chord?: boolean }
export interface SheetSection { name: string; lines: SheetToken[][] }
export function parseSheet(text: string | null | undefined, by = 0): SheetSection[] {
  const sections: SheetSection[] = []
  let cur: SheetSection = { name: '', lines: [] }
  for (const raw of (text ?? '').replace(/\r/g, '').split('\n')) {
    const h = /^\s*\[([^\]]+)\]\s*$/.exec(raw)
    if (h) {
      if (cur.name || cur.lines.length) sections.push(cur)
      cur = { name: h[1] ?? '', lines: [] }
      continue
    }
    const parts = raw.split(/(\s+)/).filter((t) => t !== '')
    // only a line made entirely of chords is a chord line – so a lyric word like "A" is never mistaken for one
    const words = parts.filter((t) => !/^\s+$/.test(t))
    const chordLine = words.length > 0 && words.every(isChord)
    const tokens = parts.map((t): SheetToken => (chordLine && !/^\s+$/.test(t) ? { t: transposeChord(t, by), chord: true } : { t }))
    cur.lines.push(tokens)
  }
  if (cur.name || cur.lines.length) sections.push(cur)
  // drop blank lines at the edges of a section
  for (const s of sections) {
    while (s.lines.length && !s.lines[0]?.length) s.lines.shift()
    while (s.lines.length && !s.lines[s.lines.length - 1]?.length) s.lines.pop()
  }
  return sections
}

/**
 * Tidies a chord sheet pasted from a site like Ultimate Guitar (copied by me): drops [tab]/[ch] tags,
 * and picks out what it can – title/artist ("Wonderwall Chords by Oasis"), capo, and the chords in the
 * order they first appear. Returns { sheet, title, artist, capo, chords }.
 */
export interface ImportedSheet { sheet: string; title: string; artist: string; capo: number | null; chords: string[] }
export function importSheet(raw: unknown): ImportedSheet {
  let text = String(raw ?? '').replace(/\r/g, '')
  text = text.replace(/\[\/?tab\]/gi, '').replace(/\[ch\](.*?)\[\/ch\]/gi, '$1')
  const head = /^\s*(.+?)\s+(?:Chords|Tabs?|Ukulele Chords|Bass Tabs?)\s+by\s+(.+?)\s*$/im.exec(text)
  const capoM = /capo\s*[:\-]?\s*(?:on\s*)?(\d{1,2})/i.exec(text)
  const lines = text.split('\n')
  // drop the site's own clutter around the sheet
  const junk = /^\s*(capo|tuning|key|difficulty|author|strumming|chords|tab|print|transpose|autoscroll|font|x$)\b.*$/i
  const kept = lines.filter((l, i) => !(i < 12 && junk.test(l)) && !(head && l.trim() === head[0].trim()))
  const sheet = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const order: string[] = []
  for (const s of parseSheet(sheet)) for (const l of s.lines) for (const t of l) if (t.chord && !order.includes(t.t)) order.push(t.t)
  return { sheet, title: head?.[1] ?? '', artist: head?.[2] ?? '', capo: capoM?.[1] ? +capoM[1] : null, chords: order }
}
