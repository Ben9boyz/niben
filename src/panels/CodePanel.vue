<script setup>
import { ArrowUpRight } from 'lucide-vue-next'
import { computed } from 'vue'
import { useData } from '../composables/useData'
import { room } from '../composables/useRoom'

const data = useData()
const list = computed(() => data.prosjekter || [])
const p = computed(() => list.value[room.sel.prosjekt])
</script>

<template>
  <section class="panel glass">
    <header class="panel-head">
      <div class="eyebrow">Kode</div>
      <h2>Prosjekter</h2>
      <p>Velg et prosjekt – det vises på skjermen.</p>
    </header>

    <div class="panel-body">
      <div class="list">
        <button v-for="(item, i) in list" :key="i" class="row" :class="{ active: i === room.sel.prosjekt }" :style="{ '--i': i }" @click="room.sel.prosjekt = i">
          <span class="num">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="meta">
            <span class="name">{{ item.navn }}</span>
            <span class="sub">{{ (item.teknologi || []).join(' · ') }}</span>
          </span>
        </button>
        <div v-if="!list.length" class="empty">Ingen prosjekter lagt inn ennå.</div>
      </div>

      <transition name="fade" mode="out-in">
        <div v-if="p" :key="room.sel.prosjekt" class="detail card">
          <div class="muted">{{ p.aar }}<template v-if="p.stjerner"> · ★ {{ p.stjerner }}</template><template v-if="p.github"> · GitHub</template></div>
          <h3>{{ p.navn }}</h3>
          <p class="body">{{ p.beskrivelse }}</p>
          <div class="tags"><span v-for="t in p.teknologi" :key="t" class="chip">{{ t }}</span></div>
          <div class="actions">
            <a v-if="p.lenke" class="btn primary" :href="p.lenke" target="_blank" rel="noopener">Se prosjektet <ArrowUpRight :size="16" /></a>
            <a v-if="p.kode" class="btn" :href="p.kode" target="_blank" rel="noopener">Kildekode</a>
          </div>
        </div>
      </transition>
    </div>
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
</style>
