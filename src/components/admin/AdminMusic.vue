<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RefreshCw, Trash2, Plus, Lock } from 'lucide-vue-next'
import { errorMessage, api } from '../../composables/useAdmin'
import { spotify, setLockSeconds, refreshSpotify, fmtLock } from '../../composables/useSpotify'
import { discover, loadDiscover, addPick, delPick, refreshRecs } from '../../composables/useDiscover'
import type { Flash } from '../../types'

// What the music corner does: how long a record stays on, the picks shown on "Oppdag", and a refresh from Spotify.
// (Connecting Spotify itself is under Tilkoblinger.)
const msg = ref<Flash | null>(null)
const busy = ref('')
const LOCKS = [0, 300, 600, 900, 1800, 3600]
const locked = computed(() => spotify.lockUntil > Date.now() / 1000 + spotify.offset)
async function setLock(s: number) {
  busy.value = 'lock'
  try { await setLockSeconds(s); msg.value = { ok: s ? `Låsen er nå ${fmtLock(s)}.` : 'Låsen er slått av.' } } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = '' }
}
async function refresh() {
  busy.value = 'refresh'
  try { await api('spotify_refresh', {}); await refreshSpotify(); msg.value = { ok: 'Hentet på nytt fra Spotify.' } } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = '' }
}
const url = ref('')
const note = ref('')
async function add() {
  const p = await addPick(url.value.trim(), note.value.trim())
  if (p) { url.value = ''; note.value = ''; msg.value = { ok: `«${p.name}» er lagt til på Oppdag.` } } else msg.value = { error: discover.error }
}
async function recs() {
  await refreshRecs()
  msg.value = discover.error ? { error: discover.error } : { ok: 'Nye forslag er hentet.' }
}
onMounted(() => { void loadDiscover() })
</script>

<template>
  <div class="mu">
    <p v-if="msg?.ok" class="notice ok">{{ msg.ok }}</p>
    <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>
    <p v-if="!spotify.connected" class="notice">Spotify er ikke koblet til ennå – gjør det under <b>Tilkoblinger</b>.</p>

    <section v-if="spotify.connected">
      <h3><Lock :size="16" /> Låsen</h3>
      <p class="muted">Hvor lenge musikken er låst når du setter på et album eller en spilleliste. Da kan ingen (heller ikke du) bytte før tiden er ute{{ locked ? ' – akkurat nå er den låst' : '' }}.</p>
      <div class="chips" role="group" aria-label="Låsens lengde">
        <button v-for="s in LOCKS" :key="s" :class="{ on: spotify.lockSeconds === s }" :disabled="busy === 'lock' || locked" @click="setLock(s)">{{ s ? fmtLock(s) : 'Av' }}</button>
      </div>
      <p v-if="locked" class="muted">Låsen kan endres når den er ferdig.</p>
      <button class="btn soft small" :disabled="busy === 'refresh'" @click="refresh"><RefreshCw :size="14" />Hent album og spillelister fra Spotify på nytt</button>
    </section>

    <section>
      <h3>Oppdag – dine anbefalinger</h3>
      <p class="muted">Lim inn en Spotify-lenke til et album eller en sang og skriv hvorfor. Det vises på Oppdag-siden for alle.</p>
      <form class="f" @submit.prevent="add">
        <input v-model="url" placeholder="https://open.spotify.com/album/…" aria-label="Spotify-lenke" required />
        <input v-model="note" placeholder="Hvorfor? (valgfritt)" aria-label="Notat" maxlength="200" />
        <button class="btn primary small" :disabled="discover.busy === 'add' || !url.trim()"><Plus :size="14" />Legg til</button>
      </form>
      <ul v-if="discover.picks.length" class="picks">
        <li v-for="p in discover.picks" :key="p.uri"><span><b>{{ p.name }}</b><small v-if="p.note">{{ p.note }}</small></span><button class="x" :aria-label="`Fjern ${p.name}`" @click="delPick(p.uri)"><Trash2 :size="14" /></button></li>
      </ul>
      <p v-else class="muted">Ingen anbefalinger ennå.</p>
      <button v-if="discover.hasKey" class="btn soft small" :disabled="discover.busy === 'refresh'" @click="recs"><RefreshCw :size="14" />Hent nye forslag (Last.fm)</button>
      <p v-else class="muted">Vil du ha forslag på album du ikke har? Legg inn en Last.fm-nøkkel under Tilkoblinger.</p>
    </section>
  </div>
</template>

<style scoped>
.mu { display: grid; gap: 26px; }
h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; font-size: 1.05rem; }
.muted { color: var(--text-3); font-size: 0.86rem; margin: 0 0 12px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.chips button { padding: 7px 14px; border: 1px solid var(--glass-border); border-radius: 999px; background: transparent; color: var(--text-2); font-weight: 600; cursor: pointer; }
.chips button.on { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }
.chips button:disabled { opacity: 0.5; cursor: default; }
.f { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto; gap: 6px; max-width: 760px; }
.f input { min-width: 0; }
.picks { list-style: none; margin: 12px 0; padding: 0; display: grid; gap: 4px; max-width: 760px; }
.picks li { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 10px; background: var(--accent-soft); }
.picks li span { flex: 1; min-width: 0; display: grid; }
.picks small { color: var(--text-3); }
.x { border: 0; background: transparent; color: var(--text-3); cursor: pointer; padding: 6px; border-radius: 8px; }
.x:hover { color: #e0705f; }
@media (max-width: 700px) { .f { grid-template-columns: 1fr; } }
</style>
