// A small cache that lives in this browser (IndexedDB), so what was fetched once isn't fetched again:
// track lists, tempo, artist pages, groups. Each entry has its own shelf life. Everything is also kept in memory,
// and nothing here ever throws – if IndexedDB isn't there (private window …) it simply remembers nothing.
const DB = 'niben-cache'
const STORE = 'kv'
let dbp = null
const mem = new Map()

function open() {
  dbp ||= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
  return dbp
}
const run = async (mode, fn) => {
  const db = await open()
  if (!db) return undefined
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode)
      const r = fn(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(r?.result)
      tx.onerror = tx.onabort = () => resolve(undefined)
    } catch { resolve(undefined) }
  })
}

/** The saved value, or undefined when there is none or it is older than `maxAgeMs`. */
export async function pget(key, maxAgeMs = Infinity) {
  let e = mem.get(key)
  if (!e) {
    e = await run('readonly', (s) => s.get(key))
    if (e) mem.set(key, e)
  }
  return e && Date.now() - e.t < maxAgeMs ? e.v : undefined
}
export async function pset(key, v) {
  const e = { t: Date.now(), v }
  mem.set(key, e)
  await run('readwrite', (s) => s.put(e, key))
}
export async function pdel(key) {
  mem.delete(key)
  await run('readwrite', (s) => s.delete(key))
}
