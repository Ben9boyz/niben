<script setup lang="ts">
import { computed, ref } from 'vue'
import { Shuffle, Droplets, Star, Check, Medal, UtensilsCrossed } from 'lucide-vue-next'
import type { ModuleKind } from '@/lib/modules/catalog'
import type { Entry } from '@/composables/room/useModules'

// What a hobby says about itself once there is something in it – each part shows up only where the fields make it make sense:
// a status board (how many want / doing / done), a random pick among the ones you still want to see / make / try, the spread of
// stars, wins and losses, plants that need water now, and what the wish list adds up to.
const props = defineProps<{ kind: ModuleKind; items: { e: Entry; i: number }[]; mine: boolean; status: string }>()
const emit = defineEmits<{ status: [value: string]; open: [i: number, e: Entry]; water: [i: number] }>()

const today = (): string => new Date().toISOString().slice(0, 10)
const statusField = computed(() => props.kind.fields.find((f) => f.k === 'status' && f.kind === 'select'))
const board = computed(() => {
  const f = statusField.value
  if (!f?.options || !props.items.length) return null
  const rows = f.options.map((o) => ({ o, n: props.items.filter(({ e }) => e.status === o).length }))
  return rows.some((r) => r.n) ? rows : null
})
const TONES = ['#8a94a3', 'var(--mc)', '#2fa84f', '#d9480f', '#6b7280']

// a random pick among the ones still waiting ("Vil se", "Vil lage", "Vil prøve" …: the first state)
const want = computed(() => statusField.value?.options?.[0] ?? '')
const waiting = computed(() => props.items.filter(({ e }) => e.status === want.value))
const picked = ref<{ e: Entry; i: number } | null>(null)
let spins = 0
function pick(): void {
  const l = waiting.value
  if (!l.length) return
  spins = 0
  const step = (): void => { // (a few quick flips before it settles – a little drumroll)
    picked.value = l[Math.floor(Math.random() * l.length)] ?? null
    if (++spins < 9 && l.length > 1) setTimeout(step, 60 + spins * 25)
  }
  step()
}

const ratingField = computed(() => props.kind.fields.some((f) => f.kind === 'rating'))
const stars = computed(() => {
  if (!ratingField.value) return null
  const r = props.items.map(({ e }) => Math.round(Number(e.rating) || 0)).filter((n) => n > 0)
  if (r.length < 2) return null
  const counts = [5, 4, 3, 2, 1].map((n) => ({ n, c: r.filter((x) => x === n).length }))
  return { avg: (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1).replace('.', ','), max: Math.max(...counts.map((c) => c.c)), counts }
})

const results = computed(() => {
  const f = props.kind.fields.find((x) => x.k === 'res' && x.kind === 'select')
  if (!f?.options) return null
  const all = props.items.filter(({ e }) => e.res)
  if (!all.length) return null
  return { total: all.length, parts: f.options.map((o, k) => ({ o, n: all.filter(({ e }) => e.res === o).length, c: ['#2fa84f', '#8a94a3', '#e5484d'][k] ?? '#999' })) }
})

// plants: the last watering + every how many days → which ones are thirsty now
const thirsty = computed(() => {
  if (!props.kind.fields.some((f) => f.k === 'dager') || !props.kind.fields.some((f) => f.k === 'date')) return []
  const now = Date.parse(today())
  return props.items.filter(({ e }) => {
    const last = Date.parse(String(e.date ?? '')), every = Number(e.dager)
    return Number.isFinite(last) && every > 0 && now - last >= every * 86400000
  })
})

// a wish list: what the ones not yet got add up to
const sum = computed(() => {
  if (!props.kind.fields.some((f) => f.k === 'pris' && f.kind === 'number')) return null
  const left = props.items.filter(({ e }) => !e.done && Number(e.pris) > 0)
  return left.length ? { n: left.length, kr: left.reduce((s, { e }) => s + Number(e.pris), 0) } : null
})
// the three best (a podium: gold in the middle)
const podium = computed(() => {
  if (!ratingField.value) return null
  const best = [...props.items].filter(({ e }) => Number(e.rating) >= 4).sort((a, b) => Number(b.e.rating) - Number(a.e.rating) || String(b.e.date ?? '').localeCompare(String(a.e.date ?? ''))).slice(0, 3)
  return best.length === 3 ? [best[1]!, best[0]!, best[2]!] : null
})

// this year, month by month (for anything with a date that is not a log – a log has its own calendar)
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
const year = computed(() => {
  if (props.kind.layout === 'log' || !props.kind.fields.some((f) => f.kind === 'date')) return null
  const y = String(new Date().getFullYear())
  const dated = props.items.filter(({ e }) => String(e.date ?? '').startsWith(y))
  if (dated.length < 2) return null
  const per = MONTHS.map((m, k) => ({ m, n: dated.filter(({ e }) => Number(String(e.date).slice(5, 7)) === k + 1).length }))
  return { y, total: dated.length, per, max: Math.max(...per.map((p) => p.n)) }
})

// recipes: a week of dinners from the ones you like (favourites first)
const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
const menu = ref<{ d: string; e: Entry; i: number }[] | null>(null)
const canMenu = computed(() => props.kind.id === 'oppskrifter' && props.items.filter(({ e }) => e.status === 'Favoritt' || e.status === 'Laget').length >= 3)
function makeMenu(): void {
  const fav = props.items.filter(({ e }) => e.status === 'Favoritt'), made = props.items.filter(({ e }) => e.status === 'Laget')
  const pool = [...fav, ...fav, ...made] // (favourites twice as likely)
  const out: { d: string; e: Entry; i: number }[] = []
  const used = new Set<number>()
  for (const d of DAYS) {
    const free = pool.filter((x) => !used.has(x.i))
    const p = (free.length ? free : pool)[Math.floor(Math.random() * (free.length || pool.length))]
    if (!p) break
    used.add(p.i)
    out.push({ d, e: p.e, i: p.i })
  }
  menu.value = out
}
const kr = (n: number): string => new Intl.NumberFormat('nb-NO').format(Math.round(n)) + ' kr'
const title = (e: Entry): string => String(e.t ?? '–')
</script>

<template>
  <div v-if="board || (waiting.length && want) || stars || results || thirsty.length || sum || podium || year || canMenu" class="ex">
    <div v-if="board" class="board" role="group" aria-label="Status">
      <button v-for="(r, k) in board" :key="r.o" :class="{ on: status === r.o }" :style="{ '--tone': TONES[k] }" @click="emit('status', status === r.o ? '' : r.o)"><b>{{ r.n }}</b>{{ r.o }}</button>
    </div>
    <div v-if="board" class="pipe" aria-hidden="true"><i v-for="(r, k) in board" :key="r.o" :style="{ flex: r.n, background: TONES[k] }"></i></div>

    <div v-if="waiting.length && want" class="pick">
      <button class="btn soft small" @click="pick"><Shuffle :size="14" />Trekk en tilfeldig «{{ want }}»</button>
      <button v-if="picked" class="won" @click="emit('open', picked.i, picked.e)">{{ title(picked.e) }}</button>
    </div>

    <div v-if="stars" class="stars">
      <span class="avg"><b>{{ stars.avg }} <Star :size="18" class="fs" /></b>i snitt</span>
      <div class="bars"><span v-for="c in stars.counts" :key="c.n"><small>{{ c.n }} <Star :size="10" class="fs" /></small><i><u :style="{ width: (c.c / stars.max) * 100 + '%' }"></u></i><small>{{ c.c }}</small></span></div>
    </div>

    <div v-if="results" class="res">
      <div class="rbar"><i v-for="p in results.parts" :key="p.o" :style="{ flex: p.n, background: p.c }" :title="`${p.o}: ${p.n}`"></i></div>
      <span v-for="p in results.parts" :key="p.o"><b :style="{ color: p.c }">{{ p.n }}</b> {{ p.o.toLowerCase() }} <small>({{ Math.round((p.n / results.total) * 100) }} %)</small></span>
    </div>

    <div v-if="thirsty.length" class="thirst">
      <Droplets :size="16" /><span>Trenger vann nå: </span>
      <template v-for="t in thirsty" :key="t.i"><button v-if="mine" class="water" :title="`Vannet ${title(t.e)} i dag`" @click="emit('water', t.i)">{{ title(t.e) }} <Check :size="12" /></button><b v-else>{{ title(t.e) }}</b></template>
    </div>

    <div v-if="podium" class="podium" aria-label="Topp tre">
      <button v-for="(p, k) in podium" :key="p.i" :class="'p' + k" @click="emit('open', p.i, p.e)"><Medal class="medal" :size="26" :style="{ color: ['#a8b2bd', '#f5a524', '#c98a4b'][k] }" aria-hidden="true" /><b>{{ title(p.e) }}</b><i></i></button>
    </div>

    <div v-if="year" class="year">
      <small>{{ year.total }} i {{ year.y }}</small>
      <div class="months"><span v-for="p in year.per" :key="p.m" :title="`${p.m}: ${p.n}`"><i :style="{ height: (p.n / Math.max(1, year.max)) * 100 + '%' }"></i><small>{{ p.m[0] }}</small></span></div>
    </div>

    <div v-if="canMenu" class="menu">
      <button class="btn soft small" @click="makeMenu"><UtensilsCrossed :size="14" />{{ menu ? 'Ny ukesmeny' : 'Foreslå ukesmeny' }}</button>
      <ol v-if="menu"><li v-for="m in menu" :key="m.d"><small>{{ m.d }}</small><button @click="emit('open', m.i, m.e)">{{ title(m.e) }}</button></li></ol>
    </div>

    <div v-if="sum" class="sum"><b>{{ kr(sum.kr) }}</b> for {{ sum.n }} ønsker som gjenstår</div>
  </div>
</template>

<style scoped>
.ex { display: flex; flex-direction: column; gap: 12px; }
.board { display: flex; gap: 8px; flex-wrap: wrap; }
.board button { all: unset; cursor: pointer; display: flex; flex-direction: column; min-width: 72px; padding: 10px 14px; border-radius: 16px; font-size: 0.78rem; color: var(--text-3); background: var(--sk-key, transparent); box-shadow: var(--sk-key-sh, inset 0 0 0 1px var(--glass-border)); transition: transform 0.12s; }
.board button:active { transform: translateY(1px); }
.board b { font-size: 1.4rem; color: var(--tone); }
.board button.on { background: var(--sk-sunk, color-mix(in srgb, var(--tone) 12%, transparent)); box-shadow: var(--sk-sunk-sh, inset 0 0 0 1px var(--tone)), inset 0 -3px 0 var(--tone); }
.pipe, .rbar { display: flex; height: 8px; border-radius: 99px; overflow: hidden; gap: 2px; }
.pick { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pick .btn { display: inline-flex; gap: 6px; align-items: center; }
.won { all: unset; cursor: pointer; font-weight: 800; padding: 6px 12px; border-radius: 999px; background: var(--mc); color: #fff; animation: pop 0.35s var(--spring, ease); }
@keyframes pop { from { transform: scale(0.85); opacity: 0.4; } }
.stars { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
.avg { display: flex; flex-direction: column; font-size: 0.78rem; color: var(--text-3); } .avg b { font-size: 1.6rem; color: #f5a524; }
.bars { display: grid; gap: 3px; flex: 1; min-width: 160px; }
.bars span { display: grid; grid-template-columns: 28px 1fr 24px; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--text-3); }
.bars i { height: 7px; border-radius: 99px; background: color-mix(in srgb, #f5a524 15%, transparent); overflow: hidden; } .bars u { display: block; height: 100%; background: #f5a524; border-radius: 99px; }
.res { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; font-size: 0.85rem; } .res .rbar { flex-basis: 100%; height: 10px; }
.thirst { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, #2b9fd8 12%, transparent); color: #2b7fb0; font-size: 0.88rem; }
.water { all: unset; cursor: pointer; padding: 3px 10px; border-radius: 999px; background: #2b9fd8; color: #fff; font-weight: 700; font-size: 0.8rem; }
.sum { font-size: 0.9rem; color: var(--text-3); } .sum b { color: var(--text); font-size: 1.1rem; }
.podium { display: grid; grid-template-columns: 1fr 1.15fr 1fr; align-items: end; gap: 8px; max-width: 420px; }
.podium button { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; font-size: 0.82rem; }
.podium b { overflow-wrap: anywhere; }
.fs { fill: #f5a524; color: #f5a524; vertical-align: -2px; }
.menu .btn, .water { display: inline-flex; align-items: center; gap: 4px; }
.podium i { display: block; width: 100%; border-radius: 10px 10px 0 0; background: color-mix(in srgb, var(--mc) 30%, transparent); }
.podium .p0 i { height: 46px; } .podium .p1 i { height: 70px; background: var(--mc); } .podium .p2 i { height: 30px; }
.year small { color: var(--text-3); font-size: 0.78rem; }
.months { display: grid; grid-template-columns: repeat(12, 1fr); gap: 4px; height: 64px; margin-top: 4px; }
.months span { display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 2px; }
.months i { display: block; width: 100%; min-height: 2px; border-radius: 3px 3px 0 0; background: var(--mc); }
.menu ol { list-style: none; margin: 8px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; }
.menu li { display: flex; flex-direction: column; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--glass-border); }
.menu li small { color: var(--text-3); font-size: 0.72rem; } .menu li button { all: unset; cursor: pointer; font-weight: 700; overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) { .won { animation: none; } }
</style>
