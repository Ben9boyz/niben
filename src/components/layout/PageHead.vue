<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { PenLine, Share2 } from 'lucide-vue-next'
import { groupOf, groupTarget, routeKey, tabLabel, tabIcon, tabTarget } from '@/lib/nav'
import { tx } from '@/composables/site/useTexts'
import { rooms } from '@/composables/room/useRooms'
import { useData } from '@/composables/site/useData'
import { admin } from '@/composables/site/useAdmin'
import { shell } from '@/composables/ui/useShell'
import SegSwitch from '@/components/ui/SegSwitch.vue'

// The head of every page (plain version, desktop), the same everywhere: one card with a band on top – where you are
// (room / tab / page) and what you can do here (share, edit) – then the page's title and a line about it, with the
// page's sub-tabs to the right. The pages' own headers are hidden under it. Not on the front page (it has its own card),
// in the admin (its own head) or in the music app.
const route = useRoute()
const data = useData()
const room = computed(() => rooms.current || data.profile.username || '')
const key = computed(() => routeKey(route))
const group = computed(() => groupOf(key.value))
// the head is as wide as the page under it (pages keep their own widths)
const WIDTH: Record<string, number> = { figurer: 1100, ovelse: 1000, gaming: 1240, japansk: 1240, modul: 1000, vurderinger: 1000, lytte: 1680 }
const width = computed(() => WIDTH[String(route.name)] ?? null)
const shown = computed(() => !['hjem', 'admin'].includes(String(route.name)) && shell.value !== 'player')

// the title: the owner's own wording where the page has one (Admin → Tekster), else the tab's name
const TITLE: Record<string, [string, string?]> = {
  boker: ['books.title'], kode: ['code.title'], figurer: ['figures.title'], gaming: ['gaming.title'], gitar: ['guitar.pageTitle'],
  japansk: ['japan.title'], ovelse: ['practice.title'], reiser: ['travel.title'], aaret: ['year.title'],
}
const title = computed(() => { const t = TITLE[key.value]; return t ? tx(t[0]) : tabLabel(key.value) || String(route.meta?.title ?? '') })
const countries = computed(() => new Set((data.reiser || []).map((t) => t.land).filter(Boolean)).size)
const lead = computed(() => {
  switch (key.value) {
    case 'lytte': return 'Platene mine, spillelistene og hva som spiller akkurat nå.'
    case 'ovelse': return 'Timer, akkorder, stemmeapparat og metronom – alt du trenger for å øve.'
    case 'japansk': return 'Det jeg lærer på jpdb – ord, repetisjon og anime.'
    case 'gitar': return 'Gitarene mine i 3D, med opptak av det jeg spiller på dem.'
    case 'figurer': return 'Figurene på hylla – trykk på en for å se den fra alle kanter.'
    case 'kode': return 'Ting jeg har laget og kodet.'
    case 'reiser': return `${countries.value} land · ${(data.reiser || []).length} reiser. Trykk på et land på kartet, eller søk.`
    case 'boker': return `${(data.boker || []).length} bøker lest. Trykk på en bok for å se hva jeg syntes.`
    case 'gaming': return 'Hva jeg spiller på Steam, og timene som har gått.'
    case 'aaret': return 'Musikk, bøker, reiser, spill og japansk – samlet, og klart til å deles.'
    case 'om': return 'Litt om hvem som bor i dette rommet.'
    case 'gangen': return 'Én dør per rom. Gå inn hos en kompis – rommet bytter, og du står i oversikten deres.'
    case 'vurderinger': return 'Det jeg har gitt stjerner.'
    default: return ''
  }
})
// the path in the band: the room → the tab (when the page is one of several) → the page
const crumbs = computed(() => {
  const g = group.value
  const out: { label: string; to: ReturnType<typeof groupTarget> | null }[] = []
  if (g && g.routes.length > 1 && g.label !== title.value) out.push({ label: g.label, to: groupTarget(g) })
  out.push({ label: tabLabel(key.value) || title.value, to: null })
  return out
})
const tabs = computed(() => {
  const g = group.value
  return g && g.routes.length > 1 ? g.routes.map((r) => ({ id: r, label: tabLabel(r), icon: tabIcon(r), to: tabTarget(r) })) : null
})
const shared = ref(false)
async function share() {
  try { await navigator.clipboard.writeText(location.href); shared.value = true; setTimeout(() => (shared.value = false), 1600) } catch { /* no clipboard */ }
}
</script>

<template>
  <section v-if="shown" class="page-head" :style="width ? { '--head-w': `${width - 64}px` } : undefined">
    <div class="band">
      <nav aria-label="Du er her" class="trail">
        <span class="pip" aria-hidden="true"></span>
        <router-link to="/">{{ room ? `Rommet til ${room}` : 'Rommet' }}</router-link>
        <template v-for="(c, i) in crumbs" :key="i">
          <span class="sep" aria-hidden="true">/</span>
          <router-link v-if="c.to" :to="c.to">{{ c.label }}</router-link>
          <b v-else aria-current="page">{{ c.label }}</b>
        </template>
      </nav>
      <div class="acts">
        <button type="button" class="btn small" @click="share"><Share2 :size="15" aria-hidden="true" />{{ shared ? 'Lenken er kopiert' : 'Del' }}</button>
        <router-link v-if="admin.mine" to="/admin" class="btn small"><PenLine :size="15" aria-hidden="true" />Rediger</router-link>
      </div>
    </div>
    <div class="title-row">
      <div class="words">
        <h1>{{ title }}</h1>
        <p v-if="lead">{{ lead }}</p>
      </div>
      <SegSwitch v-if="tabs" :items="tabs" :model-value="key" label="Underfaner" />
    </div>
  </section>
</template>

<style scoped>
.page-head { width: min(var(--head-w, calc(var(--page-max, 1360px) - 64px)), calc(100% - 64px)); margin: 24px auto 0; border-radius: 32px; overflow: hidden; background: var(--sk-surface, var(--glass-strong)); border: var(--sk-border, 1px solid var(--glass-border)); box-shadow: var(--sk-surface-sh, var(--shadow-2)); }
.band { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 16px 10px 24px; border-bottom: 1px solid var(--glass-border); }
:root[data-skin="clay"] .band, :root[data-skin="skeu"] .band, :root[data-skin="flat"] .band, :root[data-skin="glass"] .band { background: var(--sk-primary); color: var(--sk-on-primary); border-bottom: 0; }
:root[data-skin="clay"] .trail, :root[data-skin="skeu"] .trail, :root[data-skin="flat"] .trail, :root[data-skin="glass"] .trail,
:root[data-skin="clay"] .trail a, :root[data-skin="skeu"] .trail a, :root[data-skin="flat"] .trail a, :root[data-skin="glass"] .trail a,
:root[data-skin="clay"] .trail b, :root[data-skin="skeu"] .trail b, :root[data-skin="flat"] .trail b, :root[data-skin="glass"] .trail b { color: inherit; }
.trail { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 0.88rem; font-weight: 700; color: var(--text-2); }
.trail a { color: var(--text-2); text-decoration: none; }
.trail a:hover { color: var(--accent-ink); }
.trail b { color: var(--text); }
.sep { opacity: 0.45; }
.pip { width: 8px; height: 8px; border-radius: 50%; background: #22a35a; box-shadow: 0 0 0 3px rgba(34, 163, 90, 0.2); }
.acts { display: flex; gap: 8px; }
.acts .btn { min-height: 38px; padding: 0 14px; text-decoration: none; }
.title-row { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px; padding: 22px 28px 26px; }
.words { display: flex; flex-direction: column; gap: 6px; min-width: 0; max-width: 720px; }
h1 { font-size: clamp(2rem, 4vw, 2.9rem); font-weight: 800; line-height: 1.04; letter-spacing: -0.03em; text-wrap: balance; }
.words p { color: var(--text-2); font-size: 1.02rem; }
/* phones: the top bar names the page and the sub-tabs sit on their own under it (SubTabs) */
@media (max-width: 720px) { .page-head { display: none; } }
</style>
