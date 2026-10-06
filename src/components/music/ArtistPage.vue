<script setup lang="ts">
import { errorMessage } from '@/composables/useAdmin'
import { ref, watch } from 'vue'
import { ChevronLeft, ArrowUpRight, User } from 'lucide-vue-next'
import CoverGrid from './CoverGrid.vue'
import { fetchArtist, openAlbumPage, type ArtistInfo, type ArtistRef } from '@/composables/music/useBrowse'
import type { Album } from '@/types'
import { spotify } from '@/composables/music/useSpotify'

// An artist: picture, genres and all their albums. Tap an album to open it.
const props = withDefaults(defineProps<{ artist: ArtistRef; backLabel?: string }>(), { backLabel: 'Tilbake' })
const emit = defineEmits<{ back: [] }>()
const data = ref<ArtistInfo | null>(null)
const error = ref('')
watch(() => props.artist, async (a) => {
  data.value = null; error.value = ''
  try { data.value = await fetchArtist(a) } catch (e) { error.value = errorMessage(e) }
}, { immediate: true })

const have = (uri: string) => spotify.albums.some((x) => x.uri === uri)
const tiles = (list: Album[]) => list.map((a) => ({ ...a, sub: [a.year, have(a.uri) ? 'i biblioteket' : null].filter(Boolean).join(' · '), image: a.image || a.thumb }))
const kinds = (d: ArtistInfo) => [
  { title: 'Album', list: (d.albums ?? []).filter((a) => a.type !== 'single') },
  { title: 'Singler og EP-er', list: (d.albums ?? []).filter((a) => a.type === 'single') },
].filter((k) => k.list.length)
</script>

<template>
  <article class="artist">
    <header class="hero">
      <button class="back" @click="emit('back')"><ChevronLeft :size="16" />{{ backLabel }}</button>
      <div class="row">
        <img v-if="data?.image_large || data?.image" crossorigin="anonymous" class="pic" :src="data.image_large || data.image || undefined" alt="" />
        <div v-else class="pic ph"><User :size="40" /></div>
        <div class="info">
          <small>Artist</small>
          <h2>{{ data?.name || artist.name || '…' }}</h2>
          <p v-if="data?.genres?.length">{{ data.genres.join(' · ') }}</p>
          <a v-if="data?.url" class="open" :href="data.url" target="_blank" rel="noopener">Åpne i Spotify <ArrowUpRight :size="15" /></a>
        </div>
      </div>
    </header>
    <p v-if="error" class="notice error">{{ error }}</p>
    <p v-else-if="!data" class="note">Henter albumene …</p>
    <template v-else>
      <section v-for="k in kinds(data)" :key="k.title">
        <h4>{{ k.title }}</h4>
        <CoverGrid :items="tiles(k.list)" :playing-uri="spotify.now?.context" @pick="openAlbumPage($event)" />
      </section>
      <p v-if="!data.albums?.length" class="note">Fant ingen album.</p>
    </template>
  </article>
</template>

<style scoped>
.artist { display: grid; gap: 14px; min-width: 0; }
.hero { display: grid; gap: 12px; margin: -6px -6px 0; padding: 10px 14px 16px; border-radius: 16px; background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 40%, transparent), color-mix(in srgb, var(--accent) 6%, transparent)); }
.back { display: inline-flex; align-items: center; gap: 2px; justify-self: start; border: 0; padding: 6px 12px; border-radius: 999px; background: rgba(0, 0, 0, 0.18); color: #fff; font-weight: 600; font-size: 0.82rem; cursor: pointer; }
.back:hover { background: rgba(0, 0, 0, 0.3); }
.row { display: flex; align-items: flex-end; gap: 16px; min-width: 0; }
.pic { width: 96px; height: 96px; flex: none; border-radius: 50%; object-fit: cover; box-shadow: 0 14px 34px rgba(0, 0, 0, 0.4); }
.pic.ph { display: grid; place-items: center; background: var(--glass-strong); color: var(--text-3); }
.info { min-width: 0; display: grid; gap: 4px; }
.info small { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-2); }
.info h2 { margin: 0; font-size: 1.35rem; line-height: 1.1; overflow-wrap: anywhere; }
.info p { margin: 0; font-size: 0.82rem; color: var(--text-2); }
.open { display: inline-flex; align-items: center; gap: 3px; font-size: 0.8rem; font-weight: 600; color: var(--text-2); text-decoration: none; }
.open:hover { color: var(--accent); }
section { display: grid; gap: 8px; }
h4 { margin: 0 2px; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
.note { margin: 0; color: var(--text-3); font-size: 0.85rem; }
@container (min-width: 420px) { .pic { width: 120px; height: 120px; } .info h2 { font-size: 1.6rem; } }
@container (min-width: 560px) { .pic { width: 170px; height: 170px; } .info h2 { font-size: 2.4rem; } }
</style>
