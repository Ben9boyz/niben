<script setup>
import { ref, computed, onMounted } from 'vue'
import { MessageCircle, Check as CheckIcon, Archive as ArchiveIcon, MapPin, Trophy, Download, Users, Music2, Gamepad2, Languages, Globe2, BookOpen, Plane, Mic, RefreshCw, Unplug, Plug, Trash2, Check, AlertTriangle } from 'lucide-vue-next'
import { api } from '../../composables/useAdmin'
import { spotify, setLockSeconds, refreshSpotify, fmtLock, notify } from '../../composables/useSpotify'
import { byCode } from '../../lib/languages'
import { pwa, install, desktopApp } from '../../composables/usePwa'
import { live, loadLive } from '../../composables/useLive'
import { milestones, loadMilestones, setMilestones } from '../../composables/useMilestones'

// The first admin tab: what is connected and how things are set up, in plain words – with the buttons to fix it.
const emit = defineEmits(['goto'])
const st = ref(null)
const vis = ref(null)
const err = ref('')
const busy = ref('')
const msg = ref('')
async function load() {
  try { st.value = await api('admin_status') ; err.value = '' } catch (e) { err.value = e.message }
  try { vis.value = await api('admin_visits') } catch {}
}
onMounted(load)
const flash = (t) => { msg.value = t; setTimeout(() => { if (msg.value === t) msg.value = '' }, 3500) }

const LOCKS = [0, 300, 600, 900, 1800, 3600]
const lockSec = computed(() => spotify.lockSeconds)
const locked = computed(() => spotify.lockUntil > Date.now() / 1000 + spotify.offset)
async function setLock(s) {
  busy.value = 'lock'
  try { await setLockSeconds(s); flash(s ? `Låsen er nå ${fmtLock(s)}.` : 'Låsen er slått av.') } catch (e) { err.value = e.message }
  busy.value = ''
}
async function refresh() {
  busy.value = 'refresh'
  try { await api('spotify_refresh', {}); await refreshSpotify(); flash('Hentet på nytt fra Spotify.') } catch (e) { err.value = e.message }
  busy.value = ''
}
async function disconnect() {
  if (!confirm('Koble fra Spotify? Du kan koble til igjen når som helst.')) return
  busy.value = 'disc'
  try { await api('spotify_disconnect', {}); await refreshSpotify(); await load(); flash('Spotify er koblet fra.') } catch (e) { err.value = e.message }
  busy.value = ''
}
async function clearLang(lang) {
  if (!confirm(lang ? `Slette oversettelsene til ${byCode[lang]?.en || lang}? De lages på nytt neste gang noen velger språket.` : 'Slette ALLE oversettelser? De lages på nytt etter hvert.')) return
  busy.value = 'tr'
  try { await api('admin_translate_clear', { lang }); await load(); flash('Slettet.') } catch (e) { err.value = e.message }
  busy.value = ''
}
const maxDay = computed(() => Math.max(1, ...(vis.value?.days || []).map((d) => d.u)))
const dayLabel = (d) => new Date(d + 'T12:00:00').toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
// guestbook: greetings wait here until I have read and approved them
const gb = ref([])
async function loadGb() { try { gb.value = (await api('admin_guestbook')).items } catch {} }
onMounted(loadGb)
const pendingGb = computed(() => gb.value.filter((g) => g.status === 'pending'))
async function gbDo(id, what) { try { await api('admin_guestbook_set', { id, do: what }); await loadGb() } catch (e) { err.value = e.message } }
// backup: everything as one file
async function backup() {
  busy.value = 'bk'
  try {
    const r = await fetch('api.php?action=admin_backup', { headers: { 'X-Niben': '1' }, credentials: 'same-origin' })
    if (!r.ok) throw new Error('Fikk ikke laget sikkerhetskopien.')
    const url = URL.createObjectURL(await r.blob())
    const a = document.createElement('a'); a.href = url; a.download = `niben-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    flash('Sikkerhetskopien er lastet ned.')
  } catch (e) { err.value = e.message }
  busy.value = ''
}
const home = ref(null)
const hq = ref('')
const hres = ref([])
let hTimer = 0
async function loadHome() { try { home.value = (await api('home_get')).place } catch {} }
onMounted(loadHome)
function searchHome() {
  clearTimeout(hTimer)
  if (hq.value.trim().length < 2) { hres.value = []; return }
  hTimer = setTimeout(async () => { try { hres.value = (await api('home_search', null, { query: `&q=${encodeURIComponent(hq.value.trim())}` })).results } catch (e) { err.value = e.message } }, 300)
}
async function setHome(r) {
  busy.value = 'home'
  try { await api('home_set', { name: r.name + (r.region ? `, ${r.region}` : ''), lat: r.lat, lon: r.lon }); hq.value = ''; hres.value = []; await loadHome(); await loadLive(); flash('Bostedet er lagret – siden følger nå været og dag/natt der.') } catch (e) { err.value = e.message }
  busy.value = ''
}
async function clearHome() {
  busy.value = 'home'
  try { await api('home_set', { clear: true }); await loadHome(); await loadLive(); flash('Bostedet er fjernet.') } catch (e) { err.value = e.message }
  busy.value = ''
}
const KIND = { clear: 'klart', cloud: 'skyet', fog: 'tåke', drizzle: 'yr', rain: 'regn', thunder: 'torden', snow: 'snø' }
const bf = ref('')
async function loadBf() { try { bf.value = (await api('admin_best_friend')).id || '' } catch {} }
onMounted(loadBf)
onMounted(() => loadMilestones(true))
const MS_TYPES = [['song', 'Sang jeg har lært'], ['anime', 'Anime jeg klarer'], ['book', 'Bok jeg har lest'], ['recording', 'Opptak'], ['trip', 'Reise'], ['other', 'Annet']]
const ms = ref({ type: 'song', title: '', sub: '' })
async function addMs() {
  if (!ms.value.title.trim()) return
  busy.value = 'ms'
  try { const r = await api('milestone_add', { ...ms.value }); setMilestones(r.items); ms.value.title = ''; ms.value.sub = ''; flash('Lagt til – vises nå på hjem-siden.') } catch (e) { err.value = e.message }
  busy.value = ''
}
async function delMs(key) {
  try { setMilestones((await api('milestone_delete', { key })).items) } catch (e) { err.value = e.message }
}
async function saveBf() {
  busy.value = 'bf'
  try { const r = await api('admin_best_friend', { id: bf.value }); bf.value = r.id; flash('Bestevennen er lagret – vises på Spill-siden om litt.') } catch (e) { err.value = e.message }
  busy.value = ''
}
const langName = (c) => byCode[c]?.en || c
</script>

<template>
  <div class="ov">
    <p v-if="err" class="notice error">{{ err }}</p>
    <p v-if="msg" class="notice ok">{{ msg }}</p>
    <div v-if="!st && !err" class="muted">Henter status …</div>

    <template v-if="st">
      <!-- content -->
      <section class="cards">
        <button class="stat" @click="emit('goto', 'reiser')"><Plane :size="18" /><b>{{ st.counts.trips }}</b><span>reiser</span><small>{{ st.counts.photos }} bilder</small></button>
        <button class="stat" @click="emit('goto', 'boker')"><BookOpen :size="18" /><b>{{ st.counts.books }}</b><span>bøker</span></button>
        <button class="stat" @click="emit('goto', 'opptak')"><Mic :size="18" /><b>{{ st.counts.recordings }}</b><span>gitaropptak</span></button>
      </section>

      <!-- milestones -->
      <section class="card">
        <header><Trophy :size="18" /><h3>Milepæler på hjem-siden</h3></header>
        <p class="help">Vises i 30 dager under «Akkurat nå». Nye opptak, bøker du er ferdig med, anime du forstår (80 % av ordene, som jpdb bruker) og reiser (dagen de begynner) kommer av seg selv. Resten legger du inn her.</p>
        <form class="msform" @submit.prevent="addMs">
          <select v-model="ms.type" aria-label="Type"><option v-for="t in MS_TYPES" :key="t[0]" :value="t[0]">{{ t[1] }}</option></select>
          <input v-model="ms.title" placeholder="Hva klarte du? F.eks. Wonderwall" aria-label="Tittel" required />
          <input v-model="ms.sub" placeholder="Litt til (valgfritt)" aria-label="Undertekst" />
          <button class="btn primary small" :disabled="busy === 'ms' || !ms.title.trim()">Legg til</button>
        </form>
        <ul v-if="milestones.items.length" class="mslist">
          <li v-for="m in milestones.items.slice(0, 8)" :key="m.key"><span>{{ m.title }}</span><small>{{ MS_TYPES.find((t) => t[0] === m.type)?.[1] || 'Annet' }} · {{ new Date(m.t * 1000).toLocaleDateString('nb-NO') }}</small><button class="x" :aria-label="`Fjern ${m.title}`" @click="delMs(m.key)"><Trash2 :size="14" /></button></li>
        </ul>
      </section>

      <!-- the desktop app (only I need it, so it lives here and not in the menu) -->
      <section class="card">
        <header><Download :size="18" /><h3>Program på pcen</h3></header>
        <p class="help">niben som eget program: alltid oppdatert, med tyngre grafikk i 3D-rommet. Last ned for maskinen du sitter på, eller installer den som app rett fra nettleseren.</p>
        <div class="row">
          <a class="btn primary small" :class="{ rec: desktopApp?.os === 'Mac' }" href="app/niben-mac-arm64.dmg" download><Download :size="14" />Mac (Apple Silicon){{ desktopApp?.os === 'Mac' ? ' – din maskin' : '' }}</a>
          <a class="btn primary small" :class="{ rec: desktopApp?.os === 'Windows' }" href="app/niben-win-x64.exe" download><Download :size="14" />Windows{{ desktopApp?.os === 'Windows' ? ' – din maskin' : '' }}</a>
          <button v-if="pwa.canInstall && !pwa.installed" class="btn small" @click="install"><Download :size="14" />Installer som app</button>
        </div>
        <p v-if="pwa.installed" class="help">Du bruker allerede niben som app her.</p>
      </section>

      <!-- visitors -->
      <section v-if="vis" class="card">
        <header><Users :size="18" /><h3>Besøkende</h3></header>
        <div class="vstats">
          <div><b>{{ vis.today }}</b><span>i dag</span></div>
          <div><b>{{ vis.week }}</b><span>siste 7 dager</span></div>
          <div><b>{{ vis.month }}</b><span>siste 30 dager</span></div>
          <div><b>{{ vis.total }}</b><span>totalt</span></div>
        </div>
        <div class="bars" role="img" :aria-label="`Besøkende per dag, siste 30 dager`">
          <i v-for="d in vis.days" :key="d.day" :style="{ height: `${Math.max(4, (d.u / maxDay) * 100)}%` }" :class="{ zero: !d.u }" :title="`${dayLabel(d.day)}: ${d.u} besøkende, ${d.h} sidevisninger`"></i>
        </div>
        <p class="help">Hver ulike IP-adresse teller som én besøkende per dag (adressen lagres ikke, bare et tilfeldig avtrykk). {{ vis.returning }} har kommet tilbake på en ny dag. <b>Du telles ikke</b> – når du logger inn, fjernes tellingen fra denne IP-adressen og denne nettleseren.</p>
      </section>

      <!-- guestbook moderation -->
      <section class="card">
        <header><MessageCircle :size="18" /><h3>Gjestebok</h3><span class="pill" :class="pendingGb.length ? 'bad' : 'ok'">{{ pendingGb.length ? `${pendingGb.length} venter` : 'Ingen venter' }}</span></header>
        <p class="help">Hilsener vises ikke på siden før du har godkjent dem.</p>
        <ul v-if="gb.length" class="gbl">
          <li v-for="g in gb.slice(0, 20)" :key="g.id" :class="g.status">
            <div class="gm"><b translate="no">{{ g.name }}</b><small>{{ new Date(g.t * 1000).toLocaleString('nb-NO') }} · {{ g.status === 'pending' ? 'venter' : 'godkjent' }}</small><p translate="no">{{ g.msg }}</p></div>
            <div class="ga"><button v-if="g.status === 'pending'" class="btn primary small" @click="gbDo(g.id, 'approve')"><CheckIcon :size="14" />Godkjenn</button><button class="x" :aria-label="'Slett'" @click="gbDo(g.id, 'delete')"><Trash2 :size="14" /></button></div>
          </li>
        </ul>
        <p v-else class="help">Ingen hilsener ennå.</p>
      </section>

      <!-- backup -->
      <section class="card">
        <header><ArchiveIcon :size="18" /><h3>Sikkerhetskopi</h3></header>
        <p class="help">Last ned alt innholdet (reiser, bøker, opptak, sanger, gjestebok og innstillinger) som én fil. Bildene og lydfilene ligger i <code>uploads/</code> og må lastes ned for seg fra serveren. Ta en kopi av og til.</p>
        <button class="btn primary small" :disabled="busy === 'bk'" @click="backup"><Download :size="14" />Last ned sikkerhetskopi</button>
      </section>

      <!-- where I live: the weather and day / night at home -->
      <section class="card">
        <header><MapPin :size="18" /><h3>Bosted</h3><span class="pill" :class="home ? 'ok' : 'off'">{{ home ? home.name : 'Ikke satt' }}</span></header>
        <p class="help">Når du velger bosted, regner det på nettsiden (og utenfor vinduet i 3D-rommet) når det regner der du bor, det snør når det snør, og rommet blir mørkt når det er natt der. Besøkende kan velge å følge dette med «Live» i lys/mørk-menyen. Bare stedsnavnet og været vises offentlig, aldri nøyaktig posisjon.</p>
        <p v-if="home && live.configured" class="help">Akkurat nå: <b>{{ KIND[live.kind] || live.kind }}</b><template v-if="live.temp != null"> · {{ live.temp }} °C</template> · {{ live.isDay ? 'dag' : 'natt' }}</p>
        <div class="hsearch"><input v-model="hq" placeholder="Søk etter byen din …" aria-label="Søk etter bosted" @input="searchHome" /></div>
        <ul v-if="hres.length" class="hres"><li v-for="r in hres" :key="r.lat + ',' + r.lon"><button :disabled="busy === 'home'" @click="setHome(r)"><b>{{ r.name }}</b><small>{{ [r.region, r.country].filter(Boolean).join(', ') }}</small></button></li></ul>
        <button v-if="home" class="btn small danger" :disabled="busy === 'home'" @click="clearHome"><Trash2 :size="14" />Fjern bosted</button>
      </section>

      <!-- Spotify -->
      <section class="card">
        <header><Music2 :size="18" /><h3>Spotify</h3>
          <span class="pill" :class="st.spotify.connected ? 'ok' : 'bad'"><Check v-if="st.spotify.connected" :size="13" /><AlertTriangle v-else :size="13" />{{ st.spotify.connected ? 'Koblet til' : 'Ikke koblet til' }}</span>
        </header>
        <template v-if="st.spotify.connected">
          <p class="help">Hvor lenge musikken er låst når du setter på et album eller en spilleliste. Da kan ikke noen (heller ikke du) bytte før tiden er ute{{ locked ? ' – akkurat nå er den låst' : '' }}.</p>
          <div class="chips" role="group" aria-label="Låsens lengde">
            <button v-for="s in LOCKS" :key="s" :class="{ on: lockSec === s }" :disabled="busy === 'lock' || locked" @click="setLock(s)">{{ s ? fmtLock(s) : 'Av' }}</button>
          </div>
          <p v-if="locked" class="help warn">Låsen kan endres når den er ferdig.</p>
          <ul v-if="!st.spotify.can_save || !st.spotify.can_playlists" class="todo">
            <li>Spotify mangler lov til å {{ !st.spotify.can_save ? 'lagre album' : '' }}{{ !st.spotify.can_save && !st.spotify.can_playlists ? ' og ' : '' }}{{ !st.spotify.can_playlists ? 'endre spillelister' : '' }}. <a href="api.php?action=spotify_login">Koble til på nytt</a> for å få det.</li>
          </ul>
          <div class="row">
            <button class="btn small" :disabled="busy === 'refresh'" @click="refresh"><RefreshCw :size="14" />Hent fra Spotify på nytt</button>
            <button class="btn small danger" :disabled="busy === 'disc'" @click="disconnect"><Unplug :size="14" />Koble fra</button>
          </div>
        </template>
        <template v-else>
          <p class="help">Koble til Spotify-kontoen din for å vise album og spillelister, og for å styre musikken.</p>
          <a class="btn primary small" href="api.php?action=spotify_login"><Plug :size="14" />Koble til Spotify</a>
        </template>
      </section>

      <!-- other services -->
      <section class="card">
        <header><Gamepad2 :size="18" /><h3>Andre tjenester</h3></header>
        <ul class="svc">
          <li><span>Steam (spill)</span><span class="pill" :class="st.steam ? 'ok' : 'off'">{{ st.steam ? 'På' : 'Av' }}</span><small v-if="!st.steam">Kjør <code>./steam-setup.sh</code> på maskinen din.</small></li>
          <li class="bfrow" v-if="st.steam"><span>Bestevenn på Steam</span><input v-model="bf" class="bfin" placeholder="Steam-ID eller lenke til profilen" aria-label="Bestevenn på Steam" @keydown.enter="saveBf" /><button class="btn small" :disabled="busy === 'bf'" @click="saveBf">Lagre</button></li>
          <li><span>jpdb (japansk)</span><span class="pill" :class="st.jpdb ? 'ok' : 'off'">{{ st.jpdb ? 'På' : 'Av' }}</span><small v-if="!st.jpdb">Kjør <code>./jpdb-setup.sh</code>.</small></li>
        </ul>
      </section>

      <!-- translation -->
      <section class="card">
        <header><Languages :size="18" /><h3>Språk og oversettelse</h3>
          <span class="pill" :class="st.translate.configured ? 'ok' : 'off'">{{ st.translate.configured ? (st.translate.provider === 'google' ? 'Google Translate' : 'Claude') : 'Ikke satt opp' }}</span>
        </header>
        <p v-if="!st.translate.configured" class="help">Uten oversetter vises siden bare på norsk. Kjør <code>./translate-setup.sh</code> på maskinen din og last opp <code>_translate.php</code>.</p>
        <template v-else>
          <p class="help">Hver setning oversettes én gang og lagres. Total: <b>{{ st.translate.total }}</b> setninger. Slett et språk hvis oversettelsen ser feil ut – den lages på nytt neste gang noen velger språket.</p>
          <ul v-if="st.translate.languages.length" class="langs">
            <li v-for="l in st.translate.languages" :key="l.lang"><Globe2 :size="14" /><span>{{ langName(l.lang) }}</span><small>{{ l.n }}</small><button class="x" :aria-label="`Slett ${langName(l.lang)}`" :disabled="busy === 'tr'" @click="clearLang(l.lang)"><Trash2 :size="14" /></button></li>
          </ul>
          <p v-else class="help">Ingen språk er oversatt ennå.</p>
          <button v-if="st.translate.languages.length > 1" class="btn small danger" :disabled="busy === 'tr'" @click="clearLang('')"><Trash2 :size="14" />Slett alle</button>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ov { display: grid; gap: 14px; }
.muted { color: var(--text-3); }
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.stat { display: grid; justify-items: start; gap: 2px; padding: 14px; border: 1px solid var(--glass-border); border-radius: 16px; background: var(--glass-strong); color: var(--text-2); text-align: left; cursor: pointer; transition: transform 0.2s, border-color 0.2s; }
.stat:hover { transform: translateY(-2px); border-color: var(--accent); color: var(--accent); }
.stat b { font-size: 1.7rem; font-weight: 800; color: var(--text); line-height: 1.1; }
.stat span { font-size: 0.82rem; }
.stat small { font-size: 0.72rem; color: var(--text-3); }
.card { display: grid; gap: 10px; padding: 16px; border: 1px solid var(--glass-border); border-radius: 18px; background: var(--glass-strong); }
.card header { display: flex; align-items: center; gap: 8px; color: var(--accent); }
.card h3 { margin: 0; flex: 1; font-size: 1rem; color: var(--text); }
.vstats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.vstats div { display: grid; padding: 8px 4px; }
.vstats b { font-size: 1.6rem; font-weight: 800; line-height: 1.1; }
.vstats span { font-size: 0.74rem; color: var(--text-3); }
.bars { display: flex; align-items: flex-end; gap: 3px; height: 70px; padding-top: 4px; }
.bars i { flex: 1; min-width: 0; border-radius: 3px 3px 0 0; background: var(--accent); opacity: 0.85; }
.bars i.zero { background: var(--glass-border); opacity: 1; }
.bars i:hover { opacity: 1; filter: brightness(1.1); }
.help { margin: 0; font-size: 0.86rem; line-height: 1.45; color: var(--text-2); }
.help.warn { color: #b8711a; }
.help code, .svc code { padding: 1px 6px; border-radius: 6px; background: var(--accent-soft); font-size: 0.82em; }
.pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; font-size: 0.74rem; font-weight: 700; background: var(--accent-soft); color: var(--text-2); }
.pill.ok { background: rgba(29, 185, 84, 0.16); color: #17924a; }
.pill.bad { background: rgba(229, 83, 61, 0.16); color: #c0432f; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chips button { padding: 7px 14px; border: 1px solid var(--glass-border); border-radius: 999px; background: transparent; color: var(--text-2); font: 600 0.84rem var(--font); cursor: pointer; }
.chips button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.chips button.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.chips button:disabled:not(.on) { opacity: 0.5; cursor: not-allowed; }
.todo { margin: 0; padding: 10px 14px; list-style: none; border-radius: 12px; background: rgba(240, 160, 64, 0.14); font-size: 0.84rem; }
.todo a { color: var(--accent); font-weight: 700; }
.row { display: flex; flex-wrap: wrap; gap: 8px; }
.row .btn, .card .btn { display: inline-flex; align-items: center; gap: 6px; width: max-content; }
.svc { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.svc li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.svc li span:first-child { flex: 1; font-weight: 600; }
.bfrow { flex-wrap: nowrap; }
.bfin { flex: 2; min-width: 0; padding: 8px 12px; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--bg); color: var(--text); font: 500 0.84rem var(--font); }
.svc small { flex-basis: 100%; color: var(--text-3); }
.hsearch input { width: 100%; padding: 10px 14px; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--bg); color: var(--text); font: 500 0.92rem var(--font); }
.hres { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; }
.hres button { display: flex; flex-direction: column; align-items: flex-start; width: 100%; padding: 8px 12px; border: 0; border-radius: 10px; background: transparent; color: var(--text); text-align: left; cursor: pointer; }
.hres button:hover { background: var(--accent-soft); }
.hres small { color: var(--text-3); }
.gbl { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.gbl li { display: flex; gap: 10px; justify-content: space-between; align-items: flex-start; padding: 10px 12px; border-radius: 12px; background: var(--accent-soft); }
.gbl li.pending { background: rgba(240, 160, 64, 0.16); }
.gm { display: grid; gap: 2px; min-width: 0; }
.gm small { color: var(--text-3); }
.gm p { margin: 4px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.ga { display: flex; gap: 6px; flex: none; align-items: center; }
.msform { display: grid; grid-template-columns: 170px 1fr 1fr auto; gap: 8px; }
.msform select, .msform input { min-width: 0; padding: 8px 12px; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--bg); color: var(--text); font: 500 0.86rem var(--font); }
.mslist { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; }
.mslist li { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-radius: 8px; }
.mslist li:hover { background: var(--accent-soft); }
.mslist span { flex: 1; font-size: 0.88rem; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mslist small { color: var(--text-3); }
@media (max-width: 700px) { .msform { grid-template-columns: 1fr; } }
.langs { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; max-height: 220px; overflow-y: auto; }
.langs li { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-radius: 8px; }
.langs li:hover { background: var(--accent-soft); }
.langs span { flex: 1; font-size: 0.88rem; }
.langs small { color: var(--text-3); font-variant-numeric: tabular-nums; }
.x { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--text-3); cursor: pointer; }
.x:hover { color: #d24b4b; background: rgba(229, 83, 61, 0.12); }
@media (max-width: 600px) { .cards { grid-template-columns: 1fr 1fr 1fr; gap: 8px; } .stat { padding: 10px; } .stat b { font-size: 1.3rem; } }
</style>
