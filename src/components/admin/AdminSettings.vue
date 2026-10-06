<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Check, KeyRound, ExternalLink, Music2, MapPin, Plug } from 'lucide-vue-next'
import { api, errorMessage, account } from '../../composables/useAdmin'
import { reloadData, type SectionId } from '../../composables/useData'
import type { Flash } from '../../types'

// What this room shows, and the keys it needs: switch corners off (they disappear from the room and the menu), and add
// your own API keys for the things that fetch from other services (jpdb for Japanese, Steam for the gaming corner).
interface Settings {
  user: { id: number; username: string; owner: boolean }
  email: string
  sections: Record<SectionId, boolean>
  locked: SectionId[]
  keys: { jpdb: boolean; steam_id: string | null; steam_key: boolean; github_user: string | null; lastfm: boolean; spotify_app: 'site' | null }
  spotify: { connected: boolean; redirect: string }
}
interface PlaceHit { name: string; region: string; country: string; lat: number; lon: number }
const SECTIONS: { id: SectionId; label: string; hint: string }[] = [
  { id: 'reiser', label: 'Reiser', hint: 'Globusen og reisene dine' },
  { id: 'boker', label: 'Bøker', hint: 'Bokhylla' },
  { id: 'gitar', label: 'Gitarer', hint: 'Gitarene og opptakene dine' },
  { id: 'ovelse', label: 'Gitar-øving', hint: 'Timer, akkorder, stemmer og metronom' },
  { id: 'japansk', label: 'Japansk', hint: 'Krever en jpdb-nøkkel (under)' },
  { id: 'gaming', label: 'Spill', hint: 'Steam-profilen din – krever Steam-ID' },
  { id: 'lytte', label: 'Lytteplassen', hint: 'Platespilleren, hylla og musikken – krever at du kobler til Spotify (under)' },
  { id: 'kode', label: 'Prosjekter', hint: 'Dine åpne GitHub-prosjekter – krever GitHub-navnet ditt (under)' },
  { id: 'om', label: 'Om meg', hint: 'Teksten og bildet ditt' },
]
const s = ref<Settings | null>(null)
const msg = ref<Flash | null>(null)
const busy = ref(false)
const jpdbKey = ref('')
const steamId = ref('')
const steamKey = ref('')
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
onMounted(load)

async function post(body: Record<string, unknown>, ok: string) {
  busy.value = true
  msg.value = null
  try {
    s.value = await api<Settings>('me_settings', body)
    msg.value = { ok }
    await reloadData() // the room changes at once
  } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = false }
}
const toggle = (id: SectionId) => { if (s.value && !s.value.locked.includes(id)) void post({ sections: { [id]: !s.value.sections[id] } }, 'Lagret.') }
async function saveKeys() {
  const body: Record<string, unknown> = {}
  if (jpdbKey.value.trim()) body.jpdb_key = jpdbKey.value.trim()
  if (steamKey.value.trim()) body.steam_key = steamKey.value.trim()
  body.steam_id = steamId.value.trim()
  await post(body, 'Nøklene er lagret. De ligger kryptert på serveren og vises aldri igjen.')
  jpdbKey.value = ''; steamKey.value = ''
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

    <section>
      <h3>Hva vises i rommet ditt</h3>
      <p class="muted">Skru av det du ikke vil ha. Det forsvinner fra rommet, fra menyen og fra adressene.</p>
      <button v-for="x in SECTIONS" :key="x.id" class="row" :class="{ off: s.locked.includes(x.id) }" role="switch" :aria-checked="s.sections[x.id]" :disabled="busy || s.locked.includes(x.id)" @click="toggle(x.id)">
        <span class="l"><b>{{ x.label }}</b><small>{{ x.hint }}</small></span><i class="tg" :class="{ on: s.sections[x.id] }" aria-hidden="true"></i>
      </button>
    </section>

    <section>
      <h3><KeyRound :size="16" /> API-nøkler</h3>
      <p class="muted">Nøklene brukes bare til å hente det som vises i rommet ditt. De lagres kryptert og sendes aldri tilbake til nettleseren.</p>
      <form class="keys" @submit.prevent="saveKeys">
        <label class="field">
          <span>jpdb (japansk) <small v-if="s.keys.jpdb">– nøkkel er lagret</small></span>
          <input v-model="jpdbKey" type="password" autocomplete="off" :placeholder="s.keys.jpdb ? '•••••••• (skriv en ny for å bytte)' : 'Lim inn nøkkelen'" />
          <small>jpdb.io → Settings → API → «API key». <a href="https://jpdb.io/settings" target="_blank" rel="noopener">Åpne jpdb <ExternalLink :size="11" /></a></small>
        </label>
        <button v-if="s.keys.jpdb" type="button" class="btn soft small" :disabled="busy" @click="clearJpdb">Fjern jpdb-nøkkelen</button>
        <label class="field">
          <span>Steam-ID</span>
          <input v-model="steamId" placeholder="76561198… eller lenken til profilen din" />
          <small>Profilen og spillene dine må være offentlige i Steam.</small>
        </label>
        <label class="field">
          <span>Egen Steam API-nøkkel <small>(valgfritt – ellers brukes sidens)</small></span>
          <input v-model="steamKey" type="password" autocomplete="off" :placeholder="s.keys.steam_key ? '•••••••• (lagret)' : ''" />
        </label>
        <button class="btn primary" :disabled="busy"><Check :size="15" />Lagre nøklene</button>
      </form>
    </section>


    <section>
      <h3><Music2 :size="16" /> Spotify</h3>
      <p class="muted">Kobler platespilleren, hylla og spillelistene i rommet ditt til din egen Spotify-konto. Bare du kan styre musikken – de som besøker rommet ser bare hva som spilles. Styring og avspilling i nettleseren krever Spotify Premium.</p>
      <p class="status">
        <span class="pill" :class="s.spotify.connected ? 'ok' : 'off'">{{ s.spotify.connected ? 'Koblet til' : 'Ikke koblet til' }}</span>
        <a v-if="s.keys.spotify_app" class="btn primary small" href="api.php?action=spotify_login"><Plug :size="14" />{{ s.spotify.connected ? 'Koble til på nytt' : 'Koble til Spotify' }}</a>
        <button v-if="s.spotify.connected" class="btn soft small" :disabled="busy" @click="disconnectSpotify">Koble fra</button>
      </p>
      <p v-if="s.keys.spotify_app && !s.spotify.connected" class="muted">Spotify slipper bare inn kontoer som eieren av siden har lagt til. Be eieren legge til navnet og e-posten du bruker på Spotify, og trykk så «Koble til».</p>
      <p v-else-if="!s.keys.spotify_app" class="muted">Spotify er ikke satt opp på denne siden ennå.</p>
    </section>

    <section>
      <h3><MapPin :size="16" /> Bosted</h3>
      <p class="muted">Rommet kan regne når det regner der du bor, og bli mørkt om natta. Bare stedsnavnet og været vises – aldri koordinater.</p>
      <p class="status"><span class="pill" :class="place ? 'ok' : 'off'">{{ place ? place.name : 'Ikke satt' }}</span><button v-if="place" class="btn soft small" :disabled="busy" @click="clearPlace">Fjern</button></p>
      <label class="field keys"><span>Søk etter sted</span><input v-model="placeQ" placeholder="f.eks. Bergen" @input="findPlace" /></label>
      <ul v-if="placeHits.length" class="hits"><li v-for="h in placeHits" :key="h.lat + ',' + h.lon"><button :disabled="busy" @click="setPlace(h)"><b>{{ h.name }}</b><small>{{ [h.region, h.country].filter(Boolean).join(', ') }}</small></button></li></ul>
    </section>

    <section>
      <h3><KeyRound :size="16" /> Flere kilder</h3>
      <form class="keys" @submit.prevent="saveGithub">
        <label class="field">
          <span>GitHub-brukernavn <small>– til Prosjekter</small></span>
          <input v-model="ghUser" placeholder="navn eller lenken til profilen din" />
          <small>Bare åpne (public) prosjekter vises. Skru på «Prosjekter» over.</small>
        </label>
        <button class="btn soft small" :disabled="busy"><Check :size="14" />Lagre GitHub</button>
      </form>
      <form class="keys" @submit.prevent="saveLastfm">
        <label class="field">
          <span>Last.fm API-nøkkel <small v-if="s.keys.lastfm">– lagret</small> <small>– til forslag på Oppdag</small></span>
          <input v-model="lastfm" type="password" autocomplete="off" :placeholder="s.keys.lastfm ? '•••••••• (skriv en ny for å bytte)' : '32 tegn'" />
          <small><a href="https://www.last.fm/api/account/create" target="_blank" rel="noopener">Lag en nøkkel (gratis) <ExternalLink :size="11" /></a></small>
        </label>
        <div class="btns">
          <button class="btn soft small" :disabled="busy || !lastfm.trim()"><Check :size="14" />Lagre Last.fm</button>
          <button v-if="s.keys.lastfm" type="button" class="btn soft small" :disabled="busy" @click="post({ lastfm_key: '' }, 'Last.fm-nøkkelen er fjernet.')">Fjern</button>
        </div>
      </form>
    </section>

    <section v-if="!s.user.owner">
      <h3>Passord</h3>
      <form class="keys" @submit.prevent="changePw">
        <label class="field"><span>Gammelt passord</span><input v-model="oldPw" type="password" autocomplete="current-password" required /></label>
        <label class="field"><span>Nytt passord (minst 8 tegn)</span><input v-model="newPw" type="password" autocomplete="new-password" minlength="8" required /></label>
        <button class="btn soft" :disabled="busy">Bytt passord</button>
      </form>
      <p class="muted">Du er logget inn som <b>{{ account.user?.username }}</b> ({{ s.email }}).</p>
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
</style>
