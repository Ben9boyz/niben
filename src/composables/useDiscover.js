import { reactive } from 'vue'
import { api } from './useAdmin'

// "Oppdag": my picks (albums / songs I recommend) and suggestions for good albums I don't have yet.
export const discover = reactive({ loaded: false, picks: [], recs: [], at: 0, hasKey: false, busy: '', error: '' })

export async function loadDiscover() {
  try {
    const r = await fetch('api.php?action=discover_get', { cache: 'no-cache' })
    const j = await r.json()
    if (!j.error) { discover.picks = j.picks || []; discover.recs = j.recs || []; discover.at = j.at || 0; discover.hasKey = !!j.hasKey }
  } catch {}
  discover.loaded = true
}
async function run(what, fn) {
  discover.busy = what
  discover.error = ''
  try { return await fn() } catch (e) { discover.error = e.message; return null } finally { discover.busy = '' }
}
export const addPick = (url, note) => run('add', async () => {
  const r = await api('discover_add', { url, note })
  discover.picks = [r.pick, ...discover.picks.filter((p) => p.uri !== r.pick.uri)]
  return r.pick
})
export const delPick = (uri) => run('del', async () => { await api('discover_del', { uri }); discover.picks = discover.picks.filter((p) => p.uri !== uri) })
/** Hide a suggestion for good (admin). */
export const hideRec = (uri) => run('hide', async () => { await api('discover_hide', { uri }); discover.recs = discover.recs.filter((p) => p.uri !== uri) })
export const saveKey = (key) => run('key', async () => { const r = await api('discover_key', { key }); discover.hasKey = r.hasKey })
export const refreshRecs = () => run('refresh', async () => { const r = await api('discover_refresh', {}); discover.recs = r.recs || []; discover.at = r.at || 0 })
