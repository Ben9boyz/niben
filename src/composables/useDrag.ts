import { reactive, ref } from 'vue'
import type { Track } from '../types'
import { enqueue, enqueueAlbum, notify, findAlbum, spotify } from './useSpotify'

// What is being dragged right now (drag & drop on the PC): a song (to a playlist / the queue) or an album /
// playlist tile (to a folder). Shared so the drop targets – the tray, the folders, the folder tree – can see it.
export interface DraggedTrack { uri: string; name: string; t: Track }
export const drag = reactive<{ track: DraggedTrack | null; item: string | null }>({ track: null, item: null }) // track: the song · item: uri

export function startTrackDrag(e: DragEvent, t: Track): void {
  drag.track = { uri: t.uri, name: t.name, t }
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', t.uri) }
}
export function startItemDrag(e: DragEvent, uri: string): void {
  drag.item = uri
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'copyMove'; e.dataTransfer.setData('text/plain', uri) }
}
export function endDrag(): void {
  drag.track = null
  drag.item = null
}

// ── dropping on the queue (the "Neste i køen" box / the now-playing card): a song, or a whole album / playlist ──
export const queueOver = ref(false)
const canDropOnQueue = (): boolean => !!(drag.track || (drag.item && /^spotify:(album|playlist):/.test(drag.item)))
export const queueDrop = {
  dragover(e: DragEvent): void { if (!canDropOnQueue()) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; queueOver.value = true },
  dragleave(e: DragEvent): void { if (!(e.currentTarget instanceof Node) || !(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) queueOver.value = false },
  async drop(e: DragEvent): Promise<void> {
    e.preventDefault()
    queueOver.value = false
    const t = drag.track, it = drag.item
    endDrag()
    if (t) { const r = await enqueue(t.t); if (!r.ok) notify(r.error || 'Klarte ikke å legge i køen.', true); return }
    if (it) {
      const name = (findAlbum(it) ?? spotify.playlists.find((p) => p.uri === it))?.name ?? ''
      void enqueueAlbum(it, name)
    }
  },
}
