<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Layers, Pencil, Plus, ArrowUp, ArrowDown, X, Check } from 'lucide-vue-next'
import FolderIcon from '@/components/ui/FolderIcon.vue'
import SortButton from './SortButton.vue'
import { groups, setGrouping, setView, saveGroups, groupCover, itemsIn, coverOfUri, uploadGroupImage } from '@/composables/music/useGroups'
import { admin } from '@/composables/useAdmin'
import { notify } from '@/composables/music/useSpotify'
import { pickedFile } from '@/lib/dom'
import type { Group } from '@/types'

// Above the albums / playlists: a switch for grouping, and (admin) "Rediger" – moving things between groups
// and adding / renaming / reordering / deleting the groups themselves.
const props = defineProps<{ artist?: boolean; all?: boolean }>() // all: the "Alt" pot – albums + playlists, no Artist view // albums: the "Artist" view is offered (and no "Lister")
const view = computed(() => (!props.artist && groups.view === 'artist' ? 'mapper' : groups.view))
const draft = ref<Group[]>([])
const open = computed(() => admin.mine && groups.editing)
watch(open, (on) => { if (on) draft.value = groups.list.map((g) => ({ ...g })) }, { immediate: true })

const move = (i: number, d: number) => { const a = draft.value, j = i + d; const x = a[i], y = a[j]; if (!x || !y) return; a[i] = y; a[j] = x }
// a group can be put inside one that is on its own (one level of folders)
const parents = (g: Group) => (g.parent || draft.value.some((x) => x.parent === g.id) ? draft.value.filter((o) => o.id === g.parent) : draft.value.filter((o) => o.id && o.id !== g.id && !o.parent))
// the picture on a folder: pick one of the covers in it, "Automatisk" (the first) or none
const picking = ref<number | null>(null)
const choices = (g: Group) => (g.id ? itemsIn(g.id).map((u) => ({ uri: u, img: coverOfUri(u) })).filter((c) => c.img).slice(0, 16) : [])
function setCover(g: Group, v: string | null) { delete g.img; if (v) g.cover = v; else delete g.cover; picking.value = null; save() }
// my own picture on the folder
const busyImg = ref(false)
async function pickImage(g: Group, e: Event) {
  const f = pickedFile(e)
  if (!f || !g.id) return
  busyImg.value = true
  const r = await uploadGroupImage(g.id, f)
  busyImg.value = false
  if (r.ok) { draft.value = groups.list.map((x) => ({ ...x })); picking.value = null } else notify(r.error ?? '', true)
}
const add = () => draft.value.push({ id: '', name: '' })
const remove = (i: number) => { draft.value.splice(i, 1) }
async function save() {
  const r = await saveGroups(draft.value.filter((g) => g.name.trim()))
  if (r.ok) draft.value = groups.list.map((g) => ({ ...g }))
  else notify(r.error ?? '', true)
}
</script>

<template>
  <div class="gb">
    <div class="gbrow">
      <button class="sw" :class="{ on: groups.on }" role="switch" :aria-checked="groups.on" title="Grupper av / på" aria-label="Grupper av / på" @click="setGrouping(!groups.on)">
        <Layers :size="15" />
      </button>
      <span v-if="groups.on" class="vw" role="group" aria-label="Visning">
        <button :class="{ on: view === 'mapper' }" @click="setView('mapper')">Mapper</button>
        <button :class="{ on: view === 'lister' }" @click="setView('lister')">Lister</button>
        <button v-if="artist" :class="{ on: view === 'artist' }" @click="setView('artist')">Artist</button>
      </span>
      <span class="tools"><SortButton :kind="all ? 'all' : artist ? 'album' : 'playlist'" />
      <button v-if="admin.mine && groups.on && groups.view !== 'artist'" class="ed" :class="{ on: groups.editing }" @click="groups.editing = !groups.editing"><Pencil :size="13" />{{ groups.editing ? 'Ferdig' : 'Rediger' }}</button></span>
    </div>
    <div v-if="open && groups.on" class="editor">
      <p class="hint">Flytt ting med valgene på hver flis, eller dra dem til en annen gruppe. «gjettet» betyr at gruppen bare er et forslag – fra sjangeren til artistene, lyden (instrumentalitet og energi) eller navnet.</p>
      <p class="hint">Lyddata fra Spotify: {{ groups.audio === 'yes' ? 'brukes til å gjette' : groups.audio === 'no' ? 'ikke tilgjengelig for appen din (Spotify stengte det for nye apper)' : 'ikke prøvd ennå' }}.</p>
      <template v-for="(g, i) in draft" :key="g.id || i">
      <div class="g">
        <button class="pic" title="Bilde på mappa" :aria-label="`Bilde på mappa ${g.name}`" @click="picking = picking === i ? null : i"><FolderIcon :image="g.id ? groupCover(g.id) : null" :size="18" /></button>
        <input v-model="g.name" maxlength="40" placeholder="Navn på gruppe" :aria-label="`Gruppe ${i + 1}`" @change="save" />
        <select v-model="g.parent" class="par" :aria-label="`Mappe i … for ${g.name || 'gruppen'}`" title="Legg som mappe inni en annen gruppe" @change="save">
          <option :value="undefined">Egen gruppe</option>
          <option v-for="o in parents(g)" :key="o.id" :value="o.id">I «{{ o.name }}»</option>
        </select>
        <button aria-label="Opp" :disabled="i === 0" @click="move(i, -1); save()"><ArrowUp :size="14" /></button>
        <button aria-label="Ned" :disabled="i === draft.length - 1" @click="move(i, 1); save()"><ArrowDown :size="14" /></button>
        <button aria-label="Slett gruppen" @click="remove(i); save()"><X :size="14" /></button>
      </div>
      <div v-if="picking === i" class="covers">
        <label v-if="g.id" class="c0 up" :class="{ on: !!g.img }"><input type="file" accept="image/*" hidden :disabled="busyImg" @change="pickImage(g, $event)" />{{ busyImg ? 'Laster opp …' : g.img ? 'Bytt eget bilde' : 'Last opp eget bilde' }}</label>
        <button class="c0" :class="{ on: !g.cover && !g.img }" @click="setCover(g, '')">Automatisk</button>
        <button class="c0" :class="{ on: g.cover === 'none' && !g.img }" @click="setCover(g, 'none')">Ingen</button>
        <button v-for="c in choices(g)" :key="c.uri" class="ci" :class="{ on: g.cover === c.uri && !g.img }" :aria-label="'Bruk dette bildet'" @click="setCover(g, c.uri)"><img crossorigin="anonymous" :src="c.img || undefined" alt="" /></button>
        <small v-if="!choices(g).length">Legg noe i mappa for å velge et bilde.</small>
      </div>
      </template>
      <button class="new" @click="add"><Plus :size="14" />Ny gruppe</button>
    </div>
  </div>
</template>

<style scoped>
.gb { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; min-width: 0; max-width: 100%; }
.tools { display: inline-flex; align-items: center; gap: 6px; }
.gbrow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
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
.editor { display: grid; grid-template-columns: minmax(0, 1fr); min-width: 0; gap: 6px; padding: 10px; border-radius: 14px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.hint { margin: 0 0 2px; overflow-wrap: anywhere; color: var(--text-3); font-size: 0.78rem; line-height: 1.4; }
.g { display: flex; align-items: center; gap: 4px; min-width: 0; }
.g input { flex: 1; min-width: 0; padding: 6px 10px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg); color: var(--text); font: 500 0.85rem var(--font); }
.g .pic { width: 34px; }
.covers { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; padding: 6px 6px 8px 38px; }
.covers small { color: var(--text-3); font-size: 0.74rem; }
.c0 { padding: 4px 10px; border: 1px solid var(--glass-border); border-radius: 999px; background: transparent; color: var(--text-2); font: 600 0.72rem var(--font); cursor: pointer; }
.c0.up { cursor: pointer; }
.c0.on, .ci.on { border-color: var(--accent); color: var(--accent); outline: 2px solid var(--accent); outline-offset: 1px; }
.ci { width: 34px; height: 34px; padding: 0; border: 0; border-radius: 6px; overflow: hidden; cursor: pointer; background: transparent; }
.ci img { width: 100%; height: 100%; object-fit: cover; display: block; }
.g .par { flex: 0 1 112px; min-width: 0; max-width: 112px; padding: 5px 4px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg); color: var(--text-2); font: 500 0.74rem var(--font); }
.g button { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--text-3); cursor: pointer; }
.g button:hover:not(:disabled) { background: var(--accent-soft); color: var(--accent); }
.g button:disabled { opacity: 0.3; cursor: default; }
.new { justify-self: start; display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border: 1px dashed var(--glass-border); border-radius: 999px; background: transparent; color: var(--text-2); font: 600 0.78rem var(--font); cursor: pointer; }
.new:hover { color: var(--accent); border-color: var(--accent); }
@media (max-width: 820px) {
  /* phones: the switch on the left, Mapper/Artist exactly in the middle, Rediger on the right */
  .gbrow { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; }
  .gbrow > .sw { justify-self: start; }
  .gbrow > .tools { justify-self: end; }
}
</style>
