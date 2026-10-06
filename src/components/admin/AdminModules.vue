<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Trash2, Move, Plus, Eye, EyeOff, Box } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { decor, loadDecor, changed, removeDecor } from '@/composables/room/useDecor'
import { placed, addModule, modState, setModuleModel } from '@/composables/room/useModules'
import { CATALOG, CATEGORIES } from '@/lib/modules/catalog'
import { mode } from '@/composables/ui/useMode'

// Hobbies: pick the ones you want from the list – each becomes a piece of furniture in the room, a page, and a tab in the menu.
onMounted(loadDecor)
const router = useRouter()
const busy = ref('')
const groups = computed(() => CATEGORIES.map((c) => ({ cat: c, kinds: CATALOG.filter((k) => k.cat === c) })))
async function add(type: string) {
  busy.value = type
  const it = await addModule(type)
  busy.value = ''
  if (it) void router.push({ name: 'modul', params: { id: it.id } })
}
// the symbol and the tab: whichever emoji you like, and under which tab of the menu the module sits (Hobbyer, Lære, Laget, Opplevd – or a tab of one's own)
const EMOJIS = ['🏊', '🏃', '🚴', '🏋️', '⛰️', '🎣', '🧘', '⚽', '🎾', '⛷️', '🎬', '📺', '🎵', '🎹', '🎸', '🎨', '📷', '🍳', '☕', '🍷', '🌱', '🪴', '🐾', '♟️', '🎲', '🕹️', '✍️', '📚', '🔧', '🧶', '✈️', '⭐']
const PRESET_TABS = [{ v: '', l: 'Hobbyer' }, { v: 'lare', l: 'Lære' }, { v: 'laget', l: 'Laget' }, { v: 'opplevd', l: 'Opplevd' }]
const isPreset = (g: string | undefined): boolean => PRESET_TABS.some((p) => p.v === (g ?? ''))
const tabChoice = (g: string | undefined): string => (isPreset(g) ? g ?? '' : '*')
function setTab(m: { item: { grp?: string } }, v: string): void { m.item.grp = v === '*' ? (isPreset(m.item.grp) ? 'Trening' : m.item.grp) : v; changed() }
const openIcons = ref('')
function pickModel(id: string, e: Event) { const i = e.target as HTMLInputElement; const f = i.files?.[0]; i.value = ''; if (f) void setModuleModel(id, f) }
const askRemove = (id: string, name: string) => { if (confirm(`Slette «${name}» og alt som står i den?`)) void removeDecor(id) }
function edit() { decor.editing = true; if (mode.value !== 'rom') void router.push('/') }
</script>

<template>
  <div class="am">
    <p class="intro">Velg hobbyene du vil ha. Hver blir et møbel i 3D-rommet, en side og en fane i menyen. Du kan ha flere av samme sort, og flytte dem rundt med «Rediger rommet».</p>
    <p v-if="modState.error" class="notice error">{{ modState.error }}</p>

    <section v-if="placed.length">
      <h3>I rommet ditt</h3>
      <div class="bar"><button class="btn primary" @click="edit"><Move :size="15" aria-hidden="true" />Flytt rundt i rommet</button></div>
      <ul class="list">
        <li v-for="m in placed" :key="m.id" :class="{ off: m.item.visible === false }">
          <div class="icowrap">
            <button class="ic" type="button" :aria-label="`Velg symbol for ${m.name}`" :aria-expanded="openIcons === m.id" @click="openIcons = openIcons === m.id ? '' : m.id">{{ m.icon }}</button>
            <div v-if="openIcons === m.id" class="pop">
              <button v-for="e in EMOJIS" :key="e" type="button" @click="m.item.ico = e; changed(); openIcons = ''">{{ e }}</button>
              <input v-model="m.item.ico" maxlength="4" placeholder="Eget" aria-label="Eget symbol" @change="changed()" />
            </div>
          </div>
          <input v-model="m.item.name" type="text" maxlength="50" :placeholder="m.kind.name" :aria-label="`Navn på ${m.kind.name}`" @change="changed()" />
          <select :value="tabChoice(m.item.grp)" :aria-label="`Fane for ${m.name}`" @change="setTab(m, ($event.target as HTMLSelectElement).value)">
            <option v-for="p in PRESET_TABS" :key="p.v" :value="p.v">{{ p.l }}</option><option value="*">Egen fane …</option>
          </select>
          <input v-if="tabChoice(m.item.grp) === '*'" v-model="m.item.grp" class="own" maxlength="30" placeholder="Navn på fanen" aria-label="Navn på egen fane" @change="changed()" />
          <label class="btn soft small mdl" :title="m.item.file ? 'Bytt din egen 3D-modell' : 'Bruk din egen 3D-modell (.glb) i stedet for den innebygde'"><Box :size="14" />{{ m.item.file ? 'Bytt modell' : 'Egen modell' }}<input type="file" accept=".glb,model/gltf-binary" hidden @change="pickModel(m.id, $event)" /></label>
          <button v-if="m.item.file" class="btn soft small" type="button" @click="setModuleModel(m.id, null)">Bruk innebygd</button>
          <router-link class="btn soft small" :to="{ name: 'modul', params: { id: m.id } }">Åpne</router-link>
          <button class="ib" :title="m.item.visible === false ? 'Vis i rommet' : 'Skjul i rommet'" @click="m.item.visible = m.item.visible === false; changed()"><EyeOff v-if="m.item.visible !== false" :size="16" /><Eye v-else :size="16" /></button>
          <button class="ib danger" title="Slett" aria-label="Slett" @click="askRemove(m.id, m.name)"><Trash2 :size="16" /></button>
        </li>
      </ul>
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
.list select, .own { padding: 8px 10px; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--bg); color: var(--text); font: inherit; }
.own { width: 150px; }
.ib { all: unset; cursor: pointer; padding: 6px; border-radius: 8px; } .ib:hover { background: var(--glass-border); } .danger { color: #e5484d; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.kind { all: unset; box-sizing: border-box; position: relative; display: flex; flex-direction: column; gap: 3px; padding: 12px; border-radius: 16px; border: 1px solid var(--glass-border); cursor: pointer; background: color-mix(in srgb, var(--mc) 8%, transparent); transition: transform 0.25s var(--spring, ease), border-color 0.2s; }
.kind:hover, .kind:focus-visible { transform: translateY(-3px); border-color: var(--mc); }
.kind .e { font-size: 1.7rem; } .kind small { color: var(--text-3); font-size: 0.76rem; line-height: 1.3; }
.kind .p { position: absolute; top: 10px; right: 10px; color: var(--mc); }
.mdl { cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
</style>
