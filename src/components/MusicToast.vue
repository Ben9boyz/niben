<script setup>
import { ref, watch } from 'vue'
import { Speaker, AlertCircle } from 'lucide-vue-next'
import { spotify } from '../composables/useSpotify'

// A short message from the music player: where playback ended up when the page's own player wasn't
// reachable, or why it couldn't play. Disappears by itself.
const shown = ref(null)
let timer = 0
watch(() => spotify.notice?.t, () => {
  shown.value = spotify.notice
  clearTimeout(timer)
  timer = setTimeout(() => (shown.value = null), spotify.notice?.error ? 7000 : 5000)
})
</script>

<template>
  <transition name="toast">
    <div v-if="shown" class="mtoast glass" :class="{ error: shown.error }" role="status" @click="shown = null">
      <AlertCircle v-if="shown.error" :size="16" /><Speaker v-else :size="16" />
      <span>{{ shown.text }}</span>
    </div>
  </transition>
</template>

<style scoped>
.mtoast { position: fixed; z-index: 60; left: calc(50% + var(--rail) / 2); bottom: 24px; translate: -50% 0; display: flex; align-items: center; gap: 8px; max-width: min(520px, calc(100vw - 32px)); padding: 10px 16px; border-radius: 16px; font-size: 0.86rem; font-weight: 600; color: var(--text); box-shadow: 0 14px 34px rgba(0, 0, 0, 0.25); cursor: pointer; }
.mtoast svg { flex: none; color: #1db954; }
.mtoast.error svg { color: #e5533d; }
@media (max-width: 720px) { .mtoast { bottom: calc(24px + env(safe-area-inset-bottom)); transition: bottom 0.35s var(--ease, ease); } }
.toast-enter-active, .toast-leave-active { transition: opacity 0.25s, transform 0.35s var(--spring, ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px); }
</style>
