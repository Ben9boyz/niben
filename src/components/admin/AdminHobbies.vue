<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Plus, Trash2, Move, Eye, EyeOff, Box, ExternalLink, LogOut, ChevronUp, ChevronDown, PanelTop, EyeClosed, RotateCcw, Check, LoaderCircle } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { decor, loadDecor, changed, removeDecor, type DecorItem } from '@/composables/room/useDecor'
import { placed, addModule, modState, setModuleModel } from '@/composables/room/useModules'
import { CATALOG, CATEGORIES } from '@/lib/modules/catalog'
import { CORNERS, CORNER_OF_ROUTE, type Corner } from '@/lib/corners'
import { GROUPS, HOBBY, tabLabel } from '@/lib/nav'
import { layout, HIDE, tabOfPage, homeTab, movePage, nudgePage, setTab, moveTab, addTab, removeTab, resetNav, navSave } from '@/composables/room/useNavLayout'
import { iconOf, isIcon } from '@/lib/icons'
import { mode } from '@/composables/ui/useMode'
import { room } from '@/composables/room/useRoom'
import { useData } from '@/composables/site/useData'
import IconPicker from '@/components/ui/IconPicker.vue'
import ServiceSetup from '@/components/ui/ServiceSetup.vue'
import ModuleView from '@/components/content/ModuleView.vue'
import AdminTrips from './AdminTrips.vue'
import AdminBooks from './AdminBooks.vue'
import AdminGuitars from './AdminGuitars.vue'
import AdminRecordings from './AdminRecordings.vue'
import AdminSongs from './AdminSongs.vue'
import AdminFigures from './AdminFigures.vue'
import AdminMusic from './AdminMusic.vue'
import AdminProfile from './AdminProfile.vue'

// Everything the room has, in one place: its own corners (Lytteplassen, Japansk, Gitarer …) and the hobbies added to it.
// Pick one on the left: its name and symbol, where it stands in the room, and what is in it – trips, books, recordings, entries …
// "Legg til" brings a hobby in (or a corner back). A corner and a hobby work the same way; a corner just can't be deleted.
const data = useData()
const router = useRouter()
onMounted(loadDecor)
const busy = ref('')
const err = ref('')

interface Row { key: string; route: string; kind: 'corner' | 'mod' | 'page'; name: string; icon: string; std: string; item?: DecorItem; corner?: Corner; modId?: string }
const sectionOn = (c: Corner): boolean => (data.profile.sections as Record<string, boolean | undefined>)[c.section] !== false
const cornerItem = (c: Corner): DecorItem | undefined => decor.items.find((i) => i.corner === c.id)
// pages that are neither a corner nor a hobby (Spill, Året, Vurderinger): they only have a place in the menu
const PAGE_ICON: Record<string, string> = { gaming: 'Gamepad2', aaret: 'CalendarDays', vurderinger: 'Star' }
function rowOf(r: string): Row | null {
  if (r.startsWith(HOBBY)) {
    const m = placed.value.find((x) => x.id === r.slice(HOBBY.length))
    return m ? { key: 'm:' + m.id, route: r, kind: 'mod', name: m.name, icon: m.icon, std: m.kind.icon, item: m.item, modId: m.id } : null
  }
  const c = CORNERS.find((x) => x.id === CORNER_OF_ROUTE[r])
  if (c) { const it = cornerItem(c); return { key: 'c:' + c.id, route: r, kind: 'corner', name: it?.name?.trim() || c.name, icon: it?.ico || c.icon, std: c.icon, item: it, corner: c } }
  return { key: 'p:' + r, route: r, kind: 'page', name: tabLabel(r), icon: PAGE_ICON[r] ?? 'Star', std: PAGE_ICON[r] ?? 'Star' }
}
// the list on the left is the room's menu itself: each tab, with its hobbies under it – and what is hidden at the bottom
const sections = computed(() => [
  ...layout.value.tabs.map((t) => ({ id: t.id, label: t.label, icon: t.icon, rows: t.routes.map(rowOf).filter((x): x is Row => !!x) })),
  { id: HIDE, label: 'Ikke i menyen', icon: '', rows: layout.value.hidden.map(rowOf).filter((x): x is Row => !!x) },
])
const rows = computed<Row[]>(() => sections.value.flatMap((t) => t.rows))
const tabSvg = (id: string): string => GROUPS.find((g) => g.id === id)?.icon ?? GROUPS.find((g) => g.id === 'hobby')!.icon
const KEY = 'niben-admin-hobby'
const sel = ref<string>((() => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } })())
watch(sel, (v) => { try { localStorage.setItem(KEY, v) } catch { /* private mode */ } })
const curTab = computed(() => (sel.value.startsWith('t:') ? layout.value.tabs.find((t) => 't:' + t.id === sel.value) ?? null : null))
const cur = computed(() => (curTab.value || sel.value === 'add' ? null : rows.value.find((r) => r.key === sel.value) ?? rows.value[0] ?? null))
const adding = computed(() => sel.value === 'add' || (!curTab.value && !rows.value.length))
function newTab() { sel.value = 't:' + addTab() }
async function dropTab(id: string, label: string) { if (confirm(`Fjerne fanen «${label}»? Det som ligger under den går tilbake dit det sto før.`)) { await removeTab(id); sel.value = '' } }

// ── the head: the same for a corner and a hobby ──
function setIcon(r: Row, name: string) { if (!r.item) return; r.item.ico = name === r.std ? '' : name; changed() }
function setName(r: Row, e: Event) { if (!r.item) return; r.item.name = (e.target as HTMLInputElement).value; changed() }
function toggle3d(r: Row) { if (!r.item) return; r.item.visible = r.item.visible === false; changed() }
function moveInRoom(r: Row) { decor.editing = true; if (mode.value !== 'rom') void router.push('/'); setTimeout(() => room.api?.selectDecor(r.item?.id ?? null), 600) }
const openTo = (r: Row) => (r.kind === 'mod' ? { name: 'modul', params: { id: r.modId } } : { name: r.route })
async function takeOut(r: Row) {
  if (r.kind === 'mod') { if (confirm(`Slette «${r.name}» og alt som står i den?`)) { await removeDecor(r.modId!); sel.value = '' } return }
  if (!confirm(`Ta «${r.name}» ut av rommet? Det du har lagt inn blir liggende, og du kan sette det inn igjen under «Legg til».`)) return
  await movePage(r.route, HIDE, true) // (hidden from the menu = the corner is switched off)
}
function pickModel(id: string, e: Event) { const i = e.target as HTMLInputElement; const f = i.files?.[0]; i.value = ''; if (f) void setModuleModel(id, f) }
const gitarTab = ref<'gitarer' | 'opptak' | 'sanger'>('gitarer')

// ── adding: a corner back, or a new hobby ──
const cornersOff = computed(() => CORNERS.filter((c) => !sectionOn(c) && c.id !== 'figurer'))
const moveTo = (r: Row, e: Event) => movePage(r.route, (e.target as HTMLSelectElement).value)
const groups = computed(() => CATEGORIES.map((c) => ({ cat: c, kinds: CATALOG.filter((k) => k.cat === c) })))
async function add(type: string) {
  busy.value = type
  const it = await addModule(type)
  busy.value = ''
  // in the 3D room: a free place that is not inside the sofa or the desk (the server only knows where the other hobbies stand)
  const spot = it && room.api ? room.api.freeSpot(it.id) : null
  if (it && spot) { const d = decor.items.find((i) => i.id === it.id); if (d) { d.x = spot.x; d.z = spot.z; changed() } }
  if (it) sel.value = 'm:' + it.id
}
async function bringBack(c: Corner) { busy.value = 'c-' + c.id; await movePage(c.route, homeTab(c.route), true); busy.value = ''; sel.value = 'c:' + c.id }
</script>

<template>
  <div class="ah">
    <nav class="side" aria-label="Menyen og hobbyene i rommet">
      <template v-for="(t, ti) in sections" :key="t.id">
        <button v-if="t.id !== HIDE" class="tabh" :class="{ on: sel === 't:' + t.id, empty: !t.rows.length }" :title="`Fanen «${t.label}» – navn, symbol og rekkefølge`" @click="sel = 't:' + t.id">
          <component :is="iconOf(t.icon)" v-if="isIcon(t.icon)" :size="14" aria-hidden="true" />
          <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="tabSvg(t.id)" /></svg>
          <span>{{ t.label }}</span><small v-if="!t.rows.length">tom</small>
        </button>
        <p v-else-if="t.rows.length" class="tabh hid"><EyeClosed :size="14" aria-hidden="true" /><span>{{ t.label }}</span></p>
        <div class="grp">
          <button v-for="r in t.rows" :key="r.key" class="it" :class="{ on: !adding && !curTab && cur?.key === r.key, off: r.item?.visible === false || t.id === HIDE }" @click="sel = r.key">
            <component :is="iconOf(r.icon)" :size="17" aria-hidden="true" /><span>{{ r.name }}</span>
          </button>
        </div>
      </template>
      <button class="it add" :class="{ on: adding }" @click="sel = 'add'"><Plus :size="17" aria-hidden="true" /><span>Legg til hobby</span></button>
      <button class="it add" :disabled="layout.tabs.length >= 12" @click="newTab"><PanelTop :size="17" aria-hidden="true" /><span>Ny fane</span></button>
      <p class="saved" aria-live="polite">
        <template v-if="navSave.busy"><LoaderCircle :size="13" class="spin" />Lagrer menyen …</template>
        <template v-else-if="navSave.error"><span class="bad">{{ navSave.error }}</span></template>
        <template v-else-if="navSave.ok"><Check :size="13" />Menyen er lagret</template>
      </p>
    </nav>

    <div class="main">
      <p v-if="err || modState.error" class="notice error">{{ err || modState.error }}</p>

      <!-- one tab of the menu: its name, its symbol, its place – and what is under it, in order -->
      <template v-if="curTab">
        <header class="head">
          <IconPicker :model-value="curTab.icon" :label="`Symbol for ${curTab.label}`" :standard="tabSvg(curTab.id)" @update:model-value="setTab(curTab.id, { icon: $event })" />
          <input class="name" :value="curTab.label" maxlength="24" :aria-label="`Navn på fanen ${curTab.label}`" @change="setTab(curTab.id, { label: ($event.target as HTMLInputElement).value.trim() || 'Fane' })" />
        </header>
        <div class="acts">
          <button class="btn soft small" type="button" :disabled="layout.tabs[0]?.id === curTab.id" @click="moveTab(curTab.id, -1)"><ChevronUp :size="14" />Tidligere i menyen</button>
          <button class="btn soft small" type="button" :disabled="layout.tabs[layout.tabs.length - 1]?.id === curTab.id" @click="moveTab(curTab.id, 1)"><ChevronDown :size="14" />Senere i menyen</button>
          <button class="btn soft small danger" type="button" @click="dropTab(curTab.id, curTab.label)"><Trash2 :size="14" />Fjern fanen</button>
        </div>
        <div class="body">
          <p class="intro">En fane i menyen. Det som ligger under den vises som små faner inni siden – i denne rekkefølgen. Flytt en hobby hit fra hobbyen selv («Ligger under»). En tom fane vises ikke.</p>
          <ol class="order">
            <li v-for="(r, i) in (sections.find((x) => x.id === curTab!.id)?.rows ?? [])" :key="r.key">
              <component :is="iconOf(r.icon)" :size="16" aria-hidden="true" />
              <button class="lnk" type="button" @click="sel = r.key">{{ r.name }}</button>
              <button class="ib" type="button" :disabled="i === 0" :aria-label="`${r.name} tidligere`" @click="nudgePage(r.route, -1)"><ChevronUp :size="15" /></button>
              <button class="ib" type="button" :disabled="i === (sections.find((x) => x.id === curTab!.id)?.rows.length ?? 0) - 1" :aria-label="`${r.name} senere`" @click="nudgePage(r.route, 1)"><ChevronDown :size="15" /></button>
            </li>
          </ol>
          <p class="muted">Vil du ha menyen slik den var? <button class="lnk" type="button" @click="resetNav"><RotateCcw :size="12" /> Standardmenyen</button></p>
        </div>
      </template>

      <!-- add: a corner back, or a new hobby -->
      <template v-else-if="adding">
        <p class="intro">Legg til en hobby – den blir et møbel i 3D-rommet og en side i menyen. Du kan ha flere av samme sort.</p>
        <section v-if="cornersOff.length">
          <h3>Rommets egne hjørner</h3>
          <div class="grid">
            <button v-for="c in cornersOff" :key="c.id" class="kind" :disabled="busy === 'c-' + c.id" @click="bringBack(c)"><component :is="iconOf(c.icon)" :size="22" class="e" /><b>{{ c.name }}</b><small>{{ c.blurb }}</small><Plus class="p" :size="15" /></button>
          </div>
        </section>
        <section v-for="g in groups" :key="g.cat">
          <h3>{{ g.cat }}</h3>
          <div class="grid">
            <button v-for="k in g.kinds" :key="k.id" class="kind" :style="{ '--mc': k.color }" :disabled="busy === k.id" @click="add(k.id)"><component :is="iconOf(k.icon)" :size="22" class="e" /><b>{{ k.name }}</b><small>{{ k.blurb }}</small><Plus class="p" :size="15" /></button>
          </div>
        </section>
      </template>

      <!-- one hobby / corner -->
      <template v-else-if="cur">
        <header v-if="cur.kind === 'page'" class="head"><component :is="iconOf(cur.icon)" :size="22" class="pi" /><h3 class="pname">{{ cur.name }}</h3></header>
        <header v-else class="head" :class="{ off: cur.item?.visible === false }">
          <IconPicker :model-value="cur.icon" :label="`Symbol for ${cur.name}`" @update:model-value="setIcon(cur, $event)" />
          <input class="name" :value="cur.item?.name ?? ''" :placeholder="cur.kind === 'corner' ? cur.corner!.name : cur.name" maxlength="50" :aria-label="`Navn på ${cur.name}`" @change="setName(cur, $event)" />
        </header>
        <div class="acts">
          <label class="btn soft small tabsel"><PanelTop :size="14" />Ligger under
            <select :value="tabOfPage(cur.route)" :aria-label="`Hvilken fane ${cur.name} ligger under`" @change="moveTo(cur, $event)">
              <option v-for="o in layout.tabs" :key="o.id" :value="o.id">{{ o.label }}</option>
              <option :value="HIDE">{{ cur.kind === 'corner' && cur.route === cur.corner?.section ? 'Ingen (hjørnet skrus av)' : 'Ingen – ikke i menyen' }}</option>
            </select>
          </label>
          <router-link class="btn soft small" :to="openTo(cur)"><ExternalLink :size="14" />Åpne</router-link>
          <button v-if="cur.item" class="btn soft small" type="button" @click="moveInRoom(cur)"><Move :size="14" />Flytt i rommet</button>
          <button v-if="cur.item" class="btn soft small" type="button" @click="toggle3d(cur)"><EyeOff v-if="cur.item?.visible !== false" :size="14" /><Eye v-else :size="14" />{{ cur.item?.visible === false ? 'Vis i 3D' : 'Skjul i 3D' }}</button>
          <label v-if="cur.kind === 'mod'" class="btn soft small"><Box :size="14" />{{ cur.item?.file ? 'Bytt 3D-modell' : 'Egen 3D-modell' }}<input type="file" accept=".glb,model/gltf-binary" hidden @change="pickModel(cur.modId!, $event)" /></label>
          <button v-if="cur.kind === 'mod' && cur.item?.file" class="btn soft small" type="button" @click="setModuleModel(cur.modId!, null)">Bruk innebygd modell</button>
          <button v-if="cur.kind !== 'page' && tabOfPage(cur.route) !== HIDE" class="btn soft small danger" type="button" :disabled="busy === 'c-' + cur.corner?.id" @click="takeOut(cur)"><Trash2 v-if="cur.kind === 'mod'" :size="14" /><LogOut v-else :size="14" />{{ cur.kind === 'mod' ? 'Slett' : 'Ta ut av rommet' }}</button>
        </div>

        <div class="body">
          <ModuleView v-if="cur.kind === 'mod'" :id="cur.modId!" />
          <template v-else-if="cur.kind === 'page'">
            <template v-if="cur.route === 'gaming'"><ServiceSetup service="steam" /><p class="muted">Spillene hentes fra Steam.</p></template>
            <p v-else-if="cur.route === 'vurderinger'" class="muted">Samler stjernene du har gitt i hobbyene dine – ingenting å legge inn her.</p>
            <p v-else class="muted">Ingenting å legge inn her – alt skjer på siden.</p>
          </template>
          <template v-else>
            <AdminTrips v-if="cur.corner!.id === 'reiser'" />
            <AdminBooks v-else-if="cur.corner!.id === 'boker'" />
            <AdminFigures v-else-if="cur.corner!.id === 'figurer'" />
            <AdminMusic v-else-if="cur.corner!.id === 'lytte'" />
            <AdminProfile v-else-if="cur.corner!.id === 'om'" part="om" />
            <template v-else-if="cur.corner!.id === 'gitar'">
              <nav class="mini" role="tablist" aria-label="Gitarer">
                <button role="tab" :aria-selected="gitarTab === 'gitarer'" :class="{ on: gitarTab === 'gitarer' }" @click="gitarTab = 'gitarer'">Gitarer</button>
                <button role="tab" :aria-selected="gitarTab === 'opptak'" :class="{ on: gitarTab === 'opptak' }" @click="gitarTab = 'opptak'">Opptak</button>
                <button role="tab" :aria-selected="gitarTab === 'sanger'" :class="{ on: gitarTab === 'sanger' }" @click="gitarTab = 'sanger'">Sanger</button>
              </nav>
              <AdminGuitars v-if="gitarTab === 'gitarer'" />
              <AdminRecordings v-else-if="gitarTab === 'opptak'" />
              <AdminSongs v-else />
            </template>
            <template v-else-if="cur.corner!.id === 'japansk'"><ServiceSetup service="jpdb" /><p class="muted">Ordene, repetisjonen og animeen hentes fra jpdb. Selve øvingen skjer på siden.</p></template>
            <template v-else-if="cur.corner!.id === 'kode'"><ServiceSetup service="github" /><p class="muted">Prosjektene hentes fra GitHub.</p></template>
            <p v-else class="muted">Ingenting å legge inn her – alt skjer på siden.</p>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ah { display: grid; grid-template-columns: 190px 1fr; gap: 18px; align-items: start; }
.side { display: flex; flex-direction: column; gap: 2px; position: sticky; top: 0; }
.it { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 11px; color: var(--text-2); font-weight: 600; font-size: 0.9rem; }
.it span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.it:hover { background: var(--glass-border); color: var(--text); }
.it.on { background: var(--accent-soft); color: var(--accent); }
.it.off span { opacity: 0.55; }
.it.add { margin-top: 6px; border: 1px dashed var(--glass-border); } .it:disabled { opacity: 0.4; cursor: default; }
.tabh { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 6px; margin: 10px 0 2px; padding: 3px 10px; border-radius: 8px; color: var(--text-3); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.tabh:first-child { margin-top: 0; } .tabh span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .tabh small { font-weight: 600; text-transform: none; letter-spacing: 0; opacity: 0.7; }
.tabh:hover { color: var(--text); background: var(--glass-border); } .tabh.on { color: var(--accent); background: var(--accent-soft); } .tabh.empty { opacity: 0.6; }
.tabh.hid { cursor: default; } .tabh.hid:hover { background: none; color: var(--text-3); }
.grp { display: flex; flex-direction: column; gap: 2px; margin-left: 9px; padding-left: 6px; border-left: 2px solid var(--glass-border); }
.grp:empty { display: none; }
.saved { margin: 8px 0 0; min-height: 1.2em; display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: var(--text-3); } .saved .bad { color: #e5484d; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.tabsel select { margin-left: 4px; padding: 2px 4px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; font-size: 0.8rem; max-width: 170px; }
.order { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; counter-reset: o; }
.order li { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 12px; background: var(--accent-soft); }
.order li::before { counter-increment: o; content: counter(o); width: 1.2em; color: var(--text-3); font-size: 0.75rem; font-weight: 800; }
.order .lnk { flex: 1; text-align: left; font-weight: 600; }
.lnk { all: unset; cursor: pointer; color: var(--accent); display: inline-flex; align-items: center; gap: 3px; } .lnk:hover { text-decoration: underline; }
.ib { all: unset; cursor: pointer; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; color: var(--text-2); } .ib:hover:not(:disabled) { background: var(--glass-border); } .ib:disabled { opacity: 0.3; cursor: default; }
.pi { color: var(--accent); } .pname { margin: 0; font-size: 1.05rem; }
.main { min-width: 0; display: grid; gap: 14px; }
.intro, .muted { margin: 0; color: var(--text-3); font-size: 0.86rem; line-height: 1.45; }
h3 { margin: 0 0 8px; font-size: 0.95rem; }
.head { display: flex; align-items: center; gap: 8px; } .head.off .name { opacity: 0.6; }
.name { flex: 1; min-width: 0; padding: 9px 12px; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--bg); color: var(--text); font: 800 1.05rem var(--font); }
.acts { display: flex; gap: 6px; flex-wrap: wrap; }
.acts .btn { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
.acts .danger { color: #e5484d; }
.body { border-top: 1px solid var(--glass-border); padding-top: 14px; display: grid; gap: 12px; }
.mini { display: flex; gap: 4px; }
.mini button { all: unset; cursor: pointer; padding: 6px 13px; border-radius: 999px; font-size: 0.86rem; font-weight: 600; color: var(--text-2); border: 1px solid transparent; }
.mini button.on { border-color: var(--accent); color: var(--accent); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.kind { all: unset; box-sizing: border-box; position: relative; display: flex; flex-direction: column; gap: 3px; padding: 12px; border-radius: 16px; border: 1px solid var(--glass-border); cursor: pointer; background: color-mix(in srgb, var(--mc, var(--accent)) 8%, transparent); transition: transform 0.25s var(--spring, ease), border-color 0.2s; }
.kind:hover, .kind:focus-visible { transform: translateY(-3px); border-color: var(--mc, var(--accent)); }
.kind .e { color: var(--mc, var(--accent)); } .kind small { color: var(--text-3); font-size: 0.76rem; line-height: 1.3; }
.kind .p { position: absolute; top: 10px; right: 10px; color: var(--mc, var(--accent)); }
@media (max-width: 720px) {
  .ah { grid-template-columns: 1fr; }
  .side { position: static; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px; padding-bottom: 4px; }
  .it, .tabh { flex: none; } .tabh { margin: 0; } .grp { flex-direction: row; flex-wrap: wrap; margin: 0; border-left: 0; padding: 0; } .saved { flex-basis: 100%; }
}
</style>
