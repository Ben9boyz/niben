<script setup lang="ts">
import { errorMessage } from '@/composables/site/useAdmin'
import { targetEl } from '@/lib/dom'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { X, Folder, FolderOpen, FileText, FileCode2, Image as ImageIcon, ArrowUpRight, Search, PanelLeft } from 'lucide-vue-next'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import php from 'highlight.js/lib/languages/php'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import markdown from 'highlight.js/lib/languages/markdown'
import yaml from 'highlight.js/lib/languages/yaml'

// Read through one of my GitHub repositories without leaving the site: the file tree on the left,
// the README rendered and code highlighted on the right. The file list comes from the server
// (cached), the files themselves straight from raw.githubusercontent.com.
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('php', php)
hljs.registerLanguage('css', css)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('yaml', yaml)
const LANG: Record<string, string | undefined> = { js: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'javascript', vue: 'xml', html: 'xml', svg: 'xml', php: 'php', css: 'css', json: 'json', sh: 'bash', md: 'markdown', yml: 'yaml', yaml: 'yaml' }
const IMG = /\.(png|jpe?g|gif|webp|svg|ico)$/i
const MAX = 400 * 1024

const props = defineProps<{ repo: string }>()
const emit = defineEmits<{ close: [] }>()

interface RepoFile { path: string; size: number }
interface RepoInfo { owner: string; repo: string; branch: string; url: string; description?: string | null; pushed?: string; truncated?: boolean; files: RepoFile[]; error?: string }
type Content =
  | { state: 'idle' | 'loading' }
  | { state: 'error'; error: string }
  | { state: 'ok'; kind: 'big' }
  | { state: 'ok'; kind: 'image'; src: string }
  | { state: 'ok'; kind: 'md'; html: string }
  | { state: 'ok'; kind: 'code'; html: string; lines: number }
interface TreeNode { name: string; path: string; dirs: Map<string, TreeNode>; files: { name: string; path: string; size: number }[] }
interface Row { kind: 'dir' | 'file'; name: string; path: string; depth: number }

const info = ref<RepoInfo | null>(null)
const error = ref('')
const current = ref<string | null>(null) // path
const content = ref<Content>({ state: 'idle' })
const open = ref(new Set<string>(['']))
const q = ref('')
const showTree = ref(window.matchMedia('(min-width: 821px)').matches)

const raw = (p: string) => `https://raw.githubusercontent.com/${info.value?.owner}/${info.value?.repo}/${info.value?.branch}/${p.split('/').map(encodeURIComponent).join('/')}`
const ghUrl = computed(() => (info.value && current.value ? `${info.value.url}/blob/${info.value.branch}/${current.value}` : info.value?.url))

onMounted(async () => {
  try {
    const r = await fetch(`api.php?action=github_tree&repo=${encodeURIComponent(props.repo)}`)
    const j = (await r.json()) as RepoInfo
    if (j.error) throw new Error(j.error)
    info.value = j
    const readme = j.files.find((f) => /^readme\.md$/i.test(f.path)) || j.files.find((f) => /readme/i.test(f.path))
    if (readme) show(readme.path)
  } catch (e) {
    error.value = errorMessage(e) || 'Fikk ikke hentet repoet.'
  }
})

// ── the tree: folders first, then files, alphabetically ──
const tree = computed(() => {
  const root: TreeNode = { name: '', path: '', dirs: new Map(), files: [] }
  for (const f of info.value?.files || []) {
    const parts = f.path.split('/')
    let node: TreeNode = root
    parts.slice(0, -1).forEach((part, i) => {
      if (!node.dirs.has(part)) node.dirs.set(part, { name: part, path: parts.slice(0, i + 1).join('/'), dirs: new Map(), files: [] })
      node = node.dirs.get(part) ?? node
    })
    node.files.push({ name: parts.at(-1) ?? '', path: f.path, size: f.size })
  }
  return root
})
// flattened rows for rendering (only open folders)
const rows = computed(() => {
  const out: Row[] = []
  const needle = q.value.trim().toLowerCase()
  if (needle) {
    for (const f of info.value?.files || []) if (f.path.toLowerCase().includes(needle)) out.push({ kind: 'file', name: f.path, path: f.path, depth: 0 })
    return out.slice(0, 200)
  }
  const walk = (node: TreeNode, depth: number) => {
    for (const d of [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ kind: 'dir', name: d.name, path: d.path, depth })
      if (open.value.has(d.path)) walk(d, depth + 1)
    }
    for (const f of [...node.files].sort((a, b) => a.name.localeCompare(b.name))) out.push({ kind: 'file', name: f.name, path: f.path, depth })
  }
  walk(tree.value, 0)
  return out
})
function toggle(path: string) {
  const s = new Set(open.value)
  s.has(path) ? s.delete(path) : s.add(path)
  open.value = s
}
const iconFor = (name: string) => (IMG.test(name) ? ImageIcon : /\.(md|txt)$/i.test(name) ? FileText : FileCode2)

// ── one file ──
async function show(path: string) {
  current.value = path
  if (!window.matchMedia('(min-width: 821px)').matches) showTree.value = false
  // open the folders down to it
  const s = new Set(open.value)
  path.split('/').slice(0, -1).forEach((_, i, a) => s.add(a.slice(0, i + 1).join('/')))
  open.value = s
  const f = info.value?.files.find((x) => x.path === path)
  if (IMG.test(path)) { content.value = { state: 'ok', kind: 'image', src: raw(path) }; return }
  if (f && f.size > MAX) { content.value = { state: 'ok', kind: 'big' }; return }
  content.value = { state: 'loading' }
  try {
    const r = await fetch(raw(path))
    if (!r.ok) throw new Error(`GitHub svarte ${r.status}`)
    const text = await r.text()
    if (current.value !== path) return
    if (/\0/.test(text.slice(0, 2000))) { content.value = { state: 'ok', kind: 'big' }; return }
    if (/\.md$/i.test(path)) {
      content.value = { state: 'ok', kind: 'md', html: DOMPurify.sanitize(marked.parse(text, { gfm: true, async: false })) }
    } else {
      const ext = (path.split('.').pop() ?? '').toLowerCase()
      const lang = LANG[ext]
      const html = lang ? hljs.highlight(text, { language: lang }).value : hljs.highlightAuto(text).value
      content.value = { state: 'ok', kind: 'code', html, lines: text.split('\n').length }
    }
    nextTick(() => document.querySelector('.rb-body')?.scrollTo(0, 0))
  } catch (e) {
    content.value = { state: 'error', error: errorMessage(e) }
  }
}
// links inside the README to other files in the repo open here
function onDocClick(e: MouseEvent) {
  const a = targetEl(e).closest<HTMLAnchorElement>('.md a[href]')
  if (!a) return
  const href = a.getAttribute('href') ?? ''
  if (/^(https?:|mailto:|#)/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; return }
  const base = (current.value ?? '').split('/').slice(0, -1)
  const target = [...base, ...href.split('/')].reduce((acc: string[], p) => (p === '..' ? acc.slice(0, -1) : p === '.' || !p ? acc : [...acc, p]), []).join('/')
  if (info.value?.files.some((f) => f.path === target)) { e.preventDefault(); show(target) }
}

const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }
let prevOverflow = ''
onMounted(() => { window.addEventListener('keydown', onKey); prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden' })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); document.documentElement.style.overflow = prevOverflow })
watch(q, () => { if (q.value) showTree.value = true })
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} kB` : `${n} B`)
const fileSize = computed(() => info.value?.files.find((f) => f.path === current.value)?.size || 0)
</script>

<template>
  <teleport to="body">
    <div class="rb" role="dialog" aria-modal="true" :aria-label="`Koden til ${repo}`">
      <header class="rb-head">
        <button class="ic tree-btn" :class="{ on: showTree }" aria-label="Filer" title="Filer" @click="showTree = !showTree"><PanelLeft :size="18" /></button>
        <div class="crumbs">
          <b>{{ info?.owner || 'GitHub' }} / {{ repo }}</b>
          <small v-if="current">{{ current }}<template v-if="fileSize"> · {{ fmtSize(fileSize) }}</template></small>
        </div>
        <a v-if="ghUrl" class="gh" :href="ghUrl" target="_blank" rel="noopener">GitHub <ArrowUpRight :size="14" /></a>
        <button class="ic" aria-label="Lukk (Esc)" @click="emit('close')"><X :size="18" /></button>
      </header>

      <p v-if="error" class="rb-msg">{{ error }}</p>
      <div v-else class="rb-main">
        <aside v-show="showTree" class="rb-tree">
          <label class="find"><Search :size="14" /><input v-model="q" placeholder="Finn fil …" /></label>
          <p v-if="!info" class="muted">Henter filene …</p>
          <button
            v-for="r in rows"
            :key="r.kind + r.path"
            class="node"
            :class="{ dir: r.kind === 'dir', on: r.path === current }"
            :style="{ paddingLeft: `${10 + r.depth * 14}px` }"
            :title="r.path"
            @click="r.kind === 'dir' ? toggle(r.path) : show(r.path)"
          >
            <template v-if="r.kind === 'dir'"><FolderOpen v-if="open.has(r.path)" :size="15" /><Folder v-else :size="15" /></template>
            <component :is="iconFor(r.name)" v-else :size="15" />
            <span>{{ r.name }}</span>
          </button>
          <p v-if="info?.truncated" class="muted">Repoet er stort – ikke alle filene vises.</p>
        </aside>

        <main class="rb-body" @click="onDocClick">
          <p v-if="!current && info" class="muted pad">Velg en fil til venstre.</p>
          <p v-else-if="content.state === 'loading'" class="muted pad">Henter …</p>
          <p v-else-if="content.state === 'error'" class="muted pad">Fikk ikke hentet fila ({{ content.error }}).</p>
          <article v-else-if="content.state === 'ok' && content.kind === 'md'" class="md" v-html="content.html"></article>
          <div v-else-if="content.state === 'ok' && content.kind === 'code'" class="code">
            <div class="gutter" aria-hidden="true"><span v-for="n in content.lines" :key="n">{{ n }}</span></div>
            <pre><code class="hljs" v-html="content.html"></code></pre>
          </div>
          <div v-else-if="content.state === 'ok' && content.kind === 'image'" class="img"><img :src="content.src || undefined" :alt="current || undefined" /></div>
          <p v-else-if="content.state === 'ok' && content.kind === 'big'" class="muted pad">Denne fila er for stor eller ikke tekst – <a :href="ghUrl || undefined" target="_blank" rel="noopener">åpne den på GitHub</a>.</p>
        </main>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.rb { position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column; background: var(--bg); color: var(--text); animation: rbIn 0.2s ease; }
@keyframes rbIn { from { opacity: 0; transform: translateY(8px); } }
.rb-head { display: flex; align-items: center; gap: 10px; padding: max(10px, env(safe-area-inset-top)) 14px 10px; border-bottom: 1px solid var(--glass-border); }
.crumbs { flex: 1; min-width: 0; display: grid; }
.crumbs b { font-size: 0.95rem; }
.crumbs small { color: var(--text-3); font: 500 0.78rem ui-monospace, Menlo, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gh { display: inline-flex; align-items: center; gap: 3px; padding: 7px 12px; border-radius: 999px; background: var(--glass-strong); border: 1px solid var(--glass-border); color: var(--text); font: 600 0.82rem var(--font); text-decoration: none; }
.gh:hover { border-color: var(--accent); color: var(--accent); }
.ic { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border: 0; border-radius: 12px; background: var(--glass-strong); color: var(--text-2); cursor: pointer; }
.ic:hover, .ic.on { color: var(--accent); }
.rb-msg { padding: 30px; color: var(--text-3); }
.rb-main { flex: 1; min-height: 0; display: flex; }
.rb-tree { width: 280px; flex: none; overflow-y: auto; padding: 10px 8px 20px; border-right: 1px solid var(--glass-border); }
.find { display: flex; align-items: center; gap: 6px; margin: 0 2px 8px; padding: 7px 10px; border-radius: 10px; background: var(--glass-strong); border: 1px solid var(--glass-border); color: var(--text-3); }
.find input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--text); font: 500 0.85rem var(--font); outline: none; }
.node { display: flex; align-items: center; gap: 7px; width: 100%; padding: 5px 10px; border: 0; border-radius: 8px; background: transparent; color: var(--text-2); font: 500 0.84rem var(--font); text-align: left; cursor: pointer; }
.node span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.node svg { flex: none; color: var(--text-3); }
.node.dir svg { color: var(--accent); }
.node:hover { background: var(--accent-soft); color: var(--text); }
.node.on { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.muted { color: var(--text-3); font-size: 0.85rem; margin: 6px 10px; }
.pad { padding: 20px; }
.rb-body { flex: 1; min-width: 0; overflow: auto; overscroll-behavior: contain; }

/* README */
.md { max-width: 860px; margin: 0 auto; padding: 28px 32px 60px; line-height: 1.65; font-size: 0.98rem; }
.md :deep(h1), .md :deep(h2) { padding-bottom: 6px; border-bottom: 1px solid var(--glass-border); margin: 1.4em 0 0.6em; }
.md :deep(h1) { font-size: 1.9rem; margin-top: 0; }
.md :deep(h2) { font-size: 1.4rem; }
.md :deep(h3) { font-size: 1.12rem; margin: 1.2em 0 0.4em; }
.md :deep(p), .md :deep(ul), .md :deep(ol) { margin: 0.6em 0; }
.md :deep(a) { color: var(--accent); }
.md :deep(code) { font: 0.86em ui-monospace, Menlo, monospace; padding: 2px 6px; border-radius: 6px; background: var(--glass-strong); }
.md :deep(pre) { padding: 14px 16px; border-radius: 12px; background: var(--glass-strong); border: 1px solid var(--glass-border); overflow-x: auto; }
.md :deep(pre code) { padding: 0; background: none; }
.md :deep(img) { max-width: 100%; border-radius: 10px; }
.md :deep(table) { border-collapse: collapse; display: block; overflow-x: auto; }
.md :deep(th), .md :deep(td) { padding: 6px 12px; border: 1px solid var(--glass-border); }
.md :deep(blockquote) { margin: 0.8em 0; padding: 2px 14px; border-left: 3px solid var(--accent); color: var(--text-2); }

/* code */
.code { display: flex; min-width: max-content; font: 0.82rem/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; }
.gutter { display: flex; flex-direction: column; padding: 14px 10px 40px 16px; text-align: right; color: var(--text-3); opacity: 0.6; user-select: none; position: sticky; left: 0; background: var(--bg); }
pre { margin: 0; padding: 14px 24px 40px 12px; }
code { font: inherit; white-space: pre; }
.img { display: grid; place-items: center; padding: 30px; }
.img img { max-width: 100%; max-height: 70vh; border-radius: 10px; background: repeating-conic-gradient(var(--glass-strong) 0 25%, transparent 0 50%) 0 0 / 16px 16px; }

/* syntax colours (light / dark) */
.code :deep(.hljs-keyword), .code :deep(.hljs-selector-tag), .code :deep(.hljs-built_in) { color: #c2185b; }
.code :deep(.hljs-string) { color: #2e7d32; }
.code :deep(.hljs-comment) { color: #8a94a3; font-style: italic; }
.code :deep(.hljs-number), .code :deep(.hljs-literal) { color: #6d4cff; }
.code :deep(.hljs-title), .code :deep(.hljs-title.function_) { color: #1565c0; }
.code :deep(.hljs-attr), .code :deep(.hljs-attribute), .code :deep(.hljs-property) { color: #b26a00; }
.code :deep(.hljs-tag), .code :deep(.hljs-name) { color: #00838f; }
.code :deep(.hljs-variable), .code :deep(.hljs-params) { color: inherit; }
:root[data-theme="dark"] .code :deep(.hljs-keyword), :root[data-theme="dark"] .code :deep(.hljs-selector-tag), :root[data-theme="dark"] .code :deep(.hljs-built_in) { color: #ff7ab2; }
:root[data-theme="dark"] .code :deep(.hljs-string) { color: #a5e07a; }
:root[data-theme="dark"] .code :deep(.hljs-number), :root[data-theme="dark"] .code :deep(.hljs-literal) { color: #b4a4ff; }
:root[data-theme="dark"] .code :deep(.hljs-title), :root[data-theme="dark"] .code :deep(.hljs-title.function_) { color: #7cc4ff; }
:root[data-theme="dark"] .code :deep(.hljs-attr), :root[data-theme="dark"] .code :deep(.hljs-attribute), :root[data-theme="dark"] .code :deep(.hljs-property) { color: #ffc66d; }
:root[data-theme="dark"] .code :deep(.hljs-tag), :root[data-theme="dark"] .code :deep(.hljs-name) { color: #6be0e6; }

/* phones: the file list slides over the content */
@media (max-width: 820px) {
  .rb-tree { position: absolute; z-index: 2; top: 59px; bottom: 0; left: 0; width: min(86vw, 320px); background: var(--bg); box-shadow: 10px 0 30px rgba(0, 0, 0, 0.25); }
  .md { padding: 18px 16px 50px; font-size: 0.95rem; }
  .gh { padding: 7px 10px; }
}
</style>
