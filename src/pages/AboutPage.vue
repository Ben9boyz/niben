<script setup>
import { ArrowUpRight } from 'lucide-vue-next'
import { useData } from '../composables/useData'
const data = useData()
</script>

<template>
  <div class="cpage">
    <div class="about">
      <img v-if="data.om?.bilde" :src="data.om.bilde" alt="" class="photo glass rise" />
      <div>
        <div class="eyebrow rise" style="--i: 1">Om meg</div>
        <h1 class="rise" style="--i: 2">{{ data.site?.navn }}</h1>
        <p class="body rise" style="--i: 3">{{ data.om?.tekst }}</p>
        <div v-if="data.om?.fakta?.length" class="facts">
          <div v-for="(f, i) in data.om.fakta" :key="i" class="fact glass rise" :style="{ '--i': i + 4 }">
            <span>{{ f.tittel }}</span><b>{{ f.verdi }}</b>
          </div>
        </div>
        <div v-if="data.om?.lenker?.length" class="actions">
          <a v-for="l in data.om.lenker" :key="l.url" class="btn" :href="l.url" target="_blank" rel="noopener">{{ l.navn }} <ArrowUpRight :size="16" /></a>
        </div>
      </div>
    </div>
    <router-link to="/admin" class="secret" aria-label="Admin">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
    </router-link>
  </div>
</template>

<style scoped>
.about { display: grid; grid-template-columns: 340px 1fr; gap: 40px; align-items: start; margin-top: 20px; }
.photo { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 28px; padding: 8px; }
h1 { font-size: clamp(2.4rem, 5vw, 3.6rem); font-weight: 800; }
.body { color: var(--text-2); font-size: 1.1rem; margin-top: 14px; white-space: pre-line; }
.facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 24px; }
.fact { display: flex; flex-direction: column; padding: 14px 16px; border-radius: 18px; }
.fact span { font-size: 0.72rem; color: var(--text-3); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
.fact b { margin-top: 2px; }
@media (max-width: 760px) { .about { grid-template-columns: 1fr; } .photo { max-width: 260px; } }
.secret { display: block; width: 14px; margin: 28px auto 0; color: var(--text-3); opacity: 0.18; transition: opacity 0.3s; }
.secret:hover { opacity: 0.8; }
</style>
