import { reactive } from 'vue'

// "Ny spilleliste": one dialog (name + an optional picture) for every place that can make a playlist – the buttons, the
// right-click menus, "add to a new playlist". Whoever asks gets a promise: { uri, name } when it was made, otherwise null.
export const plDialog = reactive({ open: false })
let resolver = null

export function askNewPlaylist() {
  resolver?.(null)
  plDialog.open = true
  return new Promise((resolve) => { resolver = resolve })
}
export function finishPlaylistDialog(result = null) {
  plDialog.open = false
  resolver?.(result)
  resolver = null
}
