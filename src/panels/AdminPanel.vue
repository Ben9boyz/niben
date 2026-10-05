<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { LayoutDashboard, Plane, BookOpen, Mic, Music, Type, Box, Mail, Eye, EyeOff, LogOut, Lock } from 'lucide-vue-next'
import { admin, checkLogin, login, logout, errorMessage } from '../composables/useAdmin'
import AdminTrips from '../components/admin/AdminTrips.vue'
import AdminBooks from '../components/admin/AdminBooks.vue'
import AdminRecordings from '../components/admin/AdminRecordings.vue'
import AdminSongs from '../components/admin/AdminSongs.vue'
import AdminOverview from '../components/admin/AdminOverview.vue'
import AdminTexts from '../components/admin/AdminTexts.vue'
import AdminRoom from '../components/admin/AdminRoom.vue'
import AdminNews from '../components/admin/AdminNews.vue'

const TABS = [
  { id: 'oversikt', label: 'Oversikt', icon: LayoutDashboard },
  { id: 'reiser', label: 'Reiser', icon: Plane },
  { id: 'boker', label: 'Bøker', icon: BookOpen },
  { id: 'opptak', label: 'Gitaropptak', icon: Mic },
  { id: 'sanger', label: 'Sanger', icon: Music },
  { id: 'rom', label: 'Rom', icon: Box },
  { id: 'nyhetsbrev', label: 'Nyhetsbrev', icon: Mail },
  { id: 'tekster', label: 'Tekster', icon: Type },
]
const KEY = 'niben-admin-tab'
const saved = (() => { try { return localStorage.getItem(KEY) } catch { return null } })()
const tab = ref(TABS.find((t) => t.id === saved)?.id ?? 'oversikt') // remembers where I was
watch(tab, (v) => { try { localStorage.setItem(KEY, v) } catch {} })
const show = ref(false)
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
    error.value = errorMessage(e)
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
        <h2>{{ admin.loggedIn ? 'Styr siden din' : 'Logg inn' }}</h2>
      </div>
      <button v-if="admin.loggedIn" class="btn small out" @click="logout"><LogOut :size="14" />Logg ut</button>
    </header>

    <div v-if="!admin.checked" class="center muted">Sjekker innlogging …</div>

    <form v-else-if="!admin.loggedIn" class="login" @submit.prevent="submit">
      <p class="muted">Bare du ser dette. Logg inn for å legge inn innhold og styre musikken.</p>
      <label class="field">
        <span>Passord</span>
        <span class="pw">
          <Lock :size="16" aria-hidden="true" />
          <input v-model="password" :type="show ? 'text' : 'password'" autocomplete="current-password" autofocus required />
          <button type="button" class="eye" :aria-label="show ? 'Skjul passordet' : 'Vis passordet'" @click="show = !show"><EyeOff v-if="show" :size="16" /><Eye v-else :size="16" /></button>
        </span>
      </label>
      <p v-if="error" class="notice error">{{ error }}</p>
      <button class="btn primary" :disabled="busy || !password">{{ busy ? 'Logger inn …' : 'Logg inn' }}</button>
    </form>

    <template v-else>
      <nav class="tabs" role="tablist" aria-label="Admin">
        <button v-for="t in TABS" :key="t.id" role="tab" :aria-selected="tab === t.id" :class="{ on: tab === t.id }" @click="tab = t.id">
          <component :is="t.icon" :size="16" aria-hidden="true" /><span>{{ t.label }}</span>
        </button>
      </nav>
      <div class="body">
        <transition name="fade" mode="out-in">
          <AdminOverview v-if="tab === 'oversikt'" key="v" @goto="tab = $event" />
          <AdminTrips v-else-if="tab === 'reiser'" key="r" />
          <AdminBooks v-else-if="tab === 'boker'" key="b" />
          <AdminSongs v-else-if="tab === 'sanger'" key="s" />
          <AdminRoom v-else-if="tab === 'rom'" key="m" />
          <AdminNews v-else-if="tab === 'nyhetsbrev'" key="n" />
          <AdminTexts v-else-if="tab === 'tekster'" key="t" />
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
.login { display: grid; gap: 14px; padding: 8px 24px 26px; max-width: 420px; }
.out { display: inline-flex; align-items: center; gap: 6px; }
.pw { display: flex; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--glass-strong); color: var(--text-3); }
.pw:focus-within { border-color: var(--accent); }
.pw input { flex: 1; min-width: 0; padding: 12px 0; border: 0; outline: none; background: transparent; color: var(--text); font-size: 1rem; }
.eye { display: grid; place-items: center; border: 0; background: transparent; color: var(--text-3); cursor: pointer; padding: 4px; }
.tabs { display: flex; gap: 4px; padding: 0 20px 10px; border-bottom: 1px solid var(--glass-border); }
.tabs button {
  display: inline-flex; align-items: center; gap: 7px; flex: none;
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
  .tabs button { padding: 9px 12px; }
  .tabs button span { font-size: 0.86rem; }
}
</style>
