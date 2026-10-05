<script setup>
import { tx } from '../composables/useTexts'
import { ref, computed, onMounted } from 'vue'
import { Flame } from 'lucide-vue-next'

// The days I have practised Japanese on the site, as a grid like GitHub's activity (last 26 weeks) + the streak.
const d = ref(null)
onMounted(async () => { try { d.value = await (await fetch('api.php?action=practice_calendar', { cache: 'no-store' })).json() } catch {} })
const WEEKS = 26
const cells = computed(() => {
  const days = d.value?.days || {}
  const today = new Date(); today.setHours(12, 0, 0, 0)
  // columns are weeks starting on Monday; the last column ends today
  const end = new Date(today)
  const dow = (end.getDay() + 6) % 7 // Monday = 0
  const start = new Date(end); start.setDate(end.getDate() - dow - (WEEKS - 1) * 7)
  const out = []
  for (let w = 0; w < WEEKS; w++) {
    const col = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(start); day.setDate(start.getDate() + w * 7 + i)
      const key = day.toISOString().slice(0, 10)
      col.push(day > today ? null : { key, n: days[key] || 0, label: day.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) })
    }
    out.push(col)
  }
  return out
})
const level = (n) => (n === 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : n < 30 ? 3 : 4)
const months = computed(() => cells.value.map((col, i) => { const f = col.find(Boolean); const m = f ? new Date(f.key).toLocaleDateString('nb-NO', { month: 'short' }) : ''; const prev = i ? cells.value[i - 1].find(Boolean) : null; return !prev || (f && new Date(prev.key).getMonth() !== new Date(f.key).getMonth()) ? m : '' }))
</script>

<template>
  <section v-if="d" class="pc">
    <header>
      <b class="label-caps">Øving</b>
      <span v-if="d.streak" class="streak"><Flame :size="14" aria-hidden="true" />{{ d.streak }} {{ d.streak === 1 ? 'dag' : 'dager' }} på rad</span>
      <small v-if="d.best">lengst: {{ d.best }} · {{ d.active }} dager i alt</small>
    </header>
    <div class="grid" role="img" :aria-label="`${d.active} dager med øving de siste 26 ukene`">
      <div class="mo"><span v-for="(m, i) in months" :key="i">{{ m }}</span></div>
      <div class="cols">
        <div v-for="(col, i) in cells" :key="i" class="col"><i v-for="(c, j) in col" :key="j" :class="c ? 'l' + level(c.n) : 'none'" :title="c ? `${c.label}: ${c.n} kort` : ''"></i></div>
      </div>
    </div>
    <p v-if="!d.total" class="note">{{ tx('practice.cal') }}</p>
  </section>
</template>

<style scoped>
.pc { display: grid; gap: 8px; padding: 14px; border-radius: 16px; background: var(--glass-strong); border: 1px solid var(--glass-border); min-width: 0; }
header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
header small { margin-left: auto; color: var(--text-3); }
.streak { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 999px; background: rgba(240, 120, 40, 0.16); color: #d2691a; font: 700 0.76rem var(--font); }
.grid { overflow-x: auto; padding-bottom: 2px; }
.mo, .cols { display: grid; grid-template-columns: repeat(26, minmax(11px, 1fr)); gap: 3px; min-width: 340px; }
.mo { font-size: 0.64rem; color: var(--text-3); height: 14px; margin-bottom: 2px; }
.mo span { white-space: nowrap; overflow: visible; }
.col { display: grid; grid-template-rows: repeat(7, 1fr); gap: 3px; }
.col i { display: block; aspect-ratio: 1; border-radius: 3px; background: var(--accent-soft); }
.col i.none { background: transparent; }
.col i.l1 { background: color-mix(in srgb, var(--accent) 30%, transparent); }
.col i.l2 { background: color-mix(in srgb, var(--accent) 55%, transparent); }
.col i.l3 { background: color-mix(in srgb, var(--accent) 80%, transparent); }
.col i.l4 { background: var(--accent); }
.note { margin: 0; font-size: 0.78rem; color: var(--text-3); }
</style>
