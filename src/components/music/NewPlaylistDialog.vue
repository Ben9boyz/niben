<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { ImagePlus, X } from 'lucide-vue-next'
import { plDialog, finishPlaylistDialog } from '@/composables/usePlaylistDialog'
import { createPlaylist } from '@/composables/useSpotify'
import { inputOf } from '@/lib/dom'

// A small sheet for making a playlist: the name, and – if I like – a picture (Spotify takes it as the playlist's cover).
const name = ref('')
const file = ref<File | null>(null)
const preview = ref('')
const busy = ref(false)
const error = ref('')
const nameEl = ref<HTMLInputElement | null>(null)
const fileEl = ref<HTMLInputElement | null>(null)

watch(() => plDialog.open, (open) => {
  if (!open) return
  name.value = ''; error.value = ''; busy.value = false
  clearImage()
  nextTick(() => nameEl.value?.focus())
})
function clearImage() {
  if (preview.value) URL.revokeObjectURL(preview.value)
  file.value = null; preview.value = ''
  if (fileEl.value) fileEl.value.value = ''
}
function pick(e: Event) {
  const f = inputOf(e).files?.[0]
  if (!f) return
  if (!f.type.startsWith('image/')) { error.value = 'Velg et bilde.'; return }
  error.value = ''
  if (preview.value) URL.revokeObjectURL(preview.value)
  file.value = f
  preview.value = URL.createObjectURL(f)
}
async function save() {
  const n = name.value.trim()
  if (!n || busy.value) return
  busy.value = true
  error.value = ''
  const r = await createPlaylist(n, file.value)
  busy.value = false
  if (!r.ok) { error.value = r.error || 'Klarte ikke å lage spillelisten.'; return }
  finishPlaylistDialog({ uri: r.uri, name: n }) // (a picture that failed is reported by the toast; the list itself was made)
}
const cancel = () => finishPlaylistDialog(null)
function onKey(e: KeyboardEvent) { if (plDialog.open && e.key === 'Escape') cancel() }
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <transition name="npd">
    <div v-if="plDialog.open" class="npd" @click.self="cancel">
      <form class="sheet glass" role="dialog" aria-modal="true" aria-label="Ny spilleliste" @submit.prevent="save">
        <header>
          <b>Ny spilleliste</b>
          <button type="button" class="x" aria-label="Lukk" @click="cancel"><X :size="18" /></button>
        </header>
        <div class="body">
          <button type="button" class="pic" :class="{ has: preview }" :aria-label="preview ? 'Bytt bilde' : 'Velg bilde'" @click="fileEl?.click()">
            <img v-if="preview" :src="preview" alt="" />
            <span v-else><ImagePlus :size="26" /><small>Bilde</small></span>
          </button>
          <input ref="fileEl" type="file" accept="image/*" hidden @change="pick" />
          <label class="nm">
            <span>Navn</span>
            <input ref="nameEl" v-model="name" maxlength="100" placeholder="Min nye spilleliste" autocomplete="off" enterkeyhint="done" />
          </label>
        </div>
        <button v-if="preview" type="button" class="rm" @click="clearImage">Fjern bildet</button>
        <p v-if="error" class="err">{{ error }}</p>
        <footer>
          <button type="button" class="btn" @click="cancel">Avbryt</button>
          <button type="submit" class="btn primary" :disabled="!name.trim() || busy">{{ busy ? 'Lager …' : 'Lag spilleliste' }}</button>
        </footer>
      </form>
    </div>
  </transition>
</template>

<style scoped>
.npd { position: fixed; z-index: 90; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(8, 10, 16, 0.45); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.sheet { width: min(420px, 100%); display: grid; gap: 14px; padding: 18px; border-radius: 26px; background: var(--bg); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35); }
header { display: flex; align-items: center; justify-content: space-between; font-size: 1.05rem; }
.x { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; background: var(--glass-strong); color: var(--text-2); cursor: pointer; }
.body { display: flex; gap: 14px; align-items: center; }
.pic { flex: none; display: grid; place-items: center; width: 96px; height: 96px; padding: 0; border: 2px dashed var(--glass-border); border-radius: 14px; background: var(--glass-strong); color: var(--text-3); cursor: pointer; overflow: hidden; }
.pic.has { border-style: solid; border-color: transparent; }
.pic img { width: 100%; height: 100%; object-fit: cover; }
.pic span { display: grid; justify-items: center; gap: 2px; }
.pic small { font-size: 0.7rem; font-weight: 600; }
.nm { flex: 1; min-width: 0; display: grid; gap: 4px; }
.nm span { font-size: 0.72rem; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; }
.nm input { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--glass-strong); color: var(--text); font: 600 1rem var(--font); outline: none; }
.nm input:focus { border-color: var(--accent); }
.rm { justify-self: start; padding: 0; border: 0; background: none; color: var(--text-3); font: 600 0.8rem var(--font); text-decoration: underline; cursor: pointer; }
.err { margin: 0; color: #d24b4b; font-size: 0.82rem; }
footer { display: flex; justify-content: flex-end; gap: 8px; }
footer .btn { padding: 11px 18px; }
footer .btn:disabled { opacity: 0.5; cursor: default; }
.npd-enter-active, .npd-leave-active { transition: opacity 0.2s; }
.npd-enter-active .sheet, .npd-leave-active .sheet { transition: transform 0.3s var(--spring); }
.npd-enter-from, .npd-leave-to { opacity: 0; }
.npd-enter-from .sheet, .npd-leave-to .sheet { transform: translateY(24px) scale(0.97); }
@media (max-width: 720px) { .npd { place-items: end center; padding: 0; } .sheet { width: 100%; border-radius: 26px 26px 0 0; padding-bottom: calc(18px + env(safe-area-inset-bottom)); } }
</style>
