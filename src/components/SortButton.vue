<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ArrowUpDown, Check } from 'lucide-vue-next'
import { sort, OPTIONS, type SortKind } from '../composables/useSort'
import { targetEl } from '../lib/dom'

// The sort button in the library: pick how albums / playlists are ordered.
const props = withDefaults(defineProps<{ kind?: SortKind }>(), { kind: 'album' })
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const opts = computed(() => OPTIONS[props.kind])
const label = computed(() => opts.value.find((o) => o[0] === sort[props.kind])?.[1] || '')
const pick = (id: string) => { sort[props.kind] = id; open.value = false }
const onDoc = (e: Event) => { if (open.value && !root.value?.contains(targetEl(e))) open.value = false }
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') open.value = false }
onMounted(() => { document.addEventListener('pointerdown', onDoc); window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onDoc); window.removeEventListener('keydown', onKey) })
</script>

<template>
  <span ref="root" class="sortw">
    <button class="sb" :class="{ on: open }" :title="`Sortering: ${label}`" aria-label="Sortering" :aria-expanded="open" @click="open = !open"><ArrowUpDown :size="14" /><span>{{ label }}</span></button>
    <div v-if="open" class="pop glass" role="menu">
      <button v-for="o in opts" :key="o[0]" role="menuitemradio" :aria-checked="sort[kind] === o[0]" :class="{ on: sort[kind] === o[0] }" @click="pick(o[0])"><span>{{ o[1] }}</span><Check v-if="sort[kind] === o[0]" :size="14" /></button>
    </div>
  </span>
</template>

<style scoped>
.sortw { position: relative; display: inline-flex; }
.sb { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass-strong); color: var(--text-2); font: 600 0.78rem var(--font); cursor: pointer; max-width: 190px; }
.sb span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb:hover, .sb.on { color: var(--accent); border-color: var(--accent); }
.pop { position: absolute; z-index: 40; top: calc(100% + 6px); right: 0; width: 220px; padding: 6px; border-radius: 14px; background: var(--bg); box-shadow: 0 16px 44px rgba(0, 0, 0, 0.25); display: grid; gap: 1px; }
.pop button { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 0; border-radius: 9px; background: transparent; color: var(--text); font: 600 0.84rem var(--font); text-align: left; cursor: pointer; }
.pop button:hover { background: var(--accent-soft); }
.pop button.on { color: var(--accent); }
@media (max-width: 820px) { .sb span { display: none; } .sb { padding: 6px 9px; } .pop { right: auto; left: 0; } }
</style>
