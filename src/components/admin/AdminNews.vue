<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Send, Trash2, MailCheck } from 'lucide-vue-next'
import { api, errorMessage } from '@/composables/site/useAdmin'
import { useData } from '@/composables/site/useData'
import type { Flash } from '../../types'

// Newsletter: who is signed up, and a small composer. Pick a recording to fill in the mail, test it on yourself, send.
const data = useData()
interface Subscriber { id: number; email: string; confirmed: number | string; created: number }
interface NewsInfo { confirmed: number; pending: number; list: Subscriber[]; last: { t: number; subject: string; sent: number; failed: number } | null }
const info = ref<NewsInfo>({ confirmed: 0, pending: 0, list: [], last: null })
const subject = ref('')
const body = ref('')
const testTo = ref((() => { try { return localStorage.getItem('niben-news-test') || '' } catch { return '' } })())
const busy = ref('')
const msg = ref<Flash | null>(null)
const recs = computed(() => (data.gitarer || []).flatMap((g) => (g.opptak || []).map((o) => ({ ...o, gitar: g.navn }))).slice(0, 30))
const picked = ref('')
async function load() { try { info.value = await api<NewsInfo>('news_admin') } catch (e) { msg.value = { error: errorMessage(e) } } }
onMounted(load)
function fill() {
  const r = recs.value.find((x) => String(x.id) === String(picked.value))
  if (!r) return
  const site = location.origin + location.pathname.replace(/index\.html$/, '')
  subject.value = `Nytt opptak: ${r.tittel}`
  body.value = `Hei!\n\nJeg har lagt ut et nytt gitaropptak: «${r.tittel}»${r.gitar ? ` (${r.gitar})` : ''}.\n${r.notat ? `\n${r.notat}\n` : ''}\nHør det her: ${site}#/gitar\n\nHilsen Benjamin`
}
async function send(test: boolean) {
  if (!subject.value.trim() || !body.value.trim()) { msg.value = { error: 'Skriv både emne og tekst.' }; return }
  if (test && !testTo.value.trim()) { msg.value = { error: 'Skriv en e-postadresse å sende testen til.' }; return }
  if (!test && !confirm(`Sende til ${info.value.confirmed} abonnenter?`)) return
  busy.value = test ? 'test' : 'all'
  msg.value = null
  try {
    if (test) try { localStorage.setItem('niben-news-test', testTo.value.trim()) } catch {}
    const r = await api<{ sent: number; failed?: number }>('news_send', { subject: subject.value, body: body.value, to: test ? testTo.value.trim() : '' })
    msg.value = { ok: test ? `Testen er sendt til ${testTo.value.trim()}.` : `Sendt til ${r.sent}${r.failed ? ` (${r.failed} feilet)` : ''}.` }
    if (!test) load()
  } catch (e) { msg.value = { error: errorMessage(e) } } finally { busy.value = '' }
}
async function remove(id: number) { if (!confirm('Fjerne denne adressen?')) return; await api('news_remove', { id }); load() }
const date = (t: number) => new Date(t * 1000).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
</script>

<template>
  <div class="an">
    <p class="intro">Folk melder seg på under opptakene (med bekreftelse på e-post). Her skriver og sender du. Epostene sendes fra serveren din med PHP <code>mail()</code> – test alltid på deg selv først, og sjekk søppelposten. Skriv gjerne «sendt fra niben.no»-avsenderen inn i kontaktlista di så den ikke havner der.</p>

    <div class="stats">
      <span><b>{{ info.confirmed }}</b> bekreftet</span>
      <span><b>{{ info.pending }}</b> venter på bekreftelse</span>
      <span v-if="info.last">Sist: «{{ info.last.subject }}» ({{ info.last.sent }} sendt, {{ date(info.last.t) }})</span>
    </div>

    <form class="compose glass-in" @submit.prevent>
      <b class="label-caps"><Send :size="13" aria-hidden="true" />Ny e-post</b>
      <select v-model="picked" aria-label="Fyll inn fra et opptak" @change="fill">
        <option value="">Fyll inn fra et opptak …</option>
        <option v-for="r in recs" :key="r.id" :value="r.id">{{ r.tittel }} ({{ r.gitar }})</option>
      </select>
      <input v-model="subject" type="text" maxlength="150" placeholder="Emne" aria-label="Emne" />
      <textarea v-model="body" rows="9" placeholder="Teksten (lenker blir klikkbare). «Meld deg av» legges til nederst automatisk." aria-label="Tekst"></textarea>
      <div class="row">
        <input v-model="testTo" type="email" placeholder="Din e-post (for test)" aria-label="Testadresse" />
        <button class="btn" :disabled="!!busy" @click="send(true)"><MailCheck :size="14" aria-hidden="true" />{{ busy === 'test' ? 'Sender …' : 'Send test' }}</button>
        <button class="btn primary" :disabled="!!busy || !info.confirmed" @click="send(false)"><Send :size="14" aria-hidden="true" />{{ busy === 'all' ? 'Sender …' : `Send til ${info.confirmed}` }}</button>
      </div>
    </form>
    <p v-if="msg?.ok" class="notice ok">{{ msg.ok }}</p>
    <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>

    <ul v-if="info.list.length" class="list">
      <li v-for="s in info.list" :key="s.id" :class="{ pend: !+s.confirmed }"><span class="em">{{ s.email }}</span><small>{{ +s.confirmed ? 'bekreftet' : 'venter' }} · {{ date(s.created) }}</small><button class="ic" title="Fjern" aria-label="Fjern" @click="remove(s.id)"><Trash2 :size="14" /></button></li>
    </ul>
    <p v-else class="muted">Ingen påmeldte ennå.</p>
  </div>
</template>

<style scoped>
.an { display: grid; gap: 14px; }
.intro, .muted { margin: 0; color: var(--text-3); font-size: 0.84rem; line-height: 1.45; }
.stats { display: flex; gap: 8px 18px; flex-wrap: wrap; font-size: 0.86rem; color: var(--text-2); }
.stats b { color: var(--accent); }
.glass-in { display: grid; gap: 8px; padding: 14px; border-radius: 18px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
b.label-caps { display: inline-flex; align-items: center; gap: 6px; }
input[type='text'], input[type='email'], select, textarea { width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1px solid var(--glass-border); border-radius: 11px; background: var(--bg); color: var(--text); font: 500 0.92rem var(--font); }
textarea { resize: vertical; line-height: 1.45; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
.row input { flex: 1 1 180px; width: auto; }
.btn { display: inline-flex; align-items: center; gap: 6px; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.list li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 10px; background: var(--glass-strong); }
.list li.pend { opacity: 0.6; }
.em { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
small { color: var(--text-3); }
.ic { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--text-2); cursor: pointer; }
.ic:hover { background: rgba(210, 75, 75, 0.16); color: #d24b4b; }
</style>
