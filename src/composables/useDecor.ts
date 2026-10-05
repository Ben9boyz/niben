import { reactive } from 'vue'
import { api, errorMessage } from './useAdmin'

// My own 3D models in the room (uploaded as .glb in Admin → Rom, moved around in "Rediger rommet").
export interface DecorItem {
  id: string
  file: string
  name: string
  x: number
  y: number
  z: number
  rot: number
  scale: number
  visible: boolean
}
export const decor = reactive({
  items: [] as DecorItem[],
  loaded: false,
  editing: false,
  selected: null as string | null,
  busy: '',
  error: '',
  saved: true,
})

export async function loadDecor(): Promise<void> {
  try {
    const r = await fetch('api.php?action=decor_get', { cache: 'no-cache' })
    const j = (await r.json()) as { items?: DecorItem[]; error?: string }
    if (!j.error) decor.items = j.items ?? []
  } catch { /* offline */ }
  decor.loaded = true
}

let timer = 0
/** The room (or the admin list) changed something: remember it and save in a moment. */
export function changed(items?: DecorItem[]): void {
  if (items) decor.items = items
  decor.saved = false
  clearTimeout(timer)
  timer = window.setTimeout(() => { void saveNow() }, 700)
}
async function saveNow(): Promise<void> {
  clearTimeout(timer)
  try { await api('decor_save', { items: decor.items }); decor.saved = true; decor.error = '' } catch (e) { decor.error = errorMessage(e) }
}
export async function uploadDecor(file: File, name?: string): Promise<DecorItem | null> {
  decor.busy = 'upload'
  decor.error = ''
  try {
    const fd = new FormData()
    fd.append('file', file)
    if (name) fd.append('name', name)
    const r = await api<{ item: DecorItem }>('decor_upload', fd)
    decor.items = [...decor.items, r.item]
    return r.item
  } catch (e) { decor.error = errorMessage(e); return null } finally { decor.busy = '' }
}
export async function removeDecor(id: string): Promise<void> {
  decor.busy = 'del'
  try { await api('decor_delete', { id }); decor.items = decor.items.filter((i) => i.id !== id); if (decor.selected === id) decor.selected = null } catch (e) { decor.error = errorMessage(e) } finally { decor.busy = '' }
}
