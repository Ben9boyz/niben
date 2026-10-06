import { computed, reactive } from 'vue'
import { api, errorMessage } from '@/composables/site/useAdmin'
import { decor, type DecorItem } from './useDecor'
import { kindOf, type ModuleKind } from '@/lib/modules/catalog'

// The hobby modules of the room on screen: the placed pieces (decor items with a `mod`) and what is written in each of them.
export type Entry = Record<string, string | number | boolean>
export interface ModData { items: Entry[]; settings: Record<string, string> }
export interface PlacedModule { id: string; kind: ModuleKind; name: string; icon: string; item: DecorItem }

export const placed = computed<PlacedModule[]>(() => decor.items.flatMap((i) => { const kind = kindOf(i.mod); return kind ? [{ id: i.id, kind, name: i.name || kind.name, icon: i.ico || kind.icon, item: i }] : [] }))
export const moduleById = (id: string): PlacedModule | undefined => placed.value.find((m) => m.id === id)

const store = reactive<{ data: Record<string, ModData>; loading: Record<string, boolean>; error: string; saving: boolean }>({ data: {}, loading: {}, error: '', saving: false })
export const modState = store
export const dataOf = (id: string): ModData | undefined => store.data[id]

export async function loadModule(id: string, force = false): Promise<void> {
  if ((store.data[id] && !force) || store.loading[id]) return
  store.loading[id] = true
  try {
    const r = await fetch(`api.php?action=mod_get&id=${encodeURIComponent(id)}`, { cache: 'no-cache' })
    const j = (await r.json()) as { data?: { items?: Entry[]; settings?: Record<string, string> | unknown[] }; error?: string }
    if (j.error) throw new Error(j.error)
    const s = j.data?.settings
    store.data[id] = { items: j.data?.items ?? [], settings: s && !Array.isArray(s) ? (s as Record<string, string>) : {} }
  } catch (e) { store.error = errorMessage(e) } finally { store.loading[id] = false }
}

const timers = new Map<string, number>()
/** Something in a module changed: save it in a moment (several changes in a row go as one). */
export function touch(id: string): void {
  clearTimeout(timers.get(id))
  store.saving = true
  timers.set(id, window.setTimeout(() => { void saveNow(id) }, 500))
}
async function saveNow(id: string): Promise<void> {
  const d = store.data[id]
  if (!d) return
  try {
    const r = await api<{ data: ModData }>('mod_save', { id, data: { items: d.items, settings: d.settings } })
    void r
    store.error = ''
  } catch (e) { store.error = errorMessage(e) } finally { store.saving = false }
}

export async function addModule(type: string, name = ''): Promise<DecorItem | null> {
  try {
    const r = await api<{ item: DecorItem }>('mod_add', { type, name })
    decor.items = [...decor.items, r.item]
    store.data[r.item.id] = { items: [], settings: {} }
    return r.item
  } catch (e) { store.error = errorMessage(e); return null }
}
export async function removeModule(id: string): Promise<void> {
  try { await api('mod_remove', { id }); decor.items = decor.items.filter((i) => i.id !== id); delete store.data[id] } catch (e) { store.error = errorMessage(e) }
}

/** Another room: its own modules. */
export function resetModules(): void { store.data = {}; store.loading = {}; store.error = ''; store.saving = false }

/** My own 3D model (.glb) for a module – it stands in the room instead of the built-in one. */
export async function setModuleModel(id: string, file: File | null): Promise<void> {
  try {
    if (file) {
      const fd = new FormData()
      fd.append('id', id)
      fd.append('file', file)
      const r = await api<{ item: DecorItem }>('mod_model', fd)
      decor.items = decor.items.map((i) => (i.id === id ? { ...i, file: r.item.file } : i))
    } else {
      await api('mod_model_clear', { id })
      decor.items = decor.items.map((i) => (i.id === id ? { ...i, file: '' } : i))
    }
    store.error = ''
  } catch (e) { store.error = errorMessage(e) }
}
