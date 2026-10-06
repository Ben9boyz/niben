<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { CirclePlus } from 'lucide-vue-next'
import AddMenu from './AddMenu.vue'
import { spotify, enqueue, addToPlaylist, notify } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'
import { targetEl } from '../lib/dom'
import type { Playlist } from '../types'

// The + on the song that's playing now (admin): put it in the queue or in one of my playlists.
const now = computed(() => spotify.now)
const open = ref(false)
const root = ref<HTMLElement | null>(null)
async function pick(p: Playlist) {
  open.value = false
  const uri = now.value?.uri
  if (!uri) return
  const r = await addToPlaylist(p.uri, uri)
  notify(r.ok ? `«${now.value?.name}» er lagt til i «${p.name}».` : r.error ?? '', !r.ok)
}
function queue() { open.value = false; const uri = now.value?.uri; if (uri) void enqueue(uri) }
const onDoc = (e: Event) => { if (open.value && !root.value?.contains(targetEl(e))) open.value = false }
onMounted(() => document.addEventListener('pointerdown', onDoc))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDoc))
</script>

<template>
  <span v-if="admin.mine && spotify.connected && now?.uri?.startsWith('spotify:track:')" ref="root" class="na">
    <button class="plus" :class="{ on: open }" title="Legg til i kø eller spilleliste" aria-label="Legg til i kø eller spilleliste" @click.stop="open = !open"><CirclePlus :size="15" /></button>
    <div v-if="open" class="pop"><AddMenu @queue="queue" @pick="pick" @close="open = false" /></div>
  </span>
</template>

<style scoped>
.plus { display: inline-grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass); color: var(--text-3); cursor: pointer; transition: color 0.15s, border-color 0.15s; }
.plus:hover, .plus.on { color: var(--accent); border-color: var(--accent); }
/* opens right under the title line of the card (.top is the positioned parent) */
.pop { position: absolute; z-index: 40; left: 0; right: 0; top: calc(100% + 4px); min-width: 250px; filter: drop-shadow(0 14px 30px rgba(0, 0, 0, 0.25)); }
.pop :deep(.am) { background: var(--bg); }
</style>
