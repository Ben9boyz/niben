import { reactive } from 'vue'

// What is being dragged right now (drag & drop on the PC): a song (to a playlist / the queue) or an album /
// playlist tile (to a folder). Shared so the drop targets – the tray, the folders, the folder tree – can see it.
export const drag = reactive({ track: null, item: null }) // track: { uri, name } · item: uri

export function startTrackDrag(e, t) {
  drag.track = { uri: t.uri, name: t.name }
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', t.uri) }
}
export function startItemDrag(e, uri) {
  drag.item = uri
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'copyMove'; e.dataTransfer.setData('text/plain', uri) }
}
export function endDrag() {
  drag.track = null
  drag.item = null
}

// ── dropping on the queue (the "Neste i køen" box / the now-playing card): a song, or a whole album / playlist ──
import { ref } from 'vue'
import { enqueue, enqueueAlbum, notify, findAlbum, spotify } from './useSpotify'
export const queueOver = ref(false)
export const canDropOnQueue = () => !!(drag.track || (drag.item && /^spotify:(album|playlist):/.test(drag.item)))
export const queueDrop = {
  dragover(e) { if (!canDropOnQueue()) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; queueOver.value = true },
  dragleave(e) { if (!e.currentTarget.contains(e.relatedTarget)) queueOver.value = false },
  async drop(e) {
    e.preventDefault()
    queueOver.value = false
    const t = drag.track, it = drag.item
    endDrag()
    if (t) { await enqueue(t.uri); return }
    if (it) {
      const name = (findAlbum(it) || spotify.playlists.find((p) => p.uri === it))?.name || ''
      enqueueAlbum(it, name)
    }
  },
}
