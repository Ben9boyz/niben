<script setup lang="ts">
import AdminAvatar from './AdminAvatar.vue'
import ViewSwitch from './ViewSwitch.vue'
import SettingsMenu from './SettingsMenu.vue'
import { ref } from 'vue'
import { LogIn, ArrowUpRight } from 'lucide-vue-next'
import { admin, signedIn, checkLogin, login, errorMessage } from '@/composables/site/useAdmin'
import { leavePlayer } from '@/composables/ui/useShell'

// The music player's own controls, in one small row above the library: to the main site, 3D / 2D, the settings cog and
// logging in (needed to play). No bar across the top – the cards start at the very top.
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
    err.value = errorMessage(e)
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
    <span v-if="signedIn" class="icon glass avatar"><AdminAvatar /></span>
    <div v-else-if="admin.checked" class="login-wrap">
      <button class="icon glass" title="Logg inn" aria-label="Logg inn" @click="showLogin = !showLogin"><LogIn :size="17" /></button>
      <form v-if="showLogin" class="login glass" @submit.prevent="doLogin">
        <b>Logg inn for å styre musikken</b>
        <input v-model="pw" type="password" autocomplete="current-password" placeholder="Passord" autofocus />
        <p v-if="err" class="err">{{ err }}</p>
        <button class="btn primary small" :disabled="busy || !pw">{{ busy ? 'Logger inn …' : 'Logg inn' }}</button>
      </form>
    </div>
    <div class="pbtm">
    <button v-if="!inApp" class="icon glass" title="Til hovedversjonen (niben.no)" aria-label="Til hovedversjonen" @click="toSite"><ArrowUpRight :size="18" /></button>
    <ViewSwitch class="pv" />
    <SettingsMenu />
    </div>
  </header>
</template>

<style scoped>
.ptop { position: fixed; top: 16px; left: max(32px, calc((100vw - 1680px) / 2 + 32px)); z-index: 40; display: flex; align-items: center; gap: 8px; pointer-events: none; }
.ptop > * { pointer-events: auto; }
.icon { width: 44px; height: 44px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; color: var(--text-2); cursor: pointer; }
.icon:hover { color: var(--accent); }
.ptop :deep(.sm), .ptop :deep(.vs) { width: 44px; height: 44px; flex: none; }
.login-wrap { position: relative; }
.login { position: absolute; top: calc(100% + 8px); left: 0; width: 260px; display: grid; gap: 8px; padding: 14px; border-radius: 16px; background: var(--bg); }
.login b { font-size: 0.85rem; }
.login input { padding: 9px 12px; border-radius: 10px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: var(--text); font: 500 0.9rem var(--font); }
.avatar { padding: 0; overflow: visible; }
.err { margin: 0; font-size: 0.78rem; color: #d24b4b; }
/* PC: the user at the top-left; the rest down in the bottom-left corner, like the main version of the app */
.pbtm { position: fixed; left: max(32px, calc((100vw - 1680px) / 2 + 32px)); bottom: 16px; display: flex; flex-direction: column; gap: 8px; pointer-events: auto; }
/* phones: the row sits flat in the top-left corner */
@media (max-width: 820px) { .ptop { top: 10px; left: 10px; } .pbtm { position: static; flex-direction: row; } }
</style>
