<script setup lang="ts">
import { ChevronLeft, Star } from 'lucide-vue-next'
import { ref, reactive, computed, watch } from 'vue'
import { useData, reloadData, type Book } from '../../composables/useData'
import { api, errorMessage } from '../../composables/useAdmin'
import type { Flash } from '../../types'

const data = useData()
const books = computed(() => data.boker || [])
interface BookForm {
  id: number | null; title: string; author: string; isbn: string; ol_key: string; cover_url: string
  published_year: number | string; pages: number | string; read_on: string; rating: number; thoughts: string; quote: string; reading: boolean
}
interface OpenLibraryDoc { key: string; title: string; author_name?: string[]; first_publish_year?: number; isbn?: string[]; cover_i?: number; number_of_pages_median?: number }
interface BookHit { key: string; title: string; author: string; year?: number; pages?: number; isbn: string; cover: string | null; thumb: string | null }
const editing = ref<BookForm | null>(null)
const msg = ref<Flash | null>(null)
const busy = ref(false)

// ── Open Library lookup ──
const q = ref('')
const results = ref<BookHit[]>([])
const searching = ref(false)
const searchError = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

watch(q, (v) => {
  clearTimeout(timer)
  if (v.trim().length < 2) { results.value = []; return }
  timer = setTimeout(() => search(v.trim()), 350)
})

async function search(term: string) {
  const my = ++seq
  searching.value = true
  searchError.value = ''
  try {
    const isIsbn = /^[\d-xX ]{10,17}$/.test(term)
    const params = new URLSearchParams({
      [isIsbn ? 'isbn' : 'q']: isIsbn ? term.replace(/[^\dxX]/g, '') : term,
      fields: 'key,title,author_name,first_publish_year,isbn,cover_i,number_of_pages_median',
      limit: '16',
    })
    const r = await fetch(`https://openlibrary.org/search.json?${params}`)
    const json = (await r.json()) as { docs?: OpenLibraryDoc[] }
    if (my !== seq) return
    results.value = (json.docs || []).map((d): BookHit => ({
      key: d.key,
      title: d.title,
      author: (d.author_name || []).slice(0, 2).join(', '),
      year: d.first_publish_year,
      pages: d.number_of_pages_median,
      isbn: (d.isbn || []).find((i) => i.length === 13) || (d.isbn || [])[0] || '',
      cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
      thumb: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
    }))
  } catch {
    if (my === seq) searchError.value = 'Søket feilet – sjekk nettet og prøv igjen.'
  } finally {
    if (my === seq) searching.value = false
  }
}

function blank(): BookForm {
  return reactive<BookForm>({ id: null, title: '', author: '', isbn: '', ol_key: '', cover_url: '', published_year: '', pages: '', read_on: '', rating: 0, thoughts: '', quote: '', reading: false })
}
function manual() {
  edit(null)
  if (editing.value) editing.value.title = q.value
}
function pickResult(r: BookHit) {
  const f = blank()
  Object.assign(f, { title: r.title, author: r.author, isbn: r.isbn, ol_key: r.key, cover_url: r.cover || '', published_year: r.year || '', pages: r.pages || '', read_on: new Date().toISOString().slice(0, 10) })
  editing.value = f
  msg.value = null
}
function edit(b?: Book | null) {
  msg.value = null
  editing.value = b
    ? reactive<BookForm>({
        id: b.id ?? null, title: b.tittel, author: b.forfatter || '', isbn: b.isbn || '', ol_key: b.ol_key || '',
        cover_url: b.omslag || '', published_year: b.utgitt || '', pages: b.sider || '', read_on: b.lest || '', reading: !!b.leser,
        rating: b.vurdering || 0, thoughts: b.tanker || '', quote: b.sitat || '',
      })
    : blank()
}

async function save() {
  const f = editing.value
  if (!f || !f.title.trim()) { msg.value = { error: 'Boka mangler tittel.' }; return }
  busy.value = true
  try {
    const r = await api<{ id: number }>('book_save', { ...f, rating: f.rating || null })
    f.id = r.id
    await reloadData()
    msg.value = { ok: 'Lagret – boka står nå i hylla.' }
  } catch (e) {
    msg.value = { error: errorMessage(e) }
  } finally {
    busy.value = false
  }
}
async function remove() {
  const f = editing.value
  if (!f?.id || !confirm(`Fjerne «${f.title}» fra hylla?`)) return
  try {
    await api('book_delete', { id: f.id })
    await reloadData()
    editing.value = null
    q.value = ''
  } catch (e) {
    msg.value = { error: errorMessage(e) }
  }
}
</script>

<template>
  <div>
    <div v-if="!editing">
      <label class="field">
        <span>Finn en bok</span>
        <input v-model="q" type="search" class="input" placeholder="Tittel, forfatter eller ISBN …" autofocus />
        <small>Søker i Open Library – millioner av bøker med omslag.</small>
      </label>

      <p v-if="searching" class="muted pad">Søker …</p>
      <p v-else-if="searchError" class="notice error">{{ searchError }}</p>
      <div v-if="results.length" class="results">
        <button v-for="r in results" :key="r.key" class="result" @click="pickResult(r)">
          <span class="cover">
            <img v-if="r.thumb" :src="r.thumb" alt="" loading="lazy" />
            <span v-else>{{ r.title.slice(0, 1) }}</span>
          </span>
          <b>{{ r.title }}</b>
          <small>{{ r.author }}<template v-if="r.year"> · {{ r.year }}</template></small>
        </button>
      </div>
      <p v-else-if="q.trim().length >= 2 && !searching" class="muted pad">
        Ingen treff. <button class="link" @click="manual">Legg inn manuelt</button>
      </p>

      <div class="section-label">I hylla ({{ books.length }})</div>
      <button v-for="b in books" :key="b.id || b.tittel" class="item" :disabled="!b.id" @click="edit(b)" :title="!b.id ? 'Eksempel fra data.json' : ''">
        <span class="mini">
          <img v-if="b.omslag" :src="b.omslag.replace('-L.jpg', '-S.jpg')" alt="" loading="lazy" />
        </span>
        <span class="meta">
          <b>{{ b.tittel }}</b>
          <small>{{ b.forfatter }}<template v-if="b.vurdering"> · <span class="mini-stars"><Star v-for="n in b.vurdering" :key="n" :size="11" fill="currentColor" /></span></template></small>
        </span>
      </button>
    </div>

    <form v-else class="form" @submit.prevent="save">
      <button type="button" class="back" @click="editing = null"><ChevronLeft :size="16" />Tilbake</button>
      <div class="split">
        <div class="preview">
          <img v-if="editing.cover_url" :src="editing.cover_url" alt="Omslag" />
          <div v-else class="nocover">Ingen omslag</div>
        </div>
        <div class="form">
          <label class="field"><span>Tittel *</span><input v-model="editing.title" required /></label>
          <label class="field"><span>Forfatter</span><input v-model="editing.author" /></label>
          <div class="form-row">
            <label class="field"><span>Utgitt</span><input v-model="editing.published_year" type="number" /></label>
            <label class="field"><span>Sider</span><input v-model="editing.pages" type="number" min="1" /></label>
            <label class="field"><span>ISBN</span><input v-model="editing.isbn" /></label>
          </div>
        </div>
      </div>

      <div class="form-row">
        <label class="field"><span>Lest (dato)</span><input v-model="editing.read_on" type="date" /></label>
        <label class="field"><span>Leser nå</span><span class="reading"><input v-model="editing.reading" type="checkbox" /> vises på «Nå»-siden</span></label>
        <div class="field">
          <span>Vurdering</span>
          <div class="stars" role="radiogroup">
            <button v-for="i in 5" :key="i" type="button" :class="{ on: i <= editing.rating }" @click="editing.rating = editing.rating === i ? 0 : i" :aria-label="`${i} stjerner`"><Star :size="22" :fill="i <= editing.rating ? 'currentColor' : 'none'" /></button>
          </div>
        </div>
      </div>
      <label class="field"><span>Hva syntes du?</span><textarea v-model="editing.thoughts" placeholder="Tankene dine om boka …"></textarea></label>
      <label class="field"><span>Favorittsitat</span><input v-model="editing.quote" /></label>
      <label class="field"><span>Omslag-URL</span><input v-model="editing.cover_url" placeholder="https://…" /><small>Fylles inn automatisk fra søket.</small></label>

      <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>
      <p v-if="msg?.ok" class="notice ok">{{ msg.ok }}</p>
      <div class="form-actions">
        <button class="btn primary" :disabled="busy">{{ busy ? 'Lagrer …' : editing.id ? 'Lagre' : 'Sett i hylla' }}</button>
        <span class="spacer"></span>
        <button v-if="editing.id" type="button" class="btn danger small" @click="remove">Fjern</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.muted { color: var(--text-3); font-size: 0.88rem; }
.pad { padding: 10px 2px; }
.link { border: 0; background: none; color: var(--accent); font-weight: 600; cursor: pointer; padding: 0; }
.results { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 12px; margin-top: 14px; }
.result {
  display: flex; flex-direction: column; gap: 4px; padding: 8px; border: 1px solid transparent; border-radius: 14px;
  background: transparent; color: var(--text); text-align: left; cursor: pointer; transition: background 0.2s, transform 0.4s var(--spring);
}
.result:hover { background: var(--accent-soft); transform: translateY(-3px); }
.result b { font-size: 0.82rem; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.result small { font-size: 0.72rem; color: var(--text-3); }
.cover { aspect-ratio: 2 / 3; border-radius: 8px; overflow: hidden; background: linear-gradient(135deg, var(--accent-2), var(--accent)); display: grid; place-items: center; color: #fff; font: 800 1.6rem var(--font-display); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
.cover img { width: 100%; height: 100%; object-fit: cover; }
.item {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 6px 8px; margin-bottom: 4px;
  border: 0; border-radius: 12px; background: transparent; color: var(--text); text-align: left; cursor: pointer;
}
.item:hover:not(:disabled) { background: var(--accent-soft); }
.item:disabled { opacity: 0.55; cursor: default; }
.mini { width: 30px; height: 44px; border-radius: 5px; overflow: hidden; flex: none; background: linear-gradient(135deg, var(--accent-2), var(--accent)); }
.mini img { width: 100%; height: 100%; object-fit: cover; }
.meta { display: flex; flex-direction: column; min-width: 0; }
.meta small { color: var(--text-3); }
.back { justify-self: start; border: 0; background: var(--accent-soft); color: var(--accent); padding: 6px 12px; border-radius: 999px; font-weight: 600; cursor: pointer; }
.split { display: grid; grid-template-columns: 130px 1fr; gap: 18px; align-items: start; }
.preview img, .nocover { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; border-radius: 10px; box-shadow: 0 8px 22px rgba(0,0,0,.2); }
.nocover { display: grid; place-items: center; background: var(--accent-soft); color: var(--text-3); font-size: 0.8rem; }
.stars { display: flex; gap: 2px; }
.stars button { border: 0; background: none; font-size: 1.7rem; line-height: 1; color: var(--accent-soft); cursor: pointer; transition: transform 0.3s var(--spring), color 0.2s; padding: 2px; }
.stars button.on { color: var(--accent); }
.stars button:hover { transform: scale(1.2); }
@media (max-width: 600px) { .split { grid-template-columns: 90px 1fr; } }
</style>
