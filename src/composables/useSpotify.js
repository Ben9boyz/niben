import { reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { api } from './useAdmin'

// Shared Spotify state: what's saved, what's playing, and the 10-minute switch lock.
export const spotify = reactive({
  loaded: false,
  configured: false,
  connected: false,
  now: null, // { playing, progress_ms, duration_ms, name, artist, album, image, context, at }
  albums: [],
  guests: [], // albums found by search that aren't on the shelf – they get a record in the room for a while
  playlists: [],
  lockUntil: 0, // unix seconds (server clock)
  lockSeconds: 600, // how long a play locks switching (admin setting, 0 = never)
  offset: 0, // server time - local time (seconds)
  tick: Date.now(), // updates every second for countdowns
  error: null,
  startedHere: 0, // time of the last successful play() from this page
})

let subscribers = 0
let pollTimer = 0
let tickTimer = 0
let fetchedAt = 0

// The album/playlist lists are big and rarely change: keep them on this machine and only ask
// the server again every 30 minutes. "Now playing" + the lock are tiny and polled often.
const LISTS_KEY = 'niben-spotify-lists-v2'
const LISTS_MAX_AGE = 30 * 60 * 1000
let listsAt = 0
let listsSig = ''
let nowSig = ''

;(function hydrate() {
  try {
    const c = JSON.parse(localStorage.getItem(LISTS_KEY) || 'null')
    if (c?.albums) {
      spotify.albums = c.albums
      spotify.playlists = c.playlists || []
      spotify.configured = true
      spotify.connected = true
      spotify.loaded = true
      listsAt = c.at || 0
      listsSig = c.sig || ''
    }
  } catch {}
})()

async function getJson(action) {
  const r = await fetch(`api.php?action=${action}`, { cache: 'no-store' })
  if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

// the browser player reports changes instantly – while those are fresh, they beat the (slower) server
let localUntil = 0
let endTimer = 0

function setNow(n) {
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
  if (n?.playing && n.duration_ms) endTimer = setTimeout(refreshNow, Math.max(1000, n.duration_ms - n.progress_ms + 1200))
}

/** Now-playing straight from the in-browser player (useWebPlayer). */
export function setLocalNow(n) {
  localUntil = Date.now() + 30000
  setNow(n)
}

function applyNow(j) {
  spotify.configured = !!j.configured
  spotify.connected = !!j.connected
  if (j.server_time) spotify.offset = j.server_time - Date.now() / 1000
  if ((j.lock_until || 0) !== spotify.lockUntil) spotify.lockUntil = j.lock_until || 0
  if (j.lock_seconds != null && j.lock_seconds !== spotify.lockSeconds) spotify.lockSeconds = j.lock_seconds
  if (Date.now() < localUntil) return
  const n = j.now || null
  // the server caches for a few seconds: move the position on by the cache's age
  if (n?.playing && n.at && j.server_time) n.progress_ms = Math.min(n.duration_ms || Infinity, n.progress_ms + (j.server_time - n.at) * 1000)
  setNow(n)
}

/** Polls what's playing (cheap). */
export async function refreshNow() {
  try {
    applyNow(await getJson('spotify_now'))
    spotify.error = null
  } catch (e) {
    spotify.error = e.message
  } finally {
    spotify.loaded = true
  }
}

/** Fetches albums + playlists (big) – only when stale, or when forced. */
export async function refreshLists(force = false) {
  if (!force && Date.now() - listsAt < LISTS_MAX_AGE && spotify.albums.length) return
  try {
    const j = await getJson('spotify_public')
    applyNow(j)
    if (j.connected) {
      const sig = JSON.stringify([j.albums?.map((a) => a.uri + a.thumb), j.playlists?.map((p) => p.uri + p.count + p.thumb)])
      if (sig !== listsSig) {
        listsSig = sig
        spotify.albums = j.albums || []
        spotify.playlists = j.playlists || []
      }
      listsAt = Date.now()
      try { localStorage.setItem(LISTS_KEY, JSON.stringify({ at: listsAt, sig, albums: spotify.albums, playlists: spotify.playlists })) } catch {}
    } else {
      spotify.albums = []
      spotify.playlists = []
      try { localStorage.removeItem(LISTS_KEY) } catch {}
    }
    spotify.error = null
  } catch (e) {
    spotify.error = e.message
  } finally {
    spotify.loaded = true
  }
}

/** Everything, fresh (after connecting, refreshing from Spotify or disconnecting). */
export async function refreshSpotify() {
  await refreshLists(true)
}

/** Seconds left on the switch lock (0 when unlocked). */
export const lockLeft = computed(() => {
  const nowServer = spotify.tick / 1000 + spotify.offset
  return Math.max(0, Math.ceil(spotify.lockUntil - nowServer))
})

/** "10 min", "1 t 30 min" … for the lock length. */
export function fmtLock(sec) {
  const m = Math.round(sec / 60)
  return m >= 60 ? `${Math.floor(m / 60)} t${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`
}

/** Text shown after starting something, e.g. "låst i 10 min" (or nothing when the lock is off). */
export const lockNote = () => (spotify.lockSeconds > 0 ? ` – låst i ${fmtLock(spotify.lockSeconds)}` : '')

/** Changes the lock length for the next play (admin). Refused while a lock is running. */
export async function setLockSeconds(seconds) {
  const r = await api('spotify_lock', { seconds })
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

export const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const trackCache = new Map()
let prefetchTimer = 0
/** Fetch a record's/list's tracks in the background when the pointer rests on it, so opening it is instant. */
export function prefetchTracks(uri) {
  clearTimeout(prefetchTimer)
  if (!uri || trackCache.has(uri)) return
  prefetchTimer = setTimeout(() => fetchTracks(uri), 180) // only if it rests there a moment
}
/** Track list for 'spotify:album:…' / 'spotify:playlist:…' – { tracks, hidden }. */
export async function fetchTracks(uri) {
  if (trackCache.has(uri)) return trackCache.get(uri)
  const [, type, id] = uri.split(':')
  const p = fetch(`api.php?action=spotify_tracks&type=${type}&id=${encodeURIComponent(id)}`)
    .then((r) => r.json())
    .then((j) => ({ tracks: j.tracks || [], hidden: !!j.hidden }))
    .catch(() => {
      trackCache.delete(uri)
      return { tracks: [], error: true }
    })
  trackCache.set(uri, p)
  return p
}

/** Shuffle on / off (admin) – for whatever is playing, wherever it plays. */
export async function setShuffle(on) {
  try {
    await api('spotify_control', { op: 'shuffle', state: !!on })
    if (spotify.now) spotify.now.shuffle = !!on
    setTimeout(refreshNow, 800)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/** The in-browser Spotify player (useWebPlayer), when it's running: plays go there. */
export const playDevice = { id: null, activate: null, control: null, reconnect: null }

/** Pause / resume / seek / next / previous (admin). Goes straight to the browser player when it's
 *  the one playing. Pausing always works; seeking and skipping are locked like switching. */
export async function control(op, ms = 0) {
  if (['seek', 'next', 'previous'].includes(op) && lockLeft.value > 0) return { ok: false, error: 'Låst – hør ferdig' }
  if (playDevice.control && (await playDevice.control(op, ms))) return { ok: true }
  try {
    await api('spotify_control', { op, ms: Math.round(ms) })
    if (spotify.now) {
      if (op === 'seek') spotify.now.progress_ms = ms
      if (op === 'pause' || op === 'resume') spotify.now.playing = op === 'resume'
      fetchedAt = Date.now()
    }
    setTimeout(refreshNow, 800)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/** Starts an album/playlist (optionally at a given track). Locked for the admin-set lock length afterwards. */
export async function play(uri, track = null) {
  // must run inside the click, before any await, or the browser keeps the player muted
  if (playDevice.id) playDevice.activate?.()
  try {
    const body = { uri }
    if (track) body.track = track
    if (playDevice.id) body.device = playDevice.id
    let r
    try {
      r = await api('spotify_play', body)
    } catch (e) {
      // Spotify hasn't registered the browser player: reconnect it and try once more
      if (e.code !== 'device_missing' || !playDevice.reconnect) throw e
      body.device = await playDevice.reconnect()
      if (!body.device) throw e
      r = await api('spotify_play', body)
    }
    spotify.lockUntil = r.lock_until
    spotify.startedHere = Date.now()
    if (r.server_time) spotify.offset = r.server_time - Date.now() / 1000
    setTimeout(refreshNow, 1500) // give Spotify a moment before asking what's playing
    return { ok: true }
  } catch (e) {
    await refreshNow()
    return { ok: false, error: e.message }
  }
}

/** Keeps the data fresh while at least one component is using it. */
export function useSpotify() {
  onMounted(() => {
    if (subscribers++ === 0) {
      refreshLists()
      refreshNow()
      // "now playing" every 10 s, but only while the page is visible
      pollTimer = setInterval(() => { if (!document.hidden) refreshNow() }, 10000)
      tickTimer = setInterval(() => (spotify.tick = Date.now()), 1000)
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
export async function searchSpotify(q) {
  const r = await fetch(`api.php?action=spotify_search&q=${encodeURIComponent(q)}`, { cache: 'no-store', credentials: 'same-origin', headers: { 'X-Niben': '1' } })
  let j = {}
  try { j = await r.json() } catch {}
  if (!r.ok || j.error) throw new Error(j.error || `Søket feilet (${r.status})`)
  return { albums: j.albums || [], tracks: j.tracks || [] }
}

/** Put an album in the library – it joins the record shelf. */
export async function saveAlbum(uri) {
  try {
    await api('spotify_save', { uri })
    await refreshLists(true)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/** Add a song to one of my playlists. */
export async function addToPlaylist(playlistUri, trackUri) {
  try {
    await api('spotify_playlist_add', { playlist: playlistUri, uri: trackUri })
    refreshLists(true)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/** An album from search joins the room as a guest record (it flies in through the window). */
export function addGuest(a) {
  if (!a?.uri || spotify.albums.some((x) => x.uri === a.uri)) return
  spotify.guests = [a, ...spotify.guests.filter((g) => g.uri !== a.uri)].slice(0, 3)
}
/** An album on the shelf, or a guest from search. */
export const findAlbum = (uri) => spotify.albums.find((a) => a.uri === uri) || spotify.guests.find((a) => a.uri === uri) || null
