<script setup>
import { tx } from '../composables/useTexts'
import { Plane, X } from 'lucide-vue-next'
import { ref, computed } from 'vue'
import { useData } from '../composables/useData'
import { atlasName, norskNavn } from '../three/countries'
import FlatMap from '../components/FlatMap.vue'
import CountryPicker from '../components/CountryPicker.vue'
import TripCards from '../components/TripCards.vue'

const data = useData()
const selected = ref(null)
const detail = ref(null)

const byCountry = computed(() => {
  const m = new Map()
  for (const r of data.reiser || []) {
    const k = atlasName(r.land)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  for (const l of m.values()) l.sort((a, b) => String(b.dato || b.aar || '').localeCompare(String(a.dato || a.aar || '')))
  return m
})
const visited = computed(() => new Set(byCountry.value.keys()))
const year = (t) => t.aar || (t.dato ? Number(String(t.dato).slice(0, 4)) : null)
const countries = computed(() =>
  [...byCountry.value.entries()]
    .map(([en, trips]) => ({ en, no: norskNavn(en), trips, years: [...new Set(trips.map(year).filter(Boolean))].sort() }))
    .sort((a, b) => (b.years.at(-1) || 0) - (a.years.at(-1) || 0) || a.no.localeCompare(b.no, 'nb')),
)
const trips = computed(() => byCountry.value.get(selected.value) || [])
function select(c) {
  selected.value = c
  if (c) setTimeout(() => detail.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
}
</script>

<template>
  <div class="cpage">
    <header class="cpage-head">
      <div class="eyebrow">{{ tx('travel.eyebrow') }}</div>
      <h1>{{ tx('travel.title') }}</h1>
      <p>{{ countries.length }} land · {{ (data.reiser || []).length }} reiser. Trykk på et land på kartet, eller søk.</p>
    </header>

    <div class="cols" :class="{ picked: !!selected }">
      <div class="glass card mapcard">
        <div class="search"><CountryPicker :highlight="visited" clear-on-pick placeholder="Søk etter et land …" @pick="select" /></div>
        <FlatMap :visited="visited" :selected="selected" @select="select" />
      </div>

      <aside class="glass card">
        <h3>Land jeg har besøkt <small>{{ countries.length }}</small></h3>
        <div class="clist">
          <button v-for="c in countries" :key="c.en" class="row" :class="{ active: c.en === selected }" @click="select(c.en)">
            <span class="pin">{{ c.trips.length }}</span>
            <span class="meta"><span class="name">{{ c.no }}</span><span class="sub">{{ c.years.join(', ') }}</span></span>
          </button>
        </div>
        <div v-if="!countries.length" class="empty">{{ tx('travel.none') }}</div>
      </aside>

      <section ref="detail" class="detail-col" :class="{ card: !!selected, glass: !!selected }">
        <template v-if="selected">
          <div class="dhead">
            <h2>{{ norskNavn(selected) }}</h2>
            <button class="xbtn" aria-label="Lukk" title="Lukk" @click="selected = null"><X :size="18" /></button>
          </div>
          <TripCards v-if="trips.length" :trips="trips" />
          <div v-else class="empty">{{ tx('travel.notyet') }} <Plane :size="16" class="inline-ic" /></div>
        </template>
        <div v-else class="empty big">{{ tx('travel.pick') }}</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* One calm layout: the map on top, the countries as chips under it, the trips below (or – on wide screens with a
   country chosen – the map and the countries on the left, the trips on the right). */
.cols { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-areas: 'map' 'list' 'detail'; gap: 16px; align-items: start; }
.mapcard { grid-area: map; padding: 14px; display: grid; gap: 12px; }
.search { width: min(420px, 100%); }
aside { grid-area: list; padding: 14px 16px 16px; }
aside h3 { margin: 0 0 10px; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); display: flex; align-items: center; gap: 8px; }
aside h3 small { padding: 1px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 0.72rem; letter-spacing: 0; }
.clist { display: flex; flex-wrap: wrap; gap: 8px; }
.clist .row { flex: none; display: inline-flex; align-items: center; gap: 10px; width: auto; margin: 0; padding: 6px 16px 6px 6px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass); cursor: pointer; transition: border-color 0.15s, background 0.15s, transform 0.15s; }
.clist .row:hover { border-color: var(--accent); transform: none; background: var(--accent-soft); }
.clist .row.active { background: var(--accent-soft); border-color: var(--accent); }
.clist .meta { display: grid; line-height: 1.15; text-align: left; }
.clist .name { font-weight: 700; font-size: 0.9rem; }
.clist .sub { font-size: 0.72rem; color: var(--text-3); }
.pin { width: 30px; height: 30px; flex: none; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: 0.78rem; color: #fff; background: linear-gradient(135deg, var(--accent-2), var(--accent)); }
.detail-col { grid-area: detail; scroll-margin-top: 24px; min-height: 120px; }
.detail-col.card { padding: 18px; }
.dhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.xbtn { display: grid; place-items: center; width: 38px; height: 38px; flex: none; padding: 0; border: 0; border-radius: 50%; background: var(--glass-strong); color: var(--text-2); cursor: pointer; transition: color 0.15s, background 0.15s; }
.xbtn:hover { color: var(--accent); background: var(--accent-soft); }
.dhead h2 { font-size: 1.8rem; margin: 0; }
.big { padding: 28px; text-align: center; }
/* wide screens with a country chosen: map + countries on the left (the map stays put), the trips on the right */
@media (min-width: 1100px) {
  .cols.picked { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: 'map detail' 'list detail'; gap: 18px; }
  .cols.picked .mapcard { position: sticky; top: 24px; z-index: 1; }
  .cols.picked aside { position: static; }
  .cols.picked .detail-col { align-self: start; }
}
@media (min-width: 1500px) { .cpage { --page-max: 1560px; } }
@media (max-width: 860px) {
  .mapcard { padding: 8px; }
  aside { padding: 10px; }
  aside h3 { display: none; }
  .clist { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
  .clist::-webkit-scrollbar { display: none; }
  .clist .sub { display: none; }
  .clist .row { padding: 5px 12px 5px 5px; }
  .pin { width: 26px; height: 26px; font-size: 0.72rem; }
  .detail-col.card { padding: 12px; }
  .big { padding: 20px; }
}
</style>
