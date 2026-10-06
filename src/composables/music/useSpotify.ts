import { reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import type { Album, Notice, NowPlaying, PlayOrigin, Playlist, Result, Track, TrackList } from '@/types'
import { api, admin, ApiError, errorMessage } from '@/composables/site/useAdmin'
import { pget, pset, pdel } from '@/lib/pcache'
import { CUSTOM_QUEUE, addSongs, addCollection, startQueueDriver, releaseSent, myQueue } from './useQueue'
import { roomKey } from '@/lib/room'
import { cancelGap } from './useTrackGap'

// Shared Spotify state: what's saved, what's playing, and the 10-minute switch lock.
export const spotify = reactive({
  notice: null as Notice | null, // a short message after starting/controlling playback (MusicToast)
  loaded: false,
  configured: false,
  connected: false,
  denied: false, // Spotify answers 403: the account is not on the app's list of allowed users
  now: null as NowPlaying | null,
  albums: [] as Album[],
  guests: [] as Album[], // albums found by search that aren't on the shelf – they get a record in the room for a while
  playlists: [] as Playlist[],
  recent: [] as Album[], // the albums I listened to last (newest first) – from the server, the same on every device
  queueV: 0, // goes up whenever I add something to the queue (the 3D table re-reads the queue)
  lockUntil: 0, // unix seconds (server clock)
  lockSeconds: 600, // how long a play locks switching (admin setting, 0 = never)
  offset: 0, // server time - local time (seconds)
  tick: Date.now(), // updates every second for countdowns
  error: null as string | null,
  startedHere: 0, // time of the last successful play() from this page
  origin: ((): PlayOrigin | null => { try { return JSON.parse(localStorage.getItem(roomKey('niben-play-origin')) || 'null') as PlayOrigin | null } catch { return null } })(), // what I last started from this site – decides turntable or iPod
})

/** What the server answers on spotify_now / spotify_public. */
interface PublicReply {
  room?: number
  lib?: string // a fingerprint of the library: when it changes, something was added / removed in Spotify
  denied?: boolean
  configured?: boolean
  connected?: boolean
  now?: NowPlaying | null
  recent?: Album[]
  albums?: Album[]
  playlists?: Playlist[]
  lock_until?: number
  lock_seconds?: number
  server_time?: number
}
interface SavedLists { at?: number; room?: string; lib?: string; sig?: string; albums?: Album[]; playlists?: Playlist[] }

let subscribers = 0
let pollTimer = 0
let tickTimer = 0
let fetchedAt = 0

// The album/playlist lists are big and rarely change – and when I change them from here the page updates them
// itself. So keep them on this machine and only ask the server again once a day (or on "Oppdater fra Spotify").
// "Now playing" + the lock are tiny and polled often.
const listsKey = (): string => roomKey('niben-spotify-lists-v2')
const LISTS_MAX_AGE = 24 * 60 * 60 * 1000
let listsAt = 0
let listsSig = ''
let nowSig = ''
let libSig = '' // the fingerprint the lists on screen were fetched under
let listsBusy = false
let cachedRoom = '' // the room the saved lists came from (as the server told us)
let roomSeen = ''

function hydrate(): void {
  try {
    const c = JSON.parse(localStorage.getItem(listsKey()) || 'null') as SavedLists | null
    if (c?.albums) {
      spotify.albums = c.albums
      spotify.playlists = c.playlists ?? []
      spotify.configured = true
      spotify.connected = true
      spotify.loaded = true
      listsAt = c.at ?? 0
      listsSig = c.sig ?? ''
      cachedRoom = c.room ?? ''
      libSig = c.lib ?? ''
    }
  } catch { /* nothing saved */ }
}
hydrate()

async function getJson(action: string): Promise<PublicReply> {
  const r = await fetch(`api.php?action=${action}`, { cache: 'no-store' })
  if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error(`HTTP ${r.status}`)
  return (await r.json()) as PublicReply
}

// the browser player reports changes instantly – while those are fresh, they beat the (slower) server
let localUntil = 0
let endTimer = 0

function setNow(n: NowPlaying | null): void {
  const sig = n ? `${n.uri}|${n.playing}|${n.context}|${Math.round((n.progress_ms || 0) / 5000)}` : ''
  // only touch reactive state when something actually changed (avoids re-rendering panels and the room)
  if (sig !== nowSig) {
    nowSig = sig
    spotify.now = n
  } else if (n && spotify.now) {
    spotify.now.progress_ms = n.progress_ms
  }
  fetchedAt = Date.now()
  // ask again right after this track ends, so the next one shows up at once
  clearTimeout(endTimer)
  if (n?.playing && n.duration_ms) endTimer = window.setTimeout(refreshNow, Math.max(1000, n.duration_ms - n.progress_ms + 1200))
}

/** Now-playing straight from the in-browser player (useWebPlayer). */
export function setLocalNow(n: NowPlaying | null): void {
  localUntil = Date.now() + 30000
  setNow(n)
}

function applyNow(j: PublicReply): void {
  // the lists kept on this machine belong to the room they came from – another room (a session that ended, a cookie
  // that changed) starts from nothing
  if (j.room != null && cachedRoom && String(j.room) !== cachedRoom) {
    spotify.albums = []
    spotify.playlists = []
    listsAt = 0
    listsSig = ''
    cachedRoom = ''
    try { localStorage.removeItem(listsKey()) } catch { /* private mode */ }
  }
  if (j.room != null) roomSeen = String(j.room)
  spotify.configured = !!j.configured
  spotify.connected = !!j.connected
  spotify.denied = !!j.denied
  if (j.server_time) spotify.offset = j.server_time - Date.now() / 1000
  if (j.recent && JSON.stringify(j.recent) !== JSON.stringify(spotify.recent)) spotify.recent = j.recent
  if ((j.lock_until || 0) !== spotify.lockUntil) spotify.lockUntil = j.lock_until || 0
  if (j.lock_seconds != null && j.lock_seconds !== spotify.lockSeconds) spotify.lockSeconds = j.lock_seconds
  if (Date.now() < localUntil) return
  const n = j.now ?? null
  // the server caches for a few seconds: move the position on by the cache's age
  if (n?.playing && n.at && j.server_time) n.progress_ms = Math.min(n.duration_ms || Infinity, n.progress_ms + (j.server_time - n.at) * 1000)
  setNow(n)
}

/** Polls what's playing (cheap). */
export async function refreshNow(): Promise<void> {
  try {
    const j = await getJson('spotify_now')
    applyNow(j)
    spotify.error = null
    // something was added / removed in Spotify since the lists on screen were fetched: fetch them again now
    if (j.connected && j.lib && j.lib !== libSig && (libSig || spotify.albums.length)) void refreshLists(true)
  } catch (e) {
    spotify.error = errorMessage(e)
  } finally {
    spotify.loaded = true
  }
}

/** Fetches albums + playlists (big) – only when stale, or when forced. */
export async function refreshLists(force = false): Promise<void> {
  if (!force && Date.now() - listsAt < LISTS_MAX_AGE && spotify.albums.length) return
  if (listsBusy) return
  listsBusy = true
  try {
    const j = await getJson('spotify_public')
    applyNow(j)
    libSig = j.lib ?? ''
    if (j.connected) {
      const sig = JSON.stringify([j.albums?.map((a) => a.uri + a.thumb), j.playlists?.map((p) => p.uri + p.count + p.thumb)])
      if (sig !== listsSig) {
        listsSig = sig
        spotify.albums = j.albums ?? []
        spotify.playlists = j.playlists ?? []
      }
      listsAt = Date.now()
      try { localStorage.setItem(listsKey(), JSON.stringify({ at: listsAt, sig, room: roomSeen, lib: libSig, albums: spotify.albums, playlists: spotify.playlists })) } catch {}
    } else {
      spotify.albums = []
      spotify.playlists = []
      try { localStorage.removeItem(listsKey()) } catch { /* private mode */ }
    }
    spotify.error = null
    warmTracks()
  } catch (e) {
    spotify.error = errorMessage(e)
  } finally {
    listsBusy = false
    spotify.loaded = true
  }
}

/** Everything, fresh (after connecting, refreshing from Spotify or disconnecting). */
export async function refreshSpotify(): Promise<void> {
  await refreshLists(true)
}

/** Seconds left on the switch lock (0 when unlocked). */
export const lockLeft = computed(() => {
  const nowServer = spotify.tick / 1000 + spotify.offset
  return Math.max(0, Math.ceil(spotify.lockUntil - nowServer))
})

/** "10 min", "1 t 30 min" … for the lock length. */
export function fmtLock(sec: number): string {
  const m = Math.round(sec / 60)
  return m >= 60 ? `${Math.floor(m / 60)} t${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`
}

/** Text shown after starting something, e.g. "låst i 10 min" (or nothing when the lock is off). */
export const lockNote = (): string => (spotify.lockSeconds > 0 ? ` – låst i ${fmtLock(spotify.lockSeconds)}` : '')

/** Changes the lock length for the next play (admin). Refused while a lock is running. */
export async function setLockSeconds(seconds: number): Promise<void> {
  const r = await api<{ lock_seconds: number; lock_until: number; server_time?: number }>('spotify_lock', { seconds })
  spotify.lockSeconds = r.lock_seconds
  spotify.lockUntil = r.lock_until
  if (r.server_time) spotify.offset = r.server_time - Date.now() / 1000
}

/** Current position in the playing track, estimated between polls. */
export const progressMs = computed(() => {
  const n = spotify.now
  if (!n?.duration_ms) return 0
  const extra = n.playing ? spotify.tick - fetchedAt : 0
  return Math.min(n.duration_ms, n.progress_ms + Math.max(0, extra))
})

export const fmtClock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const DAY = 86400000
const trackCache = new Map<string, Promise<TrackList>>()
let prefetchTimer = 0
/** Fetch a record's/list's tracks in the background when the pointer rests on it, so opening it is instant. */
export function prefetchTracks(uri: string | null | undefined): void {
  clearTimeout(prefetchTimer)
  if (!uri || trackCache.has(uri)) return
  prefetchTimer = window.setTimeout(() => { void fetchTracks(uri) }, 60) // only if it rests there a moment
}
/** Once the lists are there and the page is quiet: fetch the songs of the first records and playlists, one by one,
 *  so that opening them is instant (they are remembered on this machine, so it only costs anything the first time). */
let warmed = false
function warmTracks(): void {
  if (warmed || !spotify.connected) return
  warmed = true
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
  const uris = [...spotify.albums.slice(0, 12), ...spotify.playlists.slice(0, 8)].map((x) => x.uri)
  let i = 0
  const next = (): void => {
    if (i >= uris.length || document.hidden) return
    void fetchTracks(uris[i++]).finally(() => setTimeout(next, 300))
  }
  setTimeout(next, 3000)
}
const tempoCache = new Map<string, Promise<number>>()
/** Tempo (BPM) of a song – 0 when nobody knows. Asked once per song, then remembered here (30 days; an unknown
 *  tempo is tried again after 3 days). The turntable in the 3D room spins to it. */
export async function fetchTempo(uri: string | null | undefined): Promise<number> {
  const id = String(uri ?? '').split(':')[2]
  if (!uri || !id || !uri.startsWith('spotify:track:')) return 0
  const cached = tempoCache.get(id)
  if (cached) return cached
  const p = (async (): Promise<number> => {
    const saved = await pget<number>(`tempo:${id}`, 30 * DAY)
    if (saved !== undefined && (saved > 0 || (await pget(`tempo:${id}`, 3 * DAY)) !== undefined)) return saved
    try {
      const r = await fetch(`api.php?action=spotify_tempo&id=${encodeURIComponent(id)}`, { credentials: 'same-origin', headers: { 'X-Niben': '1' } })
      const bpm = Number(((await r.json()) as { bpm?: number }).bpm) || 0
      if (r.ok) void pset(`tempo:${id}`, bpm)
      return bpm
    } catch { tempoCache.delete(id); return 0 }
  })()
  tempoCache.set(id, p)
  return p
}
/** Track list for 'spotify:album:…' / 'spotify:playlist:…' – { tracks, hidden }. Fetched once: an album's songs never
 *  change (kept 90 days), a playlist's are kept 6 hours – and dropped at once when I add something from here. */
export async function fetchTracks(uri: string): Promise<TrackList> {
  const cached = trackCache.get(uri)
  if (cached) return cached
  const [, type, id] = uri.split(':')
  const p = (async (): Promise<TrackList> => {
    const saved = await pget<TrackList>(`tracks2:${uri}`, type === 'album' ? 90 * DAY : 6 * 3600000)
    if (saved) return saved
    try {
      const j = (await (await fetch(`api.php?action=spotify_tracks&type=${type}&id=${encodeURIComponent(id)}`)).json()) as { tracks?: Track[]; hidden?: boolean; error?: string }
      const out: TrackList = { tracks: j.tracks ?? [], hidden: !!j.hidden }
      if (!j.error && (out.tracks.length || out.hidden)) void pset(`tracks2:${uri}`, out)
      return out
    } catch {
      trackCache.delete(uri)
      return { tracks: [], error: true }
    }
  })()
  trackCache.set(uri, p)
  return p
}
/** Forget a saved track list (after I've changed the playlist from here). */
export function forgetTracks(uri: string): void { trackCache.delete(uri); void pdel(`tracks2:${uri}`) }

/** Shuffle on / off (admin) – for whatever is playing, wherever it plays. */
export async function setShuffle(on: boolean): Promise<Result> {
  try {
    await api('spotify_control', { op: 'shuffle', state: !!on })
    if (spotify.now) spotify.now.shuffle = !!on
    setTimeout(refreshNow, 800)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

/** The in-browser Spotify player (useWebPlayer), when it's running: plays go there. `waitReady` resolves
 *  the device id once the player has registered (or null), `start` starts it if it's off. */
export interface PlayDevice {
  id: string | null
  activate: (() => void) | null
  control: ((op: string, ms: number) => Promise<boolean>) | null
  reconnect: (() => Promise<string | null>) | null
  waitReady: ((ms: number) => Promise<string | null>) | null
  start: (() => Promise<string | null>) | null
  mute: ((on: boolean) => void) | null // the browser player: silent while hopping over songs
}
export const playDevice: PlayDevice = { id: null, activate: null, control: null, reconnect: null, waitReady: null, start: null, mute: null }

/** Show a short message about playback (where it ended up, why it failed). */
export function notify(text: string, error = false): void {
  spotify.notice = { text, error, t: Date.now() }
}

/** Spotify cannot jump to a place in the queue: "next" is pressed once for every song in between (the ones skipped leave the queue).
 *  `steps` = how many "next" (1 = the next song). In the browser player the volume is down meanwhile, so the songs in between are not heard. */
export const SKIP_MAX = 15
export async function skipTo(steps: number, expectUri?: string): Promise<Result> {
  if (!admin.mine) return { ok: false, error: 'Logg inn for å styre musikken' }
  if (lockLeft.value > 0) return { ok: false, error: `Låst – hør ferdig (${fmtClock(lockLeft.value)})` }
  if (steps > SKIP_MAX) return { ok: false, error: `For langt ned i køen – Spotify tåler ikke mer enn ${SKIP_MAX} hopp på rad. Hopp et stykke først.` }
  if (steps < 1) return { ok: true }
  cancelGap()
  if (steps > 1) playDevice.mute?.(true)
  try {
    for (let i = 0; i < steps; i++) {
      const r = await control('next')
      if (!r.ok) return r
      if (i < steps - 1) await new Promise((res) => setTimeout(res, 220)) // (Spotify limits how fast commands may come)
    }
    if (expectUri) await landOn(expectUri)
    return { ok: true }
  } finally {
    if (steps > 1) setTimeout(() => playDevice.mute?.(false), 450)
  }
}
/** Spotify sometimes drops one of the quick "next" presses and the hop stops a song short. Look at where we ended up
 *  and, if the song is still ahead in the queue, press "next" for the rest. */
async function landOn(uri: string): Promise<void> {
  for (let round = 0; round < 3; round++) {
    await new Promise((res) => setTimeout(res, 700))
    await refreshNow()
    if (spotify.now?.uri === uri) return
    const left = (await fetchQueue()).findIndex((t) => t.uri === uri)
    if (left < 0 || left >= SKIP_MAX) return // it is not ahead any more (we are there, or past it)
    for (let i = 0; i <= left; i++) {
      const r = await control('next')
      if (!r.ok) return
      if (i < left) await new Promise((res) => setTimeout(res, 220))
    }
  }
}

/** "Next" was pressed: the queue shrinks by one at once (Spotify follows a moment later). */
function noteNext(): void {
  optNext.push(Date.now())
  spotify.queueV++
  setTimeout(() => { spotify.queueV++ }, 1000)
}

/** Pause / resume / seek / next / previous (admin). Goes straight to the browser player when it's
 *  the one playing. Pausing always works; seeking and skipping are locked like switching. */
export async function control(op: string, ms = 0): Promise<Result> {
  cancelGap() // (a button press wins over the pause between two songs)
  if (['seek', 'next', 'previous'].includes(op) && lockLeft.value > 0) return { ok: false, error: 'Låst – hør ferdig' }
  try {
    if (playDevice.control && (await playDevice.control(op, ms))) { if (op === 'next') noteNext(); return { ok: true } }
  } catch { /* the browser player failed: ask Spotify through the server instead */ }
  try {
    const body: Record<string, unknown> = { op, ms: Math.round(ms) }
    if (op === 'resume' && playDevice.id) { playDevice.activate?.(); body.device = playDevice.id }
    await api('spotify_control', body)
    if (spotify.now) {
      if (op === 'seek') spotify.now.progress_ms = ms
      if (op === 'pause' || op === 'resume') spotify.now.playing = op === 'resume'
      fetchedAt = Date.now()
    }
    setTimeout(refreshNow, 800)
    if (op === 'next') noteNext()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

/** Starts an album/playlist (optionally at a given track). Locked for the admin-set lock length afterwards.
 *  Tries hard to play somewhere: the player on this page first (waiting for it / reconnecting it when
 *  Spotify can't see it), then any other Spotify device of mine – and says where it ended up. */
let starting = false // one start at a time: a double click / tap must not send two plays
export interface PlayResult extends Result { device?: string | null }
interface PlayReply { lock_until: number; server_time?: number; device_name?: string | null }
export async function play(uri: string, track: string | null = null, opts: { from?: string } = {}): Promise<PlayResult> { // opts.from: 'search' = picked from the search results (the iPod plays those)
  if (starting) return { ok: false, error: 'Starter allerede …' }
  starting = true
  cancelGap() // (a new album wins over the pause between two songs)
  // must run inside the click, before any await, or the browser keeps the player muted
  if (playDevice.id) playDevice.activate?.()
  const body: Record<string, unknown> = { uri }
  if (track) body.track = track
  const send = async (): Promise<PlayReply> => {
    try {
      return await api<PlayReply>('spotify_play', body)
    } catch (e) {
      // Spotify had a hiccup: one more try
      if ((e instanceof ApiError && (e.status ?? 0) >= 500) || /HTTP 5|Failed to fetch|NetworkError/i.test(errorMessage(e))) {
        await new Promise((r) => setTimeout(r, 800))
        return api<PlayReply>('spotify_play', body)
      }
      throw e
    }
  }
  try {
    // Spotify already holds my next queued song and can't give it back: use it up first, so it doesn't pop up after what I put on now
    if (myQueue.sent && lockLeft.value <= 0) await releaseSent()
    // the page's player is still starting up: wait a moment for it rather than playing elsewhere
    // or another tab is the player: take it over here (that tab lets go)
    if (playDevice.id) body.device = playDevice.id
    else if (playDevice.waitReady) {
      body.device = (await playDevice.waitReady(6000)) || undefined
      // still not registered with Spotify: drop it and register again once, rather than playing into the void
      if (!body.device && playDevice.reconnect) body.device = (await playDevice.reconnect()) || undefined
    }
    else if (playDevice.start) body.device = (await playDevice.start()) || undefined
    let r: PlayReply
    try {
      r = await send()
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined
      if (code === 'device_missing') {
        // Spotify can't see the page's player (it dropped out after a while): re-register it and try again …
        const id = playDevice.reconnect ? await playDevice.reconnect() : null
        if (id) body.device = id
        else { delete body.device; body.fallback = true } // (no player on the page to bring back: any of my devices will do)
        try {
          r = await send()
        } catch (e2) {
          if (!(e2 instanceof ApiError) || e2.code !== 'device_missing') throw e2
          // … and if it still can't, play on another of my devices
          delete body.device
          body.fallback = true
          r = await send()
        }
      } else if (code === 'no_device' && !body.device && playDevice.start) {
        // nothing open anywhere: start the page's own player and play here
        const id = await playDevice.start()
        if (!id) throw e
        body.device = id
        r = await send()
      } else throw e
    }
    spotify.lockUntil = r.lock_until
    spotify.startedHere = Date.now()
    spotify.origin = { uri, from: opts.from || null, t: Date.now() }
    try { localStorage.setItem(roomKey('niben-play-origin'), JSON.stringify(spotify.origin)) } catch { /* private mode */ }
    if (r.server_time) spotify.offset = r.server_time - Date.now() / 1000
    if (r.device_name) notify(`Spiller på «${r.device_name}» – fant ikke spilleren på siden.`)
    setTimeout(refreshNow, 1500) // give Spotify a moment before asking what's playing
    setTimeout(() => { spotify.queueV++ }, 2200) // and what is up next (the queue changed with the new album)
    return { ok: true, device: r.device_name ?? null }
  } catch (e) {
    await refreshNow()
    notify(errorMessage(e), true)
    return { ok: false, error: errorMessage(e) }
  } finally {
    starting = false
  }
}

/** Keeps the data fresh while at least one component is using it. */
export function useSpotify(): typeof spotify {
  onMounted(() => {
    if (subscribers++ === 0) {
      void refreshLists()
      void refreshNow()
      startQueueDriver() // my own queue (only does anything when I'm logged in)
      // "now playing" every 10 s, but only while the page is visible
      pollTimer = window.setInterval(() => { if (!document.hidden) void refreshNow() }, 10000)
      tickTimer = window.setInterval(() => { spotify.tick = Date.now() }, 1000)
    }
  })
  onBeforeUnmount(() => {
    if (--subscribers === 0) {
      clearInterval(pollTimer)
      clearInterval(tickTimer)
    }
  })
  return spotify
}

// ── search (admin) and saving ──
/** Albums + tracks from all of Spotify. Throws with a readable message. */
export interface SearchArtist { id: string; name: string; image?: string | null; genres?: string[] }
export interface SearchResults { albums: Album[]; tracks: Track[]; playlists: Playlist[]; artists: SearchArtist[] }
const searchCache = new Map<string, { t: number; v: SearchResults }>() // the same search again within 10 minutes costs nothing
export async function searchSpotify(q: string): Promise<SearchResults> {
  const key = q.trim().toLowerCase()
  const hit = searchCache.get(key)
  if (hit && Date.now() - hit.t < 600000) return hit.v
  const v = await searchSpotifyNow(q)
  searchCache.set(key, { t: Date.now(), v })
  if (searchCache.size > 40) { const oldest = searchCache.keys().next(); if (!oldest.done) searchCache.delete(oldest.value) }
  return v
}
async function searchSpotifyNow(q: string): Promise<SearchResults> {
  const r = await fetch(`api.php?action=spotify_search&q=${encodeURIComponent(q)}`, { cache: 'no-store', credentials: 'same-origin', headers: { 'X-Niben': '1' } })
  let j: Partial<SearchResults> & { error?: string } = {}
  try { j = (await r.json()) as typeof j } catch { /* empty reply */ }
  if (!r.ok || j.error) throw new Error(j.error || `Søket feilet (${r.status})`)
  return { albums: j.albums ?? [], tracks: j.tracks ?? [], playlists: j.playlists ?? [], artists: j.artists ?? [] }
}

/** A picture on one of my own playlists. Spotify takes a square JPEG, which the server makes from whatever I choose. */
export async function setPlaylistImage(uri: string, file: File): Promise<ActResult> {
  const fd = new FormData()
  fd.append('playlist', uri)
  fd.append('file', file)
  const r = await act('spotify_playlist_image', fd)
  if (!r.ok) { notify(r.error || 'Klarte ikke å bytte bildet.', true); return r }
  // Spotify needs a moment before its own copy is ready – the picture I chose shows right away
  const local = URL.createObjectURL(file)
  const p = spotify.playlists.find((x) => x.uri === uri)
  if (p) { p.image = p.image_large = p.thumb = local }
  setTimeout(() => { void refreshLists(true) }, 6000)
  notify('Bildet er byttet.')
  return r
}

/** A new, empty playlist of my own – with a picture, if I picked one. */
export async function createPlaylist(name: string, image: File | null = null): Promise<ActResult<{ uri: string; name: string }> & { imageError?: string }> {
  const r = await act<{ uri: string; name: string }>('spotify_playlist_create', { name })
  if (!r.ok) { notify(r.error || 'Klarte ikke å lage spillelisten.', true); return r }
  await refreshLists(true)
  if (image) {
    const ri = await setPlaylistImage(r.uri, image)
    if (!ri.ok) return { ...r, imageError: ri.error }
  }
  notify(`«${name}» er laget.`)
  return r
}
/** Take a playlist out of my library ("delete": Spotify only lets go of it). */
export async function deletePlaylist(uri: string, name = ''): Promise<ActResult> {
  const r = await act('spotify_playlist_delete', { playlist: uri })
  if (r.ok) { spotify.playlists = spotify.playlists.filter((p) => p.uri !== uri); void refreshLists(true); notify(name ? `«${name}» er slettet.` : 'Spillelisten er slettet.') }
  else notify(r.error || 'Klarte ikke å slette spillelisten.', true)
  return r
}

/** Save someone else's playlist (from search) among mine. */
export async function followPlaylist(uri: string): Promise<Result> {
  try {
    await api('spotify_follow', { playlist: uri })
    void refreshLists(true)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

/** Put an album in the library – it joins the record shelf. */
export async function saveAlbum(uri: string): Promise<Result> {
  try {
    await api('spotify_save', { uri })
    await refreshLists(true)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

/** Is this album in my library? */
export const isSaved = (uri: string): boolean => spotify.albums.some((a) => a.uri === uri)
/** The heart on an album: save it to / take it out of the library. Shows at once, the lists are fetched again behind it. */
export async function toggleAlbumSaved(album: Album): Promise<Result & { saved?: boolean }> {
  const saved = isSaved(album.uri)
  const before = spotify.albums
  if (saved) { spotify.albums = before.filter((a) => a.uri !== album.uri); addGuest(album) } // (stays open as a guest record, so the page doesn't jump away)
  else spotify.albums = [{ ...album, added: Math.floor(Date.now() / 1000) }, ...before]
  try {
    await api(saved ? 'spotify_unsave' : 'spotify_save', { uri: album.uri })
    // no refetch (Spotify can lag a moment): the list is right as it is – keep it in the saved copy too, the server's copy was dropped
    listsSig = ''
    saveLists()
    notify(saved ? `«${album.name}» er fjernet fra albumene dine.` : `«${album.name}» ligger nå blant albumene dine.`)
    return { ok: true, saved: !saved }
  } catch (e) {
    spotify.albums = before
    notify(errorMessage(e), true)
    return { ok: false, error: errorMessage(e) }
  }
}

/** Add a song to one of my playlists. */
export async function addToPlaylist(playlistUri: string, trackUri: string): Promise<Result> {
  try {
    await api('spotify_playlist_add', { playlist: playlistUri, uri: trackUri })
    // no need to fetch everything again: the playlist is one song longer, and its saved track list is out of date
    const pl = spotify.playlists.find((p) => p.uri === playlistUri)
    if (pl && typeof pl.count === 'number') pl.count++
    forgetTracks(playlistUri)
    listsSig = ''
    saveLists()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

/** An album from search joins the room as a guest record (it flies in through the window). */
export function addGuest(a: Album | null | undefined): void {
  if (!a?.uri || spotify.albums.some((x) => x.uri === a.uri)) return
  spotify.guests = [a, ...spotify.guests.filter((g) => g.uri !== a.uri)].slice(0, 3)
}
/** An album on the shelf, or a guest from search. */
export const findAlbum = (uri: string | null | undefined): Album | null => spotify.albums.find((a) => a.uri === uri) || spotify.guests.find((a) => a.uri === uri) || null

// ── more of the player: queue, devices, volume, repeat, liked songs ──
type ActResult<T extends object = Record<string, never>> = (({ ok: true } & T) | { ok: false; error: string; code?: string }) & { error?: string }
async function act<T extends object = Record<string, never>>(action: string, body?: Record<string, unknown> | FormData): Promise<ActResult<T>> {
  try { return { ok: true, ...(await api<T>(action, body)) } as ActResult<T> } catch (e) { return { ok: false, error: errorMessage(e), code: e instanceof ApiError ? e.code : undefined } }
}
/** Remembers the lists on this machine (see hydrate). */
function saveLists(): void {
  try { localStorage.setItem(listsKey(), JSON.stringify({ at: listsAt, sig: listsSig, room: roomSeen, lib: libSig, albums: spotify.albums, playlists: spotify.playlists })) } catch { /* private mode / full */ }
}
/** Up next in Spotify's queue. Spotify itself is a moment behind after "next" or "add to queue", so what I just did is
 *  laid over its answer for a few seconds: the song that was skipped is gone and the song I added is already there. */
const OPT_MS = 3000
let optNext: number[] = [] // when I pressed "next"
let optAdds: { t: Track; at: number }[] = []
let lastQueue: Track[] = []
export async function fetchQueue(): Promise<Track[]> {
  let q: Track[]
  try { const r = await fetch('api.php?action=spotify_queue', { cache: 'no-store' }); q = ((await r.json()) as { tracks?: Track[] }).tracks ?? [] } catch { return lastQueue }
  const now = Date.now()
  optNext = optNext.filter((at) => now - at < OPT_MS)
  optAdds = optAdds.filter((a) => now - a.at < OPT_MS)
  const same = q.length === lastQueue.length && q.every((t, i) => t.uri === lastQueue[i]?.uri)
  lastQueue = q
  if (!same) optNext = [] // Spotify has caught up with the "next"
  const out = optNext.length && same ? q.slice(optNext.length) : q.slice()
  for (const a of optAdds) if (!q.some((t) => t.uri === a.t.uri)) out.push(a.t)
  return out
}
function optQueued(tracks: Partial<Track>[]): void {
  const at = Date.now()
  for (const t of tracks) if (t.uri && t.name) optAdds.push({ t: { img: t.album_image ?? null, ms: 0, artist: '', name: '', ...t } as Track, at })
}
/** My Spotify devices (admin). */
export interface SpotifyDevice { id: string; name: string; type: string; active: boolean; volume: number | null; restricted: boolean }
export async function fetchDevices(): Promise<SpotifyDevice[]> {
  try { return (await api<{ devices?: SpotifyDevice[] }>('spotify_devices')).devices ?? [] } catch { return [] }
}
/** Move playback to another device (it keeps playing). */
export async function transferTo(device: string, playNow = true): Promise<ActResult> {
  const r = await act('spotify_transfer', { device, play: playNow })
  if (r.ok) setTimeout(refreshNow, 900)
  return r
}
let volTimer = 0
/** Volume of the device that's playing (0–100), sent a moment after the slider stops. */
export function setDeviceVolume(percent: number): Promise<ActResult> {
  if (spotify.now) spotify.now.volume = percent
  clearTimeout(volTimer)
  return new Promise((res) => { volTimer = window.setTimeout(() => { void act('spotify_volume', { percent }).then(res) }, 250) })
}
type Repeat = 'off' | 'context' | 'track'
const REPEAT_NEXT: Record<Repeat, Repeat> = { off: 'context', context: 'track', track: 'off' }
/** Repeat: off → the list/album → this song → off. */
export async function cycleRepeat(): Promise<ActResult> {
  const next = REPEAT_NEXT[spotify.now?.repeat || 'off']
  const before = spotify.now?.repeat
  if (spotify.now) spotify.now.repeat = next // show it at once
  const r = await act('spotify_repeat', { state: next })
  if (!r.ok && spotify.now) spotify.now.repeat = before
  return r
}
// What I queued, in groups: songs queued right after each other from the same album are an ALBUM (it plays on the
// turntable); a lone song is "from a playlist" (the iPod). Remembered while the page is open, to know where a queued song plays.
const qRuns: { album: string | null; uris: Set<string> }[] = []
function noteQueued(tracks: { uri: string; album_uri?: string | null }[], album: string | null = null, fresh = false): void {
  tracks.forEach((t, i) => {
    const a = album || t.album_uri || null
    const last = qRuns[qRuns.length - 1]
    if (last && a && last.album === a && !(fresh && i === 0)) last.uris.add(t.uri)
    else qRuns.push({ album: a, uris: new Set([t.uri]) })
  })
  while (qRuns.length > 40) qRuns.shift()
}
/** 'album' | 'single' | null: what is this song, if I queued it from here. */
export function queuedKind(uri: string): 'album' | 'single' | null {
  for (let i = qRuns.length - 1; i >= 0; i--) if (qRuns[i].uris.has(uri)) return qRuns[i].uris.size > 1 ? 'album' : 'single'
  return null
}

/** The queue panel / the 3D table read the queue again: at once, and once more when Spotify has caught up. */
function queueChanged(): void {
  spotify.queueV++
  setTimeout(() => { spotify.queueV++ }, 1200)
}
/** Put a song last in Spotify's queue. `t` is the song ({ uri, name, … }) or just its uri. */
export async function enqueue(t: string | Partial<Track> & { uri: string }): Promise<Result> {
  const track: Partial<Track> & { uri: string } = typeof t === 'string' ? { uri: t } : t
  if (CUSTOM_QUEUE) {
    if (!track.name && spotify.now?.uri === track.uri) Object.assign(track, { name: spotify.now.name, artist: spotify.now.artist, ms: spotify.now.duration_ms, album: spotify.now.album, album_image: spotify.now.image, img: spotify.now.image })
    return addSongs([track])
  }
  const r = await act('spotify_enqueue', { uri: track.uri })
  if (r.ok) { noteQueued([track]); optQueued([track]); notify(track.name ? `«${track.name}» er lagt i køen.` : 'Lagt i køen.'); queueChanged() }
  else notify(r.error || 'Klarte ikke å legge i køen.', true)
  return r
}
/** A whole album / playlist at the end of the queue (its songs, in order, in one request). */
export async function enqueueAlbum(uri: string, name = ''): Promise<Result> {
  if (CUSTOM_QUEUE) return addCollection(uri, name)
  const t = await fetchTracks(uri)
  if (!t.tracks.length) { notify(t.hidden ? 'Spotify lar oss ikke se låtene i denne spillelista, så den kan ikke legges i køen.' : 'Fant ingen låter i albumet.', true); return { ok: false } }
  const r = await act<{ added?: number; total?: number; failed?: number }>('spotify_enqueue_many', { uris: t.tracks.map((x) => x.uri) })
  if (r.ok) { noteQueued(t.tracks.map((x) => ({ uri: x.uri, album_uri: x.album_uri })), uri.startsWith('spotify:album:') ? uri : null, true); optQueued(t.tracks) }
  queueChanged()
  if (!r.ok) { notify(r.error || 'Klarte ikke å legge albumet i køen.', true); return r }
  if (r.failed) { notify(`Bare ${r.added} av ${r.total} låter kom inn i køen – prøv en gang til.`, true); return { ok: false, error: 'partial' } }
  notify(name ? `«${name}» er lagt i køen (${r.added} låter).` : 'Albumet er lagt i køen.')
  return { ok: true }
}
/** Is this song among my liked songs? / save or remove it. */
const likedCache = new Map<string, { t: number; v: boolean }>() // asked once per song (10 minutes), changed at once by the heart
export async function isLiked(uri: string): Promise<boolean> {
  const hit = likedCache.get(uri)
  if (hit && Date.now() - hit.t < 600000) return hit.v
  try {
    const v = !!(await api<{ liked?: boolean }>('spotify_liked', null, { query: `&uri=${encodeURIComponent(uri)}` })).liked
    likedCache.set(uri, { t: Date.now(), v })
    return v
  } catch { return false }
}
export async function setLiked(uri: string, on: boolean): Promise<ActResult> {
  const r = await act('spotify_liked', { uri, on })
  if (r.ok) likedCache.set(uri, { t: Date.now(), v: !!on })
  if (r.ok) notify(on ? 'Lagret i «Likte sanger».' : 'Fjernet fra «Likte sanger».')
  return r
}

/** Another room: forget everything about the last one (its library, what played, the lock) and start from what this
 *  machine has saved for the new room. The caller then asks the server (refreshLists / refreshNow). */
export function resetSpotify(): void {
  Object.assign(spotify, {
    notice: null, loaded: false, configured: false, connected: false, denied: false, now: null, albums: [], guests: [], playlists: [], recent: [],
    queueV: 0, lockUntil: 0, lockSeconds: 600, offset: 0, error: null, startedHere: 0,
    origin: ((): PlayOrigin | null => { try { return JSON.parse(localStorage.getItem(roomKey('niben-play-origin')) || 'null') as PlayOrigin | null } catch { return null } })(),
  })
  listsAt = 0; listsSig = ''; nowSig = ''; cachedRoom = ''; roomSeen = ''; localUntil = 0
  trackCache.clear(); tempoCache.clear(); searchCache.clear(); likedCache.clear()
  hydrate()
}
