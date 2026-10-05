import { reactive } from 'vue'

// "Ny spilleliste": one dialog (name + an optional picture) for every place that can make a playlist – the buttons, the
// right-click menus, "add to a new playlist". Whoever asks gets a promise: { uri, name } when it was made, otherwise null.
export interface NewPlaylist { uri: string; name: string }
export const plDialog = reactive({ open: false })
let resolver: ((result: NewPlaylist | null) => void) | null = null

export function askNewPlaylist(): Promise<NewPlaylist | null> {
  resolver?.(null)
  plDialog.open = true
  return new Promise<NewPlaylist | null>((resolve) => { resolver = resolve })
}
export function finishPlaylistDialog(result: NewPlaylist | null = null): void {
  plDialog.open = false
  resolver?.(result)
  resolver = null
}
