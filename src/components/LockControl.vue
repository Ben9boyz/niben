<script setup lang="ts">
import { errorMessage } from '../composables/useAdmin'
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Lock, LockOpen } from 'lucide-vue-next'
import { spotify, lockLeft, fmtClock, fmtLock, setLockSeconds } from '../composables/useSpotify'
import { targetEl } from '../lib/dom'

// The lock length setting (admin): a pill with the length / countdown, or – `tiny` – just a small
// round icon for the 3D views (the held record, the iPod). The menu floats above everything.
defineProps<{ tiny?: boolean }>()

const CHOICES = [0, 5, 10, 15, 30, 60].map((m) => m * 60)
const open = ref(false)
const msg = ref('')
const locked = computed(() => lockLeft.value > 0)
const label = computed(() => (spotify.lockSeconds > 0 ? fmtLock(spotify.lockSeconds) : 'Av'))
const btn = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const pos = ref<Record<string, string>>({})

async function toggle() {
  msg.value = ''
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  // below the button, kept on screen (above it if there's no room)
  const r = btn.value?.getBoundingClientRect()
  if (!r) return
  const w = 220
  const h = menu.value?.offsetHeight || 150
  const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8)
  const top = r.bottom + 6 + h > window.innerHeight - 8 ? Math.max(8, r.top - 6 - h) : r.bottom + 6
  pos.value = { left: `${left}px`, top: `${top}px` }
}
async function choose(sec: number) {
  if (locked.value) return
  try {
    await setLockSeconds(sec)
    open.value = false
  } catch (e) {
    msg.value = errorMessage(e)
  }
}
function onDocDown(e: Event) {
  if (open.value && !btn.value?.contains(targetEl(e)) && !menu.value?.contains(targetEl(e))) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', onDocDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocDown))
</script>

<template>
  <button
    ref="btn"
    class="lockbtn"
    :class="{ tiny, off: !spotify.lockSeconds, active: locked }"
    :title="locked ? `Låst ${fmtClock(lockLeft)} – kan endres når låsen går ut` : `Låsetid: ${label}`"
    :aria-label="`Låsetid: ${label}`"
    @click.stop="toggle"
  >
    <Lock v-if="locked || spotify.lockSeconds" :size="tiny ? 11 : 12" aria-hidden="true" /><LockOpen v-else :size="tiny ? 11 : 12" aria-hidden="true" />
    <template v-if="!tiny">{{ locked ? fmtClock(lockLeft) : label }}</template>
  </button>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="open" ref="menu" class="lockmenu glass" :style="pos" @click.stop>
        <b>Lås etter avspilling</b>
        <p v-if="locked" class="lm-note">Låsen er på nå. Du kan endre den om {{ fmtClock(lockLeft) }}.</p>
        <div class="chips pills">
          <button v-for="s in CHOICES" :key="s" :class="{ on: s === spotify.lockSeconds }" :disabled="locked" @click="choose(s)">{{ s ? fmtLock(s) : 'Av' }}</button>
        </div>
        <p v-if="msg" class="lm-err">{{ msg }}</p>
        <p v-else class="lm-note">Låser bytting og hopping i låten. Pause virker alltid. Gjelder fra neste gang noe startes.</p>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.lockbtn { display: flex; align-items: center; gap: 4px; flex: none; padding: 2px 8px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass); color: var(--text-2); font: 600 0.68rem var(--font); cursor: pointer; }
.lockbtn:hover { color: var(--accent); border-color: var(--accent); }
.lockbtn.off { color: var(--text-3); }
.lockbtn.active { color: #b8711a; border-color: rgba(240, 160, 64, 0.5); }
.lockbtn.tiny { justify-content: center; width: 22px; height: 22px; padding: 0; opacity: 0.55; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); transition: opacity 0.2s; }
.lockbtn.tiny:hover, .lockbtn.tiny.active { opacity: 1; }
.lockmenu { position: fixed; z-index: 60; width: 220px; padding: 12px; border-radius: 14px; background: var(--bg, #fff); box-shadow: var(--shadow-2, 0 12px 30px rgba(0, 0, 0, 0.2)); display: grid; gap: 8px; color: var(--text); text-align: left; }
.lockmenu > b { font-size: 0.78rem; }
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
.lm-note { font-size: 0.72rem; color: var(--text-3); margin: 0; }
.lm-err { font-size: 0.72rem; color: #d24b4b; margin: 0; }
</style>
