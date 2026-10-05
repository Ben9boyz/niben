import { reactive } from 'vue'

// Milestones (a new recording, a finished book, an anime I can follow, a song I've learned) – from the server.
export interface Milestone {
  id?: string
  kind: string
  title: string
  sub?: string
  image?: string | null
  t: number
  [key: string]: unknown
}
export const milestones = reactive<{ items: Milestone[]; loaded: boolean }>({ items: [], loaded: false })
let loading: Promise<void> | null = null
export function loadMilestones(force = false): Promise<void> {
  if (loading && !force) return loading
  loading = fetch('api.php?action=milestones', { cache: 'no-store' })
    .then((r) => r.json() as Promise<{ items?: Milestone[] }>)
    .then((j) => { milestones.items = j.items ?? [] })
    .catch(() => {})
    .finally(() => { milestones.loaded = true })
  return loading
}
export const setMilestones = (items: Milestone[] | null | undefined): void => { milestones.items = items ?? [] }
