<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { Check, ImageUp, Plus, X, Trash2, Trophy } from 'lucide-vue-next'
import { api, errorMessage, shrinkImage, account } from '@/composables/site/useAdmin'
import { reloadData, useData, type About, type AboutLink, type Question } from '@/composables/site/useData'
import { siteTexts, setTexts } from '@/composables/site/useTexts'
import { ACCENTS, ACCENT_KEY, DEFAULT_ACCENT, accentHex, validAccent } from '@/composables/ui/useAccent'
import { milestones, loadMilestones, setMilestones, type Milestone } from '@/composables/site/useMilestones'
import { thumb } from '../../lib/photos'
import ImageCropper from '@/components/ui/ImageCropper.vue'
import type { Flash } from '../../types'

// Everything about who the room belongs to, in one place: the title and intro on the front page, the photo, the
// "about me" text and links, and the milestones shown under "Akkurat nå".
const msg = ref<Flash | null>(null)
const busy = ref('')
const flash = (ok: string) => { msg.value = { ok } }
const fail = (e: unknown) => { msg.value = { error: errorMessage(e) } }

// ── title + intro (the site texts the front page uses) ──
const title = reactive({ name: siteTexts['home.name'] || '', eyebrow: siteTexts['home.eyebrow'] || '', intro: siteTexts['home.intro'] || '' })
async function saveTitle() {
  busy.value = 'title'
  msg.value = null
  try {
    const texts: Record<string, string> = { ...siteTexts }
    for (const [k, v] of [['home.name', title.name], ['home.eyebrow', title.eyebrow], ['home.intro', title.intro]] as const) {
      if (v.trim()) texts[k] = v.trim(); else delete texts[k]
    }
    setTexts((await api<{ texts: Record<string, string> }>('texts_save', { texts })).texts)
    flash('Tittel og intro er lagret.')
  } catch (e) { fail(e) } finally { busy.value = '' }
}

// ── accent colour (the blue of the page, in this room) ──
const accentNow = computed(() => accentHex.value || DEFAULT_ACCENT)
async function setAccent(hex: string | null) {
  const v = validAccent(hex)
  const texts: Record<string, string> = { ...siteTexts }
  if (v) texts[ACCENT_KEY] = v; else delete texts[ACCENT_KEY]
  setTexts(texts) // (the page changes colour at once)
  busy.value = 'accent'
  try { setTexts((await api<{ texts: Record<string, string> }>('texts_save', { texts })).texts); flash(v ? 'Fargen er lagret.' : 'Tilbake til standard blå.') } catch (e) { fail(e) } finally { busy.value = '' }
}
const pickCustom = (e: Event) => { void setAccent((e.target as HTMLInputElement).value) }

// ── photo, about text, links ──
const about = ref<About | null>(null)
const edit = reactive<{ tagline: string; tekst: string; lenker: AboutLink[]; svar: Record<string, string> }>({ tagline: '', tekst: '', lenker: [], svar: {} })
const data = useData()
const isOwner = computed(() => !!data.profile.owner && !!data.profile.mine)
const qs = reactive<{ list: Question[] }>({ list: [] })
async function loadAbout() {
  try {
    const r = (await api<{ about?: About | null; questions?: Question[] }>('about_get'))
    about.value = r.about || null
    qs.list = (r.questions ?? []).map((q) => ({ ...q }))
    edit.svar = { ...(about.value?.svar ?? {}) }
    edit.tagline = about.value?.tagline || ''
    edit.tekst = about.value?.tekst || ''
    edit.lenker = (about.value?.lenker || []).map((l) => ({ ...l }))
  } catch (e) { fail(e) }
}
async function uploadPhoto(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  busy.value = 'photo'
  msg.value = null
  try {
    const fd = new FormData()
    fd.append('file', await shrinkImage(f, 1600))
    const r = await api<{ bilde: string }>('about_photo', fd)
    about.value = { ...(about.value || {}), bilde: r.bilde }
    await reloadData()
    flash('Bildet er byttet.')
  } catch (err) { fail(err) } finally { busy.value = '' }
}
// ── the door in the hall and two walls: each in exactly the shape of the place it is for ──
const IMAGE_SLOTS = [
  { id: 'door', label: 'Døra i gangen', hint: 'Dørbladet alle ser i Gangen', aspect: 1 / 2.05, out: 640 },
  { id: 'wall_back', label: 'Bakveggen', hint: 'Veggen bak skrivebordet og bokhyllen (8 × 3,2 m)', aspect: 8 / 3.2, out: 2048 },
  { id: 'wall_left', label: 'Venstre vegg', hint: 'Veggen med gitarene (7 × 3,2 m)', aspect: 7 / 3.2, out: 2048 },
] as const
const crop = ref<{ slot: (typeof IMAGE_SLOTS)[number]; file: File } | null>(null)
function pickImage(slot: (typeof IMAGE_SLOTS)[number], e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (f) crop.value = { slot, file: f }
}
async function uploadCropped(blob: Blob) {
  const c = crop.value
  if (!c) return
  crop.value = null
  busy.value = 'img-' + c.slot.id
  msg.value = null
  try {
    const fd = new FormData()
    fd.append('slot', c.slot.id)
    fd.append('file', blob, c.slot.id + '.jpg')
    const r = await api<{ bilder: Record<string, string> }>('about_image', fd)
    about.value = { ...(about.value || {}), bilder: r.bilder }
    await reloadData()
    flash(`${c.slot.label}: bildet er byttet.`)
  } catch (err) { fail(err) } finally { busy.value = '' }
}
async function clearImage(id: string) {
  busy.value = 'img-' + id
  msg.value = null
  try {
    const r = await api<{ bilder: Record<string, string> }>('about_image_clear', { slot: id })
    about.value = { ...(about.value || {}), bilder: r.bilder }
    await reloadData()
    flash('Bildet er fjernet.')
  } catch (err) { fail(err) } finally { busy.value = '' }
}
async function saveAbout() {
  busy.value = 'about'
  msg.value = null
  try {
    const r = await api<{ about: About }>('about_save', { tagline: edit.tagline, tekst: edit.tekst, lenker: edit.lenker.filter((l) => l.navn.trim() && l.url.trim()), svar: edit.svar })
    about.value = r.about
    await reloadData()
    flash('Om meg er lagret.')
  } catch (e) { fail(e) } finally { busy.value = '' }
}

// ── questions: the owner sets them for everyone, each room answers the ones it wants ──
async function saveQuestions() {
  busy.value = 'questions'
  msg.value = null
  try {
    const r = await api<{ questions: Question[] }>('about_questions', { questions: qs.list })
    qs.list = r.questions.map((q) => ({ ...q }))
    await reloadData()
    flash('Spørsmålene er lagret.')
  } catch (e) { fail(e) } finally { busy.value = '' }
}

// ── milestones ──
const MS_TYPES: [string, string][] = [['song', 'Sang jeg har lært'], ['anime', 'Anime jeg klarer'], ['book', 'Bok jeg har lest'], ['recording', 'Opptak'], ['trip', 'Reise'], ['other', 'Annet']]
const ms = ref({ type: 'song', title: '', sub: '' })
async function addMs() {
  if (!ms.value.title.trim()) return
  busy.value = 'ms'
  try { setMilestones((await api<{ items: Milestone[] }>('milestone_add', { ...ms.value })).items); ms.value.title = ''; ms.value.sub = ''; flash('Lagt til – vises under «Akkurat nå».') } catch (e) { fail(e) } finally { busy.value = '' }
}
async function delMs(key: string) {
  try { setMilestones((await api<{ items: Milestone[] }>('milestone_delete', { key })).items) } catch (e) { fail(e) }
}
onMounted(() => { void loadAbout(); void loadMilestones(true) })
</script>

<template>
  <div class="pf">
    <p v-if="msg?.ok" class="notice ok">{{ msg.ok }}</p>
    <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>

    <section>
      <h3>Tittel og intro</h3>
      <p class="muted">Det første besøkende ser på forsiden av rommet. Står et felt tomt, brukes standardteksten.</p>
      <form class="f" @submit.prevent="saveTitle">
        <label class="field"><span>Navnet ditt</span><input v-model="title.name" :placeholder="account.user?.username" maxlength="60" /></label>
        <label class="field"><span>Lille tekst over hilsenen</span><input v-model="title.eyebrow" placeholder="Velkommen inn" maxlength="120" /></label>
        <label class="field"><span>Introtekst</span><textarea v-model="title.intro" rows="3" maxlength="600" placeholder="Dette er rommet mitt på nettet …"></textarea></label>
        <button class="btn primary" :disabled="busy === 'title'"><Check :size="15" />Lagre tittel og intro</button>
      </form>
    </section>

    <section>
      <h3>Farge</h3>
      <p class="muted">Hovedfargen på siden din (den blå). Velg en annen, så skifter knapper, faner og markeringer farge for alle som besøker rommet ditt. Standard er blå.</p>
      <div class="sw" role="radiogroup" aria-label="Hovedfarge">
        <button v-for="a in ACCENTS" :key="a.id" type="button" class="dot" role="radio" :aria-checked="accentNow === a.hex" :class="{ on: accentNow === a.hex }" :style="{ background: a.hex }" :title="a.label" :aria-label="a.label" :disabled="busy === 'accent'" @click="setAccent(a.hex)"></button>
        <label class="dot custom" :class="{ on: !ACCENTS.some((a) => a.hex === accentNow) }" title="Egen farge"><input type="color" :value="accentNow" aria-label="Egen farge" @change="pickCustom" /><span>+</span></label>
      </div>
    </section>

    <section>
      <h3>Døra og veggene</h3>
      <p class="muted">Last opp hva du vil. Du velger selv hvilken del av bildet som brukes – rammen har nøyaktig formen til stedet bildet skal henge.</p>
      <div class="imgs">
        <div v-for="sl in IMAGE_SLOTS" :key="sl.id" class="img">
          <div class="pv" :style="{ aspectRatio: String(sl.aspect) }">
            <img v-if="about?.bilder?.[sl.id]" :src="about.bilder[sl.id]" alt="" />
            <span v-else class="none">Ingen bilde</span>
          </div>
          <b>{{ sl.label }}</b>
          <span class="muted">{{ sl.hint }}</span>
          <div class="irow">
            <label class="btn soft small up" :class="{ busy: busy === 'img-' + sl.id }"><ImageUp :size="15" />{{ about?.bilder?.[sl.id] ? 'Bytt' : 'Last opp' }}<input type="file" accept="image/*" hidden @change="pickImage(sl, $event)" /></label>
            <button v-if="about?.bilder?.[sl.id]" type="button" class="btn soft small" :disabled="busy === 'img-' + sl.id" @click="clearImage(sl.id)"><Trash2 :size="14" />Fjern</button>
          </div>
        </div>
      </div>
      <ImageCropper v-if="crop" :file="crop.file" :aspect="crop.slot.aspect" :out-width="crop.slot.out" :title="crop.slot.label" @done="uploadCropped" @cancel="crop = null" />
    </section>

    <section>
      <h3>Om meg</h3>
      <div class="who">
        <div class="ph">
          <img v-if="about?.bilde" :src="thumb(about.bilde, 400)" alt="" />
          <span v-else class="none">Ingen bilde</span>
        </div>
        <label class="btn soft small up" :class="{ busy: busy === 'photo' }"><ImageUp :size="15" />{{ busy === 'photo' ? 'Laster opp …' : about?.bilde ? 'Bytt bilde' : 'Last opp bilde' }}<input type="file" accept="image/*" hidden @change="uploadPhoto" /></label>
      </div>
      <form class="f" @submit.prevent="saveAbout">
        <label class="field"><span>Kort linje under navnet</span><input v-model="edit.tagline" maxlength="120" placeholder="F.eks. Student, gitarist og hobbyutvikler fra …" /></label>
        <label class="field"><span>Om meg</span><textarea v-model="edit.tekst" maxlength="4000" rows="6" placeholder="Skriv litt om deg selv …"></textarea></label>
        <span class="lbl">Lenker</span>
        <div v-for="(l, i) in edit.lenker" :key="i" class="lrow">
          <input v-model="l.navn" placeholder="Navn" maxlength="40" aria-label="Navn" />
          <input v-model="l.url" type="url" placeholder="https://…" aria-label="Adresse" />
          <button type="button" class="x" aria-label="Fjern lenke" @click="edit.lenker.splice(i, 1)"><X :size="14" /></button>
        </div>
        <button v-if="edit.lenker.length < 8" type="button" class="btn soft small add" @click="edit.lenker.push({ navn: '', url: '' })"><Plus :size="14" />Lenke</button>
        <span class="lbl">Bli kjent med meg</span>
        <p class="muted q">Svar på de spørsmålene du vil. Det du lar stå tomt vises ikke.</p>
        <label v-for="q in qs.list" :key="q.id" class="field"><span>{{ q.text }}</span><input v-model="edit.svar[q.id]" maxlength="300" /></label>
        <button class="btn primary" :disabled="busy === 'about'"><Check :size="15" />Lagre om meg</button>
      </form>
    </section>

    <section v-if="isOwner">
      <h3>Spørsmål til alle rommene</h3>
      <p class="muted">Bare du kan endre disse. De vises til alle, og hver person svarer på de de vil, under «Om meg». Opptil seks, korte.</p>
      <form class="f" @submit.prevent="saveQuestions">
        <div v-for="(q, i) in qs.list" :key="q.id" class="lrow qrow">
          <input v-model="q.text" maxlength="100" :aria-label="`Spørsmål ${i + 1}`" />
          <button type="button" class="x" aria-label="Fjern spørsmål" @click="qs.list.splice(i, 1)"><X :size="14" /></button>
        </div>
        <button v-if="qs.list.length < 6" type="button" class="btn soft small add" @click="qs.list.push({ id: 'ny' + qs.list.length, text: '' })"><Plus :size="14" />Spørsmål</button>
        <button class="btn primary" :disabled="busy === 'questions'"><Check :size="15" />Lagre spørsmålene</button>
      </form>
    </section>

    <section>
      <h3><Trophy :size="16" /> Milepæler</h3>
      <p class="muted">Vises i 30 dager under «Akkurat nå» på forsiden. Nye opptak, bøker du er ferdig med og reiser kommer av seg selv – resten legger du inn her.</p>
      <form class="ms" @submit.prevent="addMs">
        <select v-model="ms.type" aria-label="Type"><option v-for="t in MS_TYPES" :key="t[0]" :value="t[0]">{{ t[1] }}</option></select>
        <input v-model="ms.title" placeholder="Hva klarte du? F.eks. Wonderwall" aria-label="Tittel" required />
        <input v-model="ms.sub" placeholder="Litt til (valgfritt)" aria-label="Undertekst" />
        <button class="btn primary small" :disabled="busy === 'ms' || !ms.title.trim()">Legg til</button>
      </form>
      <ul v-if="milestones.items.length" class="msl">
        <li v-for="m in milestones.items.slice(0, 12)" :key="m.key"><span>{{ m.title }}</span><small>{{ MS_TYPES.find((t) => t[0] === m.type)?.[1] || 'Annet' }} · {{ new Date(m.t * 1000).toLocaleDateString('nb-NO') }}</small><button class="x" :aria-label="`Fjern ${m.title}`" @click="delMs(m.key)"><Trash2 :size="14" /></button></li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.pf { display: grid; gap: 28px; }
h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; font-size: 1.05rem; }
.muted { color: var(--text-3); font-size: 0.86rem; margin: 0 0 12px; }
.f { display: grid; gap: 12px; max-width: 560px; }
.f .btn { justify-self: start; display: inline-flex; align-items: center; gap: 6px; }
textarea, input, select { width: 100%; box-sizing: border-box; }
.sw { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.dot { width: 34px; height: 34px; padding: 0; border: 2px solid transparent; border-radius: 50%; cursor: pointer; box-shadow: 0 0 0 1px var(--glass-border); }
.dot.on { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px currentColor; color: var(--text); }
.dot.custom { position: relative; display: grid; place-items: center; background: conic-gradient(#e5484d, #f08a24, #2fb36d, #2b8cff, #8b5cf6, #e5559b, #e5484d); color: #fff; font-weight: 700; overflow: hidden; }
.dot.custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
.who { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.ph { width: 84px; height: 104px; border-radius: 16px; overflow: hidden; background: var(--accent-soft); display: grid; place-items: center; flex: none; }
.ph img { width: 100%; height: 100%; object-fit: cover; }
.none { color: var(--text-3); font-size: 0.74rem; }
.up { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.up.busy { opacity: 0.6; pointer-events: none; }
.lbl { font-size: 0.82rem; font-weight: 600; color: var(--text-2); }
.qrow { grid-template-columns: minmax(0, 1fr) auto; }
.muted.q { margin: 0; }
.lrow { display: grid; grid-template-columns: 120px minmax(0, 1fr) auto; gap: 6px; align-items: center; }
.x { border: 0; background: transparent; color: var(--text-3); cursor: pointer; padding: 6px; border-radius: 8px; }
.x:hover { color: #e0705f; }
.ms { display: grid; grid-template-columns: 170px minmax(0, 1fr) minmax(0, 1fr) auto; gap: 6px; max-width: 760px; }
.msl { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 4px; max-width: 760px; }
.msl li { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 10px; background: var(--accent-soft); }
.msl li span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.msl small { color: var(--text-3); }
@media (max-width: 700px) { .ms { grid-template-columns: 1fr; } .lrow { grid-template-columns: 1fr auto; } .lrow input:first-child { grid-column: 1 / -1; } }
.imgs { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; align-items: start; }
.img { display: flex; flex-direction: column; gap: 4px; }
.pv { width: 100%; max-width: 190px; border-radius: 10px; overflow: hidden; background: var(--glass-border, #0002); display: grid; place-items: center; }
.pv img { width: 100%; height: 100%; object-fit: cover; }
.irow { display: flex; gap: 6px; margin-top: 4px; }
</style>
