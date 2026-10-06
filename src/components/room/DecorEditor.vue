<script setup lang="ts">
import { computed } from 'vue'
import { RotateCcw, RotateCw, Minus, Plus, ArrowUp, ArrowDown, Eye, EyeOff, Trash2, Check, Upload, Move } from 'lucide-vue-next'
import { decor, uploadDecor, removeDecor, changed } from '@/composables/room/useDecor'
import { room } from '@/composables/room/useRoom'
import { admin } from '@/composables/site/useAdmin'
import { pickedFile } from '@/lib/dom'
import type { DecorItem } from '@/composables/room/useDecor'

// "Rediger rommet": drag a model on the floor to move it. The buttons turn it, resize it, lift it, hide it or delete it.
const sel = computed(() => decor.items.find((i) => i.id === decor.selected) || null)
const adj = (patch: Partial<DecorItem>) => { if (decor.selected) room.api?.adjustDecor(decor.selected, patch) }
const pick = (id: string | null) => room.api?.selectDecor(id)
async function onFile(e: Event) {
  const f = pickedFile(e)
  if (!f) return
  const it = await uploadDecor(f, f.name.replace(/\.glb$/i, ''))
  if (it) setTimeout(() => room.api?.selectDecor(it.id), 400)
}
async function del() { if (sel.value && confirm(`Slette «${sel.value.name}» for godt?`)) await removeDecor(sel.value.id) }
function done() { decor.editing = false }
</script>

<template>
  <transition name="fade">
    <div v-if="decor.editing && admin.loggedIn" class="de glass" role="toolbar" aria-label="Rediger rommet" translate="no">
      <div class="top">
        <b><Move :size="15" aria-hidden="true" />Rediger rommet</b>
        <span class="st">{{ decor.saved ? 'Lagret' : 'Lagrer …' }}</span>
        <label class="btn small"><Upload :size="14" aria-hidden="true" />{{ decor.busy === 'upload' ? 'Laster opp …' : 'Legg til modell' }}<input type="file" accept=".glb,model/gltf-binary" hidden @change="onFile" /></label>
        <button class="btn primary small" @click="done"><Check :size="14" aria-hidden="true" />Ferdig</button>
      </div>
      <p v-if="decor.error" class="err">{{ decor.error }}</p>
      <div v-if="decor.items.length" class="chips pills">
        <button v-for="i in decor.items" :key="i.id" :class="{ on: i.id === decor.selected, off: i.visible === false }" @click="pick(i.id)">{{ i.name || 'Modell' }}</button>
      </div>
      <p v-else class="hint">Ingen modeller ennå. Legg til en .glb-fil, så dukker den opp midt i rommet.</p>
      <div v-if="sel" class="tools">
        <button title="Drei mot venstre" aria-label="Drei mot venstre" @click="adj({ rot: (sel.rot || 0) - Math.PI / 12 })"><RotateCcw :size="17" /></button>
        <button title="Drei mot høyre" aria-label="Drei mot høyre" @click="adj({ rot: (sel.rot || 0) + Math.PI / 12 })"><RotateCw :size="17" /></button>
        <button title="Mindre" aria-label="Mindre" @click="adj({ scale: (sel.scale || 1) / 1.12 })"><Minus :size="17" /></button>
        <button title="Større" aria-label="Større" @click="adj({ scale: (sel.scale || 1) * 1.12 })"><Plus :size="17" /></button>
        <button title="Løft opp (på en hylle eller et bord)" aria-label="Løft opp" @click="adj({ y: (sel.y || 0) + 0.05 })"><ArrowUp :size="17" /></button>
        <button title="Ned" aria-label="Ned" @click="adj({ y: (sel.y || 0) - 0.05 })"><ArrowDown :size="17" /></button>
        <button :title="sel.visible === false ? 'Vis' : 'Skjul for besøkende'" :aria-label="sel.visible === false ? 'Vis' : 'Skjul'" @click="adj({ visible: sel.visible === false })"><EyeOff v-if="sel.visible !== false" :size="17" /><Eye v-else :size="17" /></button>
        <button class="danger" title="Slett" aria-label="Slett" @click="del"><Trash2 :size="17" /></button>
      </div>
      <p class="hint">Dra en modell for å flytte den. Scrollhjul = drei · Shift + scroll = størrelse. Trykk på gulvet for å velge bort.</p>
    </div>
  </transition>
</template>

<style scoped>
.de.de { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 70; width: min(640px, calc(100vw - 24px)); display: grid; gap: 8px; padding: 12px 14px; border-radius: 20px; background: var(--bg); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35); }
.top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.top b { display: inline-flex; align-items: center; gap: 6px; flex: 1; font-size: 0.95rem; }
.st { font-size: 0.74rem; color: var(--text-3); }
.btn { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; max-height: 74px; overflow-y: auto; }
.chips button.off { opacity: 0.55; text-decoration: line-through; }
.tools { display: flex; gap: 6px; flex-wrap: wrap; }
.tools button { display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 12px; background: var(--glass-strong); color: var(--text-2); cursor: pointer; }
.tools button:hover { background: var(--accent-soft); color: var(--accent); }
.tools .danger:hover { background: rgba(210, 75, 75, 0.16); color: #d24b4b; }
.hint { margin: 0; font-size: 0.76rem; color: var(--text-3); line-height: 1.4; }
.err { margin: 0; padding: 7px 10px; border-radius: 10px; background: rgba(210, 75, 75, 0.14); color: #b23a3a; font-size: 0.82rem; }
</style>
