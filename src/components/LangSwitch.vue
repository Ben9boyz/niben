<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Globe, Check, Search, Loader } from 'lucide-vue-next'
import { LANGS } from '../lib/languages'
import { i18n, setLang } from '../composables/useLang'
import { admin } from '../composables/useAdmin'

// The globe: pick the language of the site. Everything except the language names themselves gets translated.
const q = ref('')
const input = ref(null)
const root = ref(null)
const list = computed(() => {
  const n = q.value.trim().toLowerCase()
  return n ? LANGS.filter((l) => l.name.toLowerCase().includes(n) || l.en.toLowerCase().includes(n) || l.code.toLowerCase() === n) : LANGS
})
const noService = computed(() => i18n.unavailable.includes(i18n.lang))
function pick(code) { setLang(code); i18n.menu = false; q.value = '' }
watch(() => i18n.menu, async (o) => { if (o) { await nextTick(); input.value?.focus({ preventScroll: true }) } })
const onDoc = (e) => { if (i18n.menu && !root.value?.contains(e.target)) i18n.menu = false }
const onKey = (e) => { if (e.key === 'Escape') i18n.menu = false }
onMounted(() => { document.addEventListener('pointerdown', onDoc); window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onDoc); window.removeEventListener('keydown', onKey) })
</script>

<template>
  <span ref="root" class="lang" translate="no">
    <button class="langbtn glass" :class="{ on: i18n.menu }" title="Language · Språk" aria-label="Language" :aria-expanded="i18n.menu" @click="i18n.menu = !i18n.menu">
      <Loader v-if="i18n.working" :size="18" class="spin" aria-hidden="true" /><Globe v-else :size="19" aria-hidden="true" />
      <b>{{ i18n.lang === 'zh-TW' ? 'TW' : i18n.lang.toUpperCase() }}</b>
    </button>
    <transition name="fade">
      <div v-if="i18n.menu" class="menu glass" role="dialog" aria-label="Language">
        <label class="search"><Search :size="14" aria-hidden="true" /><input ref="input" v-model="q" type="search" placeholder="Language · Språk" aria-label="Search languages" @keydown.enter.prevent="list[0] && pick(list[0].code)" /></label>
        <ul>
          <li v-for="l in list" :key="l.code">
            <button :class="{ on: l.code === i18n.lang }" :lang="l.code" @click="pick(l.code)"><span>{{ l.name }}</span><Check v-if="l.code === i18n.lang" :size="15" aria-hidden="true" /></button>
          </li>
          <li v-if="!list.length" class="none">–</li>
        </ul>
        <p v-if="i18n.error && !noService" class="warn" translate="no">{{ i18n.error }}</p>
        <p v-if="noService" class="warn" translate="no">The site can't be translated to this language yet (no translation service is set up). {{ admin.loggedIn ? 'Admin → Oversikt → Språk: kjør ./translate-setup.sh.' : '' }}</p>
      </div>
    </transition>
  </span>
</template>

<style scoped>
.langbtn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: 50px; height: 50px; padding: 0; border: 0; border-radius: 17px; color: var(--text-2); cursor: pointer; flex-direction: column; transition: color 0.15s, transform 0.2s; }
.langbtn b { font-size: 0.56rem; font-weight: 800; letter-spacing: 0.04em; line-height: 1; margin-top: -3px; }
.langbtn:hover, .langbtn.on { color: var(--accent); }
.spin { animation: sp 0.9s linear infinite; }
@keyframes sp { to { transform: rotate(360deg); } }
.menu { position: fixed; z-index: 80; left: 100px; bottom: 16px; width: 270px; max-height: min(72dvh, 560px); display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 20px; background: var(--bg); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3); }
.search { display: flex; align-items: center; gap: 7px; padding: 7px 12px; border: 1px solid var(--glass-border); border-radius: 999px; background: var(--glass-strong); color: var(--text-3); }
.search:focus-within { border-color: var(--accent); color: var(--accent); }
.search input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--text); font: 500 0.88rem var(--font); }
.search input::-webkit-search-cancel-button { display: none; }
ul { list-style: none; margin: 0; padding: 0; overflow-y: auto; overscroll-behavior: contain; }
li button { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px 12px; border: 0; border-radius: 10px; background: transparent; color: var(--text); font: 600 0.9rem var(--font); text-align: left; cursor: pointer; }
li button:hover { background: var(--accent-soft); }
li button.on { color: var(--accent); background: var(--accent-soft); }
.none { padding: 8px 12px; color: var(--text-3); }
.warn { margin: 2px 6px 4px; padding: 8px 10px; border-radius: 10px; background: rgba(240, 160, 64, 0.16); font-size: 0.76rem; color: #8a5410; }
@media (max-width: 720px) {
  .langbtn { width: 40px; height: 40px; border-radius: 14px; box-shadow: none; }
  .langbtn b { display: none; }
  .menu { left: 12px; right: 12px; bottom: auto; top: calc(64px + env(safe-area-inset-top)); width: auto; }
}
</style>
