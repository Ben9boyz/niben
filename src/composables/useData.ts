import { reactive } from 'vue'
import { setTexts } from './useTexts'

// Static content (site text, guitars with their 3D models) lives in public/data.json.
// Trips, books and recordings come from the database via api.php and replace the
// examples in data.json when the API is available.
export interface Recording { id: number; tittel: string; dato: string | null; youtube: string | null; lyd: string | null; notat: string | null }
export interface Guitar {
  id: string
  navn: string
  merke?: string
  type?: string
  aar?: number | string
  farge: string
  pickguard?: string
  gripebrett?: string
  beskrivelse?: string
  opptak: Recording[]
  modell?: string
  farger?: Record<string, string>
  tre?: Record<string, string>
  kreditt?: { tekst: string; url: string }
}
export interface TripPhoto { id: number; src: string; tekst: string | null; w: number | null; h: number | null }
export interface Trip {
  id: number
  land: string
  sted: string | null
  tittel: string
  aar: number | null
  dato: string | null
  til: string | null
  tekst: string | null
  bilder: TripPhoto[]
}
export interface Book {
  id?: number
  tittel: string
  forfatter?: string | null
  isbn?: string | null
  omslag?: string | null
  utgitt?: number | null
  sider?: number | null
  lest?: string | null
  vurdering?: number | null
  tanker?: string | null
  sitat?: string | null
  ol_key?: string | null
  leser?: boolean
  farge?: string
}
export interface Song {
  id: number
  tittel: string
  artist: string
  akkorder: string
  bpm: number | null
  slag: number | null
  capo: number | null
  ug: string | null
  notat: string | null
  ark: string | null
  ovrer: boolean
  slagmonster: string | null
}
export interface Project {
  navn: string
  aar?: number | null
  beskrivelse?: string
  teknologi?: string[]
  lenke?: string | null
  kode?: string | null
  stjerner?: number
  github?: boolean
}
export interface SiteData {
  loaded: boolean
  error: string | null
  fromDb: boolean
  version: number
  projectsLoading: boolean
  site: { navn?: string; undertittel?: string; intro?: string }
  gitarer: Guitar[]
  boker: Book[]
  reiser: Trip[]
  prosjekter: Project[]
  sanger: Song[]
  om: { bilde?: string; [key: string]: unknown }
}

// the raw rows as the server sends them
interface DbPhoto { id: number; path: string; caption: string | null; width: number | null; height: number | null }
interface DbTrip { id: number; country: string; place: string | null; title: string; year: number | null; date_from: string | null; date_to: string | null; body: string | null; photos?: DbPhoto[] }
interface DbBook { id: number; title: string; author: string | null; isbn: string | null; cover_url: string | null; published_year: number | null; pages: number | null; read_on: string | null; rating: number | null; thoughts: string | null; quote: string | null; ol_key: string | null; reading?: number | string }
interface DbRecording { id: number; guitar: string; title: string; recorded_on: string | null; youtube: string | null; audio_path: string | null; notes: string | null }
interface DbSong { id: number; title: string; artist: string; chords: string; bpm: number | string | null; beats: number | string | null; capo: number | string | null; ug_url: string | null; notes: string | null; sheet: string | null; practising: number | string; strum: string | null }
interface DbContent {
  error?: string
  trips: DbTrip[]
  books: DbBook[]
  recordings: DbRecording[]
  songs?: DbSong[]
  about?: { bilde?: string } | null
  texts?: Record<string, unknown>
}
interface Repo { name: string; description?: string; homepage?: string | null; created?: string | number | null; language?: string | null; topics: string[]; url: string; stars: number }
interface BaseData extends Partial<Omit<SiteData, 'loaded' | 'error' | 'fromDb' | 'version' | 'projectsLoading'>> { [key: string]: unknown }

const state: SiteData = reactive({
  loaded: false,
  error: null,
  fromDb: false,
  version: 0,
  projectsLoading: false,
  site: {},
  gitarer: [],
  boker: [],
  reiser: [],
  prosjekter: [],
  sanger: [],
  om: {},
})

let base: BaseData | null = null

function mapTrip(t: DbTrip): Trip {
  return {
    id: t.id,
    land: t.country,
    sted: t.place,
    tittel: t.title,
    aar: t.year,
    dato: t.date_from,
    til: t.date_to,
    tekst: t.body,
    bilder: (t.photos ?? []).map((p) => ({ id: p.id, src: p.path, tekst: p.caption, w: p.width, h: p.height })),
  }
}

function mapBook(b: DbBook): Book {
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
    leser: !!Number(b.reading),
  }
}

function mapRecording(r: DbRecording): Recording {
  return { id: r.id, tittel: r.title, dato: r.recorded_on, youtube: r.youtube, lyd: r.audio_path, notat: r.notes }
}

const numOrNull = (v: number | string | null): number | null => (v ? Number(v) : null)

/** GitHub repos → the project shape. A repo that is already listed by hand only adds its code link. */
function mergeRepos(projects: Project[], repos: Repo[]): Project[] {
  const list = projects.map((p) => ({ ...p }))
  // the projects ARE my GitHub repos; a hand-written entry in data.json only adds to the repo it matches
  // (a nicer description, the link to the live site, the year)
  const norm = (t: unknown): string => String(t ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return repos.map((r): Project => {
    const mine = list.find((p) => norm(p.navn) === norm(r.name) || norm(p.navn) === norm(`${r.name}no`) || (!!r.homepage && p.lenke === r.homepage))
    return {
      navn: mine?.navn || r.name,
      aar: mine?.aar || (r.created ? Number(r.created) : null),
      beskrivelse: mine?.beskrivelse || r.description || '',
      teknologi: mine?.teknologi?.length ? mine.teknologi : [r.language, ...r.topics].filter((x): x is string => !!x),
      lenke: mine?.lenke || r.homepage || null,
      kode: r.url,
      stjerner: r.stars,
      github: true,
    }
  })
}

async function load(): Promise<void> {
  try {
    const r = await fetch('data.json', { cache: 'no-cache' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    base = (await r.json()) as BaseData
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e)
    base ??= {}
  }
  const merged: BaseData = structuredClone(base)

  try {
    const r = await fetch('api.php?action=content', { cache: 'no-cache' })
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
      const db = (await r.json()) as DbContent
      if (!db.error) {
        merged.reiser = db.trips.map(mapTrip)
        merged.boker = db.books.map(mapBook)
        for (const g of merged.gitarer ?? []) {
          g.opptak = db.recordings.filter((x) => x.guitar === g.id).map(mapRecording)
        }
        merged.sanger = (db.songs ?? []).map((x): Song => ({
          id: x.id, tittel: x.title, artist: x.artist, akkorder: x.chords,
          bpm: numOrNull(x.bpm), slag: numOrNull(x.beats), capo: numOrNull(x.capo),
          ug: x.ug_url, notat: x.notes, ark: x.sheet, ovrer: !!Number(x.practising), slagmonster: x.strum || null,
        }))
        // my own photo and text from the about page (uploaded, not in the repo)
        if (db.about?.bilde) merged.om = { ...(merged.om ?? {}), bilde: db.about.bilde }
        setTexts(db.texts)
        state.fromDb = true
      }
    }
  } catch {
    // no API (local dev without mock, or server not set up yet): keep data.json content
  }

  const handWritten = merged.prosjekter ?? []
  merged.prosjekter = [] // filled from GitHub below
  state.projectsLoading = true
  Object.assign(state, merged)
  state.loaded = true
  state.version++

  // the GitHub repos arrive after the page is up – the server keeps them for an hour, but never hold the site back
  fetch('api.php?action=github_repos')
    .then((r) => (r.ok ? (r.json() as Promise<{ repos?: Repo[] }>) : null))
    .then((g) => {
      if (g?.repos?.length) state.prosjekter = mergeRepos(handWritten, g.repos)
      state.version++
    })
    .catch(() => {})
    .finally(() => { state.projectsLoading = false })
}

let promise: Promise<void> | null = null
export function useData(): SiteData {
  promise ??= load()
  return state
}

/** Reload after the admin has changed something. */
export function reloadData(): Promise<void> {
  promise = load()
  return promise
}
