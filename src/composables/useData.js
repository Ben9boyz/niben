import { reactive } from 'vue'

// Static content (site text, guitars with their 3D models) lives in public/data.json.
// Trips, books and recordings come from the database via api.php and replace the
// examples in data.json when the API is available.
const state = reactive({
  loaded: false,
  error: null,
  fromDb: false,
  version: 0,
  site: {},
  gitarer: [],
  boker: [],
  reiser: [],
  prosjekter: [],
  om: {},
})

let base = null

function mapTrip(t) {
  return {
    id: t.id,
    land: t.country,
    sted: t.place,
    tittel: t.title,
    aar: t.year,
    dato: t.date_from,
    til: t.date_to,
    tekst: t.body,
    bilder: (t.photos || []).map((p) => ({ id: p.id, src: p.path, tekst: p.caption, w: p.width, h: p.height })),
  }
}

function mapBook(b) {
  return {
    id: b.id,
    tittel: b.title,
    forfatter: b.author,
    isbn: b.isbn,
    omslag: b.cover_url,
    utgitt: b.published_year,
    sider: b.pages,
    lest: b.read_on,
    vurdering: b.rating,
    tanker: b.thoughts,
    sitat: b.quote,
    ol_key: b.ol_key,
    leser: !!+b.reading,
  }
}

function mapRecording(r) {
  return { id: r.id, tittel: r.title, dato: r.recorded_on, youtube: r.youtube, lyd: r.audio_path, notat: r.notes }
}

async function load() {
  try {
    const r = await fetch('data.json', { cache: 'no-cache' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    base = await r.json()
  } catch (e) {
    state.error = e.message
    base = base || {}
  }
  const merged = structuredClone(base)

  try {
    const r = await fetch('api.php?action=content', { cache: 'no-store' })
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
      const db = await r.json()
      if (!db.error) {
        merged.reiser = db.trips.map(mapTrip)
        merged.boker = db.books.map(mapBook)
        for (const g of merged.gitarer || []) {
          g.opptak = db.recordings.filter((x) => x.guitar === g.id).map(mapRecording)
        }
        merged.sanger = (db.songs || []).map((x) => ({
          id: x.id, tittel: x.title, artist: x.artist, akkorder: x.chords,
          bpm: x.bpm ? +x.bpm : null, slag: x.beats ? +x.beats : null, capo: x.capo ? +x.capo : null,
          ug: x.ug_url, notat: x.notes, ark: x.sheet, ovrer: !!+x.practising,
        }))
        state.fromDb = true
      }
    }
  } catch {
    // no API (local dev without mock, or server not set up yet): keep data.json content
  }

  Object.assign(state, merged)
  state.loaded = true
  state.version++
}

let promise = null
export function useData() {
  if (!promise) promise = load()
  return state
}

/** Reload after the admin has changed something. */
export function reloadData() {
  promise = load()
  return promise
}
