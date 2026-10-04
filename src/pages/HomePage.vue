<script setup>
import BrandLogo from '../components/BrandLogo.vue'
import { Guitar, Timer, BookOpen, Globe, Code, Hand } from 'lucide-vue-next'
import { computed } from 'vue'
import { useData } from '../composables/useData'
import { atlasName, norskNavn } from '../three/countries'

const data = useData()
const countries = computed(() => new Set((data.reiser || []).map((r) => atlasName(r.land))).size)
const latestTrip = computed(() => (data.reiser || [])[0])
const latestBook = computed(() => (data.boker || [])[0])
const cards = computed(() => [
  { to: '/gitar', title: 'Gitar', text: `${data.gitarer?.length || 0} gitarer og opptak`, icon: Guitar },
  { to: '/ovelse', title: 'Øving', text: 'Intervall-timer for øvingsrunder', icon: Timer },
  { to: '/boker', title: 'Bøker', text: `${data.boker?.length || 0} bøker lest`, icon: BookOpen },
  { to: '/reiser', title: 'Reiser', text: `${countries.value} land besøkt`, icon: Globe },
  { to: '/kode', title: 'Kode', text: `${data.prosjekter?.length || 0} prosjekter`, icon: Code },
  { to: '/om', title: 'Om meg', text: 'Hvem er jeg?', icon: Hand },
])
</script>

<template>
  <div class="cpage">
    <section class="hero">
      <img v-if="data.om?.bilde" :src="data.om.bilde" alt="" class="avatar rise" />
      <div>
        <BrandLogo class="home-logo rise" style="--i: 0" />
        <div class="eyebrow rise" style="--i: 0">{{ data.site?.undertittel || 'Velkommen' }}</div>
        <h1 class="rise" style="--i: 1">Hei, jeg er <span class="grad">{{ data.site?.navn || 'niben' }}</span></h1>
        <p class="lead rise" style="--i: 2">{{ data.site?.intro }}</p>
      </div>
    </section>

    <div class="grid cards">
      <router-link v-for="(c, i) in cards" :key="c.to" :to="c.to" class="tile glass rise" :style="{ '--i': i + 3 }">
        <span class="ic"><component :is="c.icon" :size="22" /></span>
        <b>{{ c.title }}</b>
        <small>{{ c.text }}</small>
      </router-link>
    </div>

    <div v-if="latestTrip || latestBook" class="grid latest">
      <router-link v-if="latestTrip" to="/reiser" class="glass card latest-card">
        <img v-if="latestTrip.bilder?.[0]" :src="latestTrip.bilder[0].src" alt="" />
        <div><small>Siste reise · {{ norskNavn(atlasName(latestTrip.land)) }}</small><b>{{ latestTrip.tittel }}</b></div>
      </router-link>
      <router-link v-if="latestBook" to="/boker" class="glass card latest-card">
        <img v-if="latestBook.omslag" :src="latestBook.omslag" alt="" class="book" />
        <div><small>Leser / lest</small><b>{{ latestBook.tittel }}</b><span>{{ latestBook.forfatter }}</span></div>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: center; gap: 28px; margin: 20px 0 40px; }
.avatar { width: 128px; height: 128px; border-radius: 50%; object-fit: cover; box-shadow: 0 10px 30px var(--accent-glow); border: 4px solid var(--glass-strong); flex: none; }
h1 { font-size: clamp(2.4rem, 6vw, 4rem); font-weight: 800; }
.lead { margin-top: 10px; }
.cards { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 760px) { .cards { grid-template-columns: 1fr 1fr; } }
.tile { display: flex; flex-direction: column; gap: 4px; padding: 22px; border-radius: 24px; color: var(--text); transition: transform 0.45s var(--spring), box-shadow 0.3s; }
.tile:hover { transform: translateY(-5px); box-shadow: inset 0 1px 0 var(--glass-hi), var(--shadow-3); }
.ic { display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 8px; border-radius: 14px; background: var(--accent-soft); color: var(--accent); }
.tile b { font: 700 1.25rem var(--font-display); }
.tile small { color: var(--text-2); }
.latest { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); margin-top: 18px; }
.latest-card { display: flex; gap: 16px; align-items: center; color: var(--text); padding: 14px; transition: transform 0.4s var(--spring); }
.latest-card:hover { transform: translateY(-3px); }
.latest-card img { width: 110px; height: 80px; object-fit: cover; border-radius: 14px; }
.latest-card img.book { width: 56px; height: 84px; border-radius: 6px; }
.latest-card div { display: flex; flex-direction: column; }
.latest-card small { color: var(--accent); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; }
.latest-card b { font-size: 1.1rem; }
.latest-card span { color: var(--text-2); font-size: 0.9rem; }
@media (max-width: 720px) { .hero { flex-direction: column; align-items: flex-start; gap: 16px; } .avatar { width: 96px; height: 96px; } }
.home-logo { height: 64px; margin-bottom: 16px; }
</style>
