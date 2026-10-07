<script setup lang="ts">
import { tx } from '@/composables/site/useTexts'
import { ArrowUpRight, BookOpenText, Star } from 'lucide-vue-next'
import RepoBrowser from '@/components/content/RepoBrowser.vue'
import ServiceSetup from '@/components/ui/ServiceSetup.vue'
import { computed, ref } from 'vue'
import { useData, type Project } from '@/composables/site/useData'
import { room } from '@/composables/room/useRoom'

const data = useData()
// a project on my GitHub can be read right here (RepoBrowser)
const repoOf = (p: Project | undefined) => (/github\.com\/[\w.-]+\/([\w.-]+)/i.exec(p?.kode || '') || [])[1] || null // (the room's own GitHub account – the server only opens repos it lists)
const reading = ref<string | null>(null)
const list = computed(() => data.prosjekter || [])
const p = computed(() => list.value[room.sel.prosjekt])
</script>

<template>
  <section class="panel glass">
    <header class="panel-head">
      <div class="eyebrow">{{ tx('code.eyebrow') }}</div>
      <h2>{{ tx('code.title') }}</h2>
      <p>{{ tx('code.hint') }}</p>
    </header>

    <div class="panel-body">
      <ServiceSetup service="github" />
      <div class="list">
        <button v-for="(item, i) in list" :key="i" class="row" :class="{ active: i === room.sel.prosjekt }" :style="{ '--i': i }" @click="room.sel.prosjekt = i">
          <span class="num">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="meta">
            <span class="name">{{ item.navn }}</span>
            <span class="sub">{{ (item.teknologi || []).join(' · ') }}</span>
          </span>
        </button>
        <div v-if="!list.length" class="empty">{{ data.projectsLoading ? 'Henter prosjektene fra GitHub …' : 'Fant ingen prosjekter på GitHub.' }}</div>
      </div>

      <transition name="fade" mode="out-in">
        <div v-if="p" :key="room.sel.prosjekt" class="detail card">
          <div class="muted">{{ p.aar }}<template v-if="p.stjerner"> · <Star :size="12" class="gs" /> {{ p.stjerner }}</template><template v-if="p.github"> · GitHub</template></div>
          <h3>{{ p.navn }}</h3>
          <p class="body">{{ p.beskrivelse }}</p>
          <div class="tags"><span v-for="t in p.teknologi" :key="t" class="chip">{{ t }}</span></div>
          <div class="actions">
            <a v-if="p.lenke" class="btn primary" :href="p.lenke" target="_blank" rel="noopener">Se prosjektet <ArrowUpRight :size="16" /></a>
            <button v-if="repoOf(p)" class="btn" @click="reading = repoOf(p)"><BookOpenText :size="16" /> Les koden</button>
          <a v-if="p.kode" class="btn" :href="p.kode" target="_blank" rel="noopener">GitHub <ArrowUpRight :size="14" /></a>
          </div>
        </div>
      </transition>
    </div>
    <RepoBrowser v-if="reading" :repo="reading" @close="reading = null" />
  </section>
</template>

<style scoped>
.num {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font: 600 0.82rem ui-monospace, Menlo, monospace;
  color: var(--accent);
  background: var(--accent-soft);
}
.row.active .num { color: #fff; background: linear-gradient(135deg, var(--accent-2), var(--accent)); box-shadow: 0 4px 12px var(--accent-glow); }
.card {
  margin-top: 14px;
  padding: 16px;
  border-radius: 20px;
  background: var(--glass-strong);
  border: 1px solid var(--glass-border);
}
.gs { vertical-align: -1px; }
</style>
