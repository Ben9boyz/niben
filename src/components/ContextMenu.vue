<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { ctx, closeMenu } from '../composables/useContextMenu'

const el = ref(null)
const pos = ref({ left: 0, top: 0 })
const subAt = ref(null) // index of the open submenu
const subLeft = ref(false)
watch(() => ctx.open, async (o) => {
  subAt.value = null
  if (!o) return
  pos.value = { left: ctx.x, top: ctx.y }
  await nextTick()
  const r = el.value?.getBoundingClientRect()
  if (!r) return
  // keep it on the screen
  const left = Math.max(8, Math.min(ctx.x, innerWidth - r.width - 8))
  const top = Math.max(8, Math.min(ctx.y, innerHeight - r.height - 8))
  pos.value = { left, top }
  subLeft.value = left + r.width + 230 > innerWidth
  el.value?.focus({ preventScroll: true })
})
function run(it) {
  if (it.sub) { subAt.value = subAt.value === it.label ? null : it.label; return }
  closeMenu()
  it.run?.()
}
const onDown = (e) => { if (ctx.open && !el.value?.contains(e.target)) closeMenu() }
const onKey = (e) => { if (ctx.open && e.key === 'Escape') { e.preventDefault(); closeMenu() } }
onMounted(() => { document.addEventListener('pointerdown', onDown, true); window.addEventListener('keydown', onKey); window.addEventListener('scroll', closeMenu, true); window.addEventListener('resize', closeMenu) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', closeMenu, true); window.removeEventListener('resize', closeMenu) })
</script>

<template>
  <teleport to="body">
    <div v-if="ctx.open" ref="el" class="cm glass" role="menu" tabindex="-1" :style="{ left: `${pos.left}px`, top: `${pos.top}px` }" @contextmenu.prevent>
      <div v-if="ctx.title" class="cap" translate="no">{{ ctx.title }}</div>
      <template v-for="(it, i) in ctx.items" :key="i">
        <hr v-if="it.sep" />
        <div v-else class="mrow">
          <button role="menuitem" :class="{ danger: it.danger, open: subAt === it.label }" @click="run(it)">
            <component :is="it.icon" v-if="it.icon" :size="15" aria-hidden="true" /><span class="l">{{ it.label }}</span><ChevronRight v-if="it.sub" :size="14" aria-hidden="true" />
          </button>
          <div v-if="it.sub && subAt === it.label" class="sub glass" :class="{ left: subLeft }">
            <button v-for="s in it.sub" :key="s.label" role="menuitem" @click="closeMenu(); s.run?.()"><span class="l" translate="no">{{ s.label }}</span></button>
            <div v-if="!it.sub.length" class="none">–</div>
          </div>
        </div>
      </template>
    </div>
  </teleport>
</template>

<style scoped>
.cm { position: fixed; z-index: 95; min-width: 220px; max-width: 280px; padding: 6px; border-radius: 14px; background: var(--bg); box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3); outline: none; animation: pop 0.12s ease-out; }
@keyframes pop { from { opacity: 0; transform: scale(0.97); } }
.cap { padding: 6px 10px 6px; font-size: 0.74rem; font-weight: 700; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-bottom: 1px solid var(--glass-border); margin-bottom: 4px; }
hr { margin: 4px 6px; border: 0; border-top: 1px solid var(--glass-border); }
.mrow { position: relative; }
button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: 0; border-radius: 9px; background: transparent; color: var(--text); font: 600 0.86rem var(--font); text-align: left; cursor: pointer; }
button:hover, button.open { background: var(--accent-soft); color: var(--accent); }
button.danger { color: #d24b4b; }
button svg { flex: none; color: var(--text-3); }
button:hover svg { color: inherit; }
.l { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { position: absolute; top: -6px; left: calc(100% + 4px); width: 210px; max-height: 280px; overflow-y: auto; padding: 6px; border-radius: 14px; background: var(--bg); box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3); scrollbar-width: thin; }
.sub.left { left: auto; right: calc(100% + 4px); }
.none { padding: 8px 10px; color: var(--text-3); }
@media (max-width: 720px) { .sub { position: static; width: auto; max-height: 200px; margin: 2px 0 4px 12px; box-shadow: none; } button { padding: 11px 10px; } }
</style>
