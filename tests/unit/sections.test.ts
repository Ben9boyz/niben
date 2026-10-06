import { describe, it, expect } from 'vitest'
import { routeAllowed } from '../../src/lib/sections'
import type { RoomProfile, SectionId } from '@/composables/site/useData'

const ALL: SectionId[] = ['reiser', 'boker', 'gitar', 'ovelse', 'japansk', 'lytte', 'gaming', 'kode', 'om']
const profile = (off: SectionId[] = [], owner = false): RoomProfile => ({
  username: 'x', owner, mine: false,
  sections: Object.fromEntries(ALL.map((s) => [s, !off.includes(s)])) as Record<SectionId, boolean>,
})

describe('routeAllowed', () => {
  it('lets every page through when every corner is on', () => {
    for (const s of ALL) expect(routeAllowed(s, profile())).toBe(true)
  })

  it('hides a corner that is switched off – and only that one', () => {
    const p = profile(['japansk'])
    expect(routeAllowed('japansk', p)).toBe(false)
    expect(routeAllowed('boker', p)).toBe(true)
  })

  it('never hides the pages that belong to no corner (home, admin, Året)', () => {
    const p = profile(ALL)
    for (const name of ['home', 'admin', 'aaret', undefined, null]) expect(routeAllowed(name, p)).toBe(true)
  })
})
