<script setup lang="ts">
import { tx } from '../composables/useTexts'
import RecordingList from '../components/RecordingList.vue'
import NewsletterSignup from '../components/NewsletterSignup.vue'
import { Timer } from 'lucide-vue-next'
import { ref, computed } from 'vue'
import { useData } from '../composables/useData'
import GuitarViewer from '../components/GuitarViewer.vue'

const data = useData()
const idx = ref(0)
const g = computed(() => data.gitarer?.[idx.value])
</script>

<template>
  <div class="cpage">
    <header class="cpage-head">
      <div class="eyebrow">{{ tx('guitar.eyebrow') }}</div>
      <h1>{{ tx('guitar.pageTitle') }}</h1>
    </header>

    <div class="tabs">
      <button v-for="(item, i) in data.gitarer" :key="item.id" :class="{ on: i === idx }" @click="idx = i">
        <span class="sw" :style="{ background: item.farge }"></span>{{ item.navn }}
      </button>
    </div>

    <div v-if="g" class="layout">
      <div class="stage glass"><GuitarViewer :guitar="g" /></div>
      <div class="info">
        <div class="glass card">
          <div class="muted">{{ [g.merke, g.type, g.aar].filter(Boolean).join(' · ') }}</div>
          <h2>{{ g.navn }}</h2>
          <p class="body">{{ g.beskrivelse }}</p>
          <router-link to="/ovelse" class="btn small"><Timer :size="15" /> Øvingskroken</router-link>
        </div>
        <div class="glass card">
          <h3>Opptak</h3>
          <div v-if="!g.opptak?.length" class="empty">{{ tx('guitar.none') }}</div>
          <RecordingList :items="g.opptak || []" />
        </div>
        <NewsletterSignup />
        <p v-if="g.kreditt" class="credit">3D-modell: <a :href="g.kreditt.url" target="_blank" rel="noopener">{{ g.kreditt.tekst }}</a>, fargelagt for denne siden.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
.tabs button { display: flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 999px; border: 1px solid var(--glass-border); background: transparent; color: var(--text-2); font-weight: 600; cursor: pointer; }
.tabs button.on { background: var(--glass-strong); color: var(--text); box-shadow: var(--shadow-1); }
.sw { width: 14px; height: 14px; border-radius: 50%; }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; align-items: start; }
.stage { height: min(72vh, 640px); border-radius: 28px; overflow: hidden; position: sticky; top: 24px; }
.info { display: grid; gap: 16px; }
.muted { color: var(--text-3); font-size: 0.88rem; }
h2 { font-size: 2rem; margin: 4px 0 8px; }
h3 { margin-bottom: 10px; }
.body { color: var(--text-2); margin-bottom: 14px; }
.credit { font-size: 0.75rem; color: var(--text-3); }
.credit a { color: var(--text-2); text-decoration: underline; }
@media (max-width: 860px) { .layout { grid-template-columns: 1fr; } .stage { position: relative; top: 0; height: 56vh; } }
</style>
