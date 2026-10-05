import { reactive, watch } from 'vue'
import { api, admin } from './useAdmin'
import { playDevice, setLocalNow } from './useSpotify'
import { loadSpotifySdk } from '../lib/spotifySdk'

// niben.no as a Spotify speaker (Spotify Web Playback SDK). Admin only: the browser shows up as a
// device called "niben.no" in Spotify, and "Spill av" plays straight here. Needs Spotify Premium.
const KEY = 'niben-webplayer'
function stored() {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}

// the desktop app's Chromium has no DRM, which Spotify's streams need – there it controls other devices
const noDrm = !!window.nibenApp && !window.nibenApp.drm

export const web = reactive({
  unavailable: noDrm,
  enabled: !noDrm && stored(),
  status: 'off', // off | loading | ready | reconnect | error | elsewhere (another tab is the player)
  error: null,
  paused: true,
  volume: 0.7,
})

// ── one "niben.no" player per browser ──
// Every tab (and every reload) used to register its own player with Spotify, so Spotify listed several
// "niben.no" devices and music went to one that no longer existed. Now one tab holds a lease (renewed every
// few seconds); the others don't start a player. Playing from another tab takes the lease over.
const TAB = Math.random().toString(36).slice(2)
const LEASE_KEY = 'niben-player-lease'
const LEASE_MS = 12000
const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('niben-player') : null
function lease() { try { return JSON.parse(localStorage.getItem(LEASE_KEY) || 'null') } catch { return null } }
function takeLease() { try { localStorage.setItem(LEASE_KEY, JSON.stringify({ tab: TAB, t: Date.now() })) } catch {} }
function freeLease() { try { if (lease()?.tab === TAB) localStorage.removeItem(LEASE_KEY) } catch {} }
const leaseFree = () => { const l = lease(); return !l || l.tab === TAB || Date.now() - l.t > LEASE_MS }
let leaseTimer = 0
chan?.addEventListener('message', (e) => {
  // another tab is taking over: let go of our player so Spotify only has one "niben.no"
  if (e.data?.type === 'take' && e.data.tab !== TAB && player) { stop(); web.status = 'elsewhere' }
})

let player = null
let retryTimer = 0
let activeHere = false // Spotify is currently playing through this page
const readyWaiters = []

async function getToken(cb) {
  try {
    const r = await api('spotify_token', {})
    if (!r.streaming) {
      // the saved Spotify login is from before the player existed – it lacks the "streaming" permission
      web.status = 'reconnect'
      stop()
      return
    }
    cb(r.token)
  } catch (e) {
    fail(e.message)
  }
}

function fail(msg) {
  web.status = 'error'
  web.error = msg
  playDevice.id = null
}

export async function start({ force = false } = {}) {
  if (player || !admin.loggedIn || web.unavailable) return
  if (!leaseFree() && !force) { web.status = 'elsewhere'; return } // another tab is the player
  takeLease()
  chan?.postMessage({ type: 'take', tab: TAB })
  clearInterval(leaseTimer)
  leaseTimer = setInterval(() => { if (player) takeLease() }, 4000)
  web.status = 'loading'
  web.error = null
  try {
    await loadSpotifySdk()
  } catch (e) {
    fail(e.message)
    return
  }
  player = new window.Spotify.Player({ name: 'niben.no', getOAuthToken: getToken, volume: web.volume })
  player.addListener('ready', ({ device_id }) => {
    playDevice.id = device_id
    web.status = 'ready'
    readyWaiters.splice(0).forEach((w) => w(device_id))
  })
  // Spotify dropped the player (sleep, network change): register it again by itself
  player.addListener('not_ready', () => {
    playDevice.id = null
    web.status = 'loading'
    clearTimeout(retryTimer)
    retryTimer = setTimeout(() => { if (player && !playDevice.id) playDevice.reconnect?.() }, 3000)
  })
  // this browser can't play Spotify (no DRM etc.): plays go to my other Spotify devices instead
  player.addListener('initialization_error', ({ message }) => { fail(`Nettleseren støtter ikke Spotify-avspilling (${message}) – spiller på andre enheter.`); web.unavailable = true; stop() })
  player.addListener('authentication_error', () => fail('Spotify godtok ikke innloggingen – koble til på nytt.'))
  player.addListener('account_error', () => fail('Avspilling i nettleseren krever Spotify Premium.'))
  player.addListener('playback_error', ({ message }) => { web.error = message })
  player.addListener('player_state_changed', (st) => {
    activeHere = !!st
    web.paused = !st || st.paused
    // the player knows at once what's playing – show it straight away instead of waiting for the server
    const t = st?.track_window?.current_track
    if (!t) return
    const imgs = [...(t.album?.images || [])].sort((a, b) => (b.width || 0) - (a.width || 0))
    setLocalNow({
      playing: !st.paused,
      shuffle: !!st.shuffle,
      progress_ms: st.position,
      duration_ms: st.duration,
      name: t.name,
      artist: (t.artists || []).map((a) => a.name).join(', '),
      album: t.album?.name || '',
      image: (imgs.find((i) => (i.width || 0) <= 320) || imgs[0])?.url || null,
      image_large: imgs[0]?.url || null,
      uri: t.uri,
      context: st.context?.uri || null,
    })
  })
  // browsers block sound until the page has been clicked: unlock on the first click/tap
  playDevice.activate = () => player?.activateElement?.()
  // pause / resume / seek go straight to the player when the music is playing here
  playDevice.control = async (op, ms) => {
    if (!player || !activeHere) return false
    if (op === 'pause') await player.pause()
    else if (op === 'resume') await player.resume()
    else if (op === 'seek') await player.seek(Math.round(ms))
    else if (op === 'next') await player.nextTrack()
    else if (op === 'previous') await player.previousTrack()
    else return false
    return true
  }
  // drop and re-register with Spotify (when Spotify says it can't find this player); resolves the device id
  playDevice.reconnect = async () => {
    if (!player) return null
    const ready = new Promise((resolve) => {
      readyWaiters.push(resolve)
      setTimeout(() => resolve(null), 8000)
    })
    player.disconnect()
    await player.connect()
    const id = await ready
    if (id) await new Promise((r) => setTimeout(r, 1200)) // let Spotify catch up
    return id
  }
  // wait for the player to register with Spotify (null after `ms`)
  playDevice.waitReady = (ms = 6000) => {
    if (playDevice.id) return Promise.resolve(playDevice.id)
    if (!player) return Promise.resolve(null)
    return new Promise((resolve) => {
      readyWaiters.push(resolve)
      setTimeout(() => resolve(null), ms)
    })
  }
  const ok = await player.connect()
  if (!ok && web.status === 'loading') fail('Klarte ikke å koble til Spotify.')
}

// for play(): start the page's player if it's allowed but off, and wait for it (device id or null)
playDevice.start = async () => {
  if (web.unavailable || !admin.loggedIn) return null
  if (!web.enabled) return null
  if (!player) await start({ force: true })
  return playDevice.waitReady ? playDevice.waitReady(8000) : null
}

export function stop() {
  clearInterval(leaseTimer)
  freeLease()
  player?.disconnect()
  player = null
  playDevice.id = null
  playDevice.activate = null
  playDevice.control = null
  playDevice.reconnect = null
  playDevice.waitReady = null
  clearTimeout(retryTimer)
  activeHere = false
  if (web.status !== 'reconnect') web.status = 'off'
}

export function setEnabled(on) {
  web.enabled = on
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch {}
  if (on) start()
  else stop()
}

export function setVolume(v) {
  web.volume = v
  player?.setVolume(v)
}

// closing / reloading the page stops the music it was playing – tell Spotify, so the site doesn't go
// on saying "playing" (keepalive lets the request finish after the page is gone)
window.addEventListener('pagehide', () => {
  if (!player || !activeHere || web.paused) return
  try {
    fetch('api.php?action=spotify_control', {
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Niben': '1' },
      body: JSON.stringify({ op: 'pause' }),
    })
  } catch {}
  player.disconnect()
  clearInterval(leaseTimer)
  freeLease()
})

// start as soon as the admin is known to be logged in; drop the player on logout
watch(() => admin.loggedIn, (on) => {
  if (on && web.enabled) start()
  else if (!on) stop()
}, { immediate: true })
