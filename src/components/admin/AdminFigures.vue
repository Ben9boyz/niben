<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { Upload, Trash2, ArrowUp, ArrowDown, Check } from 'lucide-vue-next'
import { api, errorMessage } from '@/composables/site/useAdmin'
import { useData, reloadData, type Figure } from '@/composables/site/useData'
import type { Flash } from '../../types'

// Figures on the shelf in the room: each is a .glb with a name and a short description. They stand in the order below
// (twelve places: six on each board) and can be opened in the Figurer tab. In the owner's room the built-in figures stay until
// the first one is added here.
const data = useData()
const list = computed(() => data.figurer || [])
const msg = ref<Flash | null>(null)
const busy = ref('')
const draft = reactive<Record<string, { name: string; desc: string }>>({})
const fresh = reactive({ name: '', desc: '' })
const flash = (ok: string) => { msg.value = { ok } }
const fail = (e: unknown) => { msg.value = { error: errorMessage(e) } }
const edit = (f: Figure) => (draft[f.id] ??= { name: f.name, desc: f.desc })

async function upload(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  busy.value = 'new'
  msg.value = null
  try {
    const fd = new FormData()
    fd.append('file', f)
    fd.append('name', fresh.name)
    fd.append('desc', fresh.desc)
    await api('decor_figure_upload', fd)
    fresh.name = ''; fresh.desc = ''
    await reloadData()
    flash('Figuren står på hylla.')
  } catch (err) { fail(err) } finally { busy.value = '' }
}
async function saveAll(order?: string[]) {
  const ids = order ?? list.value.map((f) => f.id)
  busy.value = 'save'
  msg.value = null
  try {
    await api('decor_figure_save', { items: ids.map((id) => ({ id, name: (draft[id] ?? list.value.find((f) => f.id === id)!).name, desc: (draft[id] ?? list.value.find((f) => f.id === id)!).desc })) })
    for (const k of Object.keys(draft)) delete draft[k]
    await reloadData()
    flash('Lagret.')
  } catch (err) { fail(err) } finally { busy.value = '' }
}
const move = (i: number, d: number) => {
  const ids = list.value.map((f) => f.id)
  const j = i + d
  if (j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
  void saveAll(ids)
}
async function remove(f: Figure) {
  if (!confirm(`Fjerne «${f.name}» fra hylla?`)) return
  busy.value = f.id
  try { await api('decor_figure_delete', { id: f.id }); await reloadData(); flash('Fjernet.') } catch (err) { fail(err) } finally { busy.value = '' }
}
const dirty = computed(() => Object.keys(draft).length > 0)
</script>

<template>
  <div class="af">
    <p class="muted">Legg figurene dine på hylla i rommet. Hver figur er en 3D-modell (.glb, maks 14 MB, én fil med alt i) med et navn og en kort beskrivelse. Besøkende kan klikke på en figur og se den nærmere under «Figurer». Det er plass til 12.</p>
    <p v-if="msg?.ok" class="notice ok">{{ msg.ok }}</p>
    <p v-if="msg?.error" class="notice error">{{ msg.error }}</p>

    <form class="add" @submit.prevent>
      <label class="field"><span>Navn</span><input v-model="fresh.name" maxlength="60" placeholder="F.eks. Grogu" /></label>
      <label class="field"><span>Kort beskrivelse</span><textarea v-model="fresh.desc" rows="2" maxlength="1500" placeholder="Hvor den er fra, hvorfor du har den …"></textarea></label>
      <label class="btn primary small up" :class="{ busy: busy === 'new' || list.length >= 12 }"><Upload :size="15" />{{ busy === 'new' ? 'Laster opp …' : 'Velg modell og legg på hylla' }}<input type="file" accept=".glb,model/gltf-binary" hidden :disabled="busy === 'new' || list.length >= 12" @change="upload" /></label>
    </form>

    <div v-if="list.length" class="items">
      <div v-for="(f, i) in list" :key="f.id" class="item">
        <span class="n">{{ i + 1 }}</span>
        <div class="fields">
          <input :value="(draft[f.id] ?? f).name" maxlength="60" :aria-label="`Navn på figur ${i + 1}`" @input="edit(f).name = ($event.target as HTMLInputElement).value" />
          <textarea :value="(draft[f.id] ?? f).desc" rows="2" maxlength="1500" placeholder="Beskrivelse" :aria-label="`Beskrivelse av ${f.name}`" @input="edit(f).desc = ($event.target as HTMLTextAreaElement).value"></textarea>
        </div>
        <div class="btns">
          <button type="button" class="x" :disabled="i === 0 || !!busy" :aria-label="`Flytt ${f.name} opp`" @click="move(i, -1)"><ArrowUp :size="15" /></button>
          <button type="button" class="x" :disabled="i === list.length - 1 || !!busy" :aria-label="`Flytt ${f.name} ned`" @click="move(i, 1)"><ArrowDown :size="15" /></button>
          <button type="button" class="x del" :disabled="!!busy" :aria-label="`Fjern ${f.name}`" @click="remove(f)"><Trash2 :size="15" /></button>
        </div>
      </div>
      <button class="btn primary small save" :disabled="!dirty || busy === 'save'" @click="saveAll()"><Check :size="15" />Lagre navn og beskrivelser</button>
    </div>
    <p v-else class="muted">Ingen egne figurer ennå{{ data.profile.owner ? ' – hylla viser de innebygde figurene til du legger til den første.' : '.' }}</p>
  </div>
</template>

<style scoped>
.af { display: grid; gap: 14px; max-width: 640px; }
.muted { color: var(--text-3); font-size: 0.88rem; margin: 0; }
.add { display: grid; gap: 10px; }
textarea, input { width: 100%; box-sizing: border-box; }
.up { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; justify-self: start; }
.up.busy { opacity: 0.55; pointer-events: none; }
.items { display: grid; gap: 8px; }
.item { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 10px; align-items: start; padding: 10px; border-radius: 14px; background: var(--accent-soft); }
.n { font-weight: 700; color: var(--text-3); padding-top: 8px; text-align: center; }
.fields { display: grid; gap: 6px; }
.btns { display: grid; gap: 4px; }
.x { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 8px; background: var(--glass); color: var(--text-2); cursor: pointer; }
.x:disabled { opacity: 0.35; cursor: default; }
.x.del:hover:not(:disabled) { color: #e0705f; }
.save { justify-self: start; display: inline-flex; align-items: center; gap: 6px; }
</style>
