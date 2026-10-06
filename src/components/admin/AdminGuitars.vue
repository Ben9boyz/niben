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
const guitars = computed(() => (data.gitarer || []).filter((g) => !g.modell || g.egen))
const all = computed(() => data.gitarer || [])
const isOwnFile = (g: Guitar) => !!g.modell?.startsWith('uploads/models/')
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
// ── 3D models: each guitar can have a model of its own (.glb) ──
const mbusy = ref('')
async function uploadModel(g: Guitar, e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  mbusy.value = g.id
  msg.value = null
  try {
    const fd = new FormData()
    fd.append('id', g.id)
    fd.append('file', f)
    await api('decor_guitar_upload', fd)
    await reloadData()
    msg.value = { ok: `«${g.navn}» har fått sin egen modell.` }
  } catch (err) { msg.value = { error: errorMessage(err) } } finally { mbusy.value = '' }
}
async function removeModel(g: Guitar) {
  if (!confirm(`Fjerne den opplastede modellen til «${g.navn}»?`)) return
  mbusy.value = g.id
  try { await api('decor_guitar_delete', { id: g.id }); await reloadData(); msg.value = { ok: 'Modellen er fjernet.' } } catch (err) { msg.value = { error: errorMessage(err) } } finally { mbusy.value = '' }
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

      <section v-if="all.length" class="models">
        <h4>3D-modeller</h4>
        <p class="muted">Last opp din egen modell (.glb, maks 14 MB, én fil med alt i) til en gitar. Den settes opp etter lengden sin og vises i rommet og i Gitar-fanen. Uten egen modell brukes en enkel gitar tegnet av fargene over.</p>
        <div v-for="g in all" :key="g.id" class="mrow">
          <span class="mn"><b>{{ g.navn }}</b><small>{{ isOwnFile(g) ? 'Egen modell' : g.modell ? 'Innebygd modell' : 'Ingen modell' }}</small></span>
          <label class="btn soft small up" :class="{ busy: mbusy === g.id }">{{ mbusy === g.id ? 'Laster opp …' : g.modell ? 'Bytt modell' : 'Last opp modell' }}<input type="file" accept=".glb,model/gltf-binary" hidden :disabled="!!mbusy" @change="uploadModel(g, $event)" /></label>
          <button v-if="isOwnFile(g)" type="button" class="btn danger small" :disabled="!!mbusy" @click="removeModel(g)">Fjern</button>
        </div>
      </section>
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
.models { margin-top: 22px; display: grid; gap: 8px; }
.models h4 { margin: 0; font-size: 0.98rem; }
.mrow { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; background: var(--accent-soft); }
.mn { flex: 1; min-width: 0; display: grid; }
.mn small { color: var(--text-3); }
.up { cursor: pointer; }
.up.busy { opacity: 0.6; pointer-events: none; }
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
