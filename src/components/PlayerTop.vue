<script setup>
import BrandLogo from './BrandLogo.vue'
import { ref } from 'vue'
import { Sun, Moon, LogIn, ArrowUpRight } from 'lucide-vue-next'
import { useTheme } from '../composables/useTheme'
import { admin, checkLogin, login } from '../composables/useAdmin'
import { leavePlayer } from '../composables/useShell'

// Top bar of the music player: name, light / dark, and logging in (needed to play).
const { theme, toggle } = useTheme()
checkLogin()
const inApp = !!window.nibenApp
const showLogin = ref(false)
const pw = ref('')
const err = ref('')
const busy = ref(false)

async function doLogin() {
  busy.value = true
  err.value = ''
  try {
    await login(pw.value)
    pw.value = ''
    showLogin.value = false
  } catch (e) {
    err.value = e.message
  } finally {
    busy.value = false
  }
}
function toSite() {
  leavePlayer()
  location.hash = '#/'
}
</script>

<template>
  <header class="ptop">
    <div class="brand glass"><BrandLogo mark class="mark" /><b>musikk</b></div>

    <span class="spacer"></span>

    <div v-if="!admin.loggedIn && admin.checked" class="login-wrap">
      <button class="pill glass" @click="showLogin = !showLogin"><LogIn :size="15" />Logg inn</button>
      <form v-if="showLogin" class="login glass" @submit.prevent="doLogin">
        <b>Logg inn for å styre musikken</b>
        <input v-model="pw" type="password" autocomplete="current-password" placeholder="Passord" autofocus />
        <p v-if="err" class="err">{{ err }}</p>
        <button class="btn primary small" :disabled="busy || !pw">{{ busy ? 'Logger inn …' : 'Logg inn' }}</button>
      </form>
    </div>
    <button v-if="!inApp" class="icon glass" title="Til niben.no" aria-label="Til niben.no" @click="toSite"><ArrowUpRight :size="17" /></button>
    <button class="icon glass" :title="theme === 'dark' ? 'Lyst tema' : 'Mørkt tema'" aria-label="Bytt tema" @click="toggle">
      <Sun v-if="theme === 'dark'" :size="17" />
      <Moon v-else :size="17" />
    </button>
  </header>
</template>

<style scoped>
.ptop { position: fixed; top: 16px; left: 16px; right: 16px; z-index: 40; display: flex; align-items: center; gap: 10px; pointer-events: none; }
.ptop > * { pointer-events: auto; }
.brand { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px 0 6px; border-radius: 999px; }
.mark { height: 30px; margin-left: 8px; }
.brand b { font-size: 0.98rem; letter-spacing: -0.01em; }
.seg { display: flex; padding: 4px; border-radius: 999px; }
.seg button { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border: 0; border-radius: 999px; background: transparent; color: var(--text-2); font: 600 0.86rem var(--font); cursor: pointer; transition: background 0.2s, color 0.2s; }
.seg button.on { background: var(--glass-strong); color: var(--accent); box-shadow: inset 0 1px 0 var(--glass-hi); }
.spacer { flex: 1; }
.icon { width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 50%; color: var(--text-2); cursor: pointer; }
.icon:hover { color: var(--accent); }
.pill { display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 16px; border: 0; border-radius: 999px; color: var(--text); font: 600 0.88rem var(--font); cursor: pointer; }
.login-wrap { position: relative; }
.login { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; display: grid; gap: 8px; padding: 14px; border-radius: 16px; background: var(--bg); }
.login b { font-size: 0.85rem; }
.login input { padding: 9px 12px; border-radius: 10px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text); font: 500 0.9rem var(--font); }
.err { margin: 0; font-size: 0.78rem; color: #d24b4b; }
@media (max-width: 600px) { .brand b { display: none; } .brand { padding: 0 6px; } .seg button { padding: 8px 10px; } }
</style>
