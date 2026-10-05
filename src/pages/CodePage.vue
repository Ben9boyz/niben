<script setup>
import { ref } from 'vue'
import { ArrowUpRight, BookOpenText } from 'lucide-vue-next'
import RepoBrowser from '../components/RepoBrowser.vue'
import { useData } from '../composables/useData'
const data = useData()
// a project on my GitHub can be read right here (RepoBrowser)
const repoOf = (p) => (/github\.com\/Ben9boyz\/([\w.-]+)/i.exec(p?.kode || '') || [])[1] || null
const reading = ref(null)
</script>

<template>
  <div class="cpage">
    <header class="cpage-head">
      <div class="eyebrow">Kode</div>
      <h1>Prosjekter</h1>
    </header>
    <div class="grid projects">
      <article v-for="(p, i) in data.prosjekter" :key="i" class="glass card proj rise" :style="{ '--i': i }">
        <div class="top"><span class="num">{{ String(i + 1).padStart(2, '0') }}</span><span class="muted">{{ p.aar }}<template v-if="p.stjerner"> · ★ {{ p.stjerner }}</template><template v-if="p.github"> · GitHub</template></span></div>
        <h2>{{ p.navn }}</h2>
        <p class="body">{{ p.beskrivelse }}</p>
        <div class="tags"><span v-for="t in p.teknologi" :key="t" class="chip">{{ t }}</span></div>
        <div class="actions">
          <a v-if="p.lenke" class="btn primary small" :href="p.lenke" target="_blank" rel="noopener">Se prosjektet <ArrowUpRight :size="16" /></a>
          <button v-if="repoOf(p)" class="btn small" @click="reading = repoOf(p)"><BookOpenText :size="16" /> Les koden</button>
          <a v-if="p.kode" class="btn small" :href="p.kode" target="_blank" rel="noopener">GitHub <ArrowUpRight :size="14" /></a>
        </div>
      </article>
    </div>
    <div v-if="!data.prosjekter?.length" class="empty">{{ data.projectsLoading ? 'Henter prosjektene fra GitHub …' : 'Fant ingen prosjekter på GitHub.' }}</div>
    <RepoBrowser v-if="reading" :repo="reading" @close="reading = null" />
  </div>
</template>

<style scoped>
.projects { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.proj { display: flex; flex-direction: column; padding: 24px; transition: transform 0.45s var(--spring); }
.proj:hover { transform: translateY(-4px); }
.top { display: flex; justify-content: space-between; align-items: center; }
.num { font: 600 0.8rem ui-monospace, Menlo, monospace; color: var(--accent); background: var(--accent-soft); padding: 4px 10px; border-radius: 999px; }
.muted { color: var(--text-3); font-size: 0.85rem; }
h2 { font-size: 1.5rem; margin: 14px 0 6px; }
.body { color: var(--text-2); flex: 1; }
</style>
