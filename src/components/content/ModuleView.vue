<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Plus, Trash2, Check, X, Search, Upload, Star } from 'lucide-vue-next'
import { canManage } from '@/composables/site/useAdmin'
import { moduleById, dataOf, loadModule, touch, modState, type Entry } from '@/composables/room/useModules'
import { decor } from '@/composables/room/useDecor'
import { api, errorMessage, shrinkImage } from '@/composables/site/useAdmin'
import type { Field } from '@/lib/modules/catalog'
import LogInsights from './LogInsights.vue'
import ModuleExtras from './ModuleExtras.vue'
import { strava, loadStrava, syncStrava } from '@/composables/site/useStrava'
import type { ModData } from '@/composables/room/useModules'
import { safeUrl, isUpload } from '@/lib/modules/safe'
import { iconOf } from '@/lib/icons'
import StarRow from '@/components/ui/StarRow.vue'
import AquariumGame from '@/components/games/AquariumGame.vue'
import { parseGpx, routePath, paceText } from '@/lib/modules/gpx'

// One hobby module, whatever the hobby: the kind says which fields an entry has and how the entries are shown
// (cards, a log with numbers and a chart, or a checklist); this view does the rest.
const props = defineProps<{ id: string; compact?: boolean }>()
const draft = ref<{ at: number; e: Entry } | null>(null) // at = -1: a new one
const kat = ref('')
const status = ref('') // (the status board's filter)
const mod = computed(() => moduleById(props.id))
const data = computed(() => dataOf(props.id))
watch(() => props.id, (id) => { void loadModule(id); draft.value = null; kat.value = ''; status.value = ''; peek.value = null })
void loadModule(props.id)
const mine = computed(() => canManage.value)

// ── entries ──
const katField = computed(() => mod.value?.kind.fields.find((f) => f.k === 'kat'))
const items = computed(() => (data.value?.items ?? []).map((e, i) => ({ e, i })))
const shown = computed(() => {
  const l = items.value.filter(({ e }) => (!kat.value || e.kat === kat.value) && (!status.value || e.status === status.value))
  return mod.value?.kind.layout === 'log' ? [...l].sort((a, b) => String(b.e.date ?? '').localeCompare(String(a.e.date ?? ''))) : [...l].reverse()
})
const usedKats = computed(() => katField.value?.options?.filter((o) => items.value.some(({ e }) => e.kat === o)) ?? [])
const title = (e: Entry): string => String(e.t ?? e[mod.value?.kind.fields[0]?.k ?? 't'] ?? e.date ?? '–')
const today = (): string => new Date().toISOString().slice(0, 10)
function startNew(prefill: Entry = {}): void {
  const e: Entry = { ...prefill }
  for (const f of mod.value?.kind.fields ?? []) if (f.kind === 'date' && e[f.k] === undefined && mod.value?.kind.layout === 'log') e[f.k] = today()
  draft.value = { at: -1, e }
}
// a click on an entry: I edit it in my own room – a visitor gets to read all of it
const peek = ref<Entry | null>(null)
function openEntry(i: number, e: Entry): void { if (mine.value) draft.value = { at: i, e: { ...e } }; else peek.value = peek.value === e ? null : e }
const shownValue = (f: Field, v: unknown): string => (f.kind === 'number' && f.unit ? `${String(v).replace('.', ',')} ${f.unit}` : String(v))
function save(): void {
  const d = draft.value
  const dd = data.value
  if (!d || !dd) return
  const clean: Entry = {}
  for (const [k, v] of Object.entries(d.e)) if (v !== '' && v !== undefined && v !== null) clean[k] = v
  if (!Object.keys(clean).length) { draft.value = null; return }
  if (d.at < 0) dd.items.push(clean); else dd.items[d.at] = clean
  draft.value = null
  touch(props.id)
}
function del(): void {
  const d = draft.value
  const dd = data.value
  if (!d || !dd || d.at < 0) return
  dd.items.splice(d.at, 1)
  draft.value = null
  touch(props.id)
}
function water(i: number): void { const dd = data.value; const e = dd?.items[i]; if (!dd || !e) return; e.date = new Date().toISOString().slice(0, 10); touch(props.id) }
function toggle(i: number): void { const dd = data.value; const e = dd?.items[i]; if (!dd || !e) return; e.done = !e.done; touch(props.id) }

// ── checklist progress / log numbers ──
const done = computed(() => items.value.filter(({ e }) => e.done).length)
const series = computed(() => {
  const s = mod.value?.kind.stat
  if (!s) return []
  const v = items.value.filter(({ e }) => Number.isFinite(Number(e[s.field]))).sort((a, b) => String(a.e.date ?? '').localeCompare(String(b.e.date ?? ''))).slice(-24).map(({ e }) => Number(e[s.field]))
  const max = Math.max(...v, 1)
  return v.map((n) => ({ n, h: Math.max(6, Math.round((n / max) * 100)) }))
})
const shortDate = (d: unknown): string => { const t = Date.parse(String(d ?? '') + 'T12:00:00'); if (!Number.isFinite(t)) return String(d ?? ''); const x = new Date(t); return x.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', ...(x.getFullYear() !== new Date().getFullYear() ? { year: '2-digit' } : {}) }) }
const sub = (e: Entry): string => (mod.value?.kind.fields ?? []).slice(1).filter((f) => ['select', 'text', 'date'].includes(f.kind) && !['img', 'url', 'note'].includes(f.k) && e[f.k] !== undefined).map((f) => String(e[f.k])).join(' · ')

// ── workouts: a GPX file fills in the entry, a weekly goal sits in the settings ──
const gpxErr = ref('')
async function importGpx(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  const d = draft.value
  if (!f || !d) return
  gpxErr.value = ''
  const w = parseGpx(await f.text())
  if (!w) { gpxErr.value = 'Fant ingen rute i filen. Er det en GPX med sporpunkter (trkpt)?'; return }
  d.e.date = w.date
  d.e.km = w.km
  if (w.min) d.e.min = w.min
  if (w.hm) d.e.hm = w.hm
  if (w.name && !d.e.t) d.e.t = w.name
  d.e.route = w.route
}
const goal = computed(() => Number(data.value?.settings.goal) || 0)
function setGoal(v: string): void { const d = data.value; if (!d) return; d.settings = { ...d.settings, goal: v.replace(',', '.') }; touch(props.id) }
const pace = (e: Entry): string => (mod.value?.kind.workout ? paceText(Number(e.km), Number(e.min), String(e.kat ?? '')) : '')

// ── Strava: the owner's workouts come in by themselves (on opening, at most every half hour) or with the button ──
async function fromStrava(): Promise<void> {
  const d = await syncStrava<ModData>(props.id)
  const dd = data.value
  if (d && dd) { dd.items = d.items; dd.settings = d.settings && !Array.isArray(d.settings) ? d.settings : {} }
}
watch(() => [mod.value?.kind.workout, mine.value, data.value ? 1 : 0], async () => {
  if (!mod.value?.kind.workout || !mine.value || !data.value) return
  await loadStrava()
  const at = Number(data.value.settings.strava_at) || 0
  if (strava.connected && Date.now() / 1000 - at > 1800) void fromStrava()
}, { immediate: true })
const stravaAt = computed(() => { const t = Number(data.value?.settings.strava_at); return t ? new Date(t * 1000).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '' })

// ── look up a title: poster, link and so on from a public service ──
interface Hit { title: string; sub: string; img: string | null; url: string | null; genre: string | null; note: string }
const hits = ref<Hit[]>([])
const lookupBusy = ref(false)
const lookupErr = ref('')
let lookupTimer = 0
function lookup(q: string): void {
  clearTimeout(lookupTimer)
  const src = mod.value?.kind.lookup
  if (!src || q.trim().length < 2) { hits.value = []; return }
  lookupTimer = window.setTimeout(async () => {
    lookupBusy.value = true
    lookupErr.value = ''
    try { hits.value = (await api<{ results: Hit[] }>('mod_lookup', undefined, { query: `&s=${src}&q=${encodeURIComponent(q.trim())}` })).results } catch (e) { lookupErr.value = errorMessage(e); hits.value = [] } finally { lookupBusy.value = false }
  }, 350)
}
function useHit(h: Hit): void {
  const d = draft.value
  if (!d) return
  d.e.t = h.title
  if (safeUrl(h.img)) d.e.img = h.img as string
  if (safeUrl(h.url)) d.e.url = h.url as string
  if (h.note && !d.e.note) d.e.note = h.note
  if (mod.value?.kind.lookup === 'sted' && h.sub) { const f = mod.value.kind.fields.find((x) => x.k === 'adresse' || x.k === 'sted'); if (f && !d.e[f.k]) d.e[f.k] = h.sub }
  const opts = katField.value?.options
  if (h.genre && opts) { const m = opts.find((o) => o.toLowerCase() === h.genre?.toLowerCase()); if (m) d.e.kat = m }
  hits.value = []
}

// ── live: a chess account / the picture of the day ──
interface Live { provider: string; ratings?: Record<string, number>; games?: number; title?: string; img?: string | null; text?: string; user?: string }
const live = ref<Live | null>(null)
const liveErr = ref('')
const acct = reactive({ provider: 'chesscom', user: '' })
async function loadLive(): Promise<void> {
  const k = mod.value?.kind.live
  live.value = null
  liveErr.value = ''
  try {
    if (k === 'apod') live.value = await api<Live>('mod_live', undefined, { query: '&p=apod' })
    else if (k === 'chess') {
      const s = data.value?.settings ?? {}
      if (s.account) live.value = await api<Live>('mod_live', undefined, { query: `&p=${s.provider || 'chesscom'}&u=${encodeURIComponent(s.account)}` })
    }
  } catch (e) { liveErr.value = errorMessage(e) }
}
watch(() => [props.id, mod.value?.kind.live, data.value?.settings.account, data.value?.settings.provider], () => { if (mod.value?.kind.live && data.value) void loadLive() }, { immediate: true })
function saveAccount(): void {
  const d = data.value
  if (!d) return
  d.settings = { ...d.settings, provider: acct.provider, account: acct.user.trim() }
  touch(props.id)
}
// ── a picture for an entry: from the device, or a web address ──
const imgBusy = ref('')
const imgErr = ref('')
const fresh = new Set<string>() // uploaded while this entry was open – thrown away again unless a saved entry uses it
async function uploadImg(k: string, ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  const d = draft.value
  if (!f || !d) return
  imgBusy.value = k
  imgErr.value = ''
  try {
    const fd = new FormData()
    fd.append('id', props.id)
    fd.append('file', await shrinkImage(f, 1600))
    const r = await api<{ path: string }>('mod_image', fd)
    fresh.add(r.path)
    d.e[k] = r.path
  } catch (e) { imgErr.value = errorMessage(e) } finally { imgBusy.value = '' }
}
// when the entry closes (saved, cancelled, deleted): the uploads no saved entry ended up with go again
watch(draft, (now, was) => {
  if (!was || now === was) return
  const used = new Set((data.value?.items ?? []).map((e) => e.img))
  for (const p of [...fresh]) if (!used.has(p)) { fresh.delete(p); void api('mod_image_drop', { id: props.id, path: p }).catch(() => undefined) } else fresh.delete(p)
})
const fieldInput = (f: Field): string => (f.kind === 'number' ? 'number' : f.kind === 'date' ? 'date' : f.kind === 'url' ? 'url' : 'text')
void decor
</script>

<template>
  <div v-if="mod" class="mv" :class="{ compact }" :style="{ '--mc': mod.kind.color }">
    <header class="top">
      <span class="ico" aria-hidden="true"><component :is="iconOf(mod.icon)" :size="28" /></span>
      <div><h2>{{ mod.name }}</h2><p>{{ mod.kind.blurb }}</p></div>
      <button v-if="mine && !mod.kind.game" class="btn primary small add" @click="startNew()"><Plus :size="15" />Ny</button>
    </header>

    <!-- a hobby that is a game: the game itself (the entries, if any from before, are under it) -->
    <AquariumGame v-if="mod.kind.game === 'aquarium'" :id="id" />

    <!-- numbers from a public service, shown on top -->
    <section v-if="mod.kind.live === 'chess'" class="live">
      <div v-if="live?.ratings" class="rates"><span v-for="(v, k) in live.ratings" :key="k"><b>{{ v }}</b>{{ k }}</span><span v-if="live.games"><b>{{ live.games }}</b>partier</span></div>
      <p v-else-if="liveErr" class="err">{{ liveErr }}</p>
      <form v-if="mine" class="acct" @submit.prevent="saveAccount">
        <select v-model="acct.provider" aria-label="Tjeneste"><option value="chesscom">chess.com</option><option value="lichess">lichess</option></select>
        <input v-model="acct.user" placeholder="Brukernavnet ditt" aria-label="Brukernavn" maxlength="40" />
        <button class="btn soft small">Hent rating</button>
      </form>
    </section>
    <section v-if="mod.kind.live === 'apod' && live?.title" class="live apod">
      <img v-if="safeUrl(live.img)" :src="safeUrl(live.img) ?? undefined" alt="" loading="lazy" />
      <div><b>Dagens stjernebilde (NASA)</b><span>{{ live.title }}</span><small>{{ live.text }}</small></div>
    </section>

    <section v-if="mod.kind.workout && mine && strava.configured" class="strava">
      <template v-if="strava.connected">
        <button class="btn soft small" :disabled="strava.busy" @click="fromStrava">{{ strava.busy ? 'Henter …' : 'Hent fra Strava' }}</button>
        <small>{{ strava.athlete ? strava.athlete + ' · ' : '' }}{{ stravaAt ? 'sist hentet ' + stravaAt : 'ikke hentet ennå' }}</small>
      </template>
      <template v-else><a class="btn primary small" href="api.php?action=strava_login">Koble til Strava</a><small>Øktene dine kommer inn av seg selv, med rute.</small></template>
      <small v-if="strava.note" class="ok">{{ strava.note }}</small><small v-if="strava.error" class="err">{{ strava.error }}</small>
    </section>

    <div v-if="modState.error" class="err">{{ modState.error }}</div>

    <!-- the form for one entry -->
    <form v-if="draft" class="form" @submit.prevent="save">
      <div v-if="mod.kind.lookup" class="look">
        <label class="field"><span><Search :size="13" /> Finn tittel</span><input placeholder="Begynn å skrive …" autocomplete="off" @input="lookup(($event.target as HTMLInputElement).value)" /></label>
        <p v-if="lookupBusy" class="muted">Søker …</p><p v-else-if="lookupErr" class="err">{{ lookupErr }}</p>
        <ul v-if="hits.length" class="hits">
          <li v-for="(h, i) in hits" :key="i"><button type="button" @click="useHit(h)"><img v-if="safeUrl(h.img)" :src="safeUrl(h.img) ?? undefined" alt="" loading="lazy" /><span class="nm"><b>{{ h.title }}</b><small>{{ h.sub }}</small></span></button></li>
        </ul>
      </div>
      <div v-if="mod.kind.workout" class="look">
        <label class="btn soft small gpx"><Upload :size="14" />Importer GPX-fil<input type="file" accept=".gpx,application/gpx+xml,text/xml" hidden @change="importGpx" /></label>
        <small class="muted">Fra klokka, Strava, Komoot og lignende: distanse, tid, høydemeter og ruten fylles inn.</small>
        <p v-if="gpxErr" class="err">{{ gpxErr }}</p>
        <svg v-if="typeof draft.e.route === 'string' && draft.e.route" class="route big" viewBox="-30 -30 1060 1060" aria-label="Ruten"><path :d="routePath(draft.e.route)" /></svg>
      </div>
      <component :is="f.kind === 'image' ? 'div' : 'label'" v-for="f in mod.kind.fields.filter((x) => x.kind !== 'hidden')" :key="f.k" class="field" :class="{ wide: f.kind === 'longtext' || f.kind === 'image' }">
        <span>{{ f.label }}<template v-if="f.unit"> ({{ f.unit }})</template></span>
        <div v-if="f.kind === 'image'" class="imgf">
          <span class="thumb" :style="safeUrl(draft.e[f.k]) ? { backgroundImage: `url(${safeUrl(draft.e[f.k])})` } : undefined"><component :is="iconOf(mod.icon)" v-if="!safeUrl(draft.e[f.k])" :size="22" /></span>
          <label class="btn soft small up"><Upload :size="14" />{{ imgBusy === f.k ? 'Laster opp …' : draft.e[f.k] ? 'Bytt bilde' : 'Last opp bilde' }}<input type="file" accept="image/jpeg,image/png,image/webp" hidden :disabled="imgBusy === f.k" @change="uploadImg(f.k, $event)" /></label>
          <input :value="isUpload(draft.e[f.k]) ? '' : (draft.e[f.k] ?? '')" type="url" :placeholder="isUpload(draft.e[f.k]) ? 'Lastet opp – eller lim inn en lenke' : '… eller lim inn en lenke'" :aria-label="`${f.label}: lenke`" maxlength="400" @input="draft.e[f.k] = ($event.target as HTMLInputElement).value" />
          <button v-if="draft.e[f.k]" type="button" class="btn soft small" :aria-label="`Fjern ${f.label.toLowerCase()}`" @click="draft.e[f.k] = ''"><X :size="14" /></button>
          <small v-if="imgErr && !imgBusy" class="bad">{{ imgErr }}</small>
        </div>
        <textarea v-else-if="f.kind === 'longtext'" v-model="(draft.e[f.k] as string)" rows="3" maxlength="400"></textarea>
        <select v-else-if="f.kind === 'select'" v-model="draft.e[f.k]"><option value="">–</option><option v-for="o in f.options" :key="o" :value="o">{{ o }}</option></select>
        <span v-else-if="f.kind === 'rating'" class="rate"><button v-for="n in 5" :key="n" type="button" :class="{ on: Number(draft.e[f.k]) >= n }" :aria-label="`${n} stjerner`" @click="draft.e[f.k] = Number(draft.e[f.k]) === n ? 0 : n"><Star :size="22" /></button></span>
        <input v-else v-model="draft.e[f.k]" :type="fieldInput(f)" :step="f.kind === 'number' ? 'any' : undefined" maxlength="400" />
      </component>
      <div class="acts">
        <button class="btn primary small"><Check :size="14" />Lagre</button>
        <button type="button" class="btn soft small" @click="draft = null"><X :size="14" />Avbryt</button>
        <button v-if="draft.at >= 0" type="button" class="btn soft small del" @click="del"><Trash2 :size="14" />Slett</button>
      </div>
    </form>

    <!-- one entry, read by a visitor -->
    <article v-if="peek" class="peek">
      <button class="x" type="button" aria-label="Lukk" @click="peek = null"><X :size="16" /></button>
      <img v-if="safeUrl(peek.img)" :src="safeUrl(peek.img) ?? undefined" alt="" />
      <div>
        <h3>{{ title(peek) }}</h3>
        <dl>
          <template v-for="f in mod.kind.fields" :key="f.k"><template v-if="f.k !== 't' && f.kind !== 'hidden' && f.kind !== 'url' && f.kind !== 'image' && peek[f.k] !== undefined && peek[f.k] !== ''"><dt>{{ f.label }}</dt><dd :class="{ long: f.kind === 'longtext' }"><StarRow v-if="f.kind === 'rating'" :value="Number(peek[f.k])" /><template v-else>{{ shownValue(f, peek[f.k]) }}</template></dd></template></template>
        </dl>
        <svg v-if="typeof peek.route === 'string' && peek.route" class="route big" viewBox="-30 -30 1060 1060" aria-label="Ruten"><path :d="routePath(peek.route)" /></svg>
        <a v-if="safeUrl(peek.url)" :href="safeUrl(peek.url) ?? undefined" target="_blank" rel="noopener noreferrer">Åpne lenken</a>
      </div>
    </article>

    <ModuleExtras v-if="data && items.length" :kind="mod.kind" :items="items" :mine="mine" :status="status" @status="status = $event" @open="openEntry" @water="water" />

    <!-- category chips: one per genre / type that is in use -->
    <div v-if="usedKats.length" class="chips" role="group" aria-label="Kategori">
      <button :class="{ on: !kat }" @click="kat = ''">Alle <small>{{ items.length }}</small></button>
      <button v-for="k in usedKats" :key="k" :class="{ on: kat === k }" @click="kat = k">{{ k }} <small>{{ items.filter(({ e }) => e.kat === k).length }}</small></button>
    </div>

    <p v-if="data && !items.length && !draft && !mod.kind.game" class="empty">{{ mine ? 'Ingenting her ennå. Trykk «Ny» for å skrive inn den første.' : 'Ingenting her ennå.' }}</p>

    <!-- log: numbers and a chart -->
    <template v-if="mod.kind.layout === 'log'">
      <LogInsights v-if="items.length && mod.kind.stat" :items="items.map(({ e }) => e)" :field="mod.kind.stat.field" :unit="mod.kind.stat.label.split(' ')[0] ?? ''" :goal="goal" :color="mod.kind.color" />
      <label v-if="mine && mod.kind.workout" class="goalset">Ukemål ({{ mod.kind.stat?.label.split(' ')[0] }}) <input type="number" min="0" step="any" :value="goal || ''" placeholder="f.eks. 20" @change="setGoal(($event.target as HTMLInputElement).value)" /></label>
      <div v-if="items.length" class="stats"><span><b>{{ items.length }}</b>oppføringer</span></div>
      <div v-if="series.length > 1" class="chart" aria-hidden="true"><i v-for="(p, i) in series" :key="i" :style="{ height: p.h + '%' }" :title="String(p.n)"></i></div>
      <ul class="log">
        <li v-for="{ e, i } in shown" :key="i"><button @click="openEntry(i, e)"><time :datetime="String(e.date ?? '')">{{ shortDate(e.date) }}</time><b>{{ title(e) }}</b><span>{{ sub(e) }}<template v-if="pace(e)"> · {{ pace(e) }}</template></span><svg v-if="typeof e.route === 'string' && e.route" class="route" viewBox="-30 -30 1060 1060" aria-hidden="true"><path :d="routePath(e.route)" /></svg><em v-if="mod.kind.stat && e[mod.kind.stat.field] !== undefined">{{ e[mod.kind.stat.field] }}</em></button></li>
      </ul>
    </template>

    <!-- checklist -->
    <template v-else-if="mod.kind.layout === 'checklist'">
      <div v-if="items.length" class="prog"><span>{{ done }} av {{ items.length }}</span><i><u :style="{ width: (done / items.length) * 100 + '%' }"></u></i></div>
      <ul class="chk">
        <li v-for="{ e, i } in shown" :key="i" :class="{ ok: e.done }">
          <button class="box" :disabled="!mine" :aria-label="e.done ? 'Ikke gjort' : 'Gjort'" @click="toggle(i)"><Check v-if="e.done" :size="14" /></button>
          <button class="txt" @click="openEntry(i, e)"><b>{{ title(e) }}</b><small>{{ sub(e) }}</small></button>
        </li>
      </ul>
    </template>

    <!-- cards -->
    <ul v-else class="cards">
      <li v-for="{ e, i } in shown" :key="i">
        <button @click="openEntry(i, e)">
          <span class="im" :style="safeUrl(e.img) ? { backgroundImage: `url(${safeUrl(e.img)})` } : undefined"><component :is="iconOf(mod.icon)" v-if="!safeUrl(e.img)" :size="34" class="ph" /></span>
          <b>{{ title(e) }}</b>
          <small>{{ sub(e) }}</small>
          <StarRow v-if="e.rating" :value="Number(e.rating)" />
          <p v-if="e.note && !compact">{{ e.note }}</p>
          <a v-if="safeUrl(e.url) && !compact" :href="safeUrl(e.url) ?? undefined" target="_blank" rel="noopener noreferrer" @click.stop>Åpne</a>
        </button>
      </li>
    </ul>
  </div>
  <p v-else class="muted">Fant ikke modulen.</p>
</template>

<style scoped>
.mv { display: flex; flex-direction: column; gap: 14px; }
.top { display: flex; align-items: center; gap: 12px; }
.top h2 { margin: 0; }
.top p { margin: 2px 0 0; color: var(--text-3); font-size: 0.9rem; }
.ico { font-size: 2rem; width: 54px; height: 54px; display: grid; place-items: center; border-radius: 16px; background: color-mix(in srgb, var(--mc) 20%, transparent); }
.add { margin-left: auto; }
.err { color: #e5484d; margin: 0; font-size: 0.88rem; }
.muted, .empty { color: var(--text-3); margin: 0; }
.live { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; background: color-mix(in srgb, var(--mc) 10%, transparent); }
.rates { display: flex; gap: 14px; flex-wrap: wrap; }
.rates span { display: flex; flex-direction: column; font-size: 0.78rem; color: var(--text-3); }
.rates b { font-size: 1.4rem; color: var(--text); }
.acct { display: flex; gap: 6px; flex-wrap: wrap; }
.acct input { flex: 1; min-width: 120px; }
.apod { flex-direction: row; align-items: center; }
.apod img { width: 96px; height: 96px; object-fit: cover; border-radius: 10px; }
.apod div { display: flex; flex-direction: column; gap: 3px; }
.apod small { color: var(--text-3); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.form { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; padding: 14px; border-radius: 16px; border: 1px solid var(--glass-border); background: color-mix(in srgb, var(--bg) 70%, transparent); }
.form .wide, .look, .acts { grid-column: 1 / -1; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: var(--text-3); }
.imgf { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.imgf .thumb { width: 54px; height: 54px; border-radius: 12px; flex: none; display: grid; place-items: center; background: var(--accent-soft) center / cover no-repeat; color: var(--accent); }
.imgf .up { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; color: var(--text); }
.imgf input { flex: 1; min-width: 140px; }
.imgf .bad { flex-basis: 100%; color: #e5484d; }
.field input, .field select, .field textarea { font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--glass-border); border-radius: 10px; padding: 8px 10px; }
.rate { display: flex; gap: 2px; } .rate button { all: unset; cursor: pointer; color: var(--text-3); opacity: 0.45; } .rate button.on { color: #f5a524; opacity: 1; } .rate button.on svg { fill: currentColor; }
.ico { color: var(--mc); } .im .ph { color: var(--mc); opacity: 0.8; }
.acts { display: flex; gap: 8px; }
.del { margin-left: auto; }
.hits { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow: auto; }
.hits button { all: unset; box-sizing: border-box; display: flex; gap: 10px; align-items: center; width: 100%; padding: 6px; border-radius: 10px; cursor: pointer; }
.hits button:hover, .hits button:focus-visible { background: color-mix(in srgb, var(--mc) 16%, transparent); }
.hits img { width: 34px; height: 48px; object-fit: cover; border-radius: 4px; }
.nm { display: flex; flex-direction: column; } .nm small { color: var(--text-3); }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chips button { all: unset; cursor: pointer; padding: 5px 11px; border-radius: 999px; font-size: 0.82rem; border: 1px solid var(--glass-border); }
.chips button.on { background: var(--mc); color: #fff; border-color: transparent; }
.chips small { opacity: 0.7; }
.cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
.compact .cards { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
.cards button { all: unset; box-sizing: border-box; width: 100%; display: flex; flex-direction: column; gap: 3px; cursor: pointer; }
.cards button:disabled { cursor: default; }
.im { aspect-ratio: 2 / 3; border-radius: 12px; background: color-mix(in srgb, var(--mc) 22%, var(--bg)) center / cover; display: grid; place-items: center; font-size: 2.2rem; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18); transition: transform 0.3s var(--spring, ease); }
.cards button:not(:disabled):hover .im { transform: translateY(-4px) rotate(-1.2deg); }
.cards b { overflow-wrap: anywhere; } .cards small { color: var(--text-3); } .cards p { margin: 2px 0; font-size: 0.82rem; color: var(--text-3); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.st { color: #f5a524; letter-spacing: 1px; font-size: 0.85rem; }
.cards a { font-size: 0.8rem; color: var(--accent); }
.stats { display: flex; gap: 22px; } .stats span { display: flex; flex-direction: column; font-size: 0.78rem; color: var(--text-3); } .stats b { font-size: 1.7rem; color: var(--text); }
.chart { display: flex; align-items: flex-end; gap: 3px; height: 70px; } .chart i { flex: 1; background: var(--mc); border-radius: 3px 3px 0 0; opacity: 0.85; min-width: 4px; }
.log, .chk { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.log button { all: unset; box-sizing: border-box; width: 100%; display: grid; grid-template-columns: 90px 1fr auto auto auto; gap: 10px; align-items: baseline; padding: 9px 4px; border-bottom: 1px solid var(--glass-border); cursor: pointer; }
.log button:disabled { cursor: default; } .log time, .log span { color: var(--text-3); font-size: 0.82rem; } .log em { font-style: normal; font-weight: 800; color: var(--mc); }
.prog { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; color: var(--text-3); } .prog i { flex: 1; height: 8px; border-radius: 99px; background: color-mix(in srgb, var(--mc) 20%, transparent); overflow: hidden; } .prog u { display: block; height: 100%; background: var(--mc); transition: width 0.5s var(--spring, ease); }
.chk li { display: flex; align-items: center; gap: 10px; padding: 8px 2px; border-bottom: 1px solid var(--glass-border); }
.box { all: unset; width: 24px; height: 24px; border-radius: 8px; border: 2px solid var(--mc); display: grid; place-items: center; cursor: pointer; flex: none; } .ok .box { background: var(--mc); color: #fff; }
.txt { all: unset; display: flex; flex-direction: column; flex: 1; cursor: pointer; } .ok .txt b { text-decoration: line-through; opacity: 0.55; } .txt small { color: var(--text-3); }
.route { width: 38px; height: 38px; fill: none; stroke: var(--mc); stroke-width: 56; stroke-linecap: round; stroke-linejoin: round; }
.route.big { width: 120px; height: 120px; margin-top: 6px; }
.gpx { cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
.goalset { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: var(--text-3); } .goalset input { width: 90px; padding: 6px 8px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; }
.peek { position: relative; display: flex; gap: 16px; padding: 16px; border-radius: 16px; border: 1px solid var(--glass-border); background: color-mix(in srgb, var(--mc) 7%, var(--bg)); }
.peek img { width: 120px; aspect-ratio: 2 / 3; object-fit: cover; border-radius: 10px; flex: none; }
.peek h3 { margin: 0 0 8px; } .peek dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0 0 8px; font-size: 0.88rem; }
.peek dt { color: var(--text-3); } .peek dd { margin: 0; } .peek dd.long { grid-column: 1 / -1; white-space: pre-wrap; }
.peek a { color: var(--accent); font-size: 0.88rem; }
.peek .x { all: unset; position: absolute; top: 10px; right: 10px; cursor: pointer; padding: 4px; border-radius: 8px; } .peek .x:hover { background: var(--glass-border); }
.strava { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, #fc4c02 9%, transparent); }
.strava small { color: var(--text-3); } .strava .ok { color: #2fa84f; }
@media (max-width: 560px) { .log button { grid-template-columns: 74px 1fr auto auto; } .log span { display: none; } }
</style>
