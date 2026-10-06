import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { trackGapFor, setGapWanted, trackGap, cancelGap, GAP_MS, FADE_OUT_MS } from '../../src/composables/music/useTrackGap'

// The pause between two songs on the record player, with a fake Spotify player and fake time: the volume comes down over
// 150 ms at the end, the next song is held (silent) for 2.5 s, then it starts with a 15 ms fade-in.

interface Fake { volumes: number[]; calls: string[]; state: SpotifyPlayerState; player: SpotifyPlayer }
function fakePlayer(): Fake {
  const f: Fake = {
    volumes: [], calls: [],
    state: { paused: false, shuffle: false, position: 0, duration: 200000, context: { uri: 'spotify:album:x' }, track_window: { current_track: { uri: 'spotify:track:one' } as SpotifyTrackInfo, next_tracks: [{ uri: 'spotify:track:two' } as SpotifyTrackInfo] } },
    player: undefined as unknown as SpotifyPlayer,
  }
  f.player = {
    setVolume: async (v: number) => { f.volumes.push(+v.toFixed(2)) },
    pause: async () => { f.calls.push('pause') },
    resume: async () => { f.calls.push('resume') },
    getCurrentState: async () => ({ ...f.state, position: f.state.position + (performance.now() - started) }),
  } as unknown as SpotifyPlayer
  return f
}
let started = 0
const nextSong = (st: SpotifyPlayerState): SpotifyPlayerState => ({ ...st, position: 0, track_window: { current_track: { uri: 'spotify:track:two' } as SpotifyTrackInfo, next_tracks: [] } })

describe('the pause between two songs', () => {
  beforeEach(() => { vi.useFakeTimers(); started = performance.now(); setGapWanted(() => true); trackGap.active = false })
  afterEach(() => { cancelGap(); vi.useRealTimers() })

  it('fades out, holds the next song 2.5 s, and starts it with a tiny fade-in', async () => {
    const f = fakePlayer()
    const gap = trackGapFor(f.player, () => 1)
    f.state.position = 199000 // 1 s left
    started = performance.now()
    gap.onState(f.state)
    expect(trackGap.active).toBe(false)

    await vi.advanceTimersByTimeAsync(800) // …the end is near: the fade begins
    expect(trackGap.active).toBe(true)
    await vi.advanceTimersByTimeAsync(FADE_OUT_MS + 20)
    expect(f.volumes.at(-1)).toBe(0)
    expect(f.volumes.length).toBeGreaterThan(2) // (a ramp, not a cut)
    expect(f.volumes.every((v, i, a) => i === 0 || v <= a[i - 1]!)).toBe(true)

    // Spotify starts the next song by itself: it is held at once
    gap.onState(nextSong(f.state))
    expect(f.calls).toEqual(['pause'])
    await vi.advanceTimersByTimeAsync(GAP_MS - 50)
    expect(f.calls).toEqual(['pause']) // (still waiting)
    expect(trackGap.active).toBe(true)

    await vi.advanceTimersByTimeAsync(200)
    expect(f.calls).toEqual(['pause', 'resume'])
    await vi.advanceTimersByTimeAsync(100)
    expect(f.volumes.at(-1)).toBe(1) // back at full volume
    expect(trackGap.active).toBe(false)
  })

  it('does nothing when the gap is not wanted (the vinyl layer is off) or for the last song', async () => {
    const f = fakePlayer()
    setGapWanted(() => false)
    const gap = trackGapFor(f.player, () => 1)
    f.state.position = 199000; started = performance.now()
    gap.onState(f.state)
    await vi.advanceTimersByTimeAsync(2000)
    expect(f.volumes).toEqual([])

    setGapWanted(() => true)
    f.state.track_window.next_tracks = []
    gap.onState(f.state)
    await vi.advanceTimersByTimeAsync(2000)
    expect(f.volumes).toEqual([])
    expect(trackGap.active).toBe(false)
  })

  it('gives way when somebody presses something: the volume comes back, nothing is resumed later', async () => {
    const f = fakePlayer()
    const gap = trackGapFor(f.player, () => 1)
    f.state.position = 199000; started = performance.now()
    gap.onState(f.state)
    await vi.advanceTimersByTimeAsync(900)
    gap.onState(nextSong(f.state)) // held
    await vi.advanceTimersByTimeAsync(500)
    cancelGap() // the user picked another album
    expect(trackGap.active).toBe(false)
    expect(f.volumes.at(-1)).toBe(1)
    await vi.advanceTimersByTimeAsync(GAP_MS * 2)
    expect(f.calls).toEqual(['pause']) // no late "resume" on top of what the user chose
  })

  it('a seek far from the end cancels the fade', async () => {
    const f = fakePlayer()
    const gap = trackGapFor(f.player, () => 1)
    f.state.position = 199000; started = performance.now()
    gap.onState(f.state)
    await vi.advanceTimersByTimeAsync(800)
    expect(trackGap.active).toBe(true)
    gap.onState({ ...f.state, paused: true, position: 30000 })
    expect(trackGap.active).toBe(false)
    expect(f.volumes.at(-1)).toBe(1)
  })
})
