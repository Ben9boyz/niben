<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Upload, Trash2, Eye, EyeOff, Move, Box } from 'lucide-vue-next'
import { decor, loadDecor, uploadDecor, removeDecor, changed, type DecorItem } from '@/composables/room/useDecor'
import { mode } from '@/composables/ui/useMode'
import { useRouter } from 'vue-router'
import { inputOf } from '../../lib/dom'

// My own 3D models: upload a .glb here, then "Rediger rommet" to put it where it belongs.
onMounted(loadDecor)
const router = useRouter()
const name = ref('')
const file = ref<File | null>(null)
async function add() {
  if (!file.value) return
  const it = await uploadDecor(file.value, name.value)
  if (it) { file.value = null; name.value = ''; const i = document.getElementById('decor-file'); if (i instanceof HTMLInputElement) i.value = '' }
}
const toggle = (it: DecorItem) => { it.visible = it.visible === false; changed() }
const rename = () => changed()
const askRemove = (it: DecorItem) => { if (confirm(`Slette «${it.name}»?`)) void removeDecor(it.id) }
const pickFile = (e: Event) => { file.value = inputOf(e).files?.[0] ?? null }
function edit() { decor.editing = true; if (mode.value !== 'rom') router.push('/') }
</script>

<template>
  <div class="ar">
    <p class="intro">Last opp 3D-modeller (.glb) og sett dem hvor du vil i rommet. Modellen skaleres automatisk til ca. 50 cm, og du kan gjøre den større eller mindre. Hold filene under 14 MB – <b>ett GLB med alt i</b> (teksturer inkludert) er best. Gratis modeller finnes bl.a. på Sketchfab og poly.pizza.</p>

    <form class="up glass-in" @submit.prevent="add">
      <b class="label-caps"><Upload :size="13" aria-hidden="true" />Ny modell</b>
      <input id="decor-file" type="file" accept=".glb,model/gltf-binary" aria-label="GLB-fil" @change="pickFile" />
      <input v-model="name" type="text" maxlength="50" placeholder="Navn (valgfritt)" aria-label="Navn" />
      <div class="btns"><button class="btn primary" :disabled="!file || decor.busy === 'upload'">{{ decor.busy === 'upload' ? 'Laster opp …' : 'Last opp' }}</button></div>
    </form>
    <p v-if="decor.error" class="notice error">{{ decor.error }}</p>

    <div class="bar">
      <button class="btn primary" :disabled="mode !== 'rom' && false" @click="edit"><Move :size="15" aria-hidden="true" />Rediger rommet</button>
      <small v-if="mode !== 'rom'">Du er i enkel versjon – knappen tar deg til 3D-rommet.</small>
    </div>

    <ul v-if="decor.items.length" class="list">
      <li v-for="it in decor.items" :key="it.id" :class="{ off: it.visible === false }">
        <Box :size="17" aria-hidden="true" />
        <input v-model="it.name" type="text" maxlength="50" aria-label="Navn" @change="rename" />
        <button class="ic" :title="it.visible === false ? 'Vis' : 'Skjul'" :aria-label="it.visible === false ? 'Vis' : 'Skjul'" @click="toggle(it)"><EyeOff v-if="it.visible !== false" :size="16" /><Eye v-else :size="16" /></button>
        <button class="ic danger" title="Slett" aria-label="Slett" @click="askRemove(it)"><Trash2 :size="16" /></button>
      </li>
    </ul>
    <p v-else-if="decor.loaded" class="muted">Ingen modeller ennå.</p>
  </div>
</template>

<style scoped>
.ar { display: grid; gap: 14px; }
.intro, .muted { margin: 0; color: var(--text-3); font-size: 0.86rem; line-height: 1.45; }
.glass-in { display: grid; gap: 8px; padding: 14px; border-radius: 18px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.up b { display: inline-flex; align-items: center; gap: 6px; }
input[type='text'] { width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1px solid var(--glass-border); border-radius: 11px; background: var(--bg); color: var(--text); font: 500 0.92rem var(--font); }
.btn { display: inline-flex; align-items: center; gap: 6px; }
.bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.bar small { color: var(--text-3); }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.list li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 12px; background: var(--glass-strong); }
.list li.off { opacity: 0.6; }
.ic { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--text-2); cursor: pointer; }
.ic:hover { background: var(--accent-soft); color: var(--accent); }
.ic.danger:hover { background: rgba(210, 75, 75, 0.16); color: #d24b4b; }
</style>
