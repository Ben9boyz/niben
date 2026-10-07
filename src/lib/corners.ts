import type { SectionId } from '@/composables/site/useData'

// The room's own corners – built in, but otherwise like a hobby: a name and a symbol of their own, hidden or shown, moved around.
export interface Corner { id: string; section: SectionId; name: string; blurb: string; icon: string /* lib/icons.ts */; route: string }
export const CORNERS: Corner[] = [
  { id: 'lytte', section: 'lytte', name: 'Lytteplassen', blurb: 'Platespilleren, hylla og musikken (Spotify)', icon: 'Disc3', route: 'lytte' },
  { id: 'japansk', section: 'japansk', name: 'Japansk', blurb: 'Ord, repetisjon og anime (jpdb)', icon: 'Languages', route: 'japansk' },
  { id: 'gitar', section: 'gitar', name: 'Gitarer', blurb: 'Gitarveggen, opptak og sanger', icon: 'Guitar', route: 'gitar' },
  { id: 'figurer', section: 'gitar', name: 'Figurer', blurb: 'Figurhylla', icon: 'Sparkles', route: 'figurer' },
  { id: 'ovelse', section: 'ovelse', name: 'Gitar-øving', blurb: 'Timer, akkorder, stemmer og metronom', icon: 'Timer', route: 'ovelse' },
  { id: 'reiser', section: 'reiser', name: 'Reiser', blurb: 'Globusen og reisene dine', icon: 'Globe', route: 'reiser' },
  { id: 'boker', section: 'boker', name: 'Bøker', blurb: 'Bokhylla', icon: 'BookOpen', route: 'boker' },
  { id: 'kode', section: 'kode', name: 'Skrivebordet', blurb: 'Prosjekter (GitHub) og spill (Steam)', icon: 'Code2', route: 'kode' },
  { id: 'om', section: 'om', name: 'Om meg', blurb: 'Bildet, teksten og svarene dine', icon: 'User', route: 'om' },
]
export const cornerName = (id: string): string => CORNERS.find((c) => c.id === id)?.name ?? id
/** The corner a page belongs to (Spill sits at the desk with Prosjekter). */
export const CORNER_OF_ROUTE: Record<string, string> = { lytte: 'lytte', japansk: 'japansk', gitar: 'gitar', figurer: 'figurer', ovelse: 'ovelse', reiser: 'reiser', boker: 'boker', kode: 'kode', om: 'om' }
