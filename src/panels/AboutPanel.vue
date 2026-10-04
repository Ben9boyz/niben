<script setup>
import { ArrowUpRight } from 'lucide-vue-next'
import { useData } from '../composables/useData'
const data = useData()
</script>

<template>
  <section class="panel glass">
    <header class="panel-head">
      <div class="eyebrow">Om meg</div>
      <h2>{{ data.site?.navn }}</h2>
    </header>
    <div class="panel-body">
      <div class="detail">
        <p class="body first">{{ data.om?.tekst }}</p>
        <div v-if="data.om?.fakta?.length" class="facts">
          <div v-for="(f, i) in data.om.fakta" :key="i" class="fact" :style="{ '--i': i }">
            <span>{{ f.tittel }}</span>
            <b>{{ f.verdi }}</b>
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
  </section>
</template>

<style scoped>
.first { margin-top: 0; }
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 18px; }
.fact {
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--glass-strong);
  border: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  animation: rowIn 0.6s var(--ease) both;
  animation-delay: calc(var(--i) * 60ms + 150ms);
}
.fact span { font-size: 0.75rem; color: var(--text-3); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
.fact b { font-size: 1rem; margin-top: 2px; }
.secret { display: block; width: 14px; margin: 28px auto 0; color: var(--text-3); opacity: 0.18; transition: opacity 0.3s; }
.secret:hover { opacity: 0.8; }
</style>
