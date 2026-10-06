<script setup lang="ts">
import { computed } from 'vue'
import { PATTERNS } from '@/lib/strum'

// The strumming pattern for one bar: tap a slot to cycle down → up → muted → nothing, or pick a common
// pattern. `active` lights up the slot being played.
const props = withDefaults(defineProps<{ modelValue?: string; active?: number; readonly?: boolean }>(), { modelValue: '', active: -1 })
const emit = defineEmits<{ 'update:modelValue': [pattern: string] }>()
const slots = computed(() => (props.modelValue || 'D-D-D-D-').toUpperCase().padEnd(8, '-').split(''))
const NEXT: Record<string, string> = { D: 'U', U: 'X', X: '-', '-': 'D' }
const ARROW: Record<string, string> = { D: '↓', U: '↑', X: '×', '-': '' }
function cycle(i: number) {
  if (props.readonly) return
  const s = [...slots.value]
  s[i] = NEXT[s[i]] || 'D'
  emit('update:modelValue', s.join(''))
}
const label = (i: number) => (i % 2 ? '&' : String(i / 2 + 1))
</script>

<template>
  <div class="strum">
    <div class="slots" role="group" aria-label="Slagmønster">
      <button
        v-for="(c, i) in slots"
        :key="i"
        type="button"
        class="slot"
        :class="{ on: i === active, off: c === '-', mute: c === 'X', up: c === 'U', ro: readonly }"
        :aria-label="`${label(i)}: ${{ D: 'ned', U: 'opp', X: 'demp', '-': 'pause' }[c]}`"
        @click="cycle(i)"
      >
        <b>{{ ARROW[c] }}</b><small>{{ label(i) }}</small>
      </button>
    </div>
    <div v-if="!readonly" class="presets">
      <button v-for="[p, name] in PATTERNS" :key="p" type="button" :class="{ sel: p === slots.join('') }" @click="emit('update:modelValue', p)">{{ name }}</button>
    </div>
  </div>
</template>

<style scoped>
.strum { display: grid; gap: 6px; }
.slots { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px; max-width: 360px; }
.slot { display: grid; justify-items: center; gap: 1px; padding: 6px 0 4px; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--glass-strong); color: var(--text); cursor: pointer; transition: background 0.1s, transform 0.1s; }
.slot.ro { cursor: default; }
.slot b { font-size: 1.15rem; line-height: 1; height: 1.15rem; }
.slot small { font-size: 0.62rem; color: var(--text-3); font-weight: 700; }
.slot.up b { color: var(--accent); }
.slot.mute b { color: #c98a27; }
.slot.off { background: transparent; }
.slot.on { background: var(--accent); border-color: var(--accent); color: #fff; transform: scale(1.06); }
.slot.on b, .slot.on small { color: #fff; }
.presets { display: flex; flex-wrap: wrap; gap: 4px; }
.presets button { padding: 4px 10px; border: 1px solid var(--glass-border); border-radius: 999px; background: transparent; color: var(--text-2); font: 600 0.74rem var(--font); cursor: pointer; }
.presets button.sel, .presets button:hover { border-color: var(--accent); color: var(--accent); }
</style>
