<script setup>
import { ref, watch, computed } from 'vue'
import { Heart } from 'lucide-vue-next'
import { spotify, isLiked, setLiked, notify } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'

// The heart (admin): saves the song that's playing in Spotify's Liked Songs. Sits next to the lock.
const now = computed(() => spotify.now)
const liked = ref(false)
watch(() => now.value?.uri, async (uri) => { liked.value = uri?.startsWith('spotify:track:') && admin.loggedIn ? await isLiked(uri) : false }, { immediate: true })
async function like() {
  if (!now.value?.uri) return
  liked.value = !liked.value
  const r = await setLiked(now.value.uri, liked.value)
  if (!r.ok) { liked.value = !liked.value; notify(r.error || 'Klarte ikke å lagre låta.', true) }
}
</script>

<template>
  <button v-if="admin.loggedIn && spotify.connected && now?.uri" class="heart" :class="{ liked }" :title="liked ? 'Fjern fra Likte sanger' : 'Lagre i Likte sanger'" aria-label="Likte sanger" @click.stop="like">
    <Heart :size="14" :fill="liked ? 'currentColor' : 'none'" />
  </button>
</template>

<style scoped>
.heart { display: inline-grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass); color: var(--text-3); cursor: pointer; transition: color 0.15s, border-color 0.15s; }
.heart:hover { color: #1db954; border-color: #1db954; }
.heart.liked { color: #1db954; border-color: #1db954; }
</style>
