import { computed } from 'vue'
import { spotify } from './useSpotify'
import { sorted } from './useSort'
import { room } from './useRoom'
import { groups, topGroups, childrenOf, countIn, groupCover } from './useGroups'

// The iPod's list of playlists – and the panel next to it, which mirrors it. With grouping on it follows my folders:
// the top shows the folders, a folder shows its playlists (and folders inside it). Searching lists every match.
// Same order as the panel's grid (the chosen sort), so the highlighted row is the same tile in both.
const tile = (p) => ({ kind: 'playlist', label: p.name, sub: p.count ? `${p.count} låter` : p.owner, item: p, img: p.thumb || p.image })

export const ipodRows = computed(() => {
  const f = room.ipod.q.trim().toLowerCase()
  const lists = sorted('playlist', spotify.playlists)
  if (f) return lists.filter((p) => p.name.toLowerCase().includes(f)).map(tile)
  if (!groups.on || !groups.loaded || !groups.list.length) return lists.map(tile)
  const uris = lists.map((p) => p.uri)
  const folder = (g) => ({ kind: 'folder', id: g.id, label: g.name, sub: `${countIn(g.id, uris)} lister`, img: groupCover(g.id) })
  const sel = groups.sel
  if (!sel) {
    const out = topGroups().filter((g) => countIn(g.id, uris) > 0).map(folder)
    const loose = lists.filter((p) => !groups.list.some((g) => g.id === groups.assign[p.uri]))
    if (loose.length) out.push({ kind: 'folder', id: '_', label: 'Uten gruppe', sub: `${loose.length} lister` })
    return out
  }
  if (sel === '_') return lists.filter((p) => !groups.list.some((g) => g.id === groups.assign[p.uri])).map(tile)
  return [
    ...childrenOf(sel).filter((g) => countIn(g.id, uris) > 0).map(folder),
    ...lists.filter((p) => groups.assign[p.uri] === sel).map(tile),
  ]
})
/** The folder I'm in, for the title (null at the top). */
export const ipodFolderName = computed(() => (groups.sel === '_' ? 'Uten gruppe' : groups.list.find((g) => g.id === groups.sel)?.name || null))
