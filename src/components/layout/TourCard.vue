<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { room } from '@/composables/room/useRoom'
import { admin } from '@/composables/site/useAdmin'
import { decor } from '@/composables/room/useDecor'
import { tx } from '@/composables/site/useTexts'
import { tour, steps, current, tourDone, startTour, nextStep, endTour } from '@/composables/useTour'

// A small, quiet card at the bottom: what's here, "Neste" and "Hopp over". Only the very first time somebody opens the 3D room
// (it remembers, and never comes back). Not for me (when I'm logged in), not in the admin pages.
const route = useRoute()
const router = useRouter()
const phone = window.matchMedia('(max-width: 900px)')
const total = computed(() => steps.value.length)
const last = computed(() => tour.step === total.value - 1)

let timer: ReturnType<typeof setTimeout> | undefined
function maybeStart() {
  clearTimeout(timer)
  if (tour.active || tourDone() || !room.ready || route.name !== 'hjem') return
  let me = false
  try { me = localStorage.getItem('niben-me') === '1' } catch {}
  if (me || admin.loggedIn) return
  timer = setTimeout(() => { if (!tour.active && !tourDone() && route.name === 'hjem' && !decor.editing) startTour(phone.matches) }, 3500)
}
watch(() => room.ready, maybeStart)
onMounted(maybeStart)
onBeforeUnmount(() => clearTimeout(timer))

// the camera follows the steps (desktop)
watch(() => [tour.active, tour.step], () => {
  const s = current.value
  if (tour.active && s?.route && route.path !== s.route) router.push(s.route)
})
function skip() {
  endTour()
  if (!tour.phone && route.name !== 'hjem') router.push('/')
}
function next() {
  if (last.value) { endTour(); if (!tour.phone && route.name !== 'hjem') router.push('/'); return }
  nextStep()
}
const onKey = (e: KeyboardEvent) => { if (tour.active && e.key === 'Escape') skip() }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <transition name="tour">
    <aside v-if="tour.active && current" class="tour glass" role="dialog" aria-live="polite" aria-label="Omvisning">
      <b>{{ tx(`tour.${current.n}.t`) }}</b>
      <p>{{ tx(`tour.${current.n}.b`) }}</p>
      <div class="row">
        <span class="dots" aria-hidden="true"><i v-for="i in total" :key="i" :class="{ on: i - 1 === tour.step }"></i></span>
        <button class="skip" @click="skip">{{ tx('tour.skip') }}</button>
        <button class="next" @click="next">{{ last ? tx('tour.done') : tx('tour.next') }}</button>
      </div>
    </aside>
  </transition>
</template>

<style scoped>
.tour { position: fixed; z-index: 45; left: calc(var(--rail, 0px) + 18px); bottom: 18px; width: min(330px, calc(100vw - 36px)); display: grid; gap: 6px; padding: 14px 16px 12px; border-radius: 18px; }
.tour b { font-size: 0.95rem; }
.tour p { margin: 0; font-size: 0.84rem; line-height: 1.45; color: var(--text-2); }
.row { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.dots { display: inline-flex; gap: 4px; margin-right: auto; }
.dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--glass-border); }
.dots i.on { background: var(--accent); width: 14px; border-radius: 3px; }
.skip { border: 0; background: transparent; color: var(--text-3); font: 600 0.78rem var(--font); cursor: pointer; padding: 6px 4px; }
.skip:hover { color: var(--text); }
.next { border: 0; border-radius: 999px; background: var(--accent); color: #fff; font: 700 0.8rem var(--font); padding: 7px 16px; cursor: pointer; }
.tour-enter-active, .tour-leave-active { transition: opacity 0.35s, transform 0.35s var(--spring, ease); }
.tour-enter-from, .tour-leave-to { opacity: 0; transform: translateY(10px); }
@media (max-width: 900px) { .tour { left: 12px; right: 12px; width: auto; bottom: calc(14px + env(safe-area-inset-bottom)); } }
</style>
