<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { Search, Save, RotateCcw } from 'lucide-vue-next'
import { api, errorMessage } from '@/composables/site/useAdmin'
import { siteTexts, setTexts } from '@/composables/site/useTexts'
import { TEXT_GROUPS, TEXT_DEFAULTS } from '../../lib/textDefs'
import type { Flash } from '../../types'

// All the wording on the site that isn't data (headings, hints, the empty-state lines …). A box left empty = the
// standard text. Saved texts reach everybody with the next page load.
const draft = reactive<Record<string, string>>({ ...siteTexts })
const q = ref('')
const busy = ref(false)
const msg = ref<Flash | null>(null)
const open = reactive<Record<string, boolean>>({})
const changed = computed(() => TEXT_GROUPS.some((g) => g.items.some((i) => (draft[i.k] || '') !== (siteTexts[i.k] || ''))))
const groups = computed(() => {
  const n = q.value.trim().toLowerCase()
  if (!n) return TEXT_GROUPS
  return TEXT_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => `${i.label} ${i.d} ${draft[i.k] || ''}`.toLowerCase().includes(n)) })).filter((g) => g.items.length)
})
const isCustom = (k: string) => !!(draft[k] || '').trim()

async function save() {
  busy.value = true
  msg.value = null
  try {
    const texts = Object.fromEntries(Object.entries(draft).filter(([k, v]) => TEXT_DEFAULTS[k] !== undefined && String(v || '').trim()))
    const r = await api<{ texts: Record<string, string> }>('texts_save', { texts })
    setTexts(r.texts)
    for (const k of Object.keys(draft)) delete draft[k]
    Object.assign(draft, r.texts)
    msg.value = { ok: 'Lagret – siden bruker de nye tekstene nå.' }
  } catch (e) {
    msg.value = { error: errorMessage(e) }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="at">
    <p class="intro">All tekst om tingene på siden – titler, hint og beskjeder. Står et felt tomt, brukes standardteksten (grå). Skriver du noe, erstatter det standarden overalt.</p>
    <div class="bar">
      <label class="search"><Search :size="15" aria-hidden="true" /><input v-model="q" type="search" placeholder="Søk i tekstene …" aria-label="Søk i tekstene" /></label>
      <button class="btn primary" :disabled="busy || !changed" @click="save"><Save :size="15" aria-hidden="true" />{{ busy ? 'Lagrer …' : 'Lagre' }}</button>
    </div>
    <p v-if="msg?.ok" class="notice ok">{{ msg.ok }}</p>
    <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>

    <section v-for="g in groups" :key="g.title" class="grp">
      <h4 class="label-caps">{{ g.title }}</h4>
      <div v-for="i in g.items" :key="i.k" class="row" :class="{ custom: isCustom(i.k) }">
        <label :for="`t-${i.k}`">{{ i.label }}<button v-if="isCustom(i.k)" class="rs" type="button" title="Tilbake til standardteksten" @click="draft[i.k] = ''"><RotateCcw :size="12" aria-hidden="true" />Standard</button></label>
        <textarea v-if="i.long" :id="`t-${i.k}`" v-model="draft[i.k]" rows="3" :placeholder="i.d" maxlength="1500"></textarea>
        <input v-else :id="`t-${i.k}`" v-model="draft[i.k]" type="text" :placeholder="i.d" maxlength="300" />
      </div>
    </section>
    <p v-if="!groups.length" class="muted">Ingen treff.</p>
  </div>
</template>

<style scoped>
.at { display: grid; gap: 14px; }
.intro { margin: 0; color: var(--text-3); font-size: 0.86rem; line-height: 1.45; }
.bar { display: flex; gap: 10px; align-items: center; position: sticky; top: -18px; z-index: 3; padding: 8px 0; background: color-mix(in srgb, var(--bg) 86%, transparent); backdrop-filter: blur(10px); }
.search { flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass-strong); color: var(--text-3); }
.search input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--text); font: 500 0.9rem var(--font); }
.btn { display: inline-flex; align-items: center; gap: 6px; }
.grp { display: grid; gap: 10px; padding: 14px; border-radius: 18px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.row { display: grid; gap: 4px; }
.row label { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.8rem; font-weight: 600; color: var(--text-2); }
.row.custom label { color: var(--accent); }
.rs { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border: 0; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font: 600 0.7rem var(--font); cursor: pointer; }
input[type='text'], textarea { width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1px solid var(--glass-border); border-radius: 11px; background: var(--bg); color: var(--text); font: 500 0.92rem var(--font); resize: vertical; }
input[type='text']:focus, textarea:focus { outline: none; border-color: var(--accent); }
.muted { color: var(--text-3); }
</style>
