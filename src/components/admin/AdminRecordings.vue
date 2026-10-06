<script setup lang="ts">
import { ChevronLeft, Play, Music } from 'lucide-vue-next'
import { ref, reactive, computed } from 'vue'
import { useData, reloadData, type Recording } from '@/composables/site/useData'
import { api, errorMessage } from '@/composables/site/useAdmin'
import { recordingDate, needsMp3, toMp3 } from '../../lib/media'
import { inputOf } from '../../lib/dom'
import type { Flash } from '../../types'

const data = useData()
const guitars = computed(() => data.gitarer || [])
const guitarId = ref(guitars.value[0]?.id)
const guitar = computed(() => guitars.value.find((g) => g.id === guitarId.value))
interface RecordingForm { id: number | null; title: string; recorded_on: string; youtube: string; notes: string; file: File | null; existingAudio: string | null }
const editing = ref<RecordingForm | null>(null)
const msg = ref<Flash | null>(null)
const busy = ref(false)
const progress = ref(0)
const stage = ref('') // shown while converting / uploading
const dateNote = ref('')

// the server's upload limit (e.g. "64M"), checked before uploading
let maxBytes = Infinity
fetch('api.php?action=limits').then((r) => r.json() as Promise<{ upload_max_filesize?: string; post_max_size?: string }>).then((l) => {
  const toBytes = (v: unknown): number => { const m = String(v || '').match(/^(\d+)\s*([KMG]?)/i); return m ? Number(m[1]) * ({ K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[(m[2] ?? '').toUpperCase()] || 1) : Infinity }
  maxBytes = Math.min(toBytes(l.upload_max_filesize), toBytes(l.post_max_size))
}).catch(() => {})

function blank(): RecordingForm {
  dateNote.value = ''
  return reactive<RecordingForm>({ id: null, title: '', recorded_on: '', youtube: '', notes: '', file: null, existingAudio: null })
}
function edit(r?: Recording | null) {
  msg.value = null
  editing.value = r
    ? reactive<RecordingForm>({ id: r.id, title: r.tittel, recorded_on: r.dato || '', youtube: r.youtube ? `https://youtu.be/${r.youtube}` : '', notes: r.notat || '', file: null, existingAudio: r.lyd })
    : blank()
}

async function save() {
  const f = editing.value
  const gid = guitarId.value
  if (!f || !gid) return
  if (!f.title.trim()) { msg.value = { error: 'Skriv en tittel.' }; return }
  if (!f.id && !f.file && !f.youtube.trim()) { msg.value = { error: 'Velg en lydfil eller lim inn en YouTube-lenke.' }; return }
  busy.value = true
  progress.value = 0
  try {
    let file = f.file
    if (file && needsMp3(file)) {
      file = await toMp3(file, (st, p) => {
        stage.value = st === 'encode' ? 'Lager MP3' : st === 'load' ? 'Laster lydverktøy (kun første gang)' : 'Henter ut lyden'
        progress.value = st === 'encode' || st === 'load' ? p : 0
      })
      if (file.size > 60 * 1024 * 1024) throw new Error('Selv som MP3 er opptaket over 60 MB – bruk heller en YouTube-lenke.')
    }
    if (file && file.size > maxBytes) {
      throw new Error(`Filen er ${(file.size / 1024 / 1024).toFixed(1)} MB, men serveren tar bare imot ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`)
    }
    stage.value = file ? 'Laster opp' : ''
    progress.value = 0
    const fd = new FormData()
    if (f.id) fd.append('id', String(f.id))
    fd.append('guitar', gid)
    fd.append('title', f.title)
    fd.append('recorded_on', f.recorded_on || '')
    fd.append('youtube', f.youtube || '')
    fd.append('notes', f.notes || '')
    if (file) fd.append('file', file)
    const r = await api<{ id: number }>('recording_save', fd, { onProgress: (p) => (progress.value = p) })
    f.id = r.id
    f.file = null
    await reloadData()
    editing.value = null
    msg.value = { ok: 'Opptaket er lagt til.' }
  } catch (e) {
    msg.value = { error: errorMessage(e) }
  } finally {
    busy.value = false
    stage.value = ''
  }
}
async function remove() {
  const f = editing.value
  if (!f?.id || !confirm(`Slette «${f.title}»?`)) return
  try {
    await api('recording_delete', { id: f.id })
    await reloadData()
    editing.value = null
  } catch (e) {
    msg.value = { error: errorMessage(e) }
  }
}
async function onFile(e: Event) {
  const file = inputOf(e).files?.[0]
  const f = editing.value
  if (!file || !f) return
  msg.value = null
  if (!needsMp3(file) && file.size > 60 * 1024 * 1024) { msg.value = { error: 'Filen er over 60 MB. Bruk heller en YouTube-lenke.' }; return }
  if (file.size > 1.5 * 1024 * 1024 * 1024) { msg.value = { error: 'Videoen er for stor til å gjøres om i nettleseren (over 1,5 GB).' }; return }
  f.file = file
  // phone file names like IMG_1234 make poor titles – leave those for you to fill in
  const base = file.name.replace(/\.\w+$/, '')
  if (!f.title && !/^(img|vid|mov|dsc|pxl|rec|new recording)[ _-]?\d*/i.test(base)) f.title = base
  const { date, source } = await recordingDate(file)
  if (date) {
    f.recorded_on = date
    dateNote.value = source === 'video' ? 'Datoen er hentet fra filen.' : 'Datoen er hentet fra når filen sist ble endret – sjekk at den stemmer.'
  }
}
const mb = (n: number) => (n / 1024 / 1024).toFixed(1)
</script>

<template>
  <div>
    <div class="guitars">
      <button v-for="g in guitars" :key="g.id" :class="{ on: g.id === guitarId }" @click="guitarId = g.id; editing = null">
        <span class="sw" :style="{ background: g.farge }"></span>{{ g.navn }}
      </button>
    </div>

    <p v-if="msg?.ok && !editing" class="notice ok">{{ msg.ok }}</p>

    <div v-if="!editing && guitar">
      <div class="bar">
        <p class="muted">{{ guitar.opptak?.length || 0 }} opptak på {{ guitar.navn }}</p>
        <button class="btn primary small" @click="edit(null)">+ Nytt opptak</button>
      </div>
      <div v-if="!guitar.opptak?.length" class="empty">Ingen opptak ennå.</div>
      <button v-for="r in guitar.opptak" :key="r.id" class="item" @click="edit(r)">
        <span class="kind"><Play v-if="r.youtube" :size="16" fill="currentColor" /><Music v-else :size="16" /></span>
        <span class="meta">
          <b>{{ r.tittel }}</b>
          <small>{{ r.dato || 'uten dato' }} · {{ r.youtube ? 'YouTube' : 'lydfil' }}</small>
        </span>
      </button>
    </div>

    <form v-else-if="editing" class="form" @submit.prevent="save">
      <button type="button" class="back" @click="editing = null"><ChevronLeft :size="16" />Tilbake</button>
      <div class="form-row">
        <label class="field"><span>Tittel *</span><input v-model="editing.title" required placeholder="F.eks. Wonderwall – første forsøk" /></label>
        <label class="field"><span>Dato</span><input v-model="editing.recorded_on" type="date" /><small v-if="dateNote">{{ dateNote }}</small></label>
      </div>

      <div class="field">
        <span>Lyd eller video</span>
        <label class="file">
          <input type="file" accept="audio/*,video/*,.m4a,.mp3,.wav,.flac,.ogg,.mp4,.mov" @change="onFile" />
          <b>{{ editing.file ? editing.file.name : editing.existingAudio ? 'Bytt lyd/video …' : 'Velg lyd eller video …' }}</b>
          <small v-if="editing.file">{{ mb(editing.file.size) }} MB<template v-if="needsMp3(editing.file)"> · gjøres om til MP3 før opplasting</template></small>
          <small v-else>Video (MP4/MOV) blir automatisk til MP3. Lyd: MP3, M4A, WAV, FLAC, OGG.</small>
        </label>
        <audio v-if="editing.existingAudio && !editing.file" :src="editing.existingAudio" controls preload="none"></audio>
      </div>
      <label class="field">
        <span>…eller YouTube-lenke</span>
        <input v-model="editing.youtube" placeholder="https://youtu.be/…" />
        <small>Lurt for lange opptak – sparer lagringsplass.</small>
      </label>
      <label class="field"><span>Notat</span><textarea v-model="editing.notes" placeholder="Hva øvde du på?" style="min-height: 70px"></textarea></label>

      <div v-if="busy && stage" class="stage">
        <span>{{ stage }} … {{ Math.round(progress * 100) }} %</span>
        <div class="progress"><span :style="{ width: `${progress * 100}%` }"></span></div>
      </div>
      <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>
      <div class="form-actions">
        <button class="btn primary" :disabled="busy">{{ busy ? (stage || 'Lagrer') + ' …' : 'Lagre' }}</button>
        <span class="spacer"></span>
        <button v-if="editing.id" type="button" class="btn danger small" @click="remove">Slett</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.guitars { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.guitars button {
  display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px;
  border: 1px solid var(--glass-border); background: transparent; color: var(--text-2); font-weight: 600; cursor: pointer;
}
.guitars button.on { background: var(--glass-strong); color: var(--text); box-shadow: var(--shadow-1); }
.sw { width: 14px; height: 14px; border-radius: 50%; }
.bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.muted { color: var(--text-3); font-size: 0.88rem; }
.item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px; margin-bottom: 4px; border: 0; border-radius: 12px; background: transparent; color: var(--text); text-align: left; cursor: pointer; }
.item:hover { background: var(--accent-soft); }
.kind { width: 36px; height: 36px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
.meta { display: flex; flex-direction: column; }
.meta small { color: var(--text-3); }
.back { justify-self: start; border: 0; background: var(--accent-soft); color: var(--accent); padding: 6px 12px; border-radius: 999px; font-weight: 600; cursor: pointer; }
.file {
  display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border: 2px dashed var(--glass-border);
  border-radius: 14px; cursor: pointer; transition: border-color 0.2s, background 0.2s;
}
.file:hover { border-color: var(--accent); background: var(--accent-soft); }
.file input { display: none; }
.file small { color: var(--text-3); }
audio { width: 100%; margin-top: 6px; }
.stage { display: grid; gap: 6px; font-size: 0.85rem; color: var(--text-2); }
</style>
