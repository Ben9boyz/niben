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
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', uri) }
}
export function endDrag() {
  drag.track = null
  drag.item = null
}
