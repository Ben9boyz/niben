<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { Box, LayoutList } from 'lucide-vue-next'
import { mode, toggleMode } from '@/composables/ui/useMode'
import { shell } from '@/composables/ui/useShell'
import { room } from '@/composables/room/useRoom'
import { targetEl } from '@/lib/dom'

// One button that always shows where it takes you: "2D" while you're in the room, "3D" in the plain version.
// V does the same from the keyboard (not while typing, and not while walking around in the room).
const onKey = (e: KeyboardEvent) => {
  if (e.key.toLowerCase() !== 'v' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat) return
  const t = targetEl(e)
  if (t.closest('input, textarea, select, [contenteditable="true"]') || room.roam || shell.value === 'player') return
  toggleMode()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <button
    v-if="shell !== 'player'"
    class="sm vs glass"
    :title="mode === 'rom' ? 'Bytt til 2D-versjonen (V)' : 'Bytt til 3D-rommet (V)'"
    :aria-label="mode === 'rom' ? 'Bytt til 2D-versjonen' : 'Bytt til 3D-rommet'"
    @click="toggleMode"
  >
    <LayoutList v-if="mode === 'rom'" :size="18" aria-hidden="true" />
    <Box v-else :size="18" aria-hidden="true" />
    <b>{{ mode === 'rom' ? '2D' : '3D' }}</b>
  </button>
</template>

<style scoped>
.vs { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; width: 50px; height: 50px; padding: 0; border: 0; border-radius: 50%; color: var(--text-2); cursor: pointer; transition: transform 0.4s var(--spring), color 0.2s; }
.vs:hover { color: var(--accent); transform: scale(1.06); }
.vs b { font: 800 0.6rem var(--font); letter-spacing: 0.04em; line-height: 1; }
</style>
