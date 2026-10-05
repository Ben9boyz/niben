<script setup>
import { ref, computed, onMounted } from 'vue'
import { Music2, Gamepad2, Languages, Globe2, BookOpen, Plane, Mic, RefreshCw, Unplug, Plug, Trash2, Check, AlertTriangle } from 'lucide-vue-next'
import { api } from '../../composables/useAdmin'
import { spotify, setLockSeconds, refreshSpotify, fmtLock, notify } from '../../composables/useSpotify'
import { byCode } from '../../lib/languages'

// The first admin tab: what is connected and how things are set up, in plain words – with the buttons to fix it.
const emit = defineEmits(['goto'])
const st = ref(null)
const err = ref('')
const busy = ref('')
const msg = ref('')
async function load() {
  try { st.value = await api('admin_status') ; err.value = '' } catch (e) { err.value = e.message }
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
.svc small { flex-basis: 100%; color: var(--text-3); }
.langs { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; max-height: 220px; overflow-y: auto; }
.langs li { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-radius: 8px; }
.langs li:hover { background: var(--accent-soft); }
.langs span { flex: 1; font-size: 0.88rem; }
.langs small { color: var(--text-3); font-variant-numeric: tabular-nums; }
.x { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--text-3); cursor: pointer; }
.x:hover { color: #d24b4b; background: rgba(229, 83, 61, 0.12); }
@media (max-width: 600px) { .cards { grid-template-columns: 1fr 1fr 1fr; gap: 8px; } .stat { padding: 10px; } .stat b { font-size: 1.3rem; } }
</style>
