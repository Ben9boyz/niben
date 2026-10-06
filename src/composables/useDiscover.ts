import { reactive } from 'vue'
import type { Album, Track } from '../types'
import { api, errorMessage } from './useAdmin'

// "Oppdag": my picks (albums / songs I recommend) and suggestions for good albums I don't have yet.
export interface Pick extends Partial<Album>, Partial<Track> {
  uri: string
  name: string
  note?: string
  kind?: string
  why?: string
}
interface DiscoverReply { picks?: Pick[]; recs?: Pick[]; at?: number; hasKey?: boolean; error?: string }

export const discover = reactive({
  loaded: false,
  picks: [] as Pick[],
  recs: [] as Pick[],
  at: 0,
  hasKey: false,
  busy: '',
  error: '',
})

export async function loadDiscover(): Promise<void> {
  try {
    const r = await fetch('api.php?action=discover_get', { cache: 'no-cache' })
    const j = (await r.json()) as DiscoverReply
    if (!j.error) { discover.picks = j.picks ?? []; discover.recs = j.recs ?? []; discover.at = j.at ?? 0; discover.hasKey = !!j.hasKey }
  } catch { /* offline */ }
  discover.loaded = true
}
async function run<T>(what: string, fn: () => Promise<T>): Promise<T | null> {
  discover.busy = what
  discover.error = ''
  try { return await fn() } catch (e) { discover.error = errorMessage(e); return null } finally { discover.busy = '' }
}
export const addPick = (url: string, note: string) => run('add', async () => {
  const r = await api<{ pick: Pick }>('discover_add', { url, note })
  discover.picks = [r.pick, ...discover.picks.filter((p) => p.uri !== r.pick.uri)]
  return r.pick
})
export const delPick = (uri: string) => run('del', async () => { await api('discover_del', { uri }); discover.picks = discover.picks.filter((p) => p.uri !== uri) })
/** Hide a suggestion for good (admin). */
export const hideRec = (uri: string) => run('hide', async () => { await api('discover_hide', { uri }); discover.recs = discover.recs.filter((p) => p.uri !== uri) })
export const saveKey = (key: string) => run('key', async () => { const r = await api<{ hasKey: boolean }>('discover_key', { key }); discover.hasKey = r.hasKey })
export const refreshRecs = () => run('refresh', async () => { const r = await api<{ recs?: Pick[]; at?: number }>('discover_refresh', {}); discover.recs = r.recs ?? []; discover.at = r.at ?? 0 })

/** Another room: its own picks and suggestions. */
export function resetDiscover(): void {
  Object.assign(discover, { loaded: false, picks: [], recs: [], at: 0, hasKey: false, busy: '', error: '' })
}
