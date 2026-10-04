<script setup>
import { ref, onMounted } from 'vue'
import { admin, checkLogin, login, logout } from '../composables/useAdmin'
import AdminTrips from '../components/admin/AdminTrips.vue'
import AdminBooks from '../components/admin/AdminBooks.vue'
import AdminRecordings from '../components/admin/AdminRecordings.vue'

const tab = ref('reiser')
const password = ref('')
const error = ref('')
const busy = ref(false)

onMounted(checkLogin)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await login(password.value)
    password.value = ''
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="admin glass">
    <header class="head">
      <div>
        <div class="eyebrow">Admin</div>
        <h2>Legg inn innhold</h2>
      </div>
      <button v-if="admin.loggedIn" class="btn small" @click="logout">Logg ut</button>
    </header>

    <div v-if="!admin.checked" class="center muted">Sjekker innlogging …</div>

    <form v-else-if="!admin.loggedIn" class="login" @submit.prevent="submit">
      <label class="field">
        <span>Passord</span>
        <input v-model="password" type="password" autocomplete="current-password" autofocus required />
      </label>
      <p v-if="error" class="notice error">{{ error }}</p>
      <button class="btn primary" :disabled="busy">{{ busy ? 'Logger inn …' : 'Logg inn' }}</button>
    </form>

    <template v-else>
      <nav class="tabs" role="tablist">
        <button v-for="t in [['reiser', 'Reiser'], ['boker', 'Bøker'], ['opptak', 'Gitaropptak']]" :key="t[0]" role="tab" :aria-selected="tab === t[0]" :class="{ on: tab === t[0] }" @click="tab = t[0]">
          {{ t[1] }}
        </button>
      </nav>
      <div class="body">
        <transition name="fade" mode="out-in">
          <AdminTrips v-if="tab === 'reiser'" key="r" />
          <AdminBooks v-else-if="tab === 'boker'" key="b" />
          <AdminRecordings v-else key="o" />
        </transition>
      </div>
    </template>
  </section>
</template>

<style scoped>
.admin {
  display: flex;
  flex-direction: column;
  max-height: 100%;
  min-height: 0;
  border-radius: 30px;
  overflow: hidden;
  animation: focusIn 0.6s var(--spring) both;
}
@keyframes focusIn { from { opacity: 0; transform: scale(0.95) translateY(16px); } }
.head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding: 22px 24px 12px; }
.head h2 { font-size: 1.7rem; font-weight: 800; }
.center { padding: 40px; text-align: center; }
.muted { color: var(--text-3); }
.login { display: grid; gap: 14px; padding: 8px 24px 26px; max-width: 380px; }
.tabs { display: flex; gap: 4px; padding: 0 20px 10px; border-bottom: 1px solid var(--glass-border); }
.tabs button {
  padding: 9px 16px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.tabs button:hover { color: var(--text); }
.tabs button.on { background: var(--accent-soft); color: var(--accent); }
.body { overflow-y: auto; padding: 18px 24px 24px; min-height: 0; overscroll-behavior: contain; }
@media (max-width: 900px) {
  .head { padding: 16px 18px 10px; }
  .body { padding: 14px 16px 18px; }
  .tabs { padding: 0 12px 8px; overflow-x: auto; }
}
</style>
