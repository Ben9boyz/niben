<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, type Component } from 'vue'
import { targetEl } from '@/lib/dom'
import { useRoute, useRouter } from 'vue-router'
import { useData } from '@/composables/site/useData'
import { LayoutDashboard, Plane, BookOpen, Mic, Music, Type, Box, Mail, Eye, EyeOff, LogOut, Lock, Users, Guitar, DoorOpen, MessageCircle, X, UserRound, Plug, KeyRound, Disc3, Star, Palette } from 'lucide-vue-next'
import { admin, account, signedIn, checkLogin, login, userLogin, registerAccount, forgotPassword, resetPassword, logout, errorMessage } from '@/composables/site/useAdmin'
import { setRoom } from '@/composables/room/useRooms'
import AdminOverview from '../components/admin/AdminOverview.vue'
import AdminTexts from '../components/admin/AdminTexts.vue'
import AdminRoom from '../components/admin/AdminRoom.vue'
import AdminHobbies from '../components/admin/AdminHobbies.vue'
import AdminNews from '../components/admin/AdminNews.vue'
import AdminUsers from '../components/admin/AdminUsers.vue'
import AdminGuestbook from '../components/admin/AdminGuestbook.vue'
import AdminProfile from '../components/admin/AdminProfile.vue'
import AdminSettings from '../components/admin/AdminSettings.vue'

interface TabDef { id: string; label: string; icon: Component }
interface GroupDef { id: string; label: string; icon: Component; tabs: TabDef[] }
const TAB = (id: string, label: string, icon: Component): TabDef => ({ id, label, icon })
// The admin is grouped by what you are doing: the stuff you make (Innhold), who you are (Profil), how the room looks
// (Rommet: its menu, hobbies, look and models), what it fetches from (Tilkoblinger) and your account (Konto); the site itself – visitors,
// users, newsletter – is the owner's Oversikt.
const data = useData()
const isOwner = computed(() => admin.loggedIn || !!account.user?.owner)
const GROUPS = computed<GroupDef[]>(() => {
  const music = data.profile.sections.lytte
  const list: GroupDef[] = []
  if (isOwner.value) list.push({ id: 'oversikt', label: 'Oversikt', icon: LayoutDashboard, tabs: [TAB('oversikt', 'Oversikt', LayoutDashboard), TAB('brukere', 'Brukere', Users), TAB('nyhetsbrev', 'Nyhetsbrev', Mail)] })
  list.push({ id: 'hobbyer', label: 'Hobbyer', icon: Star, tabs: [TAB('hobbyer', 'Hobbyer', Star)] })
  list.push({ id: 'profil', label: 'Profil', icon: UserRound, tabs: [TAB('profil', 'Om meg', UserRound), TAB('tekster', 'Tekster', Type), TAB('gjestebok', 'Gjestebok', MessageCircle)] })
  list.push({ id: 'rommet', label: 'Rommet', icon: Box, tabs: [TAB('utseende', 'Utseende', Palette), ...(isOwner.value ? [TAB('rom', 'Egne 3D-modeller', Box)] : [])] })
  list.push({ id: 'tilkoblinger', label: 'Tilkoblinger', icon: Plug, tabs: [TAB('tilkoblinger', 'Tilkoblinger', Plug)] })
  list.push({ id: 'konto', label: 'Konto', icon: KeyRound, tabs: [TAB('konto', 'Konto', KeyRound)] })
  return list
})
const KEY = 'niben-admin-tab'
const OLD: Record<string, string> = { innstillinger: 'hobbyer', rommet: 'utseende', faner: 'hobbyer', reiser: 'hobbyer', boker: 'hobbyer', gitarer: 'hobbyer', figurer: 'hobbyer', opptak: 'hobbyer', sanger: 'hobbyer', musikk: 'hobbyer' } // (tabs that moved)
const saved = (() => { try { const v = localStorage.getItem(KEY); return v ? OLD[v] ?? v : null } catch { return null } })()
const tab = ref(saved ?? 'hobbyer')
/** From the overview's numbers straight to that corner in Hobbyer. */
function gotoTab(id: string) {
  const corner: Record<string, string> = { reiser: 'c:reiser', boker: 'c:boker', opptak: 'c:gitar' }
  if (corner[id]) { try { localStorage.setItem('niben-admin-hobby', corner[id]) } catch { /* private mode */ } }
  tab.value = OLD[id] ?? id
} // remembers where I was
const group = computed(() => GROUPS.value.find((g) => g.tabs.some((t) => t.id === tab.value)) ?? GROUPS.value[0])
const shownTab = computed(() => group.value?.tabs.find((t) => t.id === tab.value)?.id ?? group.value?.tabs[0]?.id ?? 'reiser')
watch(tab, (v) => { try { localStorage.setItem(KEY, v) } catch {} })
const show = ref(false)
const route = useRoute()
const router = useRouter()
const resetToken = computed(() => (typeof route.query.reset === 'string' ? route.query.reset : ''))
const mode = ref<'login' | 'register' | 'forgot' | 'reset'>(resetToken.value ? 'reset' : route.query.forgot ? 'forgot' : 'login')
const username = ref('')
const email = ref('')
const password = ref('')
const website = ref('') // hidden: only robots fill it in
const error = ref('')
const done = ref('')
const busy = ref(false)

onMounted(checkLogin)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    if (mode.value === 'forgot') {
      await forgotPassword(username.value)
      done.value = 'Hvis kontoen finnes, har vi sendt en e-post med en lenke for å velge nytt passord. Sjekk søppelposten også.'
      mode.value = 'login'
    } else if (mode.value === 'reset') {
      await resetPassword(resetToken.value, password.value)
      done.value = 'Passordet er byttet. Du kan logge inn nå.'
      mode.value = 'login'
      await router.replace({ path: route.path, query: {} })
    } else if (mode.value === 'register') {
      await registerAccount(username.value, email.value, password.value, website.value)
      done.value = 'Takk! Kontoen din er opprettet og venter på godkjenning. Du kan logge inn så snart den er godkjent.'
      mode.value = 'login'
    } else if (username.value.trim()) {
      await userLogin(username.value, password.value)
    } else {
      await login(password.value) // (the owner: just the admin password)
    }
    password.value = ''
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
// the way out: back to where you were in the room (the camera has not moved while the admin was open)
function closeAdmin() { if (window.history.state?.back) router.back(); else void router.push('/') }
const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(targetEl(e).tagName)) closeAdmin() }
onMounted(() => window.addEventListener('keydown', onEsc))
onBeforeUnmount(() => window.removeEventListener('keydown', onEsc))
const myRoom = () => { if (account.user) void setRoom(account.user.username) }
</script>

<template>
  <section class="admin glass">
    <header class="head">
      <div>
        <div class="eyebrow">{{ account.user && !account.user.owner ? account.user.username : 'Admin' }}</div>
        <h2>{{ signedIn ? 'Styr rommet ditt' : mode === 'register' ? 'Opprett konto' : mode === 'forgot' ? 'Glemt passord' : mode === 'reset' ? 'Nytt passord' : 'Logg inn' }}</h2>
      </div>
      <div class="head-btns">
        <button v-if="signedIn" class="btn small out" @click="logout"><LogOut :size="14" />Logg ut</button>
        <button class="close" aria-label="Lukk admin – tilbake til rommet" title="Lukk (Esc)" @click="closeAdmin"><X :size="18" aria-hidden="true" /></button>
      </div>
    </header>

    <div v-if="!admin.checked" class="center muted">Sjekker innlogging …</div>

    <form v-else-if="!signedIn" class="login" @submit.prevent="submit">
      <div v-if="mode === 'login' || mode === 'register'" class="modes" role="tablist" aria-label="Konto">
        <button type="button" role="tab" :aria-selected="mode === 'login'" :class="{ on: mode === 'login' }" @click="mode = 'login'; error = ''">Logg inn</button>
        <button type="button" role="tab" :aria-selected="mode === 'register'" :class="{ on: mode === 'register' }" @click="mode = 'register'; error = ''; done = ''">Opprett konto</button>
      </div>
      <p v-if="mode === 'login'" class="muted">Logg inn for å styre rommet ditt: reiser, bøker, gitarer og mer.</p>
      <p v-else-if="mode === 'register'" class="muted">Lag en konto og få et eget rom. Kontoen må godkjennes før du kan logge inn – du får en e-post når den er det.</p>
      <p v-else-if="mode === 'forgot'" class="muted">Skriv brukernavnet eller e-posten din, så sender vi en lenke for å velge et nytt passord.</p>
      <p v-else class="muted">Velg et nytt passord (minst 8 tegn).</p>
      <p v-if="done" class="notice ok">{{ done }}</p>
      <label v-if="mode !== 'reset'" class="field">
        <span>{{ mode === 'register' ? 'Brukernavn' : 'Brukernavn eller e-post' }} <small v-if="mode === 'login'">(la stå tomt hvis du bare har admin-passordet)</small></span>
        <input v-model="username" autocomplete="username" autocapitalize="none" spellcheck="false" :required="mode === 'register' || mode === 'forgot'" maxlength="190" />
      </label>
      <label v-if="mode === 'register'" class="field"><span>E-post</span><input v-model="email" type="email" autocomplete="email" required maxlength="190" /></label>
      <label v-if="mode !== 'forgot'" class="field">
        <span>{{ mode === 'reset' ? 'Nytt passord' : 'Passord' }} <small v-if="mode === 'register' || mode === 'reset'">(minst 8 tegn)</small></span>
        <span class="pw">
          <Lock :size="16" aria-hidden="true" />
          <input v-model="password" :type="show ? 'text' : 'password'" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" :minlength="mode === 'register' || mode === 'reset' ? 8 : undefined" required />
          <button type="button" class="eye" :aria-label="show ? 'Skjul passordet' : 'Vis passordet'" @click="show = !show"><EyeOff v-if="show" :size="16" /><Eye v-else :size="16" /></button>
        </span>
      </label>
      <input v-model="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <p v-if="error" class="notice error">{{ error }}</p>
      <button class="btn primary" :disabled="busy || (mode !== 'forgot' && !password)">{{ busy ? 'Vent litt …' : mode === 'login' ? 'Logg inn' : mode === 'register' ? 'Opprett konto' : mode === 'forgot' ? 'Send lenke' : 'Bytt passord' }}</button>
      <button v-if="mode === 'login'" type="button" class="linkbtn" @click="mode = 'forgot'; error = ''; done = ''">Glemt passord?</button>
      <button v-else-if="mode === 'forgot' || mode === 'reset'" type="button" class="linkbtn" @click="mode = 'login'; error = ''">Tilbake til innlogging</button>
    </form>

    <template v-else>
      <div v-if="!account.mine" class="notice away">
        <span>Du ser et annet rom akkurat nå. Gå til ditt eget for å redigere.</span>
        <button class="btn primary small" @click="myRoom"><DoorOpen :size="14" />Til mitt rom</button>
      </div>
      <template v-else>
        <nav class="tabs groups" role="tablist" aria-label="Admin">
          <button v-for="g in GROUPS" :key="g.id" role="tab" :aria-selected="group?.id === g.id" :class="{ on: group?.id === g.id }" @click="tab = g.tabs[0]?.id ?? tab">
            <component :is="g.icon" :size="16" aria-hidden="true" /><span>{{ g.label }}</span>
          </button>
        </nav>
        <nav v-if="group && group.tabs.length > 1" class="tabs sub" role="tablist" :aria-label="group.label">
          <button v-for="t in group.tabs" :key="t.id" role="tab" :aria-selected="shownTab === t.id" :class="{ on: shownTab === t.id }" @click="tab = t.id">{{ t.label }}</button>
        </nav>
      </template>
      <div v-if="account.mine" class="body">
        <transition name="fade" mode="out-in">
          <AdminOverview v-if="shownTab === 'oversikt'" key="v" @goto="gotoTab" />
          <AdminUsers v-else-if="shownTab === 'brukere'" key="u" />
          <AdminHobbies v-else-if="shownTab === 'hobbyer'" key="hb" />
          <AdminRoom v-else-if="shownTab === 'rom'" key="m" />
          <AdminNews v-else-if="shownTab === 'nyhetsbrev'" key="n" />
          <AdminTexts v-else-if="shownTab === 'tekster'" key="t" />
          <AdminGuestbook v-else-if="shownTab === 'gjestebok'" key="gb" />
          <AdminProfile v-else-if="shownTab === 'profil'" key="p" part="om" />
          <AdminProfile v-else-if="shownTab === 'utseende'" key="ut" part="utseende" />
          <AdminSettings v-else-if="shownTab === 'tilkoblinger'" key="s2" part="tilkoblinger" />
          <AdminSettings v-else-if="shownTab === 'konto'" key="s3" part="konto" />
          <AdminHobbies v-else key="hb2" />
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
.modes { display: flex; gap: 4px; padding: 3px; border-radius: 12px; background: var(--glass-strong); }
.modes button { flex: 1; padding: 9px 6px; border: 0; border-radius: 9px; background: transparent; color: var(--text-2); font-weight: 600; cursor: pointer; }
.modes button.on { background: var(--bg); color: var(--accent); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14); }
.hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.away { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin: 8px 24px 20px; }
.away .btn { display: inline-flex; align-items: center; gap: 6px; }
.head-btns { display: flex; align-items: center; gap: 8px; }
.close { display: grid; place-items: center; width: 38px; height: 38px; padding: 0; border: 0; border-radius: 50%; background: var(--glass); color: var(--text-2); cursor: pointer; }
.close:hover { color: var(--text); background: var(--accent-soft); }
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
.tabs.groups { border-bottom: 0; padding-bottom: 4px; flex-wrap: wrap; } /* (all of them in view: a row that runs off the side hid Konto) */
.tabs.sub { padding-top: 2px; }
.tabs.sub button { padding: 6px 13px; font-size: 0.86rem; background: transparent; border: 1px solid transparent; }
.tabs.sub button.on { border-color: var(--accent); background: transparent; }
.linkbtn { justify-self: start; border: 0; background: transparent; color: var(--text-3); font: inherit; font-size: 0.86rem; cursor: pointer; padding: 0; text-decoration: underline; }
.linkbtn:hover { color: var(--text); }
.tabs button:hover { color: var(--text); }
.tabs button.on { background: var(--accent-soft); color: var(--accent); }
.body { overflow-y: auto; padding: 18px 24px 24px; min-height: 0; overscroll-behavior: contain; }
@media (max-width: 900px) {
  .head { padding: 16px 18px 10px; }
  .body { padding: 14px 16px 18px; }
  .tabs { padding: 0 12px 8px; overflow-x: auto; }
  .tabs.groups { flex-wrap: wrap; overflow: visible; }
  .tabs button { padding: 9px 12px; }
  .tabs button span { font-size: 0.86rem; }
}
</style>
