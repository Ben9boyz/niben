<script setup lang="ts">
import { errorMessage } from '@/composables/site/useAdmin'
import { ref } from 'vue'
import { Mail, Rss, Check } from 'lucide-vue-next'
import { tx } from '@/composables/site/useTexts'

// "Nye opptak på e-post": the address is only used for that; a confirmation link comes first, and every mail has a
// one-click way out. Bots are caught by the hidden "website" field.
const email = ref('')
const website = ref('')
const busy = ref(false)
const done = ref(false)
const error = ref('')
async function send() {
  if (!email.value.trim() || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const r = await fetch('api.php?action=news_subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Niben': '1' }, body: JSON.stringify({ email: email.value.trim(), website: website.value }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'Noe gikk galt – prøv igjen.')
    done.value = true
  } catch (e) { error.value = errorMessage(e) } finally { busy.value = false }
}
</script>

<template>
  <section class="nl glass-in">
    <b class="label-caps"><Mail :size="13" aria-hidden="true" />{{ tx('news.title') }}</b>
    <p class="hint">{{ tx('news.hint') }}</p>
    <p v-if="done" class="ok"><Check :size="15" aria-hidden="true" />{{ tx('news.thanks') }}</p>
    <form v-else @submit.prevent="send">
      <input v-model="email" type="email" required autocomplete="email" :placeholder="tx('news.placeholder')" aria-label="E-postadresse" />
      <input v-model="website" type="text" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <button class="btn primary" :disabled="busy">{{ busy ? 'Sender …' : tx('news.button') }}</button>
    </form>
    <p v-if="error" class="err">{{ error }}</p>
    <a class="feed" href="api.php?action=feed" target="_blank" rel="noopener"><Rss :size="13" aria-hidden="true" />RSS / feed</a>
  </section>
</template>

<style scoped>
.glass-in { display: grid; gap: 8px; padding: 16px; border-radius: 20px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
b { display: inline-flex; align-items: center; gap: 6px; }
.hint { margin: 0; color: var(--text-2); font-size: 0.88rem; line-height: 1.45; }
form { display: flex; gap: 8px; flex-wrap: wrap; }
input[type='email'] { flex: 1 1 200px; min-width: 0; padding: 10px 14px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--bg); color: var(--text); font: 500 0.92rem var(--font); }
input[type='email']:focus { outline: none; border-color: var(--accent); }
.hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.ok { display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 12px; background: rgba(29, 185, 84, 0.14); color: #167a3a; font-size: 0.88rem; }
.err { margin: 0; color: #b23a3a; font-size: 0.84rem; }
.feed { display: inline-flex; align-items: center; gap: 5px; justify-self: start; color: var(--text-3); font-size: 0.76rem; text-decoration: none; }
.feed:hover { color: var(--accent); }
</style>
