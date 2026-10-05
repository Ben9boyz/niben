<script setup>
import { ref, watch, computed } from 'vue'
import { Heart } from 'lucide-vue-next'
import { spotify, isLiked, setLiked, notify, isSaved, toggleAlbumSaved, findAlbum } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'

// The heart (admin) next to the lock. What it saves depends on what I'm listening to:
//  · an album  → the ALBUM goes into (or out of) my library
//  · a playlist → no heart (the + beside it adds the song to a playlist instead)
//  · a single song → the song goes into Liked Songs
const now = computed(() => spotify.now)
const ctx = computed(() => String(now.value?.context || ''))
const kind = computed(() => (ctx.value.startsWith('spotify:album:') ? 'album' : ctx.value.startsWith('spotify:playlist:') ? 'playlist' : 'track'))
const album = computed(() => findAlbum(ctx.value) || { uri: ctx.value, name: now.value?.album || 'Albumet', artist: now.value?.artist, image: now.value?.image, image_large: now.value?.image_large, url: null })
const trackLiked = ref(false)
watch(() => [now.value?.uri, kind.value], async () => { trackLiked.value = kind.value === 'track' && now.value?.uri?.startsWith('spotify:track:') && admin.loggedIn ? await isLiked(now.value.uri) : false }, { immediate: true })
const on = computed(() => (kind.value === 'album' ? isSaved(ctx.value) : trackLiked.value))
async function like() {
  if (kind.value === 'album') { await toggleAlbumSaved(album.value); return }
  if (!now.value?.uri) return
  trackLiked.value = !trackLiked.value
  const r = await setLiked(now.value.uri, trackLiked.value)
  if (!r.ok) { trackLiked.value = !trackLiked.value; notify(r.error || 'Klarte ikke å lagre låta.', true) }
}
const title = computed(() => (kind.value === 'album' ? (on.value ? 'Fjern albumet fra biblioteket' : 'Lagre albumet i biblioteket') : on.value ? 'Fjern fra Likte sanger' : 'Lagre i Likte sanger'))
</script>

<template>
  <button v-if="admin.loggedIn && spotify.connected && now?.uri && kind !== 'playlist'" class="heart" :class="{ liked: on }" :title="title" :aria-label="title" @click.stop="like">
    <Heart :size="14" :fill="on ? 'currentColor' : 'none'" />
  </button>
</template>

<style scoped>
.heart { display: inline-grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass); color: var(--text-3); cursor: pointer; transition: color 0.15s, border-color 0.15s; }
.heart:hover { color: #1db954; border-color: #1db954; }
.heart.liked { color: #1db954; border-color: #1db954; }
</style>
