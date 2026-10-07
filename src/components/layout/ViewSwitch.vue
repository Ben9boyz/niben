<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { Box, LayoutList } from 'lucide-vue-next'
import { mode, toggleMode } from '@/composables/ui/useMode'
import { room } from '@/composables/room/useRoom'
import { targetEl } from '@/lib/dom'

// One button that always shows where it takes you: "2D" while you're in the room, "3D" in the plain version.
// V does the same from the keyboard (not while typing, and not while walking around in the room).
// rail = the desktop rail: a real slide switch (thumb up = 3D, down = 2D) instead of a round button
defineProps<{ rail?: boolean }>()
const onKey = (e: KeyboardEvent) => {
  if (e.key.toLowerCase() !== 'v' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat) return
  const t = targetEl(e)
  if (t.closest('input, textarea, select, [contenteditable="true"]') || room.roam) return
  toggleMode()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <button
    v-if="rail"
    type="button"
    class="vsw"
    role="switch"
    :aria-checked="mode === 'rom'"
    aria-label="3D-rommet"
    :title="mode === 'rom' ? 'Bytt til 2D-versjonen (V)' : 'Bytt til 3D-rommet (V)'"
    @click="toggleMode"
  >
    <span class="track"><span class="thumb"><span class="pip"></span></span></span>
    <span class="cap"><b :class="{ on: mode === 'rom' }">3D</b> · <b :class="{ on: mode !== 'rom' }">2D</b></span>
  </button>
  <button
    v-else
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
.vsw { all: unset; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; color: var(--text-2); }
.vsw:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 12px; }
.track { position: relative; display: block; width: 34px; height: 58px; border-radius: 17px; background: var(--sk-sunk, var(--bg-2)); box-shadow: var(--sk-sunk-sh, inset 0 2px 5px rgba(0, 0, 0, 0.18)); }
.thumb { position: absolute; left: 3px; top: 27px; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--sk-key, var(--glass-strong)); box-shadow: var(--sk-key-sh, var(--shadow-1)); transition: top 0.4s var(--spring); }
.vsw[aria-checked="true"] .thumb { top: 3px; }
.pip { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: var(--sk-glow, none); }
.cap { font: 700 0.6rem var(--font); letter-spacing: 0.02em; white-space: nowrap; }
.cap b { font-weight: 700; opacity: 0.5; }
.cap b.on { opacity: 1; color: var(--text); }
</style>
