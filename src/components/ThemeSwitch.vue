<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Sun, Moon, Radio, Check } from 'lucide-vue-next'
import { useTheme } from '../composables/useTheme'

// Light / dark: a button with a small menu – "Live" (day and night where I live), "Lys" and "Mørk".
const { theme, mode, setMode, live } = useTheme()
const open = ref(false)
const root = ref(null)
const menuEl = ref(null)
const pos = ref({})
function toggleMenu() {
  open.value = !open.value
  if (!open.value) return
  const r = root.value.getBoundingClientRect()
  const phone = innerWidth <= 720
  pos.value = phone ? { right: '12px', top: `${r.bottom + 8}px` } : { left: `${r.right + 10}px`, bottom: `${Math.max(8, innerHeight - r.bottom)}px` }
}
const choices = computed(() => [
  ...(live.configured ? [['live', live.name ? `Live – ${live.name}` : 'Live', Radio, 'Lys om dagen, mørkt om natten der jeg bor']] : []),
  ['light', 'Lys', Sun, ''],
  ['dark', 'Mørk', Moon, ''],
])
const onDoc = (e) => { if (open.value && !root.value?.contains(e.target) && !menuEl.value?.contains(e.target)) open.value = false }
const onKey = (e) => { if (e.key === 'Escape') open.value = false }
onMounted(() => { document.addEventListener('pointerdown', onDoc); window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onDoc); window.removeEventListener('keydown', onKey) })
function pick(id) { setMode(id); open.value = false }
</script>

<template>
  <button ref="root" class="theme glass" :aria-label="theme === 'dark' ? 'Tema: mørkt' : 'Tema: lyst'" :aria-expanded="open" @click="toggleMenu">
    <transition name="spin" mode="out-in">
      <Sun v-if="theme === 'dark'" key="s" :size="20" />
      <Moon v-else key="m" :size="20" />
    </transition>
    <i v-if="mode === 'live'" class="dot" title="Live"></i>
    <teleport to="body">
      <transition name="fade">
        <div v-if="open" ref="menuEl" class="tsmenu glass" role="menu" translate="no" :style="pos" @click.stop>
          <button v-for="c in choices" :key="c[0]" role="menuitemradio" :aria-checked="mode === c[0]" :class="{ on: mode === c[0] }" @click="pick(c[0])">
            <component :is="c[2]" :size="16" aria-hidden="true" /><span class="l"><b>{{ c[1] }}</b><small v-if="c[3]">{{ c[3] }}</small></span><Check v-if="mode === c[0]" :size="14" aria-hidden="true" />
          </button>
        </div>
      </transition>
    </teleport>
  </button>
</template>

<style scoped>
.dot { position: absolute; right: 8px; top: 8px; width: 8px; height: 8px; border-radius: 50%; background: #1db954; box-shadow: 0 0 0 2px var(--bg); }
</style>
<style>
.tsmenu { position: fixed; z-index: 85; width: 250px; padding: 6px; border-radius: 16px; background: var(--bg); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3); display: grid; gap: 2px; }
.tsmenu button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: 0; border-radius: 10px; background: transparent; color: var(--text); text-align: left; cursor: pointer; font-family: var(--font); }
.tsmenu button:hover { background: var(--accent-soft); }
.tsmenu button.on { color: var(--accent); background: var(--accent-soft); }
.tsmenu svg { flex: none; }
.tsmenu .l { flex: 1; display: grid; min-width: 0; }
.tsmenu .l b { font-weight: 600; font-size: 0.88rem; }
.tsmenu .l small { font-size: 0.72rem; color: var(--text-3); line-height: 1.25; }
</style>
