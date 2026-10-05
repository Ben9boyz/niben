import { watch } from 'vue'
import { i18n } from '../composables/useLang'
import { SOURCE, byCode } from './languages'
import { pget, pset } from './pcache'

// Shows the page in the chosen language by translating the TEXT on the screen: every text node and the text
// attributes (placeholder, title, aria-label, alt). The site is written in Norwegian, so Norwegian is the
// source. Translations come from, in this order: memory → what was fetched before (kept in this browser) →
// a file that ships with the site (i18n/<lang>.json, e.g. English) → the translation service on the server
// (which keeps every answer, so each sentence is translated once for everybody). Text that changes later
// (Vue re-renders, new panels, toasts) is picked up by a MutationObserver. Anything inside translate="no"
// (names of songs, albums, games, code …) is left alone.
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt']
// jpdb content (Japanese words, readings, English meanings, anime titles) is tagged lang="ja" / lang="en" and is never translated
const SKIP = 'script, style, code, pre, textarea, svg, canvas, [translate="no"], .notranslate, [contenteditable], [lang="ja"], [lang="en"]'
const mem = new Map() // lang -> Map(template -> translated template)
const textRec = new WeakMap() // text node -> { src, out }
const attrRec = new WeakMap() // element -> { attr: { src, out } }
const queue = new Set() // templates waiting to be translated
let loadedLang = ''
let flushTimer = 0
let scanTimer = 0
let saveTimer = 0
let busy = 0
const dirty = new Set()
const unavailable = new Set() // languages nobody can translate (no service on the server, none in the browser) – stop asking
const viaBrowser = new Map() // lang -> a browser Translator (Chrome's built-in, on-device) when the server has no service

const table = (lang) => { let t = mem.get(lang); if (!t) mem.set(lang, (t = new Map())); return t }

// numbers become {0} {1} … so "3 til repetisjon" and "5 til repetisjon" are one sentence for the translator
function templatize(core) {
  const nums = []
  const tpl = core.replace(/\d+(?:[.,:]\d+)*/g, (m) => { nums.push(m); return `{${nums.length - 1}}` })
  return { tpl, nums }
}
const fill = (tr, nums) => tr.replace(/\{(\d+)\}/g, (m, i) => (nums[+i] !== undefined ? nums[+i] : m))
const JA = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/ // Japanese / Chinese characters: that is what I'm practising, leave it
const translatable = (core) => !JA.test(core) && core.length >= 2 && core.length <= 600 && /\p{L}{2,}/u.test(core) && !/^(https?:\/\/|www\.)\S+$/i.test(core) && !/^\S+@\S+\.\S+$/.test(core)

function lookup(lang, tpl) {
  const v = table(lang).get(tpl)
  if (v === undefined && !unavailable.has(lang)) { queue.add(tpl); scheduleFlush() }
  return v
}

function processText(node, lang) {
  const v = node.nodeValue
  const rec = textRec.get(node)
  const untouched = rec && v === rec.out
  const src = untouched ? rec.src : v
  const par = node.parentElement
  if (lang === SOURCE) {
    if (untouched && v !== src) node.nodeValue = src
    if (untouched) textRec.delete(node)
    return
  }
  if (par && par.closest(SKIP)) return
  const lead = src.match(/^\s*/)[0]
  const trail = src.match(/\s*$/)[0]
  const core = src.trim()
  if (!translatable(core)) return
  const { tpl, nums } = templatize(core)
  const tr = lookup(lang, tpl)
  if (tr === undefined) { if (untouched && v !== src) node.nodeValue = src; return } // not yet: show the original meanwhile
  const out = lead + fill(tr, nums) + trail
  if (node.nodeValue !== out) node.nodeValue = out
  textRec.set(node, { src, out })
}

function processAttrs(el, lang) {
  if (!el.getAttribute) return
  let rec = attrRec.get(el)
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue
    const v = el.getAttribute(a)
    const r = rec?.[a]
    const untouched = r && v === r.out
    const src = untouched ? r.src : v
    if (lang === SOURCE) { if (untouched && v !== src) el.setAttribute(a, src); if (untouched) delete rec[a]; continue }
    if (el.closest(SKIP)) continue
    const core = src.trim()
    if (!translatable(core)) continue
    const { tpl, nums } = templatize(core)
    const tr = lookup(lang, tpl)
    if (tr === undefined) { if (untouched && v !== src) el.setAttribute(a, src); continue }
    const out = fill(tr, nums)
    if (v !== out) el.setAttribute(a, out)
    if (!rec) { rec = {}; attrRec.set(el, rec) }
    rec[a] = { src, out }
  }
}

function scan(root, lang) {
  if (!root) return
  if (root.nodeType === 3) { processText(root, lang); return }
  if (root.nodeType !== 1 && root.nodeType !== 9) return
  const el = root.nodeType === 9 ? root.documentElement : root
  if (el.closest?.(SKIP)) return
  processAttrs(el, lang)
  // elements that must stay as they are (translate="no", code, svg …) are skipped together with everything inside
  const w = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  let n = w.nextNode()
  while (n) {
    if (n.nodeType === 3) processText(n, lang)
    else processAttrs(n, lang)
    n = w.nextNode()
  }
}

function scheduleScan() {
  if (scanTimer) return
  scanTimer = requestAnimationFrame(() => {
    scanTimer = 0
    const lang = i18n.lang
    if (dirty.has(document)) { dirty.clear(); scan(document, lang); return }
    const roots = [...dirty]
    dirty.clear()
    for (const r of roots) if (r.isConnected !== false) scan(r, lang)
  })
}
const rescanAll = () => { dirty.add(document); scheduleScan() }

// ── fetching ──
function scheduleFlush() { if (!flushTimer) flushTimer = setTimeout(flush, 80) }
// Chrome (138+) can translate on the device itself – no key, nothing sent anywhere. Used when the server has no translator.
async function browserTranslator(lang) {
  if (viaBrowser.has(lang)) return viaBrowser.get(lang)
  let tr = null
  try {
    const T = self.Translator
    if (T) {
      for (const src of ['nb', 'no']) {
        try {
          const av = await T.availability({ sourceLanguage: src, targetLanguage: lang })
          if (av && av !== 'unavailable') { tr = await T.create({ sourceLanguage: src, targetLanguage: lang }); break }
        } catch {}
      }
    }
  } catch {}
  viaBrowser.set(lang, tr)
  return tr
}
async function flush() {
  flushTimer = 0
  const lang = i18n.lang
  if (lang === SOURCE || unavailable.has(lang) || !queue.size) return
  const all = [...queue]
  queue.clear()
  for (let i = 0; i < all.length; i += 40) {
    const chunk = all.slice(i, i + 40)
    busy++
    i18n.working = busy > 0
    try {
      const r = await fetch('api.php?action=translate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Niben': '1' }, body: JSON.stringify({ lang, name: byCode[lang]?.en || lang, texts: chunk }) })
      const j = await r.json().catch(() => ({}))
      if (j.error === 'not_configured' || r.status === 503) {
        const tr = await browserTranslator(lang)
        if (tr) {
          const t = table(lang)
          for (const s of chunk) { try { const o = await tr.translate(s); if (o) t.set(s, o) } catch {} }
          persist(lang)
          rescanAll()
          continue
        }
        unavailable.add(lang); i18n.unavailable = [...unavailable]; break
      }
      i18n.error = !r.ok && j.error && j.error !== 'not_configured' ? j.error : ''
      if (Array.isArray(j.texts)) {
        const t = table(lang)
        chunk.forEach((s, k) => { if (typeof j.texts[k] === 'string' && j.texts[k]) t.set(s, j.texts[k]) })
        persist(lang)
        rescanAll()
      }
    } catch { i18n.error = 'Fikk ikke kontakt med oversetteren.' }
    finally { busy--; i18n.working = busy > 0 }
  }
}
function persist(lang) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => pset(`tr:${lang}`, Object.fromEntries(table(lang))), 1500)
}

async function loadLang(lang) {
  if (lang === SOURCE) return
  const t = table(lang)
  if (loadedLang !== lang) {
    loadedLang = lang
    // 1. what this browser has fetched before
    const saved = await pget(`tr:${lang}`, 90 * 86400000)
    if (saved) for (const [k, v] of Object.entries(saved)) t.set(k, v)
    // 2. the file that ships with the site (English, …) – a sentence there beats anything saved before
    try {
      const r = await fetch(`i18n/${lang}.json`, { cache: 'no-cache' })
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) for (const [k, v] of Object.entries(await r.json())) t.set(k, v)
    } catch {}
  }
}

/** Call once after the app is mounted. */
export function startDomTranslate() {
  const obs = new MutationObserver((muts) => {
    if (i18n.lang === SOURCE && !textRec.size) return
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach((n) => dirty.add(n))
      else if (m.type === 'characterData') dirty.add(m.target)
      else if (m.type === 'attributes') dirty.add(m.target)
    }
    scheduleScan()
  })
  obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS })
  const run = async () => { await loadLang(i18n.lang); rescanAll() }
  watch(() => i18n.lang, run, { immediate: true })
  rescanAll()
}
