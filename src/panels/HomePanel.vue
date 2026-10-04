<script setup>
import BrandLogo from '../components/BrandLogo.vue'
import { computed } from 'vue'
import { useData } from '../composables/useData'
import { atlasName } from '../three/countries'

const data = useData()
const countries = computed(() => new Set((data.reiser || []).map((r) => atlasName(r.land))).size)
const stops = computed(() => [
  { to: '/gitar', label: 'Gitarer', n: data.gitarer?.length || 0 },
  { to: '/boker', label: 'Bøker', n: data.boker?.length || 0 },
  { to: '/reiser', label: 'Land', n: countries.value },
  { to: '/kode', label: 'Prosjekter', n: data.prosjekter?.length || 0 },
])
</script>

<template>
  <section class="hero glass">
    <BrandLogo class="home-logo rise" style="--i: 0" />
    <div class="eyebrow rise" style="--i: 0">{{ data.site?.undertittel || 'Velkommen inn' }}</div>
    <h1 class="rise" style="--i: 1">Hei, jeg er <span class="grad">{{ data.site?.navn || 'niben' }}</span></h1>
    <p class="lead rise" style="--i: 2">{{ data.site?.intro }}</p>
    <div class="stops">
      <router-link v-for="(s, i) in stops" :key="s.to" :to="s.to" class="stop rise" :style="{ '--i': i + 3 }">
        <b>{{ s.n }}</b>
        <span>{{ s.label }}</span>
      </router-link>
    </div>
    <p class="tap rise" style="--i: 8">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V5a2 2 0 0 1 4 0v6m0-1a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3 15.5a1.8 1.8 0 0 1 2.9-2.1L9 16" /></svg>
      Trykk på noe i rommet, eller bruk menyen
    </p>
  </section>
</template>

<style scoped>
.hero { padding: 30px 32px 24px; border-radius: 32px; }
h1 { font-size: clamp(2rem, 4.4vw, 3.3rem); font-weight: 800; }
.lead { font-size: 1.02rem; margin-top: 12px; }
.stops { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 22px; }
.stop {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  border-radius: 18px;
  background: var(--glass-strong);
  border: 1px solid var(--glass-border);
  color: var(--text);
  box-shadow: inset 0 1px 0 var(--glass-hi);
  transition: transform 0.45s var(--spring), box-shadow 0.3s, background 0.3s;
}
.stop:hover { transform: translateY(-4px) scale(1.03); box-shadow: inset 0 1px 0 var(--glass-hi), 0 10px 26px var(--accent-glow); }
.stop b { font: 800 1.6rem var(--font-display); color: var(--accent); line-height: 1.1; }
.stop span { font-size: 0.8rem; color: var(--text-2); font-weight: 600; }
.tap { display: flex; align-items: center; gap: 8px; margin-top: 18px; font-size: 0.85rem; color: var(--text-3); }
.tap svg { color: var(--accent); animation: tap 1.8s ease-in-out infinite; }
@keyframes tap { 50% { transform: translateY(-3px) rotate(-8deg); } }
@media (max-width: 900px) {
  .hero { padding: 20px 20px 16px; }
  .lead { font-size: 0.92rem; }
  .stops { gap: 6px; margin-top: 14px; }
  .stop { padding: 8px 10px; }
  .stop b { font-size: 1.25rem; }
  .tap { display: none; }
}
.home-logo { height: 54px; margin-bottom: 14px; }
</style>
