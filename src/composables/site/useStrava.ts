import { reactive } from 'vue'
import { api, errorMessage } from '@/composables/site/useAdmin'

// Strava for the room on screen: is it set up on the site, is this room's account connected – and fetching new workouts.
export const strava = reactive({ checked: false, configured: false, connected: false, athlete: null as string | null, busy: false, error: '', note: '' })

export async function loadStrava(force = false): Promise<void> {
  if (strava.checked && !force) return
  try {
    const r = await api<{ configured: boolean; connected: boolean; athlete: string | null }>('strava_status')
    Object.assign(strava, { configured: r.configured, connected: r.connected, athlete: r.athlete, checked: true })
  } catch { strava.checked = true }
}
export function resetStrava(): void { Object.assign(strava, { checked: false, configured: false, connected: false, athlete: null, busy: false, error: '', note: '' }) }

/** New activities into a Trening module; returns its content as the server now has it. */
export async function syncStrava<T>(id: string): Promise<T | null> {
  strava.busy = true
  strava.error = ''
  try {
    const r = await api<{ added: number; data: T }>('strava_sync', { id })
    strava.note = r.added ? `${r.added} nye økter fra Strava.` : 'Ingen nye økter på Strava.'
    return r.data
  } catch (e) { strava.error = errorMessage(e); return null } finally { strava.busy = false }
}
export async function disconnectStrava(): Promise<void> {
  try { await api('strava_disconnect', {}); strava.connected = false; strava.athlete = null } catch (e) { strava.error = errorMessage(e) }
}
