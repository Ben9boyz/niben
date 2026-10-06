<script setup lang="ts">
import { tx } from '@/composables/site/useTexts'
import { ref, computed, watch, onMounted } from 'vue'
import { Share2, Download, Music, BookOpen, Plane, Gamepad2, Languages, Guitar, Loader } from 'lucide-vue-next'
import { toPng } from 'html-to-image'

// "Året": a Spotify-Wrapped style summary of the year – a poster that can be saved or shared as a picture, and the details under it.
const thisYear = new Date().getFullYear()
const year = ref(thisYear)
interface Wrapped {
  year: number
  music: {
    plays: number; minutes: number; since?: number; logging?: boolean
    tracks: { name: string; artist: string; image?: string | null; n: number }[]
    albums: { album: string; artist: string; image?: string | null; album_uri?: string; n: number }[]
    artists: { artist: string; image?: string | null; n: number }[]
  }
  books: { count: number; pages: number; list: { title: string; cover_url?: string | null }[]; best?: { title: string; rating: number } | null }
  travel: { trips: number; countries: string[]; photos: number; list: { id: number; country: string; place?: string | null; title: string }[] }
  guitar: { recordings: number }
  games: { hours_now: number; gained: number; since?: string; top: { name: string; hours: number }[] }
  japanese: { known: number; gained: number; since?: string; days: number; reviews: number }
}
const d = ref<Wrapped | null>(null)
const err = ref('')
const busy = ref(false)
const poster = ref<HTMLElement | null>(null)
const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
async function load() {
  d.value = null; err.value = ''
  try { d.value = (await (await fetch(`api.php?action=wrapped&year=${year.value}`, { cache: 'no-store' })).json()) as Wrapped } catch { err.value = 'Fikk ikke hentet året.' }
}
onMounted(load)
watch(year, load)
const years = computed(() => [thisYear, thisYear - 1, thisYear - 2])
const hrs = (m: number) => (m >= 120 ? `${Math.round(m / 60).toLocaleString('nb-NO')} t` : `${m} min`)
const m = computed(() => d.value?.music)
const noMusic = computed(() => !m.value || m.value.plays < 3)
const stats = computed(() => {
  if (!d.value) return []
  const x = d.value
  const out: [string | number, string][] = []
  if (m.value && m.value.plays >= 3) out.push([hrs(m.value.minutes), 'musikk hørt'])
  if (x.books?.count) out.push([x.books.count, x.books.count === 1 ? 'bok lest' : 'bøker lest'])
  if (x.travel?.countries?.length) out.push([x.travel.countries.length, x.travel.countries.length === 1 ? 'land besøkt' : 'land besøkt'])
  if (x.games?.gained) out.push([`${x.games.gained} t`, 'i spill'])
  if (x.japanese?.days) out.push([x.japanese.days, 'dager med japansk'])
  if (x.japanese?.gained && x.japanese.gained > 0) out.push([`+${x.japanese.gained}`, 'japanske ord'])
  if (x.guitar?.recordings) out.push([x.guitar.recordings, 'gitaropptak'])
  return out.slice(0, 6)
})
const topCovers = computed(() => (m.value?.albums || []).filter((a) => a.image).slice(0, 3))
async function saveImage(share: boolean) {
  const node = poster.value
  if (!node) return
  busy.value = true
  try {
    const url = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: '#0d1b33' })
    const blob = await (await fetch(url)).blob()
    const file = new File([blob], `niben-${year.value}.png`, { type: 'image/png' })
    if (share && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `Mitt år ${year.value}` }); busy.value = false; return }
    const a = document.createElement('a')
    a.href = url; a.download = file.name; a.click()
  } catch { err.value = 'Klarte ikke å lage bildet (bilder fra andre nettsteder kan blokkere det).' }
  busy.value = false
}
</script>

<template>
  <div class="yr">
    <div class="bar">
      <div class="seg" role="tablist" aria-label="År"><button v-for="y in years" :key="y" role="tab" :aria-selected="y === year" :class="{ on: y === year }" @click="year = y">{{ y }}</button></div>
      <span class="sp"></span>
      <button class="btn small" :disabled="busy || !d" @click="saveImage(false)"><Loader v-if="busy" :size="14" class="spin" /><Download v-else :size="14" />Lagre som bilde</button>
      <button v-if="d && canShare" class="btn small primary" :disabled="busy" @click="saveImage(true)"><Share2 :size="14" />Del</button>
    </div>
    <p v-if="err" class="notice error">{{ err }}</p>
    <p v-if="!d && !err" class="muted">Henter året …</p>

    <template v-if="d">
      <!-- the poster: this is what becomes the picture -->
      <div ref="poster" class="poster" translate="no">
        <div class="glow"></div>
        <small class="pk">niben.no</small>
        <h2>Mitt år <b>{{ year }}</b></h2>
        <div v-if="topCovers.length" class="covers"><img v-for="a in topCovers" :key="a.album_uri" :src="a.image || undefined" crossorigin="anonymous" alt="" /></div>
        <p v-if="m?.artists?.length" class="line"><Music :size="16" />Mest spilt: <b>{{ m.artists[0].artist }}</b><template v-if="m.tracks?.[0]"> · «{{ m.tracks[0].name }}»</template></p>
        <ul class="stats"><li v-for="s in stats" :key="s[1]"><b>{{ s[0] }}</b><span>{{ s[1] }}</span></li></ul>
        <p v-if="d.travel?.countries?.length" class="line"><Plane :size="16" />{{ d.travel.countries.slice(0, 4).join(' · ') }}</p>
        <p v-if="d.books?.best" class="line"><BookOpen :size="16" />Favorittboka: <b>{{ d.books.best.title }}</b></p>
        <p v-if="!stats.length && noMusic" class="line dim">{{ tx('year.empty') }}</p>
      </div>

      <!-- the details -->
      <section v-if="m" class="card">
        <h3><Music :size="16" />Musikk</h3>
        <p v-if="noMusic" class="help">{{ m.logging ? 'Det er ikke logget nok lytting ennå – den fylles på etter hvert som du hører.' : 'Koble til Spotify på nytt i Admin (Oversikt → Spotify) for å la siden telle lyttingen din.' }}</p>
        <template v-else>
          <p class="help">{{ m.plays.toLocaleString('nb-NO') }} avspillinger · {{ hrs(m.minutes) }}<template v-if="m.since"> · teller siden {{ new Date(m.since * 1000).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' }) }}</template></p>
          <div class="cols">
            <div><h4>Album</h4><ol><li v-for="a in m.albums" :key="a.album_uri"><img v-if="a.image" :src="a.image" alt="" crossorigin="anonymous" /><span translate="no"><b>{{ a.album }}</b><small>{{ a.artist }}</small></span><em>{{ a.n }}</em></li></ol></div>
            <div><h4>Låter</h4><ol><li v-for="t in m.tracks" :key="t.name + t.artist"><img v-if="t.image" :src="t.image" alt="" crossorigin="anonymous" /><span translate="no"><b>{{ t.name }}</b><small>{{ t.artist }}</small></span><em>{{ t.n }}</em></li></ol></div>
            <div><h4>Artister</h4><ol><li v-for="a in m.artists" :key="a.artist"><img v-if="a.image" :src="a.image" alt="" crossorigin="anonymous" class="round" /><span translate="no"><b>{{ a.artist }}</b></span><em>{{ a.n }}</em></li></ol></div>
          </div>
        </template>
      </section>
      <section v-if="d.books?.count" class="card">
        <h3><BookOpen :size="16" />Bøker</h3>
        <p class="help">{{ d.books.count }} {{ d.books.count === 1 ? 'bok' : 'bøker' }}<template v-if="d.books.pages"> · {{ d.books.pages.toLocaleString('nb-NO') }} sider</template></p>
        <div class="shelf"><div v-for="b in d.books.list" :key="b.title" class="bk"><img v-if="b.cover_url" :src="b.cover_url" alt="" crossorigin="anonymous" /><span v-else class="ph">{{ b.title }}</span><small translate="no">{{ b.title }}</small></div></div>
      </section>
      <section v-if="d.travel?.trips" class="card">
        <h3><Plane :size="16" />Reiser</h3>
        <p class="help">{{ d.travel.trips }} {{ d.travel.trips === 1 ? 'reise' : 'reiser' }} · {{ d.travel.countries.length }} land · {{ d.travel.photos }} bilder</p>
        <ul class="plain"><li v-for="t in d.travel.list" :key="t.id" translate="no"><b>{{ t.place || t.country }}</b><small>{{ t.title }}</small></li></ul>
      </section>
      <section v-if="d.games?.top?.length" class="card">
        <h3><Gamepad2 :size="16" />Spill</h3>
        <p class="help"><template v-if="d.games.gained">{{ d.games.gained }} timer spilt i {{ year }} (siden {{ new Date(d.games.since ?? '').toLocaleDateString('nb-NO') }}). </template>Mest spilt totalt: <b translate="no">{{ d.games.top.map((g) => g.name).join(', ') }}</b>.</p>
      </section>
      <section v-if="d.japanese?.days || d.japanese?.known" class="card">
        <h3><Languages :size="16" />Japansk</h3>
        <p class="help"><b>{{ d.japanese.days }}</b> dager med øving · {{ d.japanese.reviews }} kort<template v-if="d.japanese.known"> · {{ d.japanese.known }} ord kjent</template><template v-if="d.japanese.gained > 0"> (+{{ d.japanese.gained }} siden {{ new Date(d.japanese.since ?? '').toLocaleDateString('nb-NO') }})</template></p>
      </section>
      <section v-if="d.guitar?.recordings" class="card">
        <h3><Guitar :size="16" />Gitar</h3>
        <p class="help">{{ d.guitar.recordings }} {{ d.guitar.recordings === 1 ? 'opptak' : 'opptak' }} spilt inn.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.yr { display: grid; gap: 16px; min-width: 0; }
.bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sp { flex: 1; }
.bar .btn { display: inline-flex; align-items: center; gap: 6px; }
.seg { display: inline-flex; padding: 3px; border-radius: 999px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.seg button { padding: 6px 14px; border: 0; border-radius: 999px; background: transparent; color: var(--text-2); font: 700 0.84rem var(--font); cursor: pointer; }
.seg button.on { background: var(--accent); color: #fff; }
.spin { animation: sp 0.9s linear infinite; }
@keyframes sp { to { transform: rotate(360deg); } }
.muted, .help { margin: 0; color: var(--text-2); font-size: 0.88rem; }
/* the poster (4:5, like a story / post) */
.poster { position: relative; overflow: hidden; width: min(100%, 540px); margin: 0 auto; aspect-ratio: 4 / 5; padding: 30px 28px; border-radius: 26px; display: grid; align-content: space-between; gap: 10px; color: #fff; background: linear-gradient(160deg, #1f6fe0 0%, #4b3fd1 55%, #a23bb8 100%); box-shadow: 0 24px 60px rgba(30, 60, 160, 0.35); }
.glow { position: absolute; inset: -30% -20% auto auto; width: 70%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle, rgba(255, 255, 255, 0.28), transparent 65%); pointer-events: none; }
.pk { font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.75; }
.poster h2 { margin: 0; font-size: clamp(2rem, 8vw, 2.9rem); line-height: 1; font-weight: 800; }
.poster h2 b { display: block; font-size: 1.5em; color: #ffe27a; }
.covers { display: flex; gap: 10px; }
.covers img { width: 31%; aspect-ratio: 1; border-radius: 12px; object-fit: cover; box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35); }
.line { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 0.95rem; line-height: 1.3; }
.line svg { flex: none; opacity: 0.8; }
.line.dim { opacity: 0.75; }
.stats { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.stats li { display: grid; padding: 10px 12px; border-radius: 14px; background: rgba(255, 255, 255, 0.14); }
.stats b { font-size: 1.5rem; line-height: 1.1; }
.stats span { font-size: 0.74rem; opacity: 0.85; }
/* details */
.card { display: grid; gap: 10px; padding: 18px; border-radius: 20px; background: var(--glass-strong); border: 1px solid var(--glass-border); min-width: 0; }
.card h3 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 1rem; color: var(--accent); }
.card h3 svg { flex: none; }
h4 { margin: 0 0 6px; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
ol li { display: flex; align-items: center; gap: 10px; min-width: 0; }
ol img { width: 38px; height: 38px; border-radius: 6px; object-fit: cover; flex: none; }
ol img.round { border-radius: 50%; }
ol span { display: grid; min-width: 0; flex: 1; }
ol b { font-size: 0.86rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
ol small { color: var(--text-3); font-size: 0.74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
ol em { font-style: normal; font-size: 0.8rem; font-weight: 700; color: var(--accent); }
.shelf { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px; }
.bk { flex: none; width: 84px; display: grid; gap: 4px; }
.bk img, .bk .ph { width: 84px; height: 124px; border-radius: 6px; object-fit: cover; box-shadow: 0 6px 14px rgba(0, 0, 0, 0.2); background: var(--accent-soft); font-size: 0.7rem; padding: 6px; }
.bk small { font-size: 0.7rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.plain { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
.plain li { display: flex; gap: 10px; align-items: baseline; }
.plain small { color: var(--text-3); }
</style>
