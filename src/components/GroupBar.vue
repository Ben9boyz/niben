<script setup>
import { ref, computed, watch } from 'vue'
import { Layers, Pencil, Plus, ArrowUp, ArrowDown, X, Check } from 'lucide-vue-next'
import FolderIcon from './FolderIcon.vue'
import { groups, setGrouping, setView, saveGroups, groupCover, itemsIn, coverOfUri } from '../composables/useGroups'
import { admin } from '../composables/useAdmin'
import { notify } from '../composables/useSpotify'

// Above the albums / playlists: a switch for grouping, and (admin) "Rediger" – moving things between groups
// and adding / renaming / reordering / deleting the groups themselves.
const props = defineProps({ artist: Boolean }) // albums: the "Artist" view is offered (and no "Lister")
const view = computed(() => (props.artist && groups.view === 'lister' ? 'mapper' : groups.view))
const draft = ref([])
const open = computed(() => admin.loggedIn && groups.editing)
watch(open, (on) => { if (on) draft.value = groups.list.map((g) => ({ ...g })) }, { immediate: true })

const move = (i, d) => { const a = draft.value, j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]] }
// a group can be put inside one that is on its own (one level of folders)
const parents = (g) => (g.parent || draft.value.some((x) => x.parent === g.id) ? draft.value.filter((o) => o.id === g.parent) : draft.value.filter((o) => o.id && o.id !== g.id && !o.parent))
// the picture on a folder: pick one of the covers in it, "Automatisk" (the first) or none
const picking = ref(null)
const choices = (g) => (g.id ? itemsIn(g.id).map((u) => ({ uri: u, img: coverOfUri(u) })).filter((c) => c.img).slice(0, 16) : [])
function setCover(g, v) { if (v) g.cover = v; else delete g.cover; picking.value = null; save() }
const add = () => draft.value.push({ id: '', name: '' })
const remove = (i) => { if (draft.value.length > 1) draft.value.splice(i, 1) }
async function save() {
  const r = await saveGroups(draft.value.filter((g) => g.name.trim()))
  if (r.ok) draft.value = groups.list.map((g) => ({ ...g }))
  else notify(r.error, true)
}
</script>

<template>
  <div class="gb">
    <div class="row">
      <button class="sw" :class="{ on: groups.on }" role="switch" :aria-checked="groups.on" title="Grupper av / på" aria-label="Grupper av / på" @click="setGrouping(!groups.on)">
        <Layers :size="15" />
      </button>
      <span v-if="groups.on" class="vw" role="group" aria-label="Visning">
        <button :class="{ on: view === 'mapper' }" @click="setView('mapper')">Mapper</button>
        <button v-if="!artist" :class="{ on: view === 'lister' }" @click="setView('lister')">Lister</button>
        <button v-if="artist" :class="{ on: view === 'artist' }" @click="setView('artist')">Artist</button>
      </span>
      <button v-if="admin.loggedIn && groups.on && groups.view !== 'artist'" class="ed" :class="{ on: groups.editing }" @click="groups.editing = !groups.editing"><Pencil :size="13" />{{ groups.editing ? 'Ferdig' : 'Rediger' }}</button>
    </div>
    <div v-if="open && groups.on" class="editor">
      <p class="hint">Flytt ting med valgene på hver flis, eller dra dem til en annen gruppe. «gjettet» betyr at gruppen bare er et forslag – fra sjangeren til artistene, lyden (instrumentalitet og energi) eller navnet.</p>
      <p class="hint">Lyddata fra Spotify: {{ groups.audio === 'yes' ? 'brukes til å gjette' : groups.audio === 'no' ? 'ikke tilgjengelig for appen din (Spotify stengte det for nye apper)' : 'ikke prøvd ennå' }}.</p>
      <template v-for="(g, i) in draft" :key="g.id || i">
      <div class="g">
        <button class="pic" :title="'Bilde på mappa'" :aria-label="`Bilde på mappa ${g.name}`" @click="picking = picking === i ? null : i"><FolderIcon :image="g.id ? groupCover(g.id) : null" :size="18" /></button>
        <input v-model="g.name" maxlength="40" placeholder="Navn på gruppe" :aria-label="`Gruppe ${i + 1}`" @change="save" />
        <select v-model="g.parent" class="par" :aria-label="`Mappe i … for ${g.name || 'gruppen'}`" title="Legg som mappe inni en annen gruppe" @change="save">
          <option :value="undefined">Egen gruppe</option>
          <option v-for="o in parents(g)" :key="o.id" :value="o.id">I «{{ o.name }}»</option>
        </select>
        <button aria-label="Opp" :disabled="i === 0" @click="move(i, -1); save()"><ArrowUp :size="14" /></button>
        <button aria-label="Ned" :disabled="i === draft.length - 1" @click="move(i, 1); save()"><ArrowDown :size="14" /></button>
        <button aria-label="Slett gruppen" :disabled="draft.length < 2" @click="remove(i); save()"><X :size="14" /></button>
      </div>
      <div v-if="picking === i" class="covers">
        <button class="c0" :class="{ on: !g.cover }" @click="setCover(g, '')">Automatisk</button>
        <button class="c0" :class="{ on: g.cover === 'none' }" @click="setCover(g, 'none')">Ingen</button>
        <button v-for="c in choices(g)" :key="c.uri" class="ci" :class="{ on: g.cover === c.uri }" :aria-label="'Bruk dette bildet'" @click="setCover(g, c.uri)"><img crossorigin="anonymous" :src="c.img" alt="" /></button>
        <small v-if="!choices(g).length">Legg noe i mappa for å velge et bilde.</small>
      </div>
      </template>
      <button class="new" @click="add"><Plus :size="14" />Ny gruppe</button>
    </div>
  </div>
</template>

<style scoped>
.gb { display: grid; gap: 8px; }
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sw, .ed { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass-strong); color: var(--text-2); font: 600 0.78rem var(--font); cursor: pointer; }
.sw { padding: 5px 8px; }
.sw.on { color: #fff; background: var(--accent); border-color: var(--accent); }
.sw i { position: relative; width: 26px; height: 15px; border-radius: 999px; background: var(--accent-soft); }
.sw i b { position: absolute; top: 2px; left: 2px; width: 11px; height: 11px; border-radius: 50%; background: var(--text-3); transition: transform 0.2s, background 0.2s; }
.sw.on i b { transform: translateX(11px); background: var(--accent); }
.vw { display: inline-flex; padding: 2px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass-strong); }
.vw button { padding: 3px 10px; border: 0; border-radius: 999px; background: transparent; color: var(--text-2); font: 600 0.74rem var(--font); cursor: pointer; }
.vw button.on { background: var(--accent); color: #fff; }
.ed.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.editor { display: grid; gap: 6px; padding: 10px; border-radius: 14px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.hint { margin: 0 0 2px; color: var(--text-3); font-size: 0.78rem; line-height: 1.4; }
.g { display: flex; align-items: center; gap: 4px; }
.g input { flex: 1; min-width: 0; padding: 6px 10px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg); color: var(--text); font: 500 0.85rem var(--font); }
.g .pic { width: 34px; }
.covers { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; padding: 6px 6px 8px 38px; }
.covers small { color: var(--text-3); font-size: 0.74rem; }
.c0 { padding: 4px 10px; border: 1px solid var(--glass-border); border-radius: 999px; background: transparent; color: var(--text-2); font: 600 0.72rem var(--font); cursor: pointer; }
.c0.on, .ci.on { border-color: var(--accent); color: var(--accent); outline: 2px solid var(--accent); outline-offset: 1px; }
.ci { width: 34px; height: 34px; padding: 0; border: 0; border-radius: 6px; overflow: hidden; cursor: pointer; background: transparent; }
.ci img { width: 100%; height: 100%; object-fit: cover; display: block; }
.g .par { max-width: 112px; padding: 5px 4px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg); color: var(--text-2); font: 500 0.74rem var(--font); }
.g button { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--text-3); cursor: pointer; }
.g button:hover:not(:disabled) { background: var(--accent-soft); color: var(--accent); }
.g button:disabled { opacity: 0.3; cursor: default; }
.new { justify-self: start; display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border: 1px dashed var(--glass-border); border-radius: 999px; background: transparent; color: var(--text-2); font: 600 0.78rem var(--font); cursor: pointer; }
.new:hover { color: var(--accent); border-color: var(--accent); }
</style>
