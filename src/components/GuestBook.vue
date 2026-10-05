<script setup>
import { ref, onMounted } from 'vue'
import { MessageCircle, Send } from 'lucide-vue-next'

// Guestbook: anyone can leave a greeting; it shows up here only after I have read and approved it.
const items = ref([])
const name = ref('')
const message = ref('')
const website = ref('') // hidden field: only bots fill it in
const state = ref('idle') // idle | sending | sent
const err = ref('')
async function load() { try { items.value = (await (await fetch('api.php?action=guestbook_list', { cache: 'no-store' })).json()).items || [] } catch {} }
onMounted(load)
async function send() {
  err.value = ''; state.value = 'sending'
  try {
    const r = await fetch('api.php?action=guestbook_add', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Niben': '1' }, body: JSON.stringify({ name: name.value, message: message.value, website: website.value }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'Noe gikk galt.')
    state.value = 'sent'; name.value = ''; message.value = ''
  } catch (e) { err.value = e.message; state.value = 'idle' }
}
const when = (t) => new Date(t * 1000).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
</script>

<template>
  <section class="gb">
    <h3><MessageCircle :size="16" aria-hidden="true" />Gjestebok</h3>
    <form v-if="state !== 'sent'" class="form" @submit.prevent="send">
      <input v-model="name" maxlength="60" placeholder="Navnet ditt" aria-label="Navn" required />
      <textarea v-model="message" maxlength="600" rows="3" placeholder="Legg igjen en hilsen …" aria-label="Hilsen" required></textarea>
      <input v-model="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <p v-if="err" class="err">{{ err }}</p>
      <div class="row"><small>Hilsenen vises etter at jeg har lest den.</small><button class="btn primary small" :disabled="state === 'sending' || !name.trim() || !message.trim()"><Send :size="14" />Send</button></div>
    </form>
    <p v-else class="thanks">Takk for hilsenen! Den dukker opp her så snart jeg har lest den.</p>
    <ul v-if="items.length" class="list">
      <li v-for="g in items" :key="g.id"><p translate="no">{{ g.msg }}</p><small><b translate="no">{{ g.name }}</b> · {{ when(g.t) }}</small></li>
    </ul>
    <p v-else class="empty">Ingen hilsener ennå – bli den første.</p>
  </section>
</template>

<style scoped>
.gb { display: grid; gap: 12px; padding: 16px; border-radius: 18px; border: 1px solid var(--glass-border); background: var(--glass-strong); }
h3 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 1rem; color: var(--accent); }
.form { display: grid; gap: 8px; }
.form input:not(.hp), .form textarea { width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--bg); color: var(--text); font: 500 0.92rem var(--font); resize: vertical; }
.hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.row small { color: var(--text-3); }
.row .btn { display: inline-flex; align-items: center; gap: 6px; }
.err { margin: 0; color: #d24b4b; font-size: 0.84rem; }
.thanks { margin: 0; padding: 12px; border-radius: 12px; background: rgba(29, 185, 84, 0.14); color: #17924a; font-weight: 600; }
.list { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.list li { padding: 12px 14px; border-radius: 14px; background: var(--accent-soft); }
.list p { margin: 0 0 4px; white-space: pre-wrap; overflow-wrap: anywhere; }
.list small { color: var(--text-3); }
.empty { margin: 0; color: var(--text-3); font-size: 0.88rem; }
</style>
