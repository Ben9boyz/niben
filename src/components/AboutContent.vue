<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Guitar, Music, BookOpen, Plane, Languages, Gamepad2, Code2, ArrowUpRight, Pencil, Plus, X, Check } from 'lucide-vue-next'
import { useData } from '../composables/useData'
import { useSpotify } from '../composables/useSpotify'
import { steam, loadSteam } from '../composables/useSteam'
import { jp, loadJapanese } from '../composables/useJapanese'
import { admin, checkLogin, api } from '../composables/useAdmin'
import { atlasName } from '../three/countries'

// "Om meg": a short text I write myself (edited right here when logged in) and everything else
// counted live from the other corners – nothing to keep up to date by hand.
defineProps({ compact: Boolean }) // the 3D side panel: no big photo
const router = useRouter()
const data = useData()
const spotify = useSpotify()
onMounted(() => { loadSteam(); loadJapanese(); checkLogin(); loadAbout() })

// ── my own text ──
const about = ref(null)
async function loadAbout() {
  try {
    const r = await fetch('api.php?action=about_get', { cache: 'no-store' })
    about.value = (await r.json()).about || null
  } catch {}
}
// data.json's old text is a template placeholder – don't show it
const fallback = computed(() => (/^Eksempel/i.test(data.om?.tekst || '') ? '' : data.om?.tekst || ''))
const text = computed(() => about.value?.tekst || fallback.value)
const tagline = computed(() => about.value?.tagline || '')

// ── numbers from the corners ──
const countries = computed(() => new Set((data.reiser || []).map((t) => atlasName(t.land))).size)
const photos = computed(() => (data.reiser || []).reduce((n, t) => n + (t.bilder?.length || 0), 0))
const books = computed(() => data.boker || [])
const avg = computed(() => {
  const r = books.value.filter((b) => b.vurdering)
  return r.length ? (r.reduce((n, b) => n + b.vurdering, 0) / r.length).toFixed(1).replace('.', ',') : null
})
const recordings = computed(() => (data.gitarer || []).reduce((n, g) => n + (g.opptak?.length || 0), 0))
const cards = computed(() => [
  { to: '/gitar', icon: Guitar, title: 'Gitar', big: (data.gitarer || []).length, unit: 'gitarer', sub: recordings.value ? `${recordings.value} opptak · ${(data.sanger || []).length} sanger på øvelista` : `${(data.sanger || []).length} sanger på øvelista` },
  { to: '/lytte', icon: Music, title: 'Musikk', big: spotify.albums.length || '–', unit: 'album', sub: spotify.now?.name ? `Hører på ${spotify.now.name}` : `${spotify.playlists.length} spillelister` },
  { to: '/boker', icon: BookOpen, title: 'Bøker', big: books.value.length, unit: 'lest', sub: avg.value ? `snitt ${avg.value} av 5 stjerner` : '' },
  { to: '/reiser', icon: Plane, title: 'Reiser', big: countries.value, unit: 'land', sub: `${(data.reiser || []).length} turer · ${photos.value} bilder` },
  { to: '/japansk', icon: Languages, title: 'Japansk', big: jp.count?.known || 0, unit: 'ord kan jeg', sub: jp.anime?.[0] ? `${jp.anime[0].en || jp.anime[0].title}: ${String(jp.anime[0].known).replace('.', ',')} %` : 'øver på jpdb' },
  { to: '/gaming', icon: Gamepad2, title: 'Spill', big: steam.library?.hours?.toLocaleString('nb-NO') || '–', unit: 'timer', sub: steam.profile?.playing ? `Spiller ${steam.profile.playing.name}` : steam.library ? `${steam.library.count} spill på Steam` : '' },
  { to: '/kode', icon: Code2, title: 'Kode', big: (data.prosjekter || []).length, unit: 'prosjekter', sub: 'blant annet denne siden' },
])

// ── links: my own + the profiles the site already knows ──
const links = computed(() => {
  const own = about.value?.lenker || data.om?.lenker || []
  const auto = [
    { navn: 'GitHub', url: 'https://github.com/Ben9boyz' },
    steam.profile?.url && { navn: 'Steam', url: steam.profile.url },
  ].filter(Boolean)
  return [...own, ...auto.filter((a) => !own.some((o) => o.navn.toLowerCase() === a.navn.toLowerCase()))]
})

// ── editing (admin) ──
const editing = ref(null)
const busy = ref(false)
const msg = ref('')
function edit() {
  msg.value = ''
  editing.value = reactive({
    tagline: tagline.value,
    tekst: text.value,
    lenker: (about.value?.lenker || []).map((l) => ({ ...l })),
  })
}
async function save() {
  busy.value = true
  msg.value = ''
  try {
    const r = await api('about_save', editing.value)
    about.value = r.about
    editing.value = null
  } catch (e) {
    msg.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="about" :class="{ compact }">
    <header class="hero">
      <img v-if="data.om?.bilde && !compact" :src="data.om.bilde" alt="" class="photo" />
      <div class="intro">
        <img v-if="data.om?.bilde && compact" :src="data.om.bilde" alt="" class="avatar" />
        <h1 v-if="!compact">Hei, jeg er {{ data.site?.navn || 'Benjamin' }}</h1>
        <p v-if="tagline" class="tagline">{{ tagline }}</p>

        <form v-if="editing" class="edit" @submit.prevent="save">
          <label><span>Kort linje under navnet</span><input v-model="editing.tagline" maxlength="120" placeholder="F.eks. Student, gitarist og hobbyutvikler fra …" /></label>
          <label><span>Om meg</span><textarea v-model="editing.tekst" maxlength="4000" rows="6" placeholder="Skriv litt om deg selv …"></textarea></label>
          <span class="lbl">Lenker</span>
          <div v-for="(l, i) in editing.lenker" :key="i" class="lrow">
            <input v-model="l.navn" placeholder="Navn" maxlength="40" />
            <input v-model="l.url" type="url" placeholder="https://…" />
            <button type="button" class="ic" aria-label="Fjern lenke" @click="editing.lenker.splice(i, 1)"><X :size="14" /></button>
          </div>
          <button v-if="editing.lenker.length < 8" type="button" class="add" @click="editing.lenker.push({ navn: '', url: '' })"><Plus :size="14" />Lenke</button>
          <p v-if="msg" class="err">{{ msg }}</p>
          <div class="eact">
            <button class="btn primary small" :disabled="busy"><Check :size="14" />{{ busy ? 'Lagrer …' : 'Lagre' }}</button>
            <button type="button" class="btn small" @click="editing = null">Avbryt</button>
          </div>
        </form>
        <template v-else>
          <p v-if="text" class="text">{{ text }}</p>
          <p v-else-if="admin.loggedIn" class="text muted">Her står det ingenting om deg ennå – trykk «Rediger».</p>
          <div class="links">
            <a v-for="l in links" :key="l.url" :href="l.url" target="_blank" rel="noopener" class="chip">{{ l.navn }}<ArrowUpRight :size="13" /></a>
            <button v-if="admin.loggedIn" class="chip edit-btn" @click="edit"><Pencil :size="13" />Rediger</button>
          </div>
        </template>
      </div>
    </header>

    <section class="grid-sec">
      <b class="h">Det jeg driver med</b>
      <div class="cards">
        <button v-for="(c, i) in cards" :key="c.to" class="card" :style="{ '--i': i }" @click="router.push(c.to)">
          <span class="ct"><component :is="c.icon" :size="16" />{{ c.title }}</span>
          <span class="big"><b>{{ c.big }}</b> {{ c.unit }}</span>
          <small v-if="c.sub">{{ c.sub }}</small>
        </button>
      </div>
    </section>

    <!-- the way in for me (also: double-click the logo) – small, at the very bottom -->
    <router-link v-if="!admin.loggedIn" to="/admin" class="login">Logg inn</router-link>
  </div>
</template>

<style scoped>
.about { display: grid; gap: 24px; }
.hero { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 32px; align-items: center; }
.compact .hero { grid-template-columns: minmax(0, 1fr); gap: 0; }
.photo { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 28px; box-shadow: 0 24px 50px rgba(0, 0, 0, 0.25); }
.avatar { width: 72px; height: 72px; border-radius: 22px; object-fit: cover; margin-bottom: 10px; box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2); }
.intro { min-width: 0; }
h1 { font-size: clamp(2.2rem, 4.5vw, 3.4rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; }
.tagline { margin: 8px 0 0; font-size: 1.05rem; font-weight: 600; color: var(--accent); }
.text { margin: 12px 0 0; color: var(--text-2); font-size: 1.02rem; line-height: 1.6; white-space: pre-line; max-width: 62ch; }
.muted { color: var(--text-3); font-style: italic; }
.links { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 7px 13px; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text); font: 600 0.84rem var(--font); text-decoration: none; cursor: pointer; transition: border-color 0.2s, color 0.2s; }
.chip:hover { border-color: var(--accent); color: var(--accent); }
.edit-btn { color: var(--text-3); border-style: dashed; }

.h { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.grid-sec { display: grid; gap: 10px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
.compact .cards { grid-template-columns: 1fr 1fr; }
.card { display: grid; gap: 4px; align-content: start; padding: 14px 16px; border-radius: 18px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text); text-align: left; cursor: pointer; transition: transform 0.25s var(--spring, ease), border-color 0.2s; animation: rowIn 0.5s var(--ease, ease) both; animation-delay: calc(var(--i) * 45ms); }
.card:hover { transform: translateY(-2px); border-color: var(--accent); }
.ct { display: inline-flex; align-items: center; gap: 6px; font-size: 0.76rem; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; }
.big { font-size: 0.85rem; color: var(--text-2); }
.big b { font-size: 1.6rem; color: var(--text); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.card small { font-size: 0.76rem; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.login { justify-self: center; padding: 4px 10px; font-size: 0.75rem; color: var(--text-3); opacity: 0.6; text-decoration: none; }
.login:hover { opacity: 1; color: var(--accent); }
.edit { display: grid; gap: 8px; margin-top: 12px; }
.edit label { display: grid; gap: 4px; }
.edit span, .lbl { font-size: 0.74rem; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; }
.edit input, .edit textarea { width: 100%; padding: 9px 12px; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text); font: 500 0.92rem var(--font); }
.edit textarea { resize: vertical; line-height: 1.5; }
.lrow { display: grid; grid-template-columns: 1fr 2fr auto; gap: 6px; }
.ic { display: grid; place-items: center; width: 34px; border: 0; border-radius: 10px; background: var(--glass); color: var(--text-3); cursor: pointer; }
.add { justify-self: start; display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border: 1px dashed var(--glass-border); border-radius: 999px; background: transparent; color: var(--text-2); font: 600 0.8rem var(--font); cursor: pointer; }
.eact { display: flex; gap: 8px; }
.eact .btn { display: inline-flex; align-items: center; gap: 4px; }
.err { color: #d24b4b; font-size: 0.82rem; margin: 0; }
@media (max-width: 760px) {
  .hero { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .photo { max-width: 220px; }
  .cards { grid-template-columns: 1fr 1fr; }
}
</style>
