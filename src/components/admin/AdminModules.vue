<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Trash2, Move, Plus, Eye, EyeOff, Box } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { decor, loadDecor, changed, removeDecor } from '@/composables/room/useDecor'
import { placed, addModule, modState, setModuleModel } from '@/composables/room/useModules'
import { CATALOG, CATEGORIES } from '@/lib/modules/catalog'
import { mode } from '@/composables/ui/useMode'
import { room } from '@/composables/room/useRoom'
import { api, errorMessage } from '@/composables/site/useAdmin'
import { reloadData, useData, type SectionId } from '@/composables/site/useData'
import { ROUTE_ICONS } from '@/lib/nav'

// Hobbies: everything the room has – its own corners (Japansk, Lytteplassen, Gitarer …) and the hobby modules added to it – in
// one place. A corner can be switched off and back on here; a module is picked from the list and becomes a piece of furniture in
// the room and a page in the menu.
onMounted(loadDecor)
const router = useRouter()
const busy = ref('')
// the room's own corners (built in: their own 3D corner and page)
const data = useData()
const CORNERS: { id: SectionId; name: string; blurb: string; icon: string; route: string; emoji: string }[] = [
  { id: 'lytte', name: 'Lytteplassen', blurb: 'Platespilleren, hylla og musikken (Spotify)', icon: 'M9 18V5l12-2v13M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', route: 'lytte', emoji: '🎵' },
  { id: 'japansk', name: 'Japansk', blurb: 'Ord, repetisjon og anime (jpdb)', icon: ROUTE_ICONS.japansk ?? '', route: 'japansk', emoji: '🗾' },
  { id: 'gitar', name: 'Gitarer og figurer', blurb: 'Gitarveggen, opptak og figurhylla', icon: ROUTE_ICONS.gitar ?? '', route: 'gitar', emoji: '🎸' },
  { id: 'ovelse', name: 'Gitar-øving', blurb: 'Timer, akkorder, stemmer og metronom', icon: ROUTE_ICONS.ovelse ?? '', route: 'ovelse', emoji: '⏱️' },
  { id: 'reiser', name: 'Reiser', blurb: 'Globusen og reisene dine', icon: ROUTE_ICONS.reiser ?? '', route: 'reiser', emoji: '🌍' },
  { id: 'boker', name: 'Bøker', blurb: 'Bokhylla', icon: ROUTE_ICONS.boker ?? '', route: 'boker', emoji: '📚' },
  { id: 'gaming', name: 'Spill', blurb: 'Steam-profilen og spillene dine', icon: ROUTE_ICONS.gaming ?? '', route: 'gaming', emoji: '🎮' },
  { id: 'kode', name: 'Prosjekter', blurb: 'Dine åpne GitHub-prosjekter', icon: ROUTE_ICONS.kode ?? '', route: 'kode', emoji: '💻' },
  { id: 'om', name: 'Om meg', blurb: 'Teksten, bildet og svarene dine', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0', route: 'om', emoji: '👋' },
]
const isOn = (id: SectionId): boolean => (data.profile.sections as Record<string, boolean | undefined>)[id] !== false
const cornersOn = computed(() => CORNERS.filter((c) => isOn(c.id)))
const cornersOff = computed(() => CORNERS.filter((c) => !isOn(c.id)))
const cornerErr = ref('')
async function setCorner(id: SectionId, on: boolean) {
  const c = CORNERS.find((x) => x.id === id)
  if (!on && !confirm(`Ta «${c?.name}» ut av rommet? Det du har lagt inn blir liggende, og du kan sette det tilbake her.`)) return
  busy.value = 'c-' + id
  cornerErr.value = ''
  try { await api('me_settings', { sections: { [id]: on } }); await reloadData() } catch (e) { cornerErr.value = errorMessage(e) } finally { busy.value = '' }
}
const groups = computed(() => CATEGORIES.map((c) => ({ cat: c, kinds: CATALOG.filter((k) => k.cat === c) })))
async function add(type: string) {
  busy.value = type
  const it = await addModule(type)
  busy.value = ''
  // in the 3D room: a free place that is not inside the sofa or the desk (the server only knows where the other modules stand)
  const spot = it && room.api ? room.api.freeSpot(it.id) : null
  if (it && spot) { const d = decor.items.find((i) => i.id === it.id); if (d) { d.x = spot.x; d.z = spot.z; changed() } }
  if (it) void router.push({ name: 'modul', params: { id: it.id } })
}
// the symbol: whichever emoji you like (which tab of the menu it sits under is decided in Rommet → Faner)
const EMOJIS = ['🏊', '🏃', '🚴', '🏋️', '⛰️', '🎣', '🧘', '⚽', '🎾', '⛷️', '🎬', '📺', '🎵', '🎹', '🎸', '🎨', '📷', '🍳', '☕', '🍷', '🌱', '🪴', '🐾', '♟️', '🎲', '🕹️', '✍️', '📚', '🔧', '🧶', '✈️', '⭐']
const openIcons = ref('')
function pickModel(id: string, e: Event) { const i = e.target as HTMLInputElement; const f = i.files?.[0]; i.value = ''; if (f) void setModuleModel(id, f) }
const askRemove = (id: string, name: string) => { if (confirm(`Slette «${name}» og alt som står i den?`)) void removeDecor(id) }
function edit() { decor.editing = true; if (mode.value !== 'rom') void router.push('/') }
</script>

<template>
  <div class="am">
    <p class="intro">Alt rommet ditt har: sine egne hjørner (Lytteplassen, Japansk, Gitarer …) og hobbyene du legger til. En ny hobby blir et møbel i 3D-rommet og en side i menyen. Du kan ha flere av samme sort, flytte dem rundt med «Rediger rommet», og bestemme hvilken fane de ligger under i <b>Faner</b>.</p>
    <p v-if="modState.error" class="notice error">{{ modState.error }}</p>

    <section>
      <h3>I rommet ditt</h3>
      <div class="bar"><button class="btn primary" @click="edit"><Move :size="15" aria-hidden="true" />Flytt rundt i rommet</button></div>
      <p v-if="cornerErr" class="notice error">{{ cornerErr }}</p>
      <ul class="list">
        <li v-for="c in cornersOn" :key="c.id" class="corner">
          <span class="ic">{{ c.emoji }}</span>
          <span class="cn"><b>{{ c.name }}</b><small>{{ c.blurb }} · <i>rommets eget hjørne</i></small></span>
          <router-link class="btn soft small" :to="{ name: c.route }">Åpne</router-link>
          <button class="ib" :title="`Ta ${c.name} ut av rommet`" :aria-label="`Ta ${c.name} ut av rommet`" :disabled="busy === 'c-' + c.id" @click="setCorner(c.id, false)"><EyeOff :size="16" /></button>
        </li>
      </ul>
      <ul v-if="placed.length" class="list">
        <li v-for="m in placed" :key="m.id" :class="{ off: m.item.visible === false }">
          <div class="icowrap">
            <button class="ic" type="button" :aria-label="`Velg symbol for ${m.name}`" :aria-expanded="openIcons === m.id" @click="openIcons = openIcons === m.id ? '' : m.id">{{ m.icon }}</button>
            <div v-if="openIcons === m.id" class="pop">
              <button v-for="e in EMOJIS" :key="e" type="button" @click="m.item.ico = e; changed(); openIcons = ''">{{ e }}</button>
              <input v-model="m.item.ico" maxlength="4" placeholder="Eget" aria-label="Eget symbol" @change="changed()" />
            </div>
          </div>
          <input v-model="m.item.name" type="text" maxlength="50" :placeholder="m.kind.name" :aria-label="`Navn på ${m.kind.name}`" @change="changed()" />

          <label class="btn soft small mdl" :title="m.item.file ? 'Bytt din egen 3D-modell' : 'Bruk din egen 3D-modell (.glb) i stedet for den innebygde'"><Box :size="14" />{{ m.item.file ? 'Bytt modell' : 'Egen modell' }}<input type="file" accept=".glb,model/gltf-binary" hidden @change="pickModel(m.id, $event)" /></label>
          <button v-if="m.item.file" class="btn soft small" type="button" @click="setModuleModel(m.id, null)">Bruk innebygd</button>
          <router-link class="btn soft small" :to="{ name: 'modul', params: { id: m.id } }">Åpne</router-link>
          <button class="ib" :title="m.item.visible === false ? 'Vis i rommet' : 'Skjul i rommet'" @click="m.item.visible = m.item.visible === false; changed()"><EyeOff v-if="m.item.visible !== false" :size="16" /><Eye v-else :size="16" /></button>
          <button class="ib danger" title="Slett" aria-label="Slett" @click="askRemove(m.id, m.name)"><Trash2 :size="16" /></button>
        </li>
      </ul>
    </section>

    <section v-if="cornersOff.length">
      <h3>Rommets egne hjørner</h3>
      <div class="grid">
        <button v-for="c in cornersOff" :key="c.id" class="kind" style="--mc: var(--accent)" :disabled="busy === 'c-' + c.id" @click="setCorner(c.id, true)">
          <span class="e">{{ c.emoji }}</span><b>{{ c.name }}</b><small>{{ c.blurb }}</small><Plus class="p" :size="15" aria-hidden="true" />
        </button>
      </div>
    </section>

    <section v-for="g in groups" :key="g.cat">
      <h3>{{ g.cat }}</h3>
      <div class="grid">
        <button v-for="k in g.kinds" :key="k.id" class="kind" :style="{ '--mc': k.color }" :disabled="busy === k.id" @click="add(k.id)">
          <span class="e">{{ k.icon }}</span><b>{{ k.name }}</b><small>{{ k.blurb }}</small><Plus class="p" :size="15" aria-hidden="true" />
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.am { display: grid; gap: 18px; }
.intro { margin: 0; color: var(--text-3); font-size: 0.86rem; line-height: 1.45; }
h3 { margin: 0 0 8px; font-size: 0.95rem; }
.bar { margin-bottom: 8px; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.list li { display: flex; align-items: center; gap: 8px; } .off { opacity: 0.55; }
.list input { flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--bg); color: var(--text); font: inherit; }
.list li { flex-wrap: wrap; }
.icowrap { position: relative; }
.ic { all: unset; font-size: 1.5rem; cursor: pointer; padding: 2px 6px; border-radius: 10px; } .ic:hover { background: var(--glass-border); }
.pop { position: absolute; z-index: 20; top: 110%; left: 0; width: 248px; display: flex; flex-wrap: wrap; gap: 2px; padding: 8px; border-radius: 14px; background: var(--bg); box-shadow: 0 14px 40px rgba(0, 0, 0, 0.28); border: 1px solid var(--glass-border); }
.pop button { all: unset; cursor: pointer; font-size: 1.35rem; padding: 4px; border-radius: 8px; } .pop button:hover { background: var(--glass-border); }
.pop input { width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; }
.ib { all: unset; cursor: pointer; padding: 6px; border-radius: 8px; } .ib:hover { background: var(--glass-border); } .danger { color: #e5484d; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.kind { all: unset; box-sizing: border-box; position: relative; display: flex; flex-direction: column; gap: 3px; padding: 12px; border-radius: 16px; border: 1px solid var(--glass-border); cursor: pointer; background: color-mix(in srgb, var(--mc) 8%, transparent); transition: transform 0.25s var(--spring, ease), border-color 0.2s; }
.kind:hover, .kind:focus-visible { transform: translateY(-3px); border-color: var(--mc); }
.kind .e { font-size: 1.7rem; } .kind small { color: var(--text-3); font-size: 0.76rem; line-height: 1.3; }
.kind .p { position: absolute; top: 10px; right: 10px; color: var(--mc); }
.mdl { cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
.list + .list { margin-top: 8px; }
.cn { flex: 1; min-width: 0; display: grid; } .cn small { color: var(--text-3); font-size: 0.78rem; } .cn i { font-style: normal; color: var(--accent); }
</style>
