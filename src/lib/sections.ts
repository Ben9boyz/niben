import type { RoomProfile, SectionId } from '@/composables/site/useData'

// Which corner of the room a page belongs to – a user can switch corners off (Admin → Innstillinger), and then the page,
// its menu entry and its place in the 3D room are gone. (a page not listed here – home, admin, Året – is for every room).
export const ROUTE_SECTION: Record<string, SectionId> = {
  reiser: 'reiser', boker: 'boker', gitar: 'gitar', figurer: 'gitar', ovelse: 'ovelse', japansk: 'japansk', lytte: 'lytte', gaming: 'gaming', kode: 'kode', om: 'om',
}

export function routeAllowed(name: unknown, profile: RoomProfile): boolean {
  const s = ROUTE_SECTION[String(name)]
  if (!s) return true // home, admin …
  return profile.sections[s] !== false
}
