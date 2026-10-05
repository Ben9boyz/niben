import { reactive } from 'vue'

// Milestones (a new recording, a finished book, an anime I can follow, a song I've learned) – from the server.
export const milestones = reactive({ items: [], loaded: false })
let loading = null
export function loadMilestones(force = false) {
  if (loading && !force) return loading
  loading = fetch('api.php?action=milestones', { cache: 'no-store' })
    .then((r) => r.json())
    .then((j) => { milestones.items = j.items || [] })
    .catch(() => {})
    .finally(() => { milestones.loaded = true })
  return loading
}
export const setMilestones = (items) => { milestones.items = items || [] }
