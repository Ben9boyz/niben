<script setup lang="ts">
import { computed } from 'vue'
import { Library, Search, Play, Pause, SkipBack, SkipForward, Disc3 } from 'lucide-vue-next'
import { spotify, progressMs, control } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'

// Phones, the plain music page: like Spotify's – ONE unit at the bottom: the player on top (cover, name, the buttons you need,
// a thin progress line; tap it for the whole player) and the two tabs under it: Bibliotek and Søk.
withDefaults(defineProps<{ tab?: 'library' | 'search' }>(), { tab: 'library' })
const emit = defineEmits<{ tab: [tab: 'library' | 'search']; open: [] }>()
const now = computed(() => spotify.now)
const playing = computed(() => !!now.value?.name)
const pct = computed(() => (now.value?.duration_ms ? (progressMs.value / now.value?.duration_ms) * 100 : 0))
const toggle = () => control(now.value?.playing ? 'pause' : 'resume')
</script>

<template>
  <div class="mmb glass">
    <div v-if="playing" class="np" role="button" tabindex="0" aria-label="Åpne spilleren" @click="emit('open')" @keydown.enter="emit('open')">
      <img v-if="now?.image" crossorigin="anonymous" :src="now?.image || undefined" alt="" />
      <span v-else class="ph"><Disc3 :size="20" /></span>
      <span class="tx"><b translate="no">{{ now?.name }}</b><small translate="no">{{ now?.artist }}</small></span>
      <span v-if="admin.loggedIn" class="ctl" @click.stop>
        <button aria-label="Forrige låt" @click="control('previous')"><SkipBack :size="20" fill="currentColor" /></button>
        <button class="pp" :aria-label="now?.playing ? 'Pause' : 'Spill'" @click="toggle"><Pause v-if="now?.playing" :size="22" fill="currentColor" /><Play v-else :size="22" fill="currentColor" /></button>
        <button aria-label="Neste låt" @click="control('next')"><SkipForward :size="20" fill="currentColor" /></button>
      </span>
      <i class="prog" :style="{ width: `${pct}%` }"></i>
    </div>
    <nav class="tabs" role="tablist" aria-label="Musikk">
      <button role="tab" :aria-selected="tab === 'library'" :class="{ on: tab === 'library' }" @click="emit('tab', 'library')"><Library :size="22" /><span>Bibliotek</span></button>
      <button role="tab" :aria-selected="tab === 'search'" :class="{ on: tab === 'search' }" @click="emit('tab', 'search')"><Search :size="22" /><span>Søk</span></button>
    </nav>
  </div>
</template>

<style scoped>
.mmb { background: color-mix(in srgb, var(--bg) 93%, transparent); -webkit-backdrop-filter: blur(22px) saturate(160%); backdrop-filter: blur(22px) saturate(160%); position: fixed; z-index: 34; left: 0; right: 0; bottom: 0; display: grid; border-radius: 18px 18px 0 0; padding-bottom: env(safe-area-inset-bottom); border-left: 0; border-right: 0; border-bottom: 0; }
.np { position: relative; display: flex; align-items: center; gap: 10px; padding: 8px 12px 8px 10px; border-bottom: 1px solid var(--glass-border); cursor: pointer; touch-action: manipulation; }
.np img, .np .ph { flex: none; width: 42px; height: 42px; border-radius: 8px; object-fit: cover; background: var(--accent-soft); display: grid; place-items: center; color: var(--text-3); }
.tx { display: grid; min-width: 0; flex: 1; line-height: 1.2; }
.tx b { font-size: 0.86rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tx small { font-size: 0.74rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ctl { flex: none; display: inline-flex; align-items: center; }
.ctl button { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--text); cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.ctl button:active { background: var(--accent-soft); }
.ctl .pp { width: 44px; height: 44px; background: #1db954; color: #fff; }
.prog { position: absolute; left: 0; bottom: -1px; height: 2px; background: #1db954; transition: width 1s linear; }
.tabs { display: grid; grid-template-columns: 1fr 1fr; }
.tabs button { display: grid; justify-items: center; gap: 2px; padding: 8px 0 7px; border: 0; background: transparent; color: var(--text-3); font: 600 0.68rem var(--font); cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.tabs button.on { color: var(--accent); }
.tabs button:active { background: var(--accent-soft); }
</style>
