import { reactive } from 'vue'
import { api } from './useAdmin'

// My own 3D models in the room (uploaded as .glb in Admin → Rom, moved around in "Rediger rommet").
export const decor = reactive({ items: [], loaded: false, editing: false, selected: null, busy: '', error: '', saved: true })

export async function loadDecor() {
  try {
    const r = await fetch('api.php?action=decor_get', { cache: 'no-cache' })
    const j = await r.json()
    if (!j.error) decor.items = j.items || []
  } catch {}
  decor.loaded = true
}

let timer = 0
/** The room (or the admin list) changed something: remember it and save in a moment. */
export function changed(items) {
  if (items) decor.items = items
  decor.saved = false
  clearTimeout(timer)
  timer = setTimeout(saveNow, 700)
}
export async function saveNow() {
  clearTimeout(timer)
  try { await api('decor_save', { items: decor.items }); decor.saved = true; decor.error = '' } catch (e) { decor.error = e.message }
}
export async function uploadDecor(file, name) {
  decor.busy = 'upload'
  decor.error = ''
  try {
    const fd = new FormData()
    fd.append('file', file)
    if (name) fd.append('name', name)
    const r = await api('decor_upload', fd)
    decor.items = [...decor.items, r.item]
    return r.item
  } catch (e) { decor.error = e.message; return null } finally { decor.busy = '' }
}
export async function removeDecor(id) {
  decor.busy = 'del'
  try { await api('decor_delete', { id }); decor.items = decor.items.filter((i) => i.id !== id); if (decor.selected === id) decor.selected = null } catch (e) { decor.error = e.message } finally { decor.busy = '' }
}
