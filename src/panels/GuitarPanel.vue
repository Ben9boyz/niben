<script setup>
import RecordingList from '../components/RecordingList.vue'
import { Guitar } from 'lucide-vue-next'
import { computed } from 'vue'
import { useData } from '../composables/useData'
import { room } from '../composables/useRoom'

const data = useData()
const list = computed(() => data.gitarer || [])
const g = computed(() => list.value[room.sel.gitar])

function strum() { room.api?.strum(room.sel.gitar) }
</script>

<template>
  <section class="panel glass">
    <header class="panel-head">
      <div class="eyebrow">Gitar</div>
      <h2>{{ g ? g.navn : 'Gitarveggen' }}</h2>
      <p v-if="!g">Trykk på en gitar for å se den og høre opptak.</p>
    </header>

    <div class="panel-body">
      <transition name="fade" mode="out-in">
        <div v-if="g" :key="room.sel.gitar" class="detail">
          <button class="back" @click="room.sel.gitar = -1">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 6l-6 6 6 6" /></svg>
            Alle gitarer
          </button>
          <div class="muted">{{ [g.merke, g.type, g.aar].filter(Boolean).join(' · ') }}</div>
          <p class="body">{{ g.beskrivelse }}</p>
          <div class="actions">
            <button class="btn primary" @click="strum"><Guitar :size="17" />Klimpre</button>
          </div>

          <div class="section-label">Opptak</div>
          <div v-if="!g.opptak?.length" class="empty">Ingen opptak lagt inn ennå.</div>
          <RecordingList :items="g.opptak || []" />
          <p v-if="g.kreditt" class="credit">
            3D-modell: <a :href="g.kreditt.url" target="_blank" rel="noopener">{{ g.kreditt.tekst }}</a>, fargelagt for denne siden.
          </p>
        </div>

        <div v-else class="list" key="list">
          <button v-for="(item, i) in list" :key="i" class="row" :style="{ '--i': i }" @click="room.sel.gitar = i">
            <span class="swatch" :style="{ background: item.farge || '#2b8cff' }"></span>
            <span class="meta">
              <span class="name">{{ item.navn }}</span>
              <span class="sub">{{ [item.type, item.aar, item.opptak?.length ? `${item.opptak.length} opptak` : null].filter(Boolean).join(' · ') }}</span>
            </span>
            <svg class="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <div v-if="!list.length" class="empty">Ingen gitarer lagt inn ennå.</div>
        </div>
      </transition>
    </div>

    <footer class="panel-foot">
      <router-link class="timer" to="/ovelse">
        <span class="ring"></span>
        <span class="meta">
          <b>Øvingstimer</b>
          <span>Gå til øvingskroken med klokka</span>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
      </router-link>
    </footer>
  </section>
</template>

<style scoped>
.swatch {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  flex: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.4), inset 0 -6px 12px rgba(0,0,0,.2), 0 4px 10px rgba(0,0,0,.12);
}
.credit { margin-top: 14px; font-size: 0.75rem; color: var(--text-3); }
.credit a { color: var(--text-2); text-decoration: underline; text-underline-offset: 2px; }
.timer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 18px;
  color: var(--text);
  transition: background 0.25s, transform 0.4s var(--spring);
}
.timer:hover { background: var(--accent-soft); transform: translateY(-2px); }
.timer .meta { flex: 1; display: flex; flex-direction: column; }
.timer .meta span { font-size: 0.8rem; color: var(--text-3); }
.timer svg { color: var(--accent); }
.ring {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: conic-gradient(var(--accent) 0 var(--p, 0%), var(--accent-soft) var(--p, 0%) 100%);
  -webkit-mask: radial-gradient(circle, transparent 11px, #000 12px);
  mask: radial-gradient(circle, transparent 11px, #000 12px);
  animation: fill 3s linear infinite;
}
@property --p { syntax: '<percentage>'; inherits: false; initial-value: 0%; }
@keyframes fill { to { --p: 100%; } }
</style>
