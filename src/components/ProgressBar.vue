<script setup lang="ts">
import { computed } from 'vue'
import { spotify, lockLeft, progressMs, fmtClock, control, notify } from '../composables/useSpotify'
import { admin } from '../composables/useAdmin'

// The progress bar with the times – shared by the "now playing" card and the player bar. Click to jump
// (admin; locked like switching). 'below': times under the bar · 'sides': times left and right of it.
withDefaults(defineProps<{ layout?: 'below' | 'sides' }>(), { layout: 'below' })
const now = computed(() => spotify.now)
const locked = computed(() => lockLeft.value > 0)
const pct = computed(() => (now.value?.duration_ms ? (progressMs.value / now.value?.duration_ms) * 100 : 0))
const canSeek = computed(() => admin.loggedIn && !!now.value?.duration_ms && !locked.value)

async function seek(e: MouseEvent) {
  const dur = now.value?.duration_ms
  if (!canSeek.value || !dur) return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const res = await control('seek', Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur)
  if (!res.ok && res.error) notify(res.error, true)
}
</script>

<template>
  <div v-if="now?.duration_ms" class="pb" :class="layout">
    <span class="t0">{{ fmtClock(progressMs / 1000) }}</span>
    <div class="bar" :class="{ seekable: canSeek }" :title="admin.loggedIn && locked ? 'Låst – hør ferdig' : undefined" @click="seek"><i :style="{ width: `${pct}%` }"></i></div>
    <span class="t1">{{ fmtClock(now.duration_ms / 1000) }}</span>
  </div>
</template>

<style scoped>
.pb { display: grid; align-items: center; width: 100%; font-size: 0.7rem; color: var(--text-3); font-variant-numeric: tabular-nums; }
.pb.sides { grid-template-columns: 40px minmax(0, 1fr) 40px; gap: 8px; }
.pb.sides .t0 { text-align: right; }
.pb.below { grid-template-columns: 1fr 1fr; grid-template-areas: 'bar bar' 't0 t1'; margin-top: 7px; row-gap: 2px; }
.pb.below .bar { grid-area: bar; }
.pb.below .t0 { grid-area: t0; }
.pb.below .t1 { grid-area: t1; text-align: right; }
.bar { position: relative; height: 4px; border-radius: 4px; background: var(--accent-soft); overflow: hidden; transition: height 0.15s; }
.bar i { display: block; height: 100%; background: var(--accent); transition: width 1s linear; }
.bar.seekable { cursor: pointer; }
.bar.seekable:hover { height: 6px; }
.bar.seekable:hover i { background: #1db954; }
.bar.seekable::before { content: ''; position: absolute; inset: -8px 0; } /* a bigger click target */
</style>
