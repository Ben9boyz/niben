import { describe, it, expect, beforeEach } from 'vitest'
import { groups, resetGroups, setGrouping, setView } from '@/composables/music/useGroups'
import { spotify, resetSpotify } from '@/composables/music/useSpotify'
import { milestones, resetMilestones, setMilestones } from '@/composables/site/useMilestones'
import { myQueue, resetQueue } from '@/composables/music/useQueue'
import { discover, resetDiscover } from '@/composables/music/useDiscover'
import { jp, resetJapanese } from '@/composables/japan/useJapanese'
import { steam, resetSteam } from '@/composables/site/useSteam'

// Switching rooms does not reload the page, so every store that holds something of a room has to be emptied and read
// again from what this browser kept for the NEW room. That is what these check.
const inRoom = (id: number): void => { document.cookie = `niben_r=${id}` }

describe('the browser stores belong to a room', () => {
  beforeEach(() => { localStorage.clear(); inRoom(1) })

  it('keeps the grouping settings per room', () => {
    resetGroups()
    setGrouping(false)
    setView('lister')
    expect(groups.on).toBe(false)
    expect(groups.view).toBe('lister')

    inRoom(2)
    resetGroups()
    expect(groups.on).toBe(true) // room 2 never switched it off
    expect(groups.view).toBe('artist')

    inRoom(1)
    resetGroups()
    expect(groups.on).toBe(false) // …and room 1 still has what it chose
    expect(groups.view).toBe('lister')
  })

  it('forgets the library, what plays and the lock when the room changes', () => {
    Object.assign(spotify, { connected: true, loaded: true, lockUntil: 999, albums: [{ uri: 'spotify:album:a', name: 'A', artist: 'x' }], now: { name: 'Song', playing: true } })
    inRoom(2)
    resetSpotify()
    expect(spotify.connected).toBe(false)
    expect(spotify.loaded).toBe(false)
    expect(spotify.albums).toEqual([])
    expect(spotify.now).toBeNull()
    expect(spotify.lockUntil).toBe(0)
  })

  it('starts from the lists saved for the new room, not the old one', () => {
    localStorage.setItem('niben-spotify-lists-v2:r2', JSON.stringify({ at: Date.now(), sig: 's', room: '2', albums: [{ uri: 'spotify:album:two', name: 'Two' }], playlists: [] }))
    inRoom(1)
    resetSpotify()
    expect(spotify.albums).toEqual([]) // room 1 has nothing saved
    inRoom(2)
    resetSpotify()
    expect(spotify.albums.map((a) => a.name)).toEqual(['Two'])
  })

  it('empties milestones, queue, picks, words and Steam', () => {
    setMilestones([{ key: 'k', type: 'song', title: 'x', sub: '', t: 1 }])
    myQueue.items = [{ uri: 'u', name: 'n', artist: '', img: '', ms: 1, album_uri: null, album: '', album_image: '', no: null, disc: null }]
    discover.picks = [{ uri: 'u', name: 'n' }]
    jp.count = { due: 1, learning: 2, known: 3, new: 4 }
    steam.configured = true
    resetMilestones(); resetQueue(); resetDiscover(); resetJapanese(); resetSteam()
    expect(milestones.items).toEqual([])
    expect(myQueue.items).toEqual([])
    expect(discover.picks).toEqual([])
    expect(jp.count.known).toBe(0)
    expect(steam.configured).toBe(false)
  })
})
