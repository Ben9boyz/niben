<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { Plus, ChevronLeft } from 'lucide-vue-next'
import { api, errorMessage } from '@/composables/site/useAdmin'
import { useData, reloadData, type Guitar } from '@/composables/site/useData'
import type { Flash } from '../../types'

// The user's own guitars (the owner's are in data.json, with 3D models). They are drawn from the colours chosen here and
// show up in the Gitar corner; recordings are made on one of them.
interface GuitarForm { id: string | null; name: string; brand: string; type: string; year: number | string; color: string; pickguard: string; fretboard: string; description: string }
const data = useData()
const guitars = computed(() => (data.gitarer || []).filter((g) => !g.modell))
const editing = ref<GuitarForm | null>(null)
const msg = ref<Flash | null>(null)
const busy = ref(false)

function edit(g?: Guitar) {
  msg.value = null
  editing.value = reactive<GuitarForm>(g
    ? { id: g.id, name: g.navn, brand: g.merke ?? '', type: g.type ?? '', year: g.aar ?? '', color: g.farge || '#c9a96b', pickguard: g.pickguard ?? '#222222', fretboard: g.gripebrett ?? '#4a2f1c', description: g.beskrivelse ?? '' }
    : { id: null, name: '', brand: '', type: '', year: '', color: '#c9a96b', pickguard: '#222222', fretboard: '#4a2f1c', description: '' })
}
async function save() {
  const f = editing.value
  if (!f) return
  busy.value = true
  try {
    await api('guitar_save', { ...f, year: f.year || null })
    await reloadData()
    editing.value = null
    msg.value = { ok: 'Lagret.' }
  } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = false }
}
async function remove() {
  const f = editing.value
  if (!f?.id || !confirm(`Slette «${f.name}» og opptakene på den?`)) return
  try { await api('guitar_delete', { id: f.id }); await reloadData(); editing.value = null } catch (e) { msg.value = { error: errorMessage(e) } }
}
</script>

<template>
  <div>
    <p v-if="msg?.ok && !editing" class="notice ok">{{ msg.ok }}</p>
    <div v-if="!editing">
      <div class="bar">
        <p class="muted">{{ guitars.length }} gitarer</p>
        <button class="btn primary small" @click="edit()"><Plus :size="15" />Ny gitar</button>
      </div>
      <div v-if="!guitars.length" class="empty">Ingen gitarer ennå – legg til den første, så kan du legge inn opptak på den.</div>
      <button v-for="g in guitars" :key="g.id" class="item" @click="edit(g)">
        <i class="sw" :style="{ background: g.farge }"></i><span class="meta"><b>{{ g.navn }}</b><small>{{ [g.merke, g.type, g.aar].filter(Boolean).join(' · ') || '—' }}</small></span>
      </button>
    </div>
    <form v-else class="form" @submit.prevent="save">
      <button type="button" class="back" @click="editing = null"><ChevronLeft :size="16" />Tilbake</button>
      <label class="field"><span>Navn *</span><input v-model="editing.name" required maxlength="80" placeholder="F.eks. Min Telecaster" /></label>
      <div class="form-row">
        <label class="field"><span>Merke</span><input v-model="editing.brand" maxlength="80" placeholder="Fender" /></label>
        <label class="field"><span>Type</span><input v-model="editing.type" maxlength="80" placeholder="Elgitar" /></label>
      </div>
      <label class="field"><span>Årstall</span><input v-model.number="editing.year" type="number" min="1900" max="2200" /></label>
      <div class="form-row three">
        <label class="field"><span>Kroppsfarge</span><input v-model="editing.color" type="color" /></label>
        <label class="field"><span>Slagbrett</span><input v-model="editing.pickguard" type="color" /></label>
        <label class="field"><span>Gripebrett</span><input v-model="editing.fretboard" type="color" /></label>
      </div>
      <label class="field"><span>Om gitaren</span><textarea v-model="editing.description" maxlength="4000" style="min-height: 80px"></textarea></label>
      <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>
      <div class="form-actions">
        <button class="btn primary" :disabled="busy">{{ busy ? 'Lagrer …' : 'Lagre' }}</button>
        <span class="spacer"></span>
        <button v-if="editing.id" type="button" class="btn danger small" @click="remove">Slett</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.bar .btn { display: inline-flex; align-items: center; gap: 4px; }
.muted { color: var(--text-3); font-size: 0.88rem; }
.item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px; margin-bottom: 4px; border: 0; border-radius: 12px; background: transparent; color: var(--text); text-align: left; cursor: pointer; }
.item:hover { background: var(--accent-soft); }
.sw { flex: none; width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--glass-border); }
.meta { display: flex; flex-direction: column; min-width: 0; }
.meta small { color: var(--text-3); }
.back { justify-self: start; border: 0; background: var(--accent-soft); color: var(--accent); padding: 6px 12px; border-radius: 999px; font-weight: 600; cursor: pointer; }
.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.field input[type='color'] { height: 42px; padding: 2px; }
</style>
