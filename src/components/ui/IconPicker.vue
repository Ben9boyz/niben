<script setup lang="ts">
import { ref } from 'vue'
import { PICKABLE, iconOf } from '@/lib/icons'

// Pick a symbol from the site's icon set (stored by its name). `standard` adds a choice for "the one it has by default".
const props = defineProps<{ modelValue: string; label: string; standard?: string /* svg path of the default symbol */ }>()
const emit = defineEmits<{ 'update:modelValue': [name: string] }>()
const open = ref(false)
const choose = (n: string): void => { emit('update:modelValue', n); open.value = false }
void props
</script>

<template>
  <div class="ip">
    <button class="cur" type="button" :aria-label="label" :aria-expanded="open" @click="open = !open">
      <svg v-if="!modelValue && standard" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="standard" /></svg>
      <component :is="iconOf(modelValue)" v-else :size="20" />
    </button>
    <div v-if="open" class="pop" role="listbox" :aria-label="label">
      <button v-if="standard" type="button" role="option" :aria-selected="!modelValue" title="Standard" @click="choose('')"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="standard" /></svg></button>
      <button v-for="n in PICKABLE" :key="n" type="button" role="option" :aria-selected="modelValue === n" :title="n" :class="{ on: modelValue === n }" @click="choose(n)"><component :is="iconOf(n)" :size="18" /></button>
    </div>
  </div>
</template>

<style scoped>
.ip { position: relative; }
.cur { all: unset; cursor: pointer; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; background: var(--accent-soft); color: var(--accent); }
.pop { position: absolute; z-index: 30; top: 110%; left: 0; width: 272px; display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; padding: 8px; border-radius: 14px; background: var(--bg); box-shadow: 0 14px 40px rgba(0, 0, 0, 0.28); border: 1px solid var(--glass-border); }
.pop button { all: unset; cursor: pointer; display: grid; place-items: center; height: 30px; border-radius: 8px; color: var(--text-2); }
.pop button:hover, .pop button.on { background: var(--accent-soft); color: var(--accent); }
</style>
