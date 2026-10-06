import { reactive } from 'vue'

// The pause between two songs on the record player. On a real record there is a stretch of groove between the tracks: the
// song ends, a moment of nothing but the surface noise, the next one begins. Spotify starts the next song at once, so the
// in-browser player makes the gap itself:
//   · the end of a song: the volume is brought down over 150 ms (no digital cut)
//   · the next song is held (paused, silent) for 2.5 s – only the vinyl noise is heard
//   · then it starts at once at full speed, with a 15 ms fade-in (no pop)
// Spotify's stream is DRM-protected and cannot be run through the Web Audio graph, so the envelope is set with the player's own
// volume; the vinyl noise (Web Audio) is the layer that carries on through the gap (useVinylNoise).
export const GAP_MS = 2500
export const FADE_OUT_MS = 150
export const FADE_IN_MS = 15

/** True from the start of the fade-out until the next song is playing: the vinyl layer and the 3D record player treat it as "still playing". */
export const trackGap = reactive({ active: false })

let wanted: () => boolean = () => false
/** The vinyl layer says when the gap is wanted (only while a record plays on the turntable here). */
export function setGapWanted(fn: () => boolean): void { wanted = fn }

type Phase = 'idle' | 'fading' | 'holding'
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

let current: { cancel(): void } | null = null
/** Anything that starts or changes playback from this page (a new album, pause, skip, seek) calls this: the gap gives way. */
export function cancelGap(): void { current?.cancel() }

/** Watches the in-browser player and makes the gap. `volume` = what the volume is when nothing is faded (0–1). */
export function trackGapFor(p: SpotifyPlayer, volume: () => number) {
  let phase: Phase = 'idle'
  let uri: string | null = null // the song that is ending
  let endTimer = 0
  let holdTimer = 0
  let guard = 0
  let run = 0 // goes up when a gap is cancelled: whatever is still running from the old one stops

  const setVol = (k: number): void => { void p.setVolume(Math.max(0, Math.min(1, volume() * k))) }

  /** A volume ramp in a few steps (the player takes a number, not a curve). */
  async function ramp(from: number, to: number, ms: number, me: number): Promise<void> {
    const steps = Math.max(2, Math.round(ms / 25))
    for (let i = 1; i <= steps; i++) {
      if (me !== run) return
      setVol(from + (to - from) * (i / steps))
      if (i < steps) await wait(ms / steps)
    }
  }

  function reset(restore: boolean): void {
    run++
    clearTimeout(endTimer); clearTimeout(holdTimer); clearTimeout(guard)
    phase = 'idle'
    uri = null
    trackGap.active = false
    if (restore) setVol(1)
  }

  async function fadeOut(remaining: number): Promise<void> {
    if (phase !== 'idle') return
    const me = ++run
    phase = 'fading'
    trackGap.active = true
    await ramp(1, 0, Math.min(FADE_OUT_MS, Math.max(60, remaining)), me)
    if (me !== run) return
    // normally the next song has begun by now (onState holds it); if Spotify is slow, do not leave the music silent for long
    guard = window.setTimeout(() => { if (phase === 'fading') reset(true) }, 2500)
  }

  /** When should the fade start? (the position in the state is from the moment of the event) */
  function schedule(st: SpotifyPlayerState, at: number): void {
    clearTimeout(endTimer)
    if (phase !== 'idle' || st.paused || !st.duration || !wanted()) return
    if (!(st.track_window.next_tracks?.length)) return // the last song: nothing to wait for
    uri = st.track_window.current_track?.uri ?? null
    const remaining = st.duration - (st.position + (performance.now() - at))
    endTimer = window.setTimeout(async () => {
      const now = await p.getCurrentState().catch(() => null) // the exact position, now
      if (!now || now.paused || phase !== 'idle') return
      const left = now.duration - now.position
      if (left > FADE_OUT_MS + 120) { schedule(now, performance.now()); return } // (paused / sought meanwhile: look again)
      void fadeOut(left)
    }, Math.max(0, remaining - FADE_OUT_MS - 90))
  }

  async function hold(): Promise<void> {
    const me = run
    phase = 'holding'
    clearTimeout(guard)
    void p.pause() // the next song has started (silent: the volume is 0) – hold it
    holdTimer = window.setTimeout(async () => {
      if (me !== run) return
      await p.resume()
      if (me !== run) return
      await ramp(0, 1, FADE_IN_MS, me) // a hair of fade-in against a pop
      if (me === run) reset(true)
    }, GAP_MS)
  }

  const me = {
    /** Feed every player_state_changed to this. */
    onState(st: SpotifyPlayerState | null): void {
      const at = performance.now()
      if (!st) { if (phase !== 'idle') reset(true); return }
      const cur = st.track_window.current_track?.uri ?? null
      if (phase === 'fading') {
        // the next song began (a different one) → hold it; the same song paused / sought → somebody else is in charge: back to normal
        if (cur && cur !== uri && !st.paused) void hold()
        else if (st.paused && cur === uri && st.position < st.duration - 400) reset(true)
        return
      }
      if (phase === 'holding') return // (our own pause)
      schedule(st, at)
    },
    /** The user pressed pause / skip / seek / play: the gap gives way. */
    cancel(): void { if (phase !== 'idle' || trackGap.active) reset(true) },
    stop(): void { reset(true) },
  }
  current = me
  return me
}
