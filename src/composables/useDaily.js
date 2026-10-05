import { computed } from 'vue'
import { shelfAlbums } from './useGroups'

// "Dagens plate": one record from my library, the same all day for everybody. It sticks out of the shelf in the 3D
// room and has a card on the home page. (Picked from the date, so no server is needed.)
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
export const dailyAlbum = computed(() => {
  const list = shelfAlbums.value
  if (!list.length) return null
  return list[hash(dayKey()) % list.length]
})
