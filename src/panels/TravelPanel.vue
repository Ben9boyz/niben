<script setup lang="ts">
import { tx } from '../composables/useTexts'
import { Plane } from 'lucide-vue-next'
import { computed } from 'vue'
import { useData, type Trip } from '../composables/useData'
import { room } from '../composables/useRoom'
import { atlasName, norskNavn } from '../three/countries'
import CountryPicker from '@/components/content/CountryPicker.vue'
import TripCards from '@/components/content/TripCards.vue'

const data = useData()
const byCountry = computed(() => {
  const m = new Map<string, Trip[]>()
  for (const r of data.reiser || []) {
    const key = atlasName(r.land)
    if (!key) continue
    const list = m.get(key)
    if (list) list.push(r)
    else m.set(key, [r])
  }
  for (const list of m.values()) list.sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
  return m
})
const visited = computed(() => new Set(byCountry.value.keys()))
const countries = computed(() =>
  [...byCountry.value.entries()]
    .map(([en, trips]) => ({ en, no: norskNavn(en), trips, years: [...new Set(trips.map(year).filter((y): y is number => !!y))].sort() }))
    .sort((a, b) => (b.years.at(-1) || 0) - (a.years.at(-1) || 0) || a.no.localeCompare(b.no, 'nb')),
)
const trips = computed(() => (room.sel.land ? byCountry.value.get(room.sel.land) : undefined) || [])
const totalPhotos = computed(() => (data.reiser || []).reduce((n, t) => n + (t.bilder?.length || 0), 0))

const pickCountry = (c: string) => { room.sel.land = c }
function sortKey(t: Trip) { return String(t.dato || t.aar || '') }
function year(t: Trip) { return t.aar || (t.dato ? Number(String(t.dato).slice(0, 4)) : null) }
const yearsLabel = (ys: number[]) => (ys.length > 3 ? `${ys[0]}–${ys.at(-1)}` : ys.join(', '))

</script>

<template>
  <section class="panel glass">
    <header class="panel-head">
      <div class="eyebrow">{{ tx('travel.eyebrow') }}</div>
      <h2>{{ room.sel.land ? norskNavn(room.sel.land) : tx('travel.title') }}</h2>
      <p v-if="!room.sel.land">{{ countries.length }} land · {{ (data.reiser || []).length }} reiser<template v-if="totalPhotos"> · {{ totalPhotos }} bilder</template></p>
    </header>

    <div v-if="!room.sel.land" class="search">
      <CountryPicker :highlight="visited" clear-on-pick placeholder="Søk etter et land …" @pick="pickCountry" />
    </div>

    <div class="panel-body">
      <transition name="fade" mode="out-in">
        <div v-if="room.sel.land" :key="room.sel.land" class="detail">
          <button class="back" @click="room.sel.land = null">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 6l-6 6 6 6" /></svg>
            Alle land
          </button>
          <div v-if="!trips.length" class="empty">Ikke vært her ennå – kanskje neste tur? <Plane :size="16" class="inline-ic" /></div>
          <TripCards :trips="trips" />
        </div>

        <div v-else class="list" key="list">
          <button v-for="(c, i) in countries" :key="c.en" class="row" :style="{ '--i': i }" @click="room.sel.land = c.en">
            <span class="pin">{{ c.trips.length }}</span>
            <span class="meta">
              <span class="name">{{ c.no }}</span>
              <span class="sub">{{ yearsLabel(c.years) }}<template v-if="c.years.length"> · </template>{{ c.trips.map((t) => t.tittel).join(' · ') }}</span>
            </span>
            <svg class="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <div v-if="!countries.length" class="empty">Ingen reiser lagt inn ennå.</div>
        </div>
      </transition>
    </div>

  </section>
</template>

<style scoped>
.search { padding: 0 20px 10px; }
.pin {
  width: 36px; height: 36px; flex: none; border-radius: 50%; display: grid; place-items: center;
  font-weight: 700; font-size: 0.85rem; color: #fff;
  background: linear-gradient(135deg, var(--accent-2), var(--accent)); box-shadow: 0 4px 12px var(--accent-glow);
}
</style>
