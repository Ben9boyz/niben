<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { ctx, closeMenu } from '../composables/useContextMenu'

const el = ref(null)
const pos = ref({ left: 0, top: 0 })
const subAt = ref(null) // index of the open submenu
const subLeft = ref(false)
const subQ = ref('') // search inside a long submenu (the playlists)
const subEl = ref(null)
const subItems = (it) => { const q = subQ.value.trim().toLowerCase(); return q ? it.sub.filter((x) => x.label.toLowerCase().includes(q)) : it.sub }
watch(subAt, async (v) => { subQ.value = ''; if (v == null) return; await nextTick(); subEl.value?.[0]?.querySelector?.('input')?.focus({ preventScroll: true }) })
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
const onScroll = (e) => { if (!el.value?.contains(e.target)) closeMenu() } // scrolling the list inside the menu must not close it
const onKey = (e) => { if (ctx.open && e.key === 'Escape') { e.preventDefault(); closeMenu() } }
onMounted(() => { document.addEventListener('pointerdown', onDown, true); window.addEventListener('keydown', onKey); window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', closeMenu) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', closeMenu) })
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
          <div v-if="it.sub && subAt === it.label" ref="subEl" class="sub glass" :class="{ left: subLeft }">
            <input v-if="it.sub.length > 3" v-model="subQ" class="sq" type="search" placeholder="Søk …" aria-label="Søk i listen" @keydown.stop @keydown.esc="closeMenu" />
            <div class="subl">
              <button v-for="s in subItems(it)" :key="s.label" role="menuitem" @click="closeMenu(); s.run?.()">
                <img v-if="s.img" :src="s.img" alt="" class="si" crossorigin="anonymous" /><span class="l" translate="no">{{ s.label }}</span>
              </button>
              <div v-if="!subItems(it).length" class="none">{{ it.sub.length ? 'Ingen treff' : '–' }}</div>
            </div>
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
.sub { position: absolute; top: -6px; left: calc(100% + 4px); width: 240px; padding: 6px; display: grid; gap: 4px; border-radius: 14px; background: var(--bg); box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3); }
.sub.left { left: auto; right: calc(100% + 4px); }
.subl { max-height: 260px; overflow-y: auto; overscroll-behavior: contain; display: grid; gap: 1px; }
.sq { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--glass-border); border-radius: 9px; background: var(--glass-strong); color: var(--text); font: 600 0.84rem var(--font); outline: none; }
.sq:focus { border-color: var(--accent); }
.si { width: 28px; height: 28px; flex: none; border-radius: 5px; object-fit: cover; }
.none { padding: 8px 10px; color: var(--text-3); }
@media (max-width: 720px) { .sub { position: static; width: auto; margin: 2px 0 4px 12px; box-shadow: none; } .subl { max-height: 200px; } button { padding: 11px 10px; } }
</style>
