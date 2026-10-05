import { reactive, watch } from 'vue'
import { api, admin } from './useAdmin'
import { spotify, progressMs, notify, fetchTracks, findAlbum, playDevice } from './useSpotify'

// My own queue. Spotify's queue can only be added to – songs can't be moved or taken away – so the list lives HERE
// (on the server, the same on every device) and Spotify only ever holds ONE song of it: the next one, sent in the last
// seconds of the song that plays (or at once if the page is being put away – a phone about to lock). Everything before
// that can be dragged around and deleted freely. When a song from the list starts playing it leaves the list.
// What plays after the list is empty is whatever the album / playlist does next (shuffled, if Spotify's shuffle is on).
// OFF: the app uses Spotify's own queue (add to it, read it). The code below stays for later, but does nothing while this is false.
export const CUSTOM_QUEUE = false

export const myQueue = reactive({
  items: [], // [{ uri, name, artist, img, ms, album_uri, album, album_image, no, disc }]
  loaded: false,
  sent: null, // { uri, after, t } – the first song is already in Spotify's queue: it can't be moved any more
})

const LEAD_MS = 15000 // send the next song this long before the current one ends
const SENT_KEY = 'niben-queue-sent'
if (CUSTOM_QUEUE) { try { myQueue.sent = JSON.parse(sessionStorage.getItem(SENT_KEY) || 'null') } catch {} }
const keepSent = () => { try { sessionStorage.setItem(SENT_KEY, JSON.stringify(myQueue.sent)) } catch {} }

let saveT = 0
let backoff = 0
let started = false
let sending = false

const slim = (t) => ({ uri: t.uri, name: t.name || '', artist: t.artist || '', img: t.img || t.album_image || '', ms: t.ms || 0, album_uri: t.album_uri || null, album: t.album || '', album_image: t.album_image || t.img || '', no: t.no ?? t.n ?? null, disc: t.disc ?? null })

export async function loadMyQueue() {
  if (!CUSTOM_QUEUE || !admin.loggedIn) return
  try {
    const j = await api('myqueue_get')
    // what I'm editing right now wins over a slow answer
    if (!saveT) myQueue.items = Array.isArray(j.items) ? j.items : []
  } catch {}
  myQueue.loaded = true
}

function save() {
  clearTimeout(saveT)
  saveT = setTimeout(async () => {
    saveT = 0
    try { await api('myqueue_set', { items: myQueue.items }) } catch {}
  }, 500)
}
const changed = () => { spotify.queueV++; save() }

/** Is this place in the list still free to change? (The first song is locked once Spotify has it.) */
export const locked = (i) => i === 0 && !!myQueue.sent && myQueue.sent.uri === myQueue.items[0]?.uri

export function addSongs(tracks, { silent = false } = {}) {
  const list = tracks.filter((t) => t?.uri).map(slim)
  if (!list.length) return { ok: false, error: 'Ingen låter å legge til.' }
  myQueue.items = [...myQueue.items, ...list]
  changed()
  if (!silent) notify(list.length === 1 ? `«${list[0].name || 'Låten'}» er lagt i køen.` : `${list.length} låter er lagt i køen.`)
  startQueueDriver()
  return { ok: true }
}

/** A whole album / playlist at the end of my list. */
export async function addCollection(uri, name = '') {
  const t = await fetchTracks(uri)
  if (!t.tracks?.length) { notify(t.hidden ? 'Spotify lar oss ikke se låtene i denne spillelista, så den kan ikke legges i køen. Du kan spille den, og køen din spilles som vanlig etter låten som går.' : 'Fant ingen låter.', true); return { ok: false } }
  const al = findAlbum(uri)
  const tracks = uri.startsWith('spotify:album:')
    ? t.tracks.map((x) => ({ ...x, album_uri: x.album_uri || uri, album: x.album || al?.name || name, album_image: x.album_image || al?.image || al?.thumb || '', img: x.img || al?.thumb || al?.image || '' }))
    : t.tracks
  const r = addSongs(tracks, { silent: true })
  if (r.ok) notify(`${name ? `«${name}»` : 'Samlingen'} er lagt i køen (${tracks.length} låter).`)
  return r
}

export function removeAt(i) {
  if (locked(i) || i < 0 || i >= myQueue.items.length) return
  myQueue.items = myQueue.items.filter((_, x) => x !== i)
  changed()
}
/** Take out the songs at these places (an album tile) and put them back at `to` (a place in the list without them). */
export function moveRange(from, count, to) {
  const items = [...myQueue.items]
  const lo = myQueue.sent ? 1 : 0 // never in front of the song Spotify already has
  if (from < lo || from + count > items.length) return
  const chunk = items.splice(from, count)
  items.splice(Math.max(lo, Math.min(items.length, to)), 0, ...chunk)
  myQueue.items = items
  changed()
}
export function clearMine() {
  myQueue.items = myQueue.items.filter((_, i) => locked(i))
  changed()
}
/** Mix up what's left of my list (the locked first song stays). */
export function shuffleMine() {
  const lo = myQueue.sent ? 1 : 0
  const rest = myQueue.items.slice(lo)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  myQueue.items = [...myQueue.items.slice(0, lo), ...rest]
  changed()
}

/** I'm about to put something else on, but Spotify already holds my next song and can't give it back. So use it up
 *  first (skip to it – a blip, the new song starts right after) and put it back first in my list: it isn't lost. */
export async function releaseSent() {
  const s = myQueue.sent
  if (!s) return
  try {
    if (!(playDevice.control && (await playDevice.control('next', 0)))) await api('spotify_control', { op: 'next', ms: 0 })
  } catch {}
  myQueue.sent = null
  keepSent()
  spotify.queueV++
}

// ── the driver: keeps Spotify's queue holding exactly my next song ──
async function sendNext() {
  if (sending || myQueue.sent || !myQueue.items.length || Date.now() < backoff) return
  const head = myQueue.items[0]
  sending = true
  try {
    const after = spotify.now?.uri || ''
    await api('myqueue_send', { uri: head.uri, after }) // the server sends it once, however many pages are open
    myQueue.sent = { uri: head.uri, after: after || null, t: Date.now() }
    keepSent()
    spotify.queueV++
  } catch (e) {
    backoff = Date.now() + 20000 // no device / Spotify busy: try again in a while
  } finally {
    sending = false
  }
}

function drive() {
  const n = spotify.now
  if (!admin.loggedIn || !n?.uri) return
  const s = myQueue.sent
  if (s) {
    // it has started playing → it leaves my list
    const arrived = n.uri === s.uri && (n.uri !== s.after || (progressMs.value < 8000 && Date.now() - s.t > 3000))
    if (arrived) {
      const i = myQueue.items.findIndex((t) => t.uri === s.uri)
      if (i >= 0) myQueue.items = myQueue.items.filter((_, x) => x !== i)
      myQueue.sent = null
      keepSent()
      changed()
    } else if (Date.now() - s.t > 25 * 60000) { myQueue.sent = null; keepSent() } // it never came: let go
    return
  }
  if (!myQueue.items.length || !n.playing || !n.duration_ms) return
  if (n.duration_ms - progressMs.value <= LEAD_MS) sendNext()
}

/** Start watching (once): called when I'm logged in and the page runs. */
export function startQueueDriver() {
  if (!CUSTOM_QUEUE || started || !admin.loggedIn) return
  started = true
  loadMyQueue()
  watch(() => spotify.tick, drive)
  watch(() => spotify.now?.uri, drive)
  // the page is being put away (phone locks, tab hidden): hand Spotify the next song now – nothing runs after this
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && spotify.now?.playing && myQueue.items.length) sendNext()
    else if (!document.hidden) loadMyQueue()
  })
  window.addEventListener('pagehide', () => { if (spotify.now?.playing && myQueue.items.length) sendNext() })
}

watch(() => admin.loggedIn, (v) => { if (v) startQueueDriver(); else { myQueue.items = []; myQueue.sent = null } }, { immediate: false })
