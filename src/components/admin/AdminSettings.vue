<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Check, KeyRound, ExternalLink } from 'lucide-vue-next'
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
  keys: { jpdb: boolean; steam_id: string | null; steam_key: boolean }
}
const SECTIONS: { id: SectionId; label: string; hint: string }[] = [
  { id: 'reiser', label: 'Reiser', hint: 'Globusen og reisene dine' },
  { id: 'boker', label: 'Bøker', hint: 'Bokhylla' },
  { id: 'gitar', label: 'Gitarer', hint: 'Gitarene og opptakene dine' },
  { id: 'ovelse', label: 'Gitar-øving', hint: 'Timer, akkorder, stemmer og metronom' },
  { id: 'japansk', label: 'Japansk', hint: 'Krever en jpdb-nøkkel (under)' },
  { id: 'gaming', label: 'Spill', hint: 'Steam-profilen din – krever Steam-ID' },
  { id: 'lytte', label: 'Lytteplassen', hint: 'Spotify per bruker kommer senere' },
  { id: 'kode', label: 'Prosjekter', hint: 'Bare i hovedrommet' },
  { id: 'om', label: 'Om meg', hint: 'Teksten og bildet ditt' },
]
const s = ref<Settings | null>(null)
const msg = ref<Flash | null>(null)
const busy = ref(false)
const jpdbKey = ref('')
const steamId = ref('')
const steamKey = ref('')
const oldPw = ref('')
const newPw = ref('')

async function load() {
  try {
    s.value = await api<Settings>('me_settings')
    steamId.value = s.value.keys.steam_id && s.value.keys.steam_id !== 'fra oppsettet' ? s.value.keys.steam_id : ''
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
.field small a { color: var(--accent); display: inline-flex; align-items: center; gap: 2px; }
</style>
