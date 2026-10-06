<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Check, KeyRound, ExternalLink, Music2, MapPin, Plug, Download, Mail, Trash2, Lock } from 'lucide-vue-next'
import { api, errorMessage, account } from '@/composables/site/useAdmin'
import { reloadData, type SectionId } from '@/composables/site/useData'
import type { Flash } from '../../types'
import { strava, loadStrava, disconnectStrava } from '@/composables/site/useStrava'

// One component, two admin tabs: `tilkoblinger` (Spotify, Steam, jpdb … the services it fetches from) and `konto` (e-mail,
// password, backup, deleting the account). Which corners the room shows is decided in Faner (AdminTabs).
const props = defineProps<{ part: 'tilkoblinger' | 'konto' }>()
// What this room shows, and the keys it needs: switch corners off (they disappear from the room and the menu), and add
// your own API keys for the things that fetch from other services (jpdb for Japanese, Steam for the gaming corner).
interface Settings {
  user: { id: number; username: string; owner: boolean }
  email: string
  sections: Record<SectionId, boolean>
  locked: SectionId[]
  keys: { jpdb: boolean; steam_id: string | null; steam_key: boolean; github_user: string | null; lastfm: boolean; spotify_app: 'site' | null }
  spotify: { connected: boolean; denied: boolean; redirect: string }
}
interface PlaceHit { name: string; region: string; country: string; lat: number; lon: number }
const s = ref<Settings | null>(null)
const msg = ref<Flash | null>(null)
const busy = ref(false)
const jpdbKey = ref('')
const steamId = ref('')
const steamKey = ref('')
const newEmail = ref('')
const emailPw = ref('')
const delPw = ref('')
const ghUser = ref('')
const lastfm = ref('')
const place = ref<{ name: string } | null>(null)
const placeQ = ref('')
const placeHits = ref<PlaceHit[]>([])
let placeTimer: ReturnType<typeof setTimeout> | undefined
const oldPw = ref('')
const newPw = ref('')

async function load() {
  try {
    s.value = await api<Settings>('me_settings')
    steamId.value = s.value.keys.steam_id && s.value.keys.steam_id !== 'fra oppsettet' ? s.value.keys.steam_id : ''
    ghUser.value = s.value.keys.github_user ?? ''
    api<{ place: { name: string } | null }>('home_get').then((r) => { place.value = r.place }).catch(() => {})
  } catch (e) { msg.value = { error: errorMessage(e) } }
}
onMounted(() => { void load(); void loadStrava(true) })

async function post(body: Record<string, unknown>, ok: string) {
  busy.value = true
  msg.value = null
  try {
    s.value = await api<Settings>('me_settings', body)
    msg.value = { ok }
    await reloadData() // the room changes at once
  } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = false }
}
async function saveJpdb() { await post({ jpdb_key: jpdbKey.value.trim() }, 'jpdb-nøkkelen er lagret.'); jpdbKey.value = '' }
async function saveSteam() {
  const body: Record<string, unknown> = { steam_id: steamId.value.trim() }
  if (steamKey.value.trim()) body.steam_key = steamKey.value.trim()
  await post(body, 'Steam er lagret.')
  steamKey.value = ''
}
async function disconnectSpotify() {
  busy.value = true
  try { await api('spotify_disconnect', {}); await load(); await reloadData(); msg.value = { ok: 'Spotify er koblet fra.' } } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = false }
}
const saveGithub = () => post({ github_user: ghUser.value.trim() }, ghUser.value.trim() ? 'GitHub-navnet er lagret.' : 'GitHub-navnet er fjernet.')
async function saveLastfm() { await post({ lastfm_key: lastfm.value.trim() }, lastfm.value.trim() ? 'Last.fm-nøkkelen er lagret.' : 'Last.fm-nøkkelen er fjernet.'); lastfm.value = '' }
function findPlace() {
  clearTimeout(placeTimer)
  if (placeQ.value.trim().length < 2) { placeHits.value = []; return }
  placeTimer = setTimeout(async () => {
    try { placeHits.value = (await api<{ results: PlaceHit[] }>('home_search', null, { query: `&q=${encodeURIComponent(placeQ.value.trim())}` })).results } catch (e) { msg.value = { error: errorMessage(e) } }
  }, 300)
}
async function setPlace(h: PlaceHit) {
  busy.value = true
  try {
    await api('home_set', { name: h.name + (h.region ? `, ${h.region}` : ''), lat: h.lat, lon: h.lon })
    place.value = { name: h.name }; placeQ.value = ''; placeHits.value = []
    msg.value = { ok: 'Bostedet er lagret – rommet følger været og dag/natt der.' }
  } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = false }
}
async function clearPlace() {
  busy.value = true
  try { await api('home_set', { clear: true }); place.value = null; msg.value = { ok: 'Bostedet er fjernet.' } } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = false }
}
const clearJpdb = () => post({ jpdb_key: '' }, 'jpdb-nøkkelen er fjernet.')
async function changeEmail() {
  busy.value = true
  msg.value = null
  try {
    await api('me_email', { email: newEmail.value, password: emailPw.value })
    newEmail.value = ''; emailPw.value = ''
    await load()
    msg.value = { ok: 'E-postadressen er byttet.' }
  } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = false }
}
async function backup() {
  busy.value = true
  msg.value = null
  try {
    const r = await fetch('api.php?action=admin_backup', { headers: { 'X-Niben': '1' }, credentials: 'same-origin' })
    if (!r.ok) throw new Error('Klarte ikke å lage sikkerhetskopien.')
    const url = URL.createObjectURL(await r.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = `niben-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = false }
}
async function deleteAccount() {
  if (!window.confirm('Slette kontoen og alt i rommet ditt for godt?')) return
  busy.value = true
  msg.value = null
  try { await api('me_delete', { password: delPw.value }); location.href = location.pathname } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = false }
}
async function changePw() {
  busy.value = true
  msg.value = null
  try { await api('me_password', { old: oldPw.value, new: newPw.value }); oldPw.value = ''; newPw.value = ''; msg.value = { ok: 'Passordet er byttet.' } } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = false }
}
</script>

<template>
  <div v-if="s" class="set">
    <p v-if="msg?.ok" class="notice ok">{{ msg.ok }}</p>
    <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>


    <section v-if="part === 'tilkoblinger'" class="svcs">
      <h3><Plug :size="16" /> Tilkoblinger</h3>
      <p class="muted">Tjenestene rommet henter fra. Åpne en for å koble til eller bytte. Nøkler lagres kryptert og vises aldri igjen.</p>

      <details class="svc" :open="!s.spotify.connected && !!s.keys.spotify_app">
        <summary><Music2 :size="18" /><span class="t"><b>Spotify</b><small>Lytteplassen: platespiller, hylle og spillelister</small></span><span class="pill" :class="s.spotify.connected ? 'ok' : 'off'">{{ s.spotify.connected ? 'Koblet til' : 'Ikke koblet' }}</span></summary>
        <div class="body">
          <p class="muted">Kobler platespilleren, hylla og spillelistene til din egen Spotify-konto. Bare du styrer musikken – besøkende ser hva som spilles. Avspilling i nettleseren krever Spotify Premium.</p>
          <p class="status">
            <a v-if="s.keys.spotify_app" class="btn primary small" href="api.php?action=spotify_login"><Plug :size="14" />{{ s.spotify.connected ? 'Koble til på nytt' : 'Koble til Spotify' }}</a>
            <button v-if="s.spotify.connected" class="btn soft small" :disabled="busy" @click="disconnectSpotify">Koble fra</button>
          </p>
          <p v-if="s.spotify.connected && s.spotify.denied" class="notice error">Spotify slipper ikke denne kontoen inn ennå, så hylla blir tom. Be eieren av siden legge til e-posten du bruker på Spotify (Spotify-dashboardet → appen → User Management).</p>
          <p v-if="s.keys.spotify_app && !s.spotify.connected" class="muted">Spotify slipper bare inn kontoer som eieren av siden har lagt til. Be eieren legge til navnet og e-posten du bruker på Spotify, og trykk så «Koble til».</p>
          <p v-else-if="!s.keys.spotify_app" class="muted">Spotify er ikke satt opp på denne siden ennå.</p>
        </div>
      </details>

      <details v-if="strava.configured" class="svc">
        <summary><Plug :size="18" /><span class="t"><b>Strava</b><small>Trening: øktene dine med rute, av seg selv</small></span><span class="pill" :class="strava.connected ? 'ok' : 'off'">{{ strava.connected ? strava.athlete || 'Koblet til' : 'Ikke koblet' }}</span></summary>
        <div class="body">
          <p class="muted">Legg til modulen «Trening» under Rommet → Hobbyer. Nye økter hentes når du åpner den (og med knappen der).</p>
          <p class="status"><a class="btn primary small" href="api.php?action=strava_login"><Plug :size="14" />{{ strava.connected ? 'Koble til på nytt' : 'Koble til Strava' }}</a><button v-if="strava.connected" class="btn soft small" @click="disconnectStrava">Koble fra</button></p>
          <p v-if="strava.error" class="notice error">{{ strava.error }}</p>
        </div>
      </details>

      <details class="svc">
        <summary><KeyRound :size="18" /><span class="t"><b>jpdb</b><small>Japansk: ord, repetisjon og anime</small></span><span class="pill" :class="s.keys.jpdb ? 'ok' : 'off'">{{ s.keys.jpdb ? 'Nøkkel lagret' : 'Ikke satt' }}</span></summary>
        <form class="body keys" @submit.prevent="saveJpdb">
          <label class="field">
            <span>API-nøkkel</span>
            <input v-model="jpdbKey" type="password" autocomplete="off" :placeholder="s.keys.jpdb ? '•••••••• (skriv en ny for å bytte)' : 'Lim inn nøkkelen'" />
            <small>jpdb.io → Settings → API → «API key». <a href="https://jpdb.io/settings" target="_blank" rel="noopener">Åpne jpdb <ExternalLink :size="11" /></a></small>
          </label>
          <div class="btns"><button class="btn primary small" :disabled="busy || !jpdbKey.trim()"><Check :size="14" />Lagre</button><button v-if="s.keys.jpdb" type="button" class="btn soft small" :disabled="busy" @click="clearJpdb">Fjern</button></div>
        </form>
      </details>

      <details class="svc">
        <summary><KeyRound :size="18" /><span class="t"><b>Steam</b><small>Spill: profilen og biblioteket</small></span><span class="pill" :class="s.keys.steam_id ? 'ok' : 'off'">{{ s.keys.steam_id ? 'Koblet til' : 'Ikke satt' }}</span></summary>
        <form class="body keys" @submit.prevent="saveSteam">
          <label class="field"><span>Steam-ID</span><input v-model="steamId" placeholder="76561198… eller lenken til profilen din" /><small>Profilen og spillene dine må være offentlige i Steam.</small></label>
          <label class="field"><span>Egen Steam API-nøkkel <small>(valgfritt – ellers brukes sidens)</small></span><input v-model="steamKey" type="password" autocomplete="off" :placeholder="s.keys.steam_key ? '•••••••• (lagret)' : ''" /></label>
          <div class="btns"><button class="btn primary small" :disabled="busy"><Check :size="14" />Lagre</button></div>
        </form>
      </details>

      <details class="svc">
        <summary><KeyRound :size="18" /><span class="t"><b>GitHub</b><small>Prosjekter: dine åpne prosjekter</small></span><span class="pill" :class="s.keys.github_user ? 'ok' : 'off'">{{ s.keys.github_user ? s.keys.github_user : 'Ikke satt' }}</span></summary>
        <form class="body keys" @submit.prevent="saveGithub">
          <label class="field"><span>Brukernavn</span><input v-model="ghUser" placeholder="navn eller lenken til profilen din" /><small>Bare åpne (public) prosjekter vises. Skru på «Prosjekter» under «Hva vises».</small></label>
          <div class="btns"><button class="btn primary small" :disabled="busy"><Check :size="14" />Lagre</button></div>
        </form>
      </details>

      <details class="svc">
        <summary><KeyRound :size="18" /><span class="t"><b>Last.fm</b><small>Oppdag: forslag til ny musikk</small></span><span class="pill" :class="s.keys.lastfm ? 'ok' : 'off'">{{ s.keys.lastfm ? 'Nøkkel lagret' : 'Ikke satt' }}</span></summary>
        <form class="body keys" @submit.prevent="saveLastfm">
          <label class="field"><span>API-nøkkel</span><input v-model="lastfm" type="password" autocomplete="off" :placeholder="s.keys.lastfm ? '•••••••• (skriv en ny for å bytte)' : '32 tegn'" /><small><a href="https://www.last.fm/api/account/create" target="_blank" rel="noopener">Lag en nøkkel (gratis) <ExternalLink :size="11" /></a></small></label>
          <div class="btns"><button class="btn primary small" :disabled="busy || !lastfm.trim()"><Check :size="14" />Lagre</button><button v-if="s.keys.lastfm" type="button" class="btn soft small" :disabled="busy" @click="post({ lastfm_key: '' }, 'Last.fm-nøkkelen er fjernet.')">Fjern</button></div>
        </form>
      </details>

      <details class="svc">
        <summary><MapPin :size="18" /><span class="t"><b>Bosted</b><small>Været og dag/natt i rommet</small></span><span class="pill" :class="place ? 'ok' : 'off'">{{ place ? place.name : 'Ikke satt' }}</span></summary>
        <div class="body">
          <p class="muted">Rommet kan regne når det regner der du bor, og bli mørkt om natta. Bare stedsnavnet og været vises – aldri koordinater.</p>
          <p v-if="place" class="status"><button class="btn soft small" :disabled="busy" @click="clearPlace">Fjern {{ place.name }}</button></p>
          <label class="field keys"><span>Søk etter sted</span><input v-model="placeQ" placeholder="f.eks. Bergen" @input="findPlace" /></label>
          <ul v-if="placeHits.length" class="hits"><li v-for="h in placeHits" :key="h.lat + ',' + h.lon"><button :disabled="busy" @click="setPlace(h)"><b>{{ h.name }}</b><small>{{ [h.region, h.country].filter(Boolean).join(', ') }}</small></button></li></ul>
        </div>
      </details>

      <details class="svc free">
        <summary><Plug :size="18" /><span class="t"><b>Uten oppsett</b><small>Brukes av hobbymodulene – ingen nøkkel trengs</small></span><span class="pill ok">Klare</span></summary>
        <ul class="body free-list">
          <li><b>Filmer og podkaster</b> – plakater og lenker fra iTunes</li>
          <li><b>Serier</b> – TVmaze</li>
          <li><b>Oppskrifter og baking</b> – TheMealDB</li>
          <li><b>Fugler og planter</b> – artsnavn fra GBIF</li>
          <li><b>Reisemål</b> – flagg fra REST Countries</li>
          <li><b>Restauranter, turer og camping</b> – steder fra OpenStreetMap</li>
          <li><b>Sjakk</b> – rating fra chess.com og lichess</li>
          <li><b>Stjernekikking</b> – NASAs dagsbilde</li>
          <li><b>Trening</b> – GPX-filer fra klokka (leses i nettleseren){{ strava.configured ? '' : ' · Strava kan kobles til når eieren av siden har satt det opp (strava-setup.sh)' }}</li>
        </ul>
      </details>
    </section>

    <section v-if="part === 'konto'">
      <h3><Mail :size="16" /> E-post</h3>
      <p class="muted">{{ s.user.owner ? 'Hit sendes beskjed når noen ber om en konto.' : 'Brukes til beskjed om kontoen din og hvis du glemmer passordet.' }} Nå: <b>{{ s.email || 'ikke satt' }}</b></p>
      <form class="keys" @submit.prevent="changeEmail">
        <label class="field"><span>Ny e-postadresse</span><input v-model="newEmail" type="email" autocomplete="email" required maxlength="190" /></label>
        <label class="field"><span>Passord (for å bekrefte)</span><input v-model="emailPw" type="password" autocomplete="current-password" required /></label>
        <button class="btn soft" :disabled="busy">Bytt e-post</button>
      </form>
    </section>

    <section v-if="part === 'konto' && !s.user.owner">
      <h3><Lock :size="16" /> Passord</h3>
      <form class="keys" @submit.prevent="changePw">
        <label class="field"><span>Gammelt passord</span><input v-model="oldPw" type="password" autocomplete="current-password" required /></label>
        <label class="field"><span>Nytt passord (minst 8 tegn)</span><input v-model="newPw" type="password" autocomplete="new-password" minlength="8" required /></label>
        <button class="btn soft" :disabled="busy">Bytt passord</button>
      </form>
      <p class="muted">Du er logget inn som <b>{{ account.user?.username }}</b> ({{ s.email }}).</p>
    </section>

    <section v-if="part === 'konto'">
      <h3><Download :size="16" /> Sikkerhetskopi</h3>
      <p class="muted">Last ned alt innholdet i rommet ditt (reiser, bøker, opptak, sanger, gitarer, gjestebok og innstillinger) som én fil. Bildene og lydfilene ligger på serveren og er ikke med. Nøklene dine er aldri med.</p>
      <button class="btn soft" :disabled="busy" @click="backup"><Download :size="15" />Last ned sikkerhetskopi</button>
    </section>

    <section v-if="part === 'konto' && !s.user.owner" class="danger">
      <h3><Trash2 :size="16" /> Slett kontoen</h3>
      <p class="muted">Sletter rommet ditt for godt: alt innhold, bilder og lydfiler. Det kan ikke angres – ta en sikkerhetskopi først.</p>
      <form class="keys" @submit.prevent="deleteAccount">
        <label class="field"><span>Skriv passordet for å slette</span><input v-model="delPw" type="password" autocomplete="current-password" required /></label>
        <button class="btn danger" :disabled="busy">Slett kontoen og rommet</button>
      </form>
    </section>
  </div>
  <p v-else class="muted">Henter innstillinger …</p>
</template>

<style scoped>
.set { display: grid; gap: 26px; }
h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; font-size: 1.05rem; }
.muted { color: var(--text-3); font-size: 0.86rem; margin: 0 0 10px; }
.row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; margin-bottom: 4px; border: 0; border-radius: 12px; background: transparent; color: var(--text); text-align: left; cursor: pointer; }
.row:hover:not(:disabled) { background: var(--accent-soft); }
.row.off { opacity: 0.5; cursor: default; }
.l { flex: 1; display: grid; min-width: 0; }
.l small { color: var(--text-3); font-size: 0.78rem; }
.tg { position: relative; flex: none; width: 38px; height: 22px; border-radius: 999px; background: var(--glass-border); transition: background 0.2s; }
.tg::after { content: ''; position: absolute; left: 3px; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); transition: transform 0.2s; }
.tg.on { background: var(--accent); }
.tg.on::after { transform: translateX(16px); }
.keys { display: grid; gap: 12px; max-width: 480px; }
.keys textarea { width: 100%; box-sizing: border-box; resize: vertical; }
.danger h3 { color: #e0705f; }
.btn.danger { background: #c8493a; color: #fff; justify-self: start; }
.keys .btn { justify-self: start; display: inline-flex; align-items: center; gap: 6px; }
.field small { color: var(--text-3); font-weight: 500; }
.field small a, .steps a { color: var(--accent); display: inline-flex; align-items: center; gap: 2px; }
.status { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 0 0 10px; }
.pill { padding: 3px 11px; border-radius: 999px; font-size: 0.8rem; background: var(--glass-border); color: var(--text-2); }
.pill.ok { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--text); }
.btns { display: flex; gap: 8px; flex-wrap: wrap; }
.how { margin-bottom: 14px; }
.how summary { cursor: pointer; font-weight: 600; margin-bottom: 8px; }
.steps { margin: 6px 0 12px; padding-left: 20px; display: grid; gap: 6px; font-size: 0.88rem; color: var(--text-2); }
.copy { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border: 1px solid var(--glass-border); border-radius: 8px; background: transparent; color: var(--text); cursor: pointer; max-width: 100%; }
.copy code { overflow-wrap: anywhere; font-size: 0.8rem; }
.hits { list-style: none; margin: 6px 0 0; padding: 0; max-width: 480px; }
.hits button { display: grid; width: 100%; text-align: left; padding: 8px 10px; border: 0; border-radius: 10px; background: transparent; color: var(--text); cursor: pointer; }
.hits button:hover { background: var(--accent-soft); }
.hits small { color: var(--text-3); }
.svcs { display: grid; gap: 8px; }
.svc { border: 1px solid var(--glass-border); border-radius: 16px; background: color-mix(in srgb, var(--bg) 60%, transparent); }
.svc > summary { list-style: none; display: flex; align-items: center; gap: 12px; padding: 12px 14px; cursor: pointer; border-radius: 16px; }
.svc > summary::-webkit-details-marker { display: none; }
.svc > summary:hover { background: var(--accent-soft); }
.svc .t { flex: 1; display: grid; min-width: 0; } .svc .t small { color: var(--text-3); font-size: 0.78rem; }
.svc[open] > summary { border-bottom: 1px solid var(--glass-border); border-radius: 16px 16px 0 0; }
.svc .body { padding: 14px; margin: 0; }
.pill.off { opacity: 0.8; }
.free-list { list-style: none; display: grid; gap: 6px; font-size: 0.88rem; color: var(--text-2); } .free-list b { color: var(--text); }
</style>
