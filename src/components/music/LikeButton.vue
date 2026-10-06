<script setup lang="ts">
import { computed } from 'vue'
import { Bookmark } from 'lucide-vue-next'
import { spotify, isSaved, toggleAlbumSaved, findAlbum } from '@/composables/useSpotify'
import { admin } from '@/composables/useAdmin'

// Save the ALBUM that plays to / from my library (admin). Only while an album plays: in playlist / song mode there is
// no button (the + beside it adds the song to a playlist instead).
const now = computed(() => spotify.now)
const ctx = computed(() => String(now.value?.context || ''))
const isAlbum = computed(() => ctx.value.startsWith('spotify:album:'))
const album = computed(() => findAlbum(ctx.value) || { uri: ctx.value, name: now.value?.album || 'Albumet', artist: now.value?.artist, image: now.value?.image, image_large: now.value?.image_large, url: null })
const on = computed(() => isSaved(ctx.value))
const title = computed(() => (on.value ? 'Fjern albumet fra biblioteket' : 'Lagre albumet i biblioteket'))
const save = () => toggleAlbumSaved({ ...album.value, artist: album.value.artist ?? '' })
</script>

<template>
  <button v-if="admin.mine && spotify.connected && now?.uri && isAlbum" class="heart" :class="{ liked: on }" :title="title" :aria-label="title" @click.stop="save">
    <Bookmark :size="14" :fill="on ? 'currentColor' : 'none'" />
  </button>
</template>

<style scoped>
.heart { display: inline-grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass); color: var(--text-3); cursor: pointer; transition: color 0.15s, border-color 0.15s; }
.heart:hover { color: #1db954; border-color: #1db954; }
.heart.liked { color: #1db954; border-color: #1db954; }
</style>
