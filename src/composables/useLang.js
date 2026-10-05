import { reactive, watch } from 'vue'
import { DEFAULT_LANG, byCode, guessLang } from '../lib/languages'

// Which language the site is shown in. English unless a visitor has chosen another; the choice is remembered.
// The first time, the site only SUGGESTS the language that fits where the visitor is (see LangSuggest.vue).
const KEY = 'niben-lang'
const ASKED = 'niben-lang-asked'
function read() { try { const v = localStorage.getItem(KEY); return v && byCode[v] ? v : null } catch { return null } }
export const i18n = reactive({
  lang: read() || DEFAULT_LANG,
  chosen: !!read(), // has the visitor picked one themselves
  suggest: null, // a language code to offer on this first visit, else null
  menu: false,
  working: false, // the translator is fetching something
  unavailable: [], // languages the server could not translate (no translation service set up)
})

export function setLang(code) {
  if (!byCode[code]) return
  i18n.lang = code
  i18n.chosen = true
  i18n.suggest = null
  try { localStorage.setItem(KEY, code); localStorage.setItem(ASKED, '1') } catch {}
}
export function dismissSuggestion() {
  i18n.suggest = null
  try { localStorage.setItem(ASKED, '1') } catch {}
}
// first visit, nothing chosen, never asked: offer the language of the place – but never switch on our own
;(function initialSuggestion() {
  try {
    if (i18n.chosen || localStorage.getItem(ASKED)) return
  } catch { return }
  const g = guessLang()
  if (g && g !== DEFAULT_LANG) i18n.suggest = g
})()

function applyHtml() {
  const l = byCode[i18n.lang]
  document.documentElement.lang = i18n.lang === 'nb' ? 'nb' : i18n.lang
  document.documentElement.dir = l?.rtl ? 'rtl' : 'ltr'
}
applyHtml()
watch(() => i18n.lang, applyHtml)
