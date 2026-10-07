<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Plus, Trash2, Move, Eye, EyeOff, Box, ExternalLink, LogOut } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { decor, loadDecor, changed, removeDecor, type DecorItem } from '@/composables/room/useDecor'
import { placed, addModule, modState, setModuleModel } from '@/composables/room/useModules'
import { CATALOG, CATEGORIES } from '@/lib/modules/catalog'
import { CORNERS, type Corner } from '@/lib/corners'
import { iconOf } from '@/lib/icons'
import { mode } from '@/composables/ui/useMode'
import { room } from '@/composables/room/useRoom'
import { api, errorMessage } from '@/composables/site/useAdmin'
import { reloadData, useData } from '@/composables/site/useData'
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

interface Row { key: string; kind: 'corner' | 'mod'; name: string; icon: string; std: string; item?: DecorItem; corner?: Corner; modId?: string }
const sectionOn = (c: Corner): boolean => (data.profile.sections as Record<string, boolean | undefined>)[c.section] !== false
const cornerItem = (c: Corner): DecorItem | undefined => decor.items.find((i) => i.corner === c.id)
const rows = computed<Row[]>(() => [
  ...CORNERS.filter(sectionOn).map((c): Row => { const it = cornerItem(c); return { key: 'c:' + c.id, kind: 'corner', name: it?.name?.trim() || c.name, icon: it?.ico || c.icon, std: c.icon, item: it, corner: c } }),
  ...placed.value.map((m): Row => ({ key: 'm:' + m.id, kind: 'mod', name: m.name, icon: m.icon, std: m.kind.icon, item: m.item, modId: m.id })),
])
const KEY = 'niben-admin-hobby'
const sel = ref<string>((() => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } })())
watch(sel, (v) => { try { localStorage.setItem(KEY, v) } catch { /* private mode */ } })
const cur = computed(() => rows.value.find((r) => r.key === sel.value) ?? (sel.value === 'add' ? null : rows.value[0] ?? null))
const adding = computed(() => sel.value === 'add' || !rows.value.length)

// ── the head: the same for a corner and a hobby ──
function setIcon(r: Row, name: string) { if (!r.item) return; r.item.ico = name === r.std ? '' : name; changed() }
function setName(r: Row, e: Event) { if (!r.item) return; r.item.name = (e.target as HTMLInputElement).value; changed() }
function toggle3d(r: Row) { if (!r.item) return; r.item.visible = r.item.visible === false; changed() }
function moveInRoom(r: Row) { decor.editing = true; if (mode.value !== 'rom') void router.push('/'); setTimeout(() => room.api?.selectDecor(r.item?.id ?? null), 600) }
const openTo = (r: Row) => (r.kind === 'mod' ? { name: 'modul', params: { id: r.modId } } : { name: r.corner!.route })
async function takeOut(r: Row) {
  if (r.kind === 'mod') { if (confirm(`Slette «${r.name}» og alt som står i den?`)) { await removeDecor(r.modId!); sel.value = '' } return }
  if (!confirm(`Ta «${r.name}» ut av rommet? Det du har lagt inn blir liggende, og du kan sette det inn igjen under «Legg til».`)) return
  await setSection(r.corner!, false)
  sel.value = ''
}
async function setSection(c: Corner, on: boolean) {
  busy.value = 'c-' + c.id
  err.value = ''
  try { await api('me_settings', { sections: { [c.section]: on } }); await reloadData() } catch (e) { err.value = errorMessage(e) } finally { busy.value = '' }
}
function pickModel(id: string, e: Event) { const i = e.target as HTMLInputElement; const f = i.files?.[0]; i.value = ''; if (f) void setModuleModel(id, f) }
const gitarTab = ref<'gitarer' | 'opptak' | 'sanger'>('gitarer')

// ── adding: a corner back, or a new hobby ──
const cornersOff = computed(() => CORNERS.filter((c) => !sectionOn(c) && c.id !== 'figurer'))
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
async function bringBack(c: Corner) { await setSection(c, true); sel.value = 'c:' + c.id }
</script>

<template>
  <div class="ah">
    <nav class="side" aria-label="Hobbyene i rommet">
      <button v-for="r in rows" :key="r.key" class="it" :class="{ on: !adding && cur?.key === r.key, off: r.item?.visible === false }" @click="sel = r.key">
        <component :is="iconOf(r.icon)" :size="17" aria-hidden="true" /><span>{{ r.name }}</span>
      </button>
      <button class="it add" :class="{ on: adding }" @click="sel = 'add'"><Plus :size="17" aria-hidden="true" /><span>Legg til</span></button>
    </nav>

    <div class="main">
      <p v-if="err || modState.error" class="notice error">{{ err || modState.error }}</p>

      <!-- add: a corner back, or a new hobby -->
      <template v-if="adding">
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
        <header class="head" :class="{ off: cur.item?.visible === false }">
          <IconPicker :model-value="cur.icon" :label="`Symbol for ${cur.name}`" @update:model-value="setIcon(cur, $event)" />
          <input class="name" :value="cur.item?.name ?? ''" :placeholder="cur.kind === 'corner' ? cur.corner!.name : cur.name" maxlength="50" :aria-label="`Navn på ${cur.name}`" @change="setName(cur, $event)" />
        </header>
        <div class="acts">
          <router-link class="btn soft small" :to="openTo(cur)"><ExternalLink :size="14" />Åpne</router-link>
          <button class="btn soft small" type="button" @click="moveInRoom(cur)"><Move :size="14" />Flytt i rommet</button>
          <button class="btn soft small" type="button" @click="toggle3d(cur)"><EyeOff v-if="cur.item?.visible !== false" :size="14" /><Eye v-else :size="14" />{{ cur.item?.visible === false ? 'Vis i 3D' : 'Skjul i 3D' }}</button>
          <label v-if="cur.kind === 'mod'" class="btn soft small"><Box :size="14" />{{ cur.item?.file ? 'Bytt 3D-modell' : 'Egen 3D-modell' }}<input type="file" accept=".glb,model/gltf-binary" hidden @change="pickModel(cur.modId!, $event)" /></label>
          <button v-if="cur.kind === 'mod' && cur.item?.file" class="btn soft small" type="button" @click="setModuleModel(cur.modId!, null)">Bruk innebygd modell</button>
          <button class="btn soft small danger" type="button" :disabled="busy === 'c-' + cur.corner?.id" @click="takeOut(cur)"><Trash2 v-if="cur.kind === 'mod'" :size="14" /><LogOut v-else :size="14" />{{ cur.kind === 'mod' ? 'Slett' : 'Ta ut av rommet' }}</button>
        </div>

        <div class="body">
          <ModuleView v-if="cur.kind === 'mod'" :id="cur.modId!" />
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
            <template v-else-if="cur.corner!.id === 'kode'"><ServiceSetup service="github" /><ServiceSetup service="steam" /><p class="muted">Prosjektene hentes fra GitHub og spillene fra Steam.</p></template>
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
.it.add { margin-top: 6px; border: 1px dashed var(--glass-border); }
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
  .side { position: static; flex-direction: row; overflow-x: auto; padding-bottom: 4px; }
  .it { flex: none; }
}
</style>
