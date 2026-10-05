import { setTexts } from './useTexts'
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

/** GitHub repos → the project shape. A repo that is already listed by hand only adds its code link. */
function mergeRepos(projects, repos) {
  const list = projects.map((p) => ({ ...p }))
  // the projects ARE my GitHub repos; a hand-written entry in data.json only adds to the repo it matches
  // (a nicer description, the link to the live site, the year)
  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return repos.map((r) => {
    const mine = list.find((p) => norm(p.navn) === norm(r.name) || norm(p.navn) === norm(`${r.name}no`) || (r.homepage && p.lenke === r.homepage)) || {}
    return {
      navn: mine.navn || r.name,
      aar: mine.aar || (r.created ? +r.created : null),
      beskrivelse: mine.beskrivelse || r.description || '',
      teknologi: mine.teknologi?.length ? mine.teknologi : [r.language, ...r.topics].filter(Boolean),
      lenke: mine.lenke || r.homepage || null,
      kode: r.url,
      stjerner: r.stars,
      github: true,
    }
  })
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
    const r = await fetch('api.php?action=content', { cache: 'no-cache' })
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
          ug: x.ug_url, notat: x.notes, ark: x.sheet, ovrer: !!+x.practising, slagmonster: x.strum || null,
        }))
        // my own photo and text from the about page (uploaded, not in the repo)
        if (db.about?.bilde) merged.om = { ...(merged.om || {}), bilde: db.about.bilde }
        setTexts(db.texts)
        state.fromDb = true
      }
    }
  } catch {
    // no API (local dev without mock, or server not set up yet): keep data.json content
  }

  const handWritten = merged.prosjekter || []
  merged.prosjekter = [] // filled from GitHub below
  state.projectsLoading = true
  Object.assign(state, merged)
  state.loaded = true
  state.version++

  // the GitHub repos arrive after the page is up – the server keeps them for an hour, but never hold the site back
  fetch('api.php?action=github_repos')
    .then((r) => (r.ok ? r.json() : null))
    .then((g) => {
      if (g?.repos?.length) state.prosjekter = mergeRepos(handWritten, g.repos)
      state.version++
    })
    .catch(() => {})
    .finally(() => { state.projectsLoading = false })
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
