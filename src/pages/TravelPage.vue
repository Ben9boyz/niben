<script setup>
import { Plane } from 'lucide-vue-next'
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
      <div class="eyebrow">Reiser</div>
      <h1>Verden</h1>
      <p>{{ countries.length }} land · {{ (data.reiser || []).length }} reiser. Trykk på et land på kartet, eller søk.</p>
    </header>

    <div class="glass card mapcard">
      <FlatMap :visited="visited" :selected="selected" @select="select" />
      <div class="search"><CountryPicker :highlight="visited" clear-on-pick placeholder="Søk etter et land …" @pick="select" /></div>
    </div>

    <div class="cols">
      <aside class="glass card">
        <h3>Land jeg har besøkt</h3>
        <button v-for="c in countries" :key="c.en" class="row" :class="{ active: c.en === selected }" @click="select(c.en)">
          <span class="pin">{{ c.trips.length }}</span>
          <span class="meta"><span class="name">{{ c.no }}</span><span class="sub">{{ c.years.join(', ') }}</span></span>
        </button>
        <div v-if="!countries.length" class="empty">Ingen reiser ennå.</div>
      </aside>

      <section ref="detail" class="detail-col">
        <template v-if="selected">
          <div class="dhead">
            <h2>{{ norskNavn(selected) }}</h2>
            <button class="btn small" @click="selected = null">Lukk</button>
          </div>
          <TripCards v-if="trips.length" :trips="trips" />
          <div v-else class="empty">Ikke vært her ennå – kanskje neste tur? <Plane :size="16" class="inline-ic" /></div>
        </template>
        <div v-else class="empty big">Velg et land for å se reisene og bildene.</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.mapcard { padding: 14px; margin-bottom: 18px; }
.search { max-width: 380px; margin: 10px auto 0; }
.cols { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 18px; align-items: start; }
aside { position: sticky; top: 96px; max-height: calc(100vh - 120px); overflow-y: auto; padding: 14px; }
aside h3 { margin: 4px 8px 10px; font-size: 1rem; }
.pin { width: 32px; height: 32px; flex: none; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: 0.8rem; color: #fff; background: linear-gradient(135deg, var(--accent-2), var(--accent)); }
.detail-col { scroll-margin-top: 96px; }
.dhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.dhead h2 { font-size: 1.8rem; }
.big { padding: 40px; }
@media (max-width: 860px) { .cols { grid-template-columns: 1fr; } aside { position: static; max-height: none; } }
</style>
