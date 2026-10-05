<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { allCountries, searchCountries, norskNavn, type Country } from '../three/countries'

const props = withDefaults(defineProps<{
  modelValue?: string | null // atlas (English) name
  placeholder?: string
  highlight?: Set<string> | null // atlas names to mark (e.g. visited)
  clearOnPick?: boolean
}>(), { modelValue: null, placeholder: 'Søk etter land …', highlight: null, clearOnPick: false })
const emit = defineEmits<{ 'update:modelValue': [en: string]; pick: [en: string] }>()

const all = allCountries()
const q = ref(props.modelValue ? norskNavn(props.modelValue) : '')
const open = ref(false)
const active = ref(0)
const list = ref<HTMLElement | null>(null)

const results = computed(() => searchCountries(q.value, all).slice(0, 60))
watch(() => props.modelValue, (v) => { if (!open.value) q.value = v ? norskNavn(v) : '' })
watch(q, () => (active.value = 0))

function pick(c: Country) {
  emit('update:modelValue', c.en)
  emit('pick', c.en)
  q.value = props.clearOnPick ? '' : c.no
  open.value = false
}
function onKey(e: KeyboardEvent) {
  if (!open.value && (e.key === 'ArrowDown' || e.key === 'Enter')) { open.value = true; return }
  if (e.key === 'ArrowDown') { active.value = Math.min(results.value.length - 1, active.value + 1); scroll() ; e.preventDefault() }
  else if (e.key === 'ArrowUp') { active.value = Math.max(0, active.value - 1); scroll(); e.preventDefault() }
  else if (e.key === 'Enter') { const c = results.value[active.value]; if (c) pick(c); e.preventDefault() }
  else if (e.key === 'Escape') open.value = false
}
function scroll() {
  nextTick(() => list.value?.children[active.value]?.scrollIntoView({ block: 'nearest' }))
}
function onBlur() { setTimeout(() => (open.value = false), 150) }
</script>

<template>
  <div class="picker">
    <svg class="glass-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
    <input
      v-model="q"
      type="search"
      :placeholder="placeholder"
      autocomplete="off"
      role="combobox"
      :aria-expanded="open"
      @focus="open = true"
      @input="open = true"
      @keydown="onKey"
      @blur="onBlur"
    />
    <transition name="fade">
      <ul v-if="open && results.length" ref="list" class="menu glass" role="listbox">
        <li
          v-for="(c, i) in results"
          :key="c.en"
          :class="{ active: i === active }"
          role="option"
          @mousedown.prevent="pick(c)"
          @mouseenter="active = i"
        >
          <span>{{ c.no }}</span>
          <small v-if="c.no !== c.en">{{ c.en }}</small>
          <b v-if="highlight?.has(c.en)" class="dot" title="Besøkt"></b>
        </li>
      </ul>
    </transition>
  </div>
</template>

<style scoped>
.picker { position: relative; }
.glass-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
input {
  width: 100%;
  padding: 11px 14px 11px 40px;
  border-radius: 14px;
  border: 1px solid var(--glass-border);
  background: var(--glass-strong);
  color: var(--text);
  font: 500 0.95rem var(--font);
  outline: none;
  transition: box-shadow 0.2s, border-color 0.2s;
}
input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
.menu {
  position: absolute;
  z-index: 30;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 260px;
  overflow-y: auto;
  margin: 0;
  padding: 6px;
  list-style: none;
  border-radius: 16px;
}
li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.92rem;
}
li.active { background: var(--accent-soft); color: var(--accent); }
li small { color: var(--text-3); font-size: 0.75rem; }
.dot { margin-left: auto; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); align-self: center; }
</style>
