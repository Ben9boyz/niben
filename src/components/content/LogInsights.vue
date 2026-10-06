<script setup lang="ts">
import { computed } from 'vue'
import type { Entry } from '@/composables/room/useModules'

// What a log says when it is looked at from a little way off: the streak, this week against the goal, a year-ish of days as
// a calendar of squares (the darker, the more), and the records.
const props = defineProps<{ items: Entry[]; field?: string; unit: string; goal: number; color: string }>()

const day = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const val = (e: Entry): number => (props.field ? Number(e[props.field]) || 0 : 1)
const byDay = computed(() => {
  const m = new Map<string, number>()
  for (const e of props.items) { const d = String(e.date ?? ''); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) m.set(d, (m.get(d) ?? 0) + (props.field ? val(e) : 1)) }
  return m
})
const streak = computed(() => {
  const d = new Date()
  if (!byDay.value.has(day(d))) d.setDate(d.getDate() - 1) // (today may still be to come)
  let n = 0
  while (byDay.value.has(day(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
})
const longest = computed(() => {
  const days = [...byDay.value.keys()].sort()
  let best = 0, run = 0, prev = 0
  for (const d of days) {
    const t = Date.parse(d + 'T12:00:00')
    run = prev && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = t
  }
  return best
})
const week = computed(() => {
  const now = new Date()
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const start = day(mon)
  let sum = 0
  for (const [d, v] of byDay.value) if (d >= start) sum += v
  return Math.round(sum * 10) / 10
})
const pct = computed(() => (props.goal > 0 ? Math.min(100, Math.round((week.value / props.goal) * 100)) : 0))
const WEEKS = 18
const cells = computed(() => {
  const max = Math.max(1, ...byDay.value.values())
  const now = new Date()
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) - (WEEKS - 1) * 7)
  const out: { d: string; a: number; v: number }[] = []
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i)
    const k = day(d)
    const v = byDay.value.get(k) ?? 0
    out.push({ d: k, v, a: d > now ? -1 : v ? 0.25 + 0.75 * (v / max) : 0 })
  }
  return out
})
const best = computed(() => (props.field ? Math.max(0, ...props.items.map(val)) : 0))
const total = computed(() => Math.round(props.items.reduce((s, e) => s + val(e), 0) * 10) / 10)
const fmt = (n: number): string => String(n).replace('.', ',')
</script>

<template>
  <section class="ins" :style="{ '--mc': color }">
    <div class="kpis">
      <span><b>{{ streak }}</b>dager på rad<small v-if="longest > streak">best {{ longest }}</small></span>
      <span v-if="field"><b>{{ fmt(total) }}</b>{{ unit }} totalt</span>
      <span v-if="field && best"><b>{{ fmt(best) }}</b>lengste</span>
      <span v-if="goal > 0" class="goal">
        <svg viewBox="0 0 36 36" width="54" height="54" aria-hidden="true"><circle cx="18" cy="18" r="15" class="bg" /><circle cx="18" cy="18" r="15" class="fg" :stroke-dasharray="`${(pct / 100) * 94.2} 94.2`" /></svg>
        <em>{{ fmt(week) }} / {{ fmt(goal) }}</em>ukemål
      </span>
    </div>
    <div class="cal" role="img" :aria-label="`Aktivitet de siste ${WEEKS} ukene`">
      <i v-for="c in cells" :key="c.d" :class="{ future: c.a < 0 }" :style="c.a > 0 ? { background: color, opacity: c.a } : undefined" :title="c.v ? `${c.d}: ${fmt(Math.round(c.v * 10) / 10)}` : c.d"></i>
    </div>
  </section>
</template>

<style scoped>
.ins { display: flex; flex-direction: column; gap: 12px; padding: 14px; border-radius: 16px; background: color-mix(in srgb, var(--mc) 8%, transparent); }
.kpis { display: flex; gap: 22px; flex-wrap: wrap; align-items: center; }
.kpis span { display: flex; flex-direction: column; font-size: 0.78rem; color: var(--text-3); }
.kpis b { font-size: 1.6rem; color: var(--text); line-height: 1.1; } .kpis small { color: var(--mc); }
.goal { align-items: center; position: relative; } .goal em { font-style: normal; color: var(--text); font-weight: 700; font-size: 0.82rem; }
.goal svg { transform: rotate(-90deg); } .goal circle { fill: none; stroke-width: 4; } .goal .bg { stroke: color-mix(in srgb, var(--mc) 20%, transparent); } .goal .fg { stroke: var(--mc); stroke-linecap: round; transition: stroke-dasharray 0.6s var(--spring, ease); }
.cal { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 1fr); gap: 3px; }
.cal i { aspect-ratio: 1; border-radius: 3px; background: color-mix(in srgb, var(--text) 8%, transparent); min-width: 8px; }
.cal i.future { visibility: hidden; }
</style>
