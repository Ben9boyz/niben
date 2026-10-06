<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, type Component } from 'vue'
import { useRoute } from 'vue-router'
import { Gauge, Settings, Globe, Sun, Moon, Radio, Check, Wind, Keyboard, Box, LayoutList, ShieldCheck, ChevronDown, Search, LogIn, UserPlus } from 'lucide-vue-next'
import { LANGS } from '../lib/languages'
import { i18n, setLang } from '../composables/useLang'
import { useTheme, type ThemeChoice } from '../composables/useTheme'
import { calm, setCalm } from '../composables/useCalm'
import { mode as viewMode, toggleMode } from '../composables/useMode'
import { shortcuts } from '../composables/useShortcuts'
import { signedIn, login, userLogin, errorMessage } from '../composables/useAdmin'
import { useData } from '../composables/useData'
import { gfxUi } from '../composables/useGraphics'
import { vinyl, setVinyl, setVinylLevel, setVinylMech, setVinylWow } from '../composables/useVinylNoise'
import { targetEl, inputOf } from '../lib/dom'

// One button for everything about how the site looks: my photo (with the green dot) when I'm logged in, a cog for
// everybody else. It opens a small menu: admin (me only), 3D room / plain version, theme, calm mode, language, shortcuts.
const { mode, setMode, live } = useTheme()
const data = useData()
const route = useRoute()
const photo = computed(() => data.om?.bilde || null)
const open = ref(false)
const langOpen = ref(false)
const q = ref('')
const root = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const pos = ref<Record<string, string>>({})
const touch = window.matchMedia('(hover: none)').matches
// logging in lives here, under the cog: the owner's password alone, or username / e-mail + password for an account
const loginOpen = ref(false)
const lgUser = ref('')
const lgPass = ref('')
const lgErr = ref('')
const lgBusy = ref(false)
async function doLogin() {
  lgErr.value = ''
  lgBusy.value = true
  try {
    if (lgUser.value.trim()) await userLogin(lgUser.value, lgPass.value)
    else { await login(lgPass.value); location.reload() }
  } catch (e) { lgErr.value = errorMessage(e) } finally { lgBusy.value = false }
}

async function toggle() {
  open.value = !open.value
  langOpen.value = false
  if (!open.value) return
  const r = root.value?.getBoundingClientRect()
  if (!r) return
  const phone = innerWidth <= 720
  pos.value = { visibility: 'hidden', left: '0px', top: '0px' }
  await nextTick()
  const h = menuEl.value?.offsetHeight || 300, w = menuEl.value?.offsetWidth || 270
  // desktop: beside the rail, bottom edges lined up · phones: under the button in the corner – always on the screen
  const left = phone ? Math.max(8, Math.min(innerWidth - w - 10, r.right - w)) : Math.min(r.right + 10, innerWidth - w - 8)
  // (24 px spare at the bottom: a window edge or the Dock can hide the last few pixels)
  const top = phone ? Math.min(r.bottom + 8, innerHeight - h - 24) : Math.min(r.bottom - h - 4, innerHeight - h - 24)
  pos.value = { left: `${left}px`, top: `${Math.max(8, top)}px` }
}
const close = () => { open.value = false; langOpen.value = false }
const onDoc = (e: Event) => { if (open.value && !root.value?.contains(targetEl(e)) && !menuEl.value?.contains(targetEl(e))) close() }
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
onMounted(() => { document.addEventListener('pointerdown', onDoc); window.addEventListener('keydown', onKey); window.addEventListener('resize', close) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onDoc); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', close) })
watch(() => route.fullPath, close)

const themes = computed((): [ThemeChoice, string, Component][] => [
  ...(live.configured ? [['live', 'Live', Radio] as [ThemeChoice, string, Component]] : []),
  ['light', 'Lys', Sun],
  ['dark', 'Mørk', Moon],
])
const langs = computed(() => {
  const n = q.value.trim().toLowerCase()
  return n ? LANGS.filter((l) => l.name.toLowerCase().includes(n) || l.en.toLowerCase().includes(n) || l.code.toLowerCase() === n) : LANGS
})
const langName = computed(() => (i18n.lang === 'zh-TW' ? 'TW' : i18n.lang.toUpperCase()))
function pickLang(code: string) { setLang(code); q.value = ''; langOpen.value = false }
const setView = (v: string) => { if (viewMode.value !== v) toggleMode() }
</script>

<template>
  <button ref="root" class="sm glass" :class="{ on: open, me: signedIn }" :title="signedIn ? 'Meg og innstillinger' : 'Innstillinger'" :aria-label="signedIn ? 'Meg og innstillinger' : 'Innstillinger'" :aria-expanded="open" @click="toggle">
    <template v-if="signedIn">
      <img v-if="photo" :src="photo" alt="" crossorigin="anonymous" />
      <Settings v-else :size="19" aria-hidden="true" />
      <i class="dot" aria-hidden="true"></i>
    </template>
    <Settings v-else :size="20" aria-hidden="true" />
  </button>
  <teleport to="body">
    <transition name="fade">
      <div v-if="open" ref="menuEl" class="smenu glass" role="menu" translate="no" :style="pos" @click.stop>
        <router-link v-if="signedIn" to="/admin" class="row" role="menuitem" @click="close"><ShieldCheck :size="16" aria-hidden="true" /><span class="l"><b>Admin</b><small>Styr siden din</small></span></router-link>
        <template v-else>
          <button class="row" role="menuitem" :aria-expanded="loginOpen" @click="loginOpen = !loginOpen"><LogIn :size="16" aria-hidden="true" /><span class="l"><b>Logg inn</b><small>Styr rommet ditt</small></span><ChevronDown :size="14" class="chev" :class="{ up: loginOpen }" aria-hidden="true" /></button>
          <form v-if="loginOpen" class="lgf" @submit.prevent="doLogin">
            <input v-model="lgUser" placeholder="Brukernavn eller e-post (tomt = admin)" autocomplete="username" autocapitalize="none" spellcheck="false" />
            <input v-model="lgPass" type="password" placeholder="Passord" autocomplete="current-password" required />
            <p v-if="lgErr" class="lge" role="alert">{{ lgErr }}</p>
            <button class="go" :disabled="lgBusy || !lgPass">{{ lgBusy ? 'Logger inn …' : 'Logg inn' }}</button>
            <router-link to="/admin" class="reg" @click="close"><UserPlus :size="13" aria-hidden="true" />Ingen konto? Opprett en</router-link>
            <router-link :to="{ path: '/admin', query: { forgot: '1' } }" class="reg" @click="close">Glemt passord?</router-link>
          </form>
        </template>

        <div class="grp">
          <span class="cap">Visning</span>
          <div class="seg" role="group" aria-label="Visning">
            <button :class="{ on: viewMode === 'rom' }" @click="setView('rom')"><Box :size="15" aria-hidden="true" />3D-rom</button>
            <button :class="{ on: viewMode === 'enkel' }" @click="setView('enkel')"><LayoutList :size="15" aria-hidden="true" />Enkel</button>
          </div>
        </div>

        <div class="grp">
          <span class="cap">Tema</span>
          <div class="seg" role="group" aria-label="Tema">
            <button v-for="t in themes" :key="t[0]" :class="{ on: mode === t[0] }" :title="t[0] === 'live' ? 'Lys om dagen, mørkt om natten der jeg bor' : ''" @click="setMode(t[0])"><component :is="t[2]" :size="15" aria-hidden="true" />{{ t[1] }}</button>
          </div>
          <button class="row calm" role="menuitemcheckbox" :aria-checked="calm" @click="setCalm(!calm)">
            <Wind :size="16" aria-hidden="true" /><span class="l"><b>Rolig modus</b><small>Ingen animasjon, glød eller bevegelse</small></span><i class="tg" :class="{ on: calm }" aria-hidden="true"></i>
          </button>
        </div>

        <button class="row" role="menuitem" :aria-expanded="langOpen" @click="langOpen = !langOpen">
          <Globe :size="16" aria-hidden="true" /><span class="l"><b>Språk</b><small>{{ langName }}</small></span><ChevronDown :size="15" class="chev" :class="{ up: langOpen }" aria-hidden="true" />
        </button>
        <div v-if="langOpen" class="langs">
          <label class="search"><Search :size="14" aria-hidden="true" /><input v-model="q" type="search" placeholder="Language · Språk" aria-label="Search languages" @keydown.enter.prevent="langs[0] && pickLang(langs[0].code)" /></label>
          <ul>
            <li v-for="l in langs" :key="l.code"><button :class="{ on: l.code === i18n.lang }" :lang="l.code" @click="pickLang(l.code)"><span>{{ l.name }}</span><Check v-if="l.code === i18n.lang" :size="14" aria-hidden="true" /></button></li>
          </ul>
        </div>

        <div v-if="viewMode === 'rom'" class="grp">
          <span class="cap">Vinyl</span>
          <button class="row" role="menuitemcheckbox" :aria-checked="vinyl.on" @click="setVinyl(!vinyl.on)">
            <span class="l"><b>Knitring</b><small>Støy og knitring under musikken på platespilleren</small></span><i class="tg" :class="{ on: vinyl.on }" aria-hidden="true"></i>
          </button>
          <template v-if="vinyl.on">
            <label class="vrow"><span>Styrke</span><input type="range" min="0" max="100" :value="vinyl.level" aria-label="Styrke på knitringen" @input="setVinylLevel(+inputOf($event).value)" /></label>
            <label class="vrow"><span>Svai</span><input type="range" min="0" max="100" :value="vinyl.wow" aria-label="Svai (små turtallssvingninger)" @input="setVinylWow(+inputOf($event).value)" /></label>
            <button class="row" role="menuitemcheckbox" :aria-checked="vinyl.mech" @click="setVinylMech(!vinyl.mech)">
              <span class="l"><b>Mekaniske lyder</b><small>Nåla som lander og løftes, og skrap når låta byttes</small></span><i class="tg" :class="{ on: vinyl.mech }" aria-hidden="true"></i>
            </button>
          </template>
        </div>

        <button v-if="viewMode === 'rom'" class="row" role="menuitem" @click="close(); gfxUi.open = true"><Gauge :size="16" aria-hidden="true" /><span class="l"><b>Grafikk</b></span></button>

        <button v-if="!touch" class="row" role="menuitem" @click="close(); shortcuts.open = true"><Keyboard :size="16" aria-hidden="true" /><span class="l"><b>Hurtigtaster</b></span></button>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.sm { position: relative; display: grid; place-items: center; width: 50px; height: 50px; padding: 0; border: 0; border-radius: 50%; color: var(--text-2); cursor: pointer; transition: transform 0.4s var(--spring), color 0.2s; }
.sm:hover, .sm.on { color: var(--accent); transform: scale(1.06); }
.sm img { position: absolute; inset: 3px; width: calc(100% - 6px); height: calc(100% - 6px); border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 2px var(--accent); }
.dot { position: absolute; right: 1px; bottom: 1px; width: 11px; height: 11px; border-radius: 50%; background: #1db954; border: 2px solid var(--bg); }
@media (max-width: 720px) { .sm { width: 40px; height: 40px; } }
</style>
<style>
.smenu.smenu { position: fixed; z-index: 90; width: 280px; max-height: calc(100dvh - 40px); overflow-y: auto; overscroll-behavior: contain; padding: 8px; border-radius: 18px; background: var(--bg); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3); display: grid; gap: 4px; }
.smenu .row { display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; padding: 7px 10px; border: 0; border-radius: 11px; background: transparent; color: var(--text); text-align: left; text-decoration: none; cursor: pointer; font-family: var(--font); }
.smenu .chev { margin-left: auto; opacity: 0.6; transition: transform 0.2s; }
.smenu .chev.up { transform: rotate(180deg); }
.smenu .lgf { display: grid; gap: 7px; padding: 4px 10px 10px; }
.smenu .lgf input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--accent-soft); color: var(--text); font: inherit; font-size: 0.86rem; }
.smenu .lgf .go { padding: 8px 10px; border: 0; border-radius: 10px; background: var(--accent); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.smenu .lgf .go:disabled { opacity: 0.55; cursor: default; }
.smenu .lgf .lge { margin: 0; color: #e0705f; font-size: 0.8rem; }
.smenu .lgf .reg { display: inline-flex; align-items: center; gap: 5px; justify-self: start; color: var(--text-3); font-size: 0.78rem; text-decoration: none; }
.smenu .lgf .reg:hover { color: var(--text); }
.smenu .row:hover { background: var(--accent-soft); }
.smenu .row:focus { outline: none; }
.smenu .row:focus-visible, .smenu .seg button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.smenu svg { flex: none; }
.smenu .l { flex: 1; display: grid; min-width: 0; }
.smenu .l b { font-weight: 600; font-size: 0.88rem; }
.smenu .l small { font-size: 0.72rem; color: var(--text-3); line-height: 1.25; }
.smenu .grp { display: grid; gap: 4px; padding: 5px 0 3px; border-top: 1px solid var(--glass-border); }
.smenu .cap { padding: 0 10px; font-size: 0.66rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.smenu .vrow { display: flex; align-items: center; gap: 10px; padding: 3px 10px; font-size: 0.8rem; color: var(--text-2); }
.smenu .vrow span { flex: none; width: 52px; }
.smenu .vrow input { flex: 1; min-width: 0; accent-color: var(--accent); }
.smenu .seg { display: flex; gap: 3px; padding: 3px; margin: 0 4px; border-radius: 12px; background: var(--glass-strong); }
.smenu .seg button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 8px 4px; border: 0; border-radius: 9px; background: transparent; color: var(--text-2); font: 600 0.82rem var(--font); cursor: pointer; }
.smenu .seg button.on { background: var(--bg); color: var(--accent); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14); }
.smenu .tg { position: relative; flex: none; width: 34px; height: 20px; border-radius: 999px; background: var(--glass-border); transition: background 0.2s; }
.smenu .tg::after { content: ''; position: absolute; left: 3px; top: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); transition: transform 0.2s; }
.smenu .tg.on { background: var(--accent); }
.smenu .tg.on::after { transform: translateX(14px); }
.smenu .chev { color: var(--text-3); transition: transform 0.2s; }
.smenu .chev.up { transform: rotate(180deg); }
.smenu .langs { display: grid; gap: 4px; padding: 0 2px 4px; }
.smenu .search { display: flex; align-items: center; gap: 7px; padding: 7px 12px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass-strong); color: var(--text-3); }
.smenu .search:focus-within { border-color: var(--accent); color: var(--accent); }
.smenu .search input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--text); font: 500 0.88rem var(--font); }
.smenu .search input::-webkit-search-cancel-button { display: none; }
.smenu .langs ul { list-style: none; margin: 0; padding: 0; max-height: 200px; overflow-y: auto; overscroll-behavior: contain; }
.smenu .langs li button { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px 12px; border: 0; border-radius: 10px; background: transparent; color: var(--text); font: 600 0.88rem var(--font); text-align: left; cursor: pointer; }
.smenu .langs li button:hover { background: var(--accent-soft); }
.smenu .langs li button.on { color: var(--accent); background: var(--accent-soft); }
</style>
