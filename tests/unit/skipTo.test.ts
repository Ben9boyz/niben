import { describe, it, expect, vi, afterEach } from 'vitest'
import { skipTo, playDevice, SKIP_MAX } from '../../src/composables/music/useSpotify'
import { admin } from '../../src/composables/site/useAdmin'

// Spotify cannot jump to a place in the queue: "next" is pressed once for every song in between, quietly.
describe('hopping to a song in the queue', () => {
  afterEach(() => { vi.useRealTimers(); playDevice.control = null; playDevice.mute = null; admin.mine = false })

  it('presses next once per step, with the volume down while hopping over more than one song', async () => {
    vi.useFakeTimers()
    admin.mine = true
    const ops: string[] = []
    const vol: boolean[] = []
    playDevice.control = async (op) => { ops.push(op); return true }
    playDevice.mute = (on) => { vol.push(on) }
    const p = skipTo(3)
    await vi.runAllTimersAsync()
    expect((await p).ok).toBe(true)
    expect(ops).toEqual(['next', 'next', 'next'])
    expect(vol).toEqual([true, false])
  })

  it('a single step is just "next" (no muting), and only the owner can do it', async () => {
    vi.useFakeTimers()
    const ops: string[] = []
    const vol: boolean[] = []
    playDevice.control = async (op) => { ops.push(op); return true }
    playDevice.mute = (on) => { vol.push(on) }
    expect((await skipTo(1)).ok).toBe(false) // not logged in as the owner of the room
    admin.mine = true
    const p = skipTo(1)
    await vi.runAllTimersAsync()
    expect((await p).ok).toBe(true)
    expect(ops).toEqual(['next'])
    expect(vol).toEqual([])
  })

  it('refuses a hop that is too long for Spotify\'s speed limit', async () => {
    admin.mine = true
    playDevice.control = async () => true
    const r = await skipTo(SKIP_MAX + 1)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/For langt/)
  })
})
