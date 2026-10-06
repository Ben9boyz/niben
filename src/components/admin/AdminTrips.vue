<script setup lang="ts">
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import { ref, reactive, computed } from 'vue'
import { useData, reloadData, type Trip } from '@/composables/site/useData'
import { api, shrinkImage, errorMessage } from '@/composables/site/useAdmin'
import { norskNavn } from '../../three/countries'
import CountryPicker from '@/components/content/CountryPicker.vue'
import { inputOf } from '../../lib/dom'

const data = useData()
interface PhotoForm { id: number; src: string; caption: string }
interface TripForm { id: number | null; country: string | null; place: string; title: string; year: number | string; date_from: string; date_to: string; body: string; photos: PhotoForm[] }
interface Upload { name: string; progress: number; error: string | null }
const editing = ref<TripForm | null>(null) // form object or null
const msg = ref<{ ok?: string; error?: string } | null>(null)
const busy = ref(false)
const uploads = ref<Upload[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

const trips = computed(() => data.reiser || [])

function blankTrip(): TripForm {
  return reactive<TripForm>({ id: null, country: null, place: '', title: '', year: new Date().getFullYear(), date_from: '', date_to: '', body: '', photos: [] })
}
function edit(t?: Trip | null) {
  msg.value = null
  editing.value = t
    ? reactive<TripForm>({
        id: t.id, country: t.land, place: t.sted || '', title: t.tittel || '', year: t.aar || '',
        date_from: t.dato || '', date_to: t.til || '', body: t.tekst || '',
        photos: (t.bilder || []).map((b) => ({ id: b.id, src: b.src, caption: b.tekst || '' })),
      })
    : blankTrip()
}

function payload(f: TripForm) {
  return {
    id: f.id, country: f.country, place: f.place, title: f.title, year: f.year || null,
    date_from: f.date_from || null, date_to: f.date_to || null, body: f.body,
    photos: f.photos.map((p) => ({ id: p.id, caption: p.caption })),
  }
}

async function save({ quiet = false } = {}) {
  const f = editing.value
  if (!f) return false
  if (!f.country) { msg.value = { error: 'Velg et land.' }; return false }
  if (!f.title.trim()) { msg.value = { error: 'Skriv en tittel.' }; return false }
  busy.value = true
  try {
    const r = await api<{ id: number }>('trip_save', payload(f))
    f.id = r.id
    await reloadData()
    if (!quiet) msg.value = { ok: 'Lagret.' }
    return true
  } catch (e) {
    msg.value = { error: errorMessage(e) }
    return false
  } finally {
    busy.value = false
  }
}

async function remove() {
  const f = editing.value
  if (!f?.id || !confirm(`Slette «${f.title}» med alle bildene?`)) return
  try {
    await api('trip_delete', { id: f.id })
    await reloadData()
    editing.value = null
  } catch (e) {
    msg.value = { error: errorMessage(e) }
  }
}

async function addPhotos(files: File[] | FileList | null | undefined) {
  const f = editing.value
  if (!f || !files?.length) return
  // the trip must exist before photos can be attached to it
  if (!f.id && !(await save({ quiet: true }))) return
  msg.value = null
  for (const file of files) {
    const u = reactive<Upload>({ name: file.name, progress: 0, error: null })
    uploads.value.push(u)
    try {
      const small = await shrinkImage(file)
      const fd = new FormData()
      fd.append('trip_id', String(f.id))
      fd.append('file', small)
      const r = await api<{ id: number; path: string }>('photo_upload', fd, { onProgress: (p) => (u.progress = p) })
      f.photos.push({ id: r.id, src: r.path, caption: '' })
      uploads.value = uploads.value.filter((x) => x !== u)
    } catch (e) {
      u.error = errorMessage(e).includes('decode') || (e instanceof Error && e.name === 'InvalidStateError') ? 'Kunne ikke lese bildet (prøv JPEG/PNG)' : errorMessage(e)
    }
  }
  await reloadData()
}

async function removePhoto(p: PhotoForm) {
  if (!confirm('Slette bildet?')) return
  try {
    await api('photo_delete', { id: p.id })
    if (editing.value) editing.value.photos = editing.value.photos.filter((x) => x !== p)
    await reloadData()
  } catch (e) {
    msg.value = { error: errorMessage(e) }
  }
}
function move(i: number, d: number) {
  const list = editing.value?.photos
  const j = i + d
  const a = list?.[i], b = list?.[j]
  if (!list || !a || !b) return
  list[i] = b
  list[j] = a
}
function onDrop(e: DragEvent) {
  addPhotos([...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/')))
}
function when(t: Trip) {
  if (t.dato) return new Date(t.dato).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
  return t.aar || ''
}
</script>

<template>
  <div>
    <div v-if="!editing">
      <div class="bar">
        <p class="muted">{{ trips.length }} reiser</p>
        <button class="btn primary small" @click="edit(null)">+ Ny reise</button>
      </div>
      <div v-if="!trips.length" class="empty">Ingen reiser ennå – legg til den første!</div>
      <button v-for="t in trips" :key="t.id || t.tittel" class="item" @click="edit(t)" :disabled="!t.id" :title="!t.id ? 'Eksempel fra data.json' : ''">
        <img v-if="t.bilder?.[0]" :src="t.bilder[0].src" alt="" />
        <span v-else class="ph">{{ norskNavn(t.land).slice(0, 2) }}</span>
        <span class="meta">
          <b>{{ t.tittel }}</b>
          <small>{{ norskNavn(t.land) }}<template v-if="t.sted"> · {{ t.sted }}</template> · {{ when(t) }} · {{ t.bilder?.length || 0 }} bilder</small>
        </span>
      </button>
    </div>

    <form v-else class="form" @submit.prevent="save()">
      <button type="button" class="back" @click="editing = null"><ChevronLeft :size="16" />Alle reiser</button>

      <div class="form-row">
        <label class="field">
          <span>Land *</span>
          <CountryPicker v-model="editing.country" />
        </label>
        <label class="field">
          <span>Sted</span>
          <input v-model="editing.place" placeholder="By eller område" />
        </label>
      </div>
      <label class="field">
        <span>Tittel *</span>
        <input v-model="editing.title" placeholder="F.eks. Sommer i Roma" required />
      </label>
      <div class="form-row">
        <label class="field">
          <span>År</span>
          <input v-model.number="editing.year" type="number" min="1900" max="2200" />
        </label>
        <label class="field">
          <span>Fra dato</span>
          <input v-model="editing.date_from" type="date" @change="editing.date_from && (editing.year = +editing.date_from.slice(0, 4))" />
        </label>
        <label class="field">
          <span>Til dato</span>
          <input v-model="editing.date_to" type="date" :min="editing.date_from || undefined" />
        </label>
      </div>
      <label class="field">
        <span>Om reisen</span>
        <textarea v-model="editing.body" placeholder="Hva gjorde du, hva likte du best …"></textarea>
      </label>

      <div class="field">
        <span>Bilder</span>
        <div class="drop" @dragover.prevent @drop.prevent="onDrop" @click="fileInput?.click()">
          <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="(e: Event) => { addPhotos([...(inputOf(e).files ?? [])]); inputOf(e).value = '' }" />
          <b>Slipp bilder her</b> eller klikk for å velge
          <small>Bildene krympes og GPS-posisjon fjernes før opplasting.</small>
        </div>
        <div v-for="u in uploads" :key="u.name" class="up">
          <span>{{ u.name }}</span>
          <span v-if="u.error" class="err">{{ u.error }}</span>
          <div v-else class="progress"><span :style="{ width: `${u.progress * 100}%` }"></span></div>
        </div>
        <div v-if="editing.photos.length" class="photos">
          <figure v-for="(p, i) in editing.photos" :key="p.id">
            <img :src="p.src" alt="" />
            <div class="tools">
              <button type="button" @click="move(i, -1)" :disabled="i === 0" aria-label="Flytt til venstre"><ChevronLeft :size="16" /></button>
              <button type="button" @click="move(i, 1)" :disabled="i === editing.photos.length - 1" aria-label="Flytt til høyre"><ChevronRight :size="16" /></button>
              <button type="button" class="del" @click="removePhoto(p)" aria-label="Slett"><X :size="15" /></button>
            </div>
            <input v-model="p.caption" placeholder="Bildetekst" />
          </figure>
        </div>
      </div>

      <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>
      <p v-if="msg?.ok" class="notice ok">{{ msg.ok }}</p>
      <div class="form-actions">
        <button class="btn primary" :disabled="busy">{{ busy ? 'Lagrer …' : 'Lagre' }}</button>
        <span class="spacer"></span>
        <button v-if="editing.id" type="button" class="btn danger small" @click="remove">Slett reise</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.muted { color: var(--text-3); font-size: 0.88rem; }
.item {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px; margin-bottom: 6px;
  border: 1px solid transparent; border-radius: 16px; background: transparent; color: var(--text);
  text-align: left; cursor: pointer; transition: background 0.2s;
}
.item:hover:not(:disabled) { background: var(--accent-soft); }
.item:disabled { opacity: 0.55; cursor: default; }
.item img, .ph { width: 56px; height: 42px; border-radius: 10px; object-fit: cover; flex: none; }
.ph { display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-weight: 700; text-transform: uppercase; }
.meta { display: flex; flex-direction: column; min-width: 0; }
.meta small { color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.back { justify-self: start; border: 0; background: var(--accent-soft); color: var(--accent); padding: 6px 12px; border-radius: 999px; font-weight: 600; cursor: pointer; }
.drop {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 22px;
  border: 2px dashed var(--glass-border); border-radius: 16px; text-align: center; color: var(--text-2);
  cursor: pointer; transition: border-color 0.2s, background 0.2s;
}
.drop:hover { border-color: var(--accent); background: var(--accent-soft); }
.drop small { color: var(--text-3); }
.up { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: center; font-size: 0.82rem; color: var(--text-2); }
.err { color: #e5484d; }
.photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-top: 6px; }
figure { margin: 0; position: relative; display: flex; flex-direction: column; gap: 6px; }
figure img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px; }
figure input { padding: 6px 8px !important; font-size: 0.8rem !important; }
.tools { position: absolute; top: 6px; right: 6px; display: flex; gap: 4px; }
.tools button {
  width: 26px; height: 26px; border-radius: 50%; border: 0; cursor: pointer;
  background: rgba(10, 20, 36, 0.6); color: #fff; font-size: 0.85rem; 
}
.tools button:disabled { opacity: 0.35; }
.tools .del:hover { background: #e5484d; }
</style>
