<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, Check } from 'lucide-vue-next'
import { api, errorMessage } from '@/composables/site/useAdmin'
import { reloadData, useData, type NavTab, type SectionId } from '@/composables/site/useData'
import { GROUPS, HOBBY, ROUTE_ICONS, standardGroups, tabLabel } from '@/lib/nav'
import { ROUTE_SECTION } from '@/lib/sections'
import { placed } from '@/composables/room/useModules'
import type { Flash } from '../../types'

// The room's own menu: the tabs, what they are called, their symbol, and which pages and hobbies sit under each – in the order
// you want. A page put under "Skjult" is not in the menu (a corner of the room – Japansk, Spill … – is then switched off altogether).
const data = useData()
const msg = ref<Flash | null>(null)
const busy = ref(false)
const EMOJIS = ['', '🏠', '🎓', '🛠️', '🧭', '⭐', '🏊', '🏃', '🚴', '🏋️', '⛰️', '🎬', '🎵', '🎸', '🎨', '📷', '🍳', '☕', '🌱', '🐾', '♟️', '🎲', '🕹️', '✍️', '📚', '🌍', '✈️', '💼', '❤️', '🔥']

// every page that can be in the menu (Hjem and the hall always are): the built-in ones, also those switched off, and every hobby module
const owned = (r: string): boolean => ROUTE_SECTION[r] === r // (a page that is a whole corner of the room of its own)
const allPages = computed<string[]>(() => {
  const out: string[] = []
  for (const g of GROUPS) if (g.id !== 'hjem' && g.id !== 'gangen' && g.id !== 'hobby') for (const r of g.routes) if (r !== 'vurderinger' || placed.value.some((m) => m.kind.fields.some((f) => f.kind === 'rating'))) out.push(r)
  for (const m of placed.value) out.push(HOBBY + m.id)
  return out
})
const sectionOff = (r: string): boolean => owned(r) && (data.profile.sections as Record<string, boolean | undefined>)[r] === false

function startLayout(): { tabs: NavTab[]; hidden: string[] } {
  const base = data.nav
    ? { tabs: data.nav.tabs.map((t) => ({ ...t, routes: [...t.routes] })), hidden: [...data.nav.hidden] }
    : { tabs: standardGroups.value.filter((g) => g.id !== 'hjem' && g.id !== 'gangen').map((g) => ({ id: g.id.replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'fane', label: g.label, icon: g.emoji ?? '', routes: [...g.routes] })), hidden: [] }
  const seen = new Set([...base.tabs.flatMap((t) => t.routes), ...base.hidden])
  for (const r of allPages.value) {
    if (seen.has(r)) continue
    if (sectionOff(r)) { base.hidden.push(r); continue } // (switched off before: shows as hidden)
    const std = standardGroups.value.find((g) => g.routes.includes(r))
    const tab = base.tabs.find((t) => t.id === std?.id) ?? base.tabs[base.tabs.length - 1]
    if (tab) tab.routes.push(r); else base.hidden.push(r)
  }
  // pages that no longer exist (a removed module) are left out
  const exists = new Set(allPages.value)
  for (const t of base.tabs) t.routes = t.routes.filter((r) => exists.has(r))
  base.hidden = base.hidden.filter((r) => exists.has(r))
  return base
}
const layout = ref(startLayout())
const dirty = ref(false)
const changed = (): void => { dirty.value = true; msg.value = null }

const svgOf = (t: NavTab): string => GROUPS.find((g) => g.id === t.id)?.icon ?? GROUPS.find((g) => g.id === 'hobby')!.icon
const pageIcon = (r: string): string | null => ROUTE_ICONS[r] ?? null
const openIcons = ref('')
const HIDE = '__skjult'
function moveTo(r: string, where: string): void {
  const L = layout.value
  for (const t of L.tabs) t.routes = t.routes.filter((x) => x !== r)
  L.hidden = L.hidden.filter((x) => x !== r)
  if (where === HIDE) L.hidden.push(r)
  else L.tabs.find((t) => t.id === where)?.routes.push(r)
  changed()
}
function nudge(list: string[], i: number, d: -1 | 1): void { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j]!, list[i]!]; changed() }
function moveTab(i: number, d: -1 | 1): void { const T = layout.value.tabs; const j = i + d; if (j < 0 || j >= T.length) return; [T[i], T[j]] = [T[j]!, T[i]!]; changed() }
function addTab(): void { layout.value.tabs.push({ id: 't' + Math.random().toString(36).slice(2, 8), label: 'Ny fane', icon: '⭐', routes: [] }); changed() }
function removeTab(i: number): void { const t = layout.value.tabs[i]; if (!t) return; layout.value.hidden.push(...t.routes); layout.value.tabs.splice(i, 1); changed() }

async function save(): Promise<void> {
  busy.value = true
  msg.value = null
  try {
    const L = layout.value
    await api('about_nav', { tabs: L.tabs, hidden: L.hidden })
    // a whole corner put under "Skjult" is switched off in the room as well – and on again when it gets a tab
    const sections: Partial<Record<SectionId, boolean>> = {}
    for (const r of allPages.value) if (owned(r)) { const off = L.hidden.includes(r); if (off !== sectionOff(r)) sections[r as SectionId] = !off }
    if (Object.keys(sections).length) await api('me_settings', { sections })
    await reloadData()
    dirty.value = false
    msg.value = { ok: 'Fanene er lagret.' }
  } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = false }
}
async function reset(): Promise<void> {
  if (!confirm('Tilbake til standardfanene?')) return
  busy.value = true
  try { await api('about_nav', { reset: true }); await reloadData(); layout.value = startLayout(); dirty.value = false; msg.value = { ok: 'Standardfanene er tilbake.' } } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = false }
}
</script>

<template>
  <div class="at">
    <p class="intro">Bestem menyen i rommet ditt: navn og symbol på hver fane, og hvilke sider og hobbyer som ligger under den – i den rekkefølgen du vil. «Hjem» og «Gangen» er alltid med. Det du legger under <b>Skjult</b> er ikke i menyen, og et hjørne av rommet (Japansk, Spill …) skrus da av helt.</p>
    <p v-if="msg?.ok" class="notice ok">{{ msg.ok }}</p>
    <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>

    <section v-for="(t, ti) in layout.tabs" :key="t.id" class="tab" :class="{ empty: !t.routes.length }">
      <header>
        <div class="icowrap">
          <button class="ic" type="button" :aria-label="`Symbol for ${t.label}`" :aria-expanded="openIcons === t.id" @click="openIcons = openIcons === t.id ? '' : t.id">
            <span v-if="t.icon">{{ t.icon }}</span>
            <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="svgOf(t)" /></svg>
          </button>
          <div v-if="openIcons === t.id" class="pop">
            <button v-for="e in EMOJIS" :key="e || 'std'" type="button" :title="e ? e : 'Standard'" @click="t.icon = e; changed(); openIcons = ''">{{ e || '∅' }}</button>
            <input v-model="t.icon" maxlength="4" placeholder="Eget" aria-label="Eget symbol" @input="changed" />
          </div>
        </div>
        <input v-model="t.label" class="name" maxlength="24" :aria-label="`Navn på fane ${ti + 1}`" @input="changed" />
        <button class="ib" type="button" :disabled="ti === 0" aria-label="Flytt fanen opp" @click="moveTab(ti, -1)"><ChevronUp :size="16" /></button>
        <button class="ib" type="button" :disabled="ti === layout.tabs.length - 1" aria-label="Flytt fanen ned" @click="moveTab(ti, 1)"><ChevronDown :size="16" /></button>
        <button class="ib danger" type="button" aria-label="Fjern fanen" title="Fjern fanen (sidene legges under Skjult)" @click="removeTab(ti)"><Trash2 :size="15" /></button>
      </header>
      <ul class="pages">
        <li v-for="(r, ri) in t.routes" :key="r">
          <button class="ib sm" type="button" :disabled="ri === 0" aria-label="Flytt til venstre" @click="nudge(t.routes, ri, -1)"><ChevronLeft :size="14" /></button>
          <svg v-if="pageIcon(r)" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="pageIcon(r)!" /></svg>
          <span class="pl">{{ tabLabel(r) }}</span>
          <select :value="t.id" :aria-label="`Flytt ${tabLabel(r)}`" @change="moveTo(r, ($event.target as HTMLSelectElement).value)">
            <option v-for="o in layout.tabs" :key="o.id" :value="o.id">{{ o.label }}</option><option :value="HIDE">Skjult</option>
          </select>
          <button class="ib sm" type="button" :disabled="ri === t.routes.length - 1" aria-label="Flytt til høyre" @click="nudge(t.routes, ri, 1)"><ChevronRight :size="14" /></button>
        </li>
        <li v-if="!t.routes.length" class="none">Tom – flytt sider hit. En tom fane vises ikke.</li>
      </ul>
    </section>

    <section class="tab hidden">
      <header><b>Skjult</b><small>Ikke i menyen</small></header>
      <ul class="pages">
        <li v-for="r in layout.hidden" :key="r">
          <span class="pl">{{ tabLabel(r) }}</span>
          <select :value="HIDE" :aria-label="`Flytt ${tabLabel(r)}`" @change="moveTo(r, ($event.target as HTMLSelectElement).value)">
            <option v-for="o in layout.tabs" :key="o.id" :value="o.id">{{ o.label }}</option><option :value="HIDE">Skjult</option>
          </select>
        </li>
        <li v-if="!layout.hidden.length" class="none">Ingenting skjult.</li>
      </ul>
    </section>

    <div class="bar">
      <button class="btn soft" type="button" :disabled="layout.tabs.length >= 12" @click="addTab"><Plus :size="15" />Ny fane</button>
      <button class="btn soft" type="button" :disabled="busy" @click="reset"><RotateCcw :size="14" />Standard</button>
      <button class="btn primary" type="button" :disabled="busy || !dirty" @click="save"><Check :size="15" />{{ busy ? 'Lagrer …' : 'Lagre fanene' }}</button>
    </div>
  </div>
</template>

<style scoped>
.at { display: grid; gap: 12px; }
.intro { margin: 0; color: var(--text-3); font-size: 0.86rem; line-height: 1.45; }
.tab { border: 1px solid var(--glass-border); border-radius: 16px; padding: 10px; background: color-mix(in srgb, var(--bg) 60%, transparent); }
.tab.empty { opacity: 0.75; border-style: dashed; }
.tab header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.tab.hidden header { gap: 10px; } .tab.hidden small { color: var(--text-3); }
.name { flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--bg); color: var(--text); font: 700 0.95rem var(--font); }
.icowrap { position: relative; }
.ic { all: unset; cursor: pointer; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; background: var(--accent-soft); color: var(--accent); font-size: 1.3rem; }
.pop { position: absolute; z-index: 20; top: 110%; left: 0; width: 260px; display: flex; flex-wrap: wrap; gap: 2px; padding: 8px; border-radius: 14px; background: var(--bg); box-shadow: 0 14px 40px rgba(0, 0, 0, 0.28); border: 1px solid var(--glass-border); }
.pop button { all: unset; cursor: pointer; font-size: 1.3rem; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; } .pop button:hover { background: var(--glass-border); }
.pop input { width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; }
.ib { all: unset; cursor: pointer; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; color: var(--text-2); }
.ib:hover:not(:disabled) { background: var(--glass-border); } .ib:disabled { opacity: 0.3; cursor: default; } .ib.sm { width: 22px; height: 26px; } .danger { color: #e5484d; }
.pages { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.pages li { display: flex; align-items: center; gap: 4px; padding: 3px 4px 3px 8px; border-radius: 999px; background: var(--accent-soft); font-size: 0.85rem; }
.pages li.none { background: transparent; color: var(--text-3); font-size: 0.8rem; padding: 4px; }
.pl { font-weight: 600; white-space: nowrap; max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
.pages select { max-width: 92px; padding: 3px 4px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; font-size: 0.78rem; }
.bar { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.bar .btn { display: inline-flex; align-items: center; gap: 6px; }
</style>
