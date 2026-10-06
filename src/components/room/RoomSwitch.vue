<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { DoorOpen, Check } from 'lucide-vue-next'
import { rooms, loadRooms, setRoom } from '@/composables/useRooms'
import { thumb } from '@/lib/photos'
import { targetEl } from '@/lib/dom'

// The room icon: appears when there is more than one room. Pick another room and the whole room is loaded: its trips,
// books, guitars … (and nothing of mine).
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const pos = ref<Record<string, string>>({})
onMounted(loadRooms)

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  const r = root.value?.getBoundingClientRect()
  if (!r) return
  const phone = innerWidth <= 720
  pos.value = { visibility: 'hidden', left: '0px', top: '0px' }
  await nextTick()
  const h = menuEl.value?.offsetHeight || 200, w = menuEl.value?.offsetWidth || 260
  const left = phone ? Math.max(8, Math.min(innerWidth - w - 10, r.right - w)) : Math.min(r.right + 10, innerWidth - w - 8)
  const top = phone ? Math.min(r.bottom + 8, innerHeight - h - 24) : Math.min(r.bottom - h - 4, innerHeight - h - 24)
  pos.value = { left: `${left}px`, top: `${Math.max(8, top)}px` }
}
const close = () => { open.value = false }
const onDoc = (e: Event) => { if (open.value && !root.value?.contains(targetEl(e)) && !menuEl.value?.contains(targetEl(e))) close() }
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
onMounted(() => { document.addEventListener('pointerdown', onDoc); window.addEventListener('keydown', onKey); window.addEventListener('resize', close) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onDoc); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', close) })
</script>

<template>
  <template v-if="rooms.list.length > 1">
    <button ref="root" class="sm rooms glass" :class="{ on: open }" title="Bytt rom" aria-label="Bytt rom" :aria-expanded="open" @click="toggle"><DoorOpen :size="20" aria-hidden="true" /></button>
    <teleport to="body">
      <transition name="fade">
        <div v-if="open" ref="menuEl" class="smenu glass" role="menu" translate="no" :style="pos" @click.stop>
          <div class="grp first"><span class="cap">Rom</span></div>
          <button v-for="r in rooms.list" :key="r.username" class="row" role="menuitem" @click="close(); if (r.username !== rooms.current) void setRoom(r.username)">
            <img v-if="r.photo" class="av" :src="thumb(r.photo, 400)" alt="" crossorigin="anonymous" /><span v-else class="av ph">{{ r.username.slice(0, 1).toUpperCase() }}</span>
            <span class="l"><b>{{ r.username }}<small v-if="r.owner"> · hovedrommet</small></b><small v-if="r.tagline">{{ r.tagline }}</small></span>
            <Check v-if="r.username === rooms.current" :size="16" aria-hidden="true" />
          </button>
        </div>
      </transition>
    </teleport>
  </template>
</template>

<style>
.sm.rooms { position: relative; display: grid; place-items: center; width: 50px; height: 50px; padding: 0; border: 0; border-radius: 50%; color: var(--text-2); cursor: pointer; transition: transform 0.4s var(--spring), color 0.2s; }
.sm.rooms:hover, .sm.rooms.on { color: var(--accent); transform: scale(1.06); }
.smenu .av { flex: none; width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
.smenu .av.ph { display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-weight: 800; }
.smenu .grp.first { border-top: 0; padding-top: 2px; }
@media (max-width: 720px) { html body .sm.sm.rooms { right: 62px; } }
</style>
