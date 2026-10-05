import { reactive, computed } from 'vue'
import { spotify, queuedKind } from './useSpotify'

// Where does the music "live" in the room? An album (or a song picked from an album) plays on the turntable; a playlist
// (or a song found by searching) plays on the iPod. "Auto" follows that. It can be forced: always iPod / always turntable.
// The place a play was started from is remembered (spotify.origin), so the room knows what came from what.
const KEY = 'niben-playon'
export const playPref = reactive({ v: (() => { try { const v = localStorage.getItem(KEY); return v === 'ipod' || v === 'vinyl' ? v : 'auto' } catch { return 'auto' } })() })
export function setPlayPref(v) { playPref.v = v === 'ipod' || v === 'vinyl' ? v : 'auto'; try { localStorage.setItem(KEY, playPref.v) } catch {} }

/** Where would playing `uri` end up? ('vinyl' = the turntable, 'ipod') */
export function targetFor(uri, from = null) {
  if (playPref.v !== 'auto') return playPref.v
  if (from === 'search') return 'ipod' // a song found by searching goes on the iPod, even if it plays inside its album
  return /^spotify:album:/.test(uri || '') ? 'vinyl' : 'ipod'
}
/** Where the music is playing right now. */
export const playOn = computed(() => {
  if (playPref.v !== 'auto') return playPref.v
  const now = spotify.now
  const o = spotify.origin
  // a song I queued from here: songs queued together from one album are an album (turntable), a lone song is a playlist song (iPod)
  const q = now?.uri ? queuedKind(now.uri) : null
  if (q) return q === 'album' ? 'vinyl' : 'ipod'
  // started from this site a moment ago (or it is what's playing): the place it was started from decides
  if (o?.uri && now && (now.context === o.uri || now.uri === o.uri || Date.now() - o.t < 20000)) return targetFor(o.uri, o.from)
  // started somewhere else (the Spotify app, another device): by what is playing
  if (/^spotify:album:/.test(now?.context || '')) return 'vinyl'
  return now?.name ? 'ipod' : 'vinyl'
})
