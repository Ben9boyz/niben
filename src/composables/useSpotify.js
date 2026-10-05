import { reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { api } from './useAdmin'
import { pget, pset, pdel } from '../lib/pcache'

// Shared Spotify state: what's saved, what's playing, and the 10-minute switch lock.
export const spotify = reactive({
  notice: null, // { text, error, t } – a short message after starting/controlling playback (MusicToast)
  loaded: false,
  configured: false,
  connected: false,
  now: null, // { playing, progress_ms, duration_ms, name, artist, album, image, context, at }
  albums: [],
  guests: [], // albums found by search that aren't on the shelf – they get a record in the room for a while
  playlists: [],
  recent: [], // the albums I listened to last (newest first) – from the server, the same on every device
  queueV: 0, // goes up whenever I add something to the queue (the 3D table re-reads the queue)
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

// The album/playlist lists are big and rarely change – and when I change them from here the page updates them
// itself. So keep them on this machine and only ask the server again once a day (or on "Oppdater fra Spotify").
// "Now playing" + the lock are tiny and polled often.
const LISTS_KEY = 'niben-spotify-lists-v2'
const LISTS_MAX_AGE = 24 * 60 * 60 * 1000
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
  if (j.recent && JSON.stringify(j.recent) !== JSON.stringify(spotify.recent)) spotify.recent = j.recent
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

const DAY = 86400000
const trackCache = new Map()
let prefetchTimer = 0
/** Fetch a record's/list's tracks in the background when the pointer rests on it, so opening it is instant. */
export function prefetchTracks(uri) {
  clearTimeout(prefetchTimer)
  if (!uri || trackCache.has(uri)) return
  prefetchTimer = setTimeout(() => fetchTracks(uri), 180) // only if it rests there a moment
}
const tempoCache = new Map()
/** Tempo (BPM) of a song – 0 when nobody knows. Asked once per song, then remembered here (30 days; an unknown
 *  tempo is tried again after 3 days). The turntable in the 3D room spins to it. */
export async function fetchTempo(uri) {
  const id = String(uri || '').split(':')[2]
  if (!id || !uri.startsWith('spotify:track:')) return 0
  if (tempoCache.has(id)) return tempoCache.get(id)
  const p = (async () => {
    const saved = await pget(`tempo:${id}`, 30 * DAY)
    if (saved !== undefined && (saved > 0 || (await pget(`tempo:${id}`, 3 * DAY)) !== undefined)) return saved
    try {
      const r = await fetch(`api.php?action=spotify_tempo&id=${encodeURIComponent(id)}`, { credentials: 'same-origin', headers: { 'X-Niben': '1' } })
      const bpm = Number((await r.json()).bpm) || 0
      if (r.ok) pset(`tempo:${id}`, bpm)
      return bpm
    } catch { tempoCache.delete(id); return 0 }
  })()
  tempoCache.set(id, p)
  return p
}
/** Track list for 'spotify:album:…' / 'spotify:playlist:…' – { tracks, hidden }. Fetched once: an album's songs never
 *  change (kept 90 days), a playlist's are kept 6 hours – and dropped at once when I add something from here. */
export async function fetchTracks(uri) {
  if (trackCache.has(uri)) return trackCache.get(uri)
  const [, type, id] = uri.split(':')
  const p = (async () => {
    const saved = await pget(`tracks:${uri}`, type === 'album' ? 90 * DAY : 6 * 3600000)
    if (saved) return saved
    try {
      const j = await (await fetch(`api.php?action=spotify_tracks&type=${type}&id=${encodeURIComponent(id)}`)).json()
      const out = { tracks: j.tracks || [], hidden: !!j.hidden }
      if (!j.error && (out.tracks.length || out.hidden)) pset(`tracks:${uri}`, out)
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
export function forgetTracks(uri) { trackCache.delete(uri); pdel(`tracks:${uri}`) }

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

/** The in-browser Spotify player (useWebPlayer), when it's running: plays go there. `waitReady` resolves
 *  the device id once the player has registered (or null), `start` starts it if it's off. */
export const playDevice = { id: null, activate: null, control: null, reconnect: null, waitReady: null, start: null }

/** Show a short message about playback (where it ended up, why it failed). */
export function notify(text, error = false) {
  spotify.notice = { text, error, t: Date.now() }
}

/** Pause / resume / seek / next / previous (admin). Goes straight to the browser player when it's
 *  the one playing. Pausing always works; seeking and skipping are locked like switching. */
export async function control(op, ms = 0) {
  if (['seek', 'next', 'previous'].includes(op) && lockLeft.value > 0) return { ok: false, error: 'Låst – hør ferdig' }
  try {
    if (playDevice.control && (await playDevice.control(op, ms))) return { ok: true }
  } catch {} // the browser player failed: ask Spotify through the server instead
  try {
    const body = { op, ms: Math.round(ms) }
    if (op === 'resume' && playDevice.id) { playDevice.activate?.(); body.device = playDevice.id }
    await api('spotify_control', body)
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

/** Starts an album/playlist (optionally at a given track). Locked for the admin-set lock length afterwards.
 *  Tries hard to play somewhere: the player on this page first (waiting for it / reconnecting it when
 *  Spotify can't see it), then any other Spotify device of mine – and says where it ended up. */
let starting = false // one start at a time: a double click / tap must not send two plays
export async function play(uri, track = null) {
  if (starting) return { ok: false, error: 'Starter allerede …' }
  starting = true
  // must run inside the click, before any await, or the browser keeps the player muted
  if (playDevice.id) playDevice.activate?.()
  const body = { uri }
  if (track) body.track = track
  const send = async () => {
    try {
      return await api('spotify_play', body)
    } catch (e) {
      // Spotify had a hiccup: one more try
      if (e.status >= 500 || /HTTP 5|Failed to fetch|NetworkError/i.test(e.message)) {
        await new Promise((r) => setTimeout(r, 800))
        return api('spotify_play', body)
      }
      throw e
    }
  }
  try {
    // the page's player is still starting up: wait a moment for it rather than playing elsewhere
    // or another tab is the player: take it over here (that tab lets go)
    if (playDevice.id) body.device = playDevice.id
    else if (playDevice.waitReady) body.device = (await playDevice.waitReady(6000)) || undefined
    else if (playDevice.start) body.device = (await playDevice.start()) || undefined
    let r
    try {
      r = await send()
    } catch (e) {
      if (e.code === 'device_missing' && playDevice.reconnect) {
        // Spotify can't see the page's player: re-register it and try again …
        const id = await playDevice.reconnect()
        if (id) body.device = id
        try {
          r = await send()
        } catch (e2) {
          if (e2.code !== 'device_missing') throw e2
          // … and if it still can't, play on another of my devices
          body.fallback = true
          r = await send()
        }
      } else if (e.code === 'no_device' && !body.device && playDevice.start) {
        // nothing open anywhere: start the page's own player and play here
        const id = await playDevice.start()
        if (!id) throw e
        body.device = id
        r = await send()
      } else throw e
    }
    spotify.lockUntil = r.lock_until
    spotify.startedHere = Date.now()
    if (r.server_time) spotify.offset = r.server_time - Date.now() / 1000
    if (r.device_name) notify(`Spiller på «${r.device_name}» – fant ikke spilleren på siden.`)
    setTimeout(refreshNow, 1500) // give Spotify a moment before asking what's playing
    return { ok: true, device: r.device_name || null }
  } catch (e) {
    await refreshNow()
    notify(e.message, true)
    return { ok: false, error: e.message }
  } finally {
    starting = false
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
const searchCache = new Map() // the same search again within 10 minutes costs nothing
export async function searchSpotify(q) {
  const key = q.trim().toLowerCase()
  const hit = searchCache.get(key)
  if (hit && Date.now() - hit.t < 600000) return hit.v
  const v = await searchSpotifyNow(q)
  searchCache.set(key, { t: Date.now(), v })
  if (searchCache.size > 40) searchCache.delete(searchCache.keys().next().value)
  return v
}
async function searchSpotifyNow(q) {
  const r = await fetch(`api.php?action=spotify_search&q=${encodeURIComponent(q)}`, { cache: 'no-store', credentials: 'same-origin', headers: { 'X-Niben': '1' } })
  let j = {}
  try { j = await r.json() } catch {}
  if (!r.ok || j.error) throw new Error(j.error || `Søket feilet (${r.status})`)
  return { albums: j.albums || [], tracks: j.tracks || [], playlists: j.playlists || [] }
}

/** Save someone else's playlist (from search) among mine. */
export async function followPlaylist(uri) {
  try {
    await api('spotify_follow', { playlist: uri })
    refreshLists(true)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
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
    // no need to fetch everything again: the playlist is one song longer, and its saved track list is out of date
    const pl = spotify.playlists.find((p) => p.uri === playlistUri)
    if (pl && typeof pl.count === 'number') pl.count++
    forgetTracks(playlistUri)
    listsSig = ''
    try { localStorage.setItem(LISTS_KEY, JSON.stringify({ at: listsAt, sig: listsSig, albums: spotify.albums, playlists: spotify.playlists })) } catch {}
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

// ── more of the player: queue, devices, volume, repeat, liked songs ──
async function act(action, body) {
  try { return { ok: true, ...(await api(action, body)) } } catch (e) { return { ok: false, error: e.message, code: e.code } }
}
/** Up next in Spotify's queue. */
export async function fetchQueue() {
  try { const r = await fetch('api.php?action=spotify_queue', { cache: 'no-store' }); return (await r.json()).tracks || [] } catch { return [] }
}
/** My Spotify devices (admin). */
export async function fetchDevices() {
  try { return (await api('spotify_devices')).devices || [] } catch { return [] }
}
/** Move playback to another device (it keeps playing). */
export async function transferTo(device, playNow = true) {
  const r = await act('spotify_transfer', { device, play: playNow })
  if (r.ok) setTimeout(refreshNow, 900)
  return r
}
let volTimer = 0
/** Volume of the device that's playing (0–100), sent a moment after the slider stops. */
export function setDeviceVolume(percent) {
  if (spotify.now) spotify.now.volume = percent
  clearTimeout(volTimer)
  return new Promise((res) => { volTimer = setTimeout(async () => res(await act('spotify_volume', { percent })), 250) })
}
const REPEAT_NEXT = { off: 'context', context: 'track', track: 'off' }
/** Repeat: off → the list/album → this song → off. */
export async function cycleRepeat() {
  const next = REPEAT_NEXT[spotify.now?.repeat || 'off']
  const before = spotify.now?.repeat
  if (spotify.now) spotify.now.repeat = next // show it at once
  const r = await act('spotify_repeat', { state: next })
  if (!r.ok && spotify.now) spotify.now.repeat = before
  return r
}
/** Put a song next in the queue. */
export async function enqueue(uri) {
  const r = await act('spotify_enqueue', { uri })
  if (r.ok) { notify('Lagt i køen.'); spotify.queueV++ }
  return r
}
/** A whole album at the end of the queue (its songs, in order). */
export async function enqueueAlbum(albumUri, name = '') {
  const t = await fetchTracks(albumUri)
  if (!t.tracks.length) { notify('Fant ingen låter i albumet.', true); return { ok: false } }
  for (const tr of t.tracks) {
    const r = await act('spotify_enqueue', { uri: tr.uri })
    if (!r.ok) { notify(r.error || 'Klarte ikke å legge albumet i køen.', true); spotify.queueV++; return r }
  }
  notify(name ? `«${name}» er lagt i køen.` : 'Albumet er lagt i køen.')
  spotify.queueV++
  return { ok: true }
}
/** Is this song among my liked songs? / save or remove it. */
const likedCache = new Map() // uri -> { t, v }: asked once per song (10 minutes), changed at once by the heart
export async function isLiked(uri) {
  const hit = likedCache.get(uri)
  if (hit && Date.now() - hit.t < 600000) return hit.v
  try {
    const v = !!(await api('spotify_liked', null, { query: `&uri=${encodeURIComponent(uri)}` })).liked
    likedCache.set(uri, { t: Date.now(), v })
    return v
  } catch { return false }
}
export async function setLiked(uri, on) {
  const r = await act('spotify_liked', { uri, on })
  if (r.ok) likedCache.set(uri, { t: Date.now(), v: !!on })
  if (r.ok) notify(on ? 'Lagret i «Likte sanger».' : 'Fjernet fra «Likte sanger».')
  return r
}
