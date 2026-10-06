<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Download, Users, Gamepad2, Languages, Globe2, BookOpen, Plane, Mic, Trash2 } from 'lucide-vue-next'
import { api, errorMessage } from '../../composables/useAdmin'
import { byCode } from '../../lib/languages'
import { pwa, install, desktopApp } from '../../composables/usePwa'

// The first admin tab: what is connected and how things are set up, in plain words – with the buttons to fix it.
const emit = defineEmits<{ goto: [tab: string] }>()
interface Status {
  counts: { trips: number; books: number; recordings: number; photos: number }
  steam: boolean
  jpdb: boolean
  translate: { configured: boolean; provider?: string; total: number; languages: { lang: string; n: number }[] }
  [key: string]: unknown
}
interface Visits { days: { day: string; u: number; h: number }[]; today: number; week: number; month: number; total: number; returning: number; hits_today: number }
const st = ref<Status | null>(null)
const vis = ref<Visits | null>(null)
const err = ref('')
const busy = ref('')
const msg = ref('')
async function load() {
  try { st.value = await api<Status>('admin_status') ; err.value = '' } catch (e) { err.value = errorMessage(e) }
  try { vis.value = await api<Visits>('admin_visits') } catch {}
}
onMounted(load)
const flash = (t: string) => { msg.value = t; setTimeout(() => { if (msg.value === t) msg.value = '' }, 3500) }

async function clearLang(lang: string) {
  if (!confirm(lang ? `Slette oversettelsene til ${byCode[lang]?.en || lang}? De lages på nytt neste gang noen velger språket.` : 'Slette ALLE oversettelser? De lages på nytt etter hvert.')) return
  busy.value = 'tr'
  try { await api('admin_translate_clear', { lang }); await load(); flash('Slettet.') } catch (e) { err.value = errorMessage(e) }
  busy.value = ''
}
const maxDay = computed(() => Math.max(1, ...(vis.value?.days || []).map((d) => d.u)))
const dayLabel = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
const bf = ref('')
async function loadBf() { try { bf.value = (await api<{ id?: string }>('admin_best_friend')).id || '' } catch {} }
onMounted(loadBf)
async function saveBf() {
  busy.value = 'bf'
  try { const r = await api<{ id: string }>('admin_best_friend', { id: bf.value }); bf.value = r.id; flash('Bestevennen er lagret – vises på Spill-siden om litt.') } catch (e) { err.value = errorMessage(e) }
  busy.value = ''
}
const langName = (c: string) => byCode[c]?.en || c
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
