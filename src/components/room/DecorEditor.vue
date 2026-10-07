<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RotateCcw, RotateCw, Minus, Plus, ArrowUp, ArrowDown, Eye, EyeOff, Trash2, Check, Upload, Move, Magnet, MoveVertical, Undo2, ListRestart } from 'lucide-vue-next'
import { kindOf } from '@/lib/modules/catalog'
import { decor, uploadDecor, removeDecor, changed } from '@/composables/room/useDecor'
import { room } from '@/composables/room/useRoom'
import { admin, canManage } from '@/composables/site/useAdmin'
import { cornerName } from '@/lib/corners'
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
function done() { decor.editing = false; lift.value = false }

// snapping to the walls (on unless switched off – remembered on this machine) and the lift mode (dragging moves up and down;
// on a computer Shift does the same while dragging)
const SNAP_KEY = 'niben-decor-snap'
const snap = ref((() => { try { return localStorage.getItem(SNAP_KEY) !== 'off' } catch { return true } })())
const lift = ref(false)
watch([snap, () => room.api], () => { room.api?.setDecorSnap(snap.value); try { localStorage.setItem(SNAP_KEY, snap.value ? 'on' : 'off') } catch { /* private mode */ } }, { immediate: true })
watch([lift, () => room.api], () => room.api?.setDecorLift(lift.value), { immediate: true })
const height = computed(() => Math.round((sel.value?.y || 0) * 100))
function setHeight(e: Event) { adj({ y: Number((e.target as HTMLInputElement).value) / 100 }) }
function resetOne() { if (sel.value) room.api?.resetDecor(sel.value.id) }
function resetAll() { if (confirm('Sette alt i rommet tilbake der det sto fra start – hjørnene, hobbyene og modellene?')) room.api?.resetDecor(null) }
</script>

<template>
  <transition name="fade">
    <div v-if="decor.editing && canManage" class="de glass" role="toolbar" aria-label="Rediger rommet" translate="no">
      <div class="top">
        <b><Move :size="15" aria-hidden="true" />Rediger rommet</b>
        <span class="st">{{ decor.saved ? 'Lagret' : 'Lagrer …' }}</span>
        <label v-if="admin.loggedIn" class="btn small"><Upload :size="14" aria-hidden="true" />{{ decor.busy === 'upload' ? 'Laster opp …' : 'Legg til modell' }}<input type="file" accept=".glb,model/gltf-binary" hidden @change="onFile" /></label>
        <button class="btn primary small" @click="done"><Check :size="14" aria-hidden="true" />Ferdig</button>
      </div>
      <p v-if="decor.error" class="err">{{ decor.error }}</p>
      <div v-if="decor.items.length" class="chips pills">
        <button v-for="i in decor.items" :key="i.id" :class="{ on: i.id === decor.selected, off: i.visible === false }" @click="pick(i.id)">{{ i.name || (i.corner ? cornerName(i.corner) : kindOf(i.mod)?.name) || 'Modell' }}</button>
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
        <button title="Tilbake der den sto fra start" aria-label="Tilbake til start" @click="resetOne"><Undo2 :size="17" /></button>
        <button v-if="!sel.corner" class="danger" title="Slett" aria-label="Slett" @click="del"><Trash2 :size="17" /></button>
        <label class="hgt" title="Høyde over gulvet"><MoveVertical :size="15" aria-hidden="true" /><input type="range" min="0" max="300" step="1" :value="height" aria-label="Høyde over gulvet" @input="setHeight" /><span>{{ height }} cm</span></label>
      </div>
      <div class="modes">
        <button type="button" :class="{ on: snap }" :aria-pressed="snap" title="Fest til veggen når du drar nær den" @click="snap = !snap"><Magnet :size="15" aria-hidden="true" />Fest til vegg: {{ snap ? 'på' : 'av' }}</button>
        <button type="button" :class="{ on: lift }" :aria-pressed="lift" title="Dra opp og ned i stedet for bortover (Shift gjør det samme)" @click="lift = !lift"><MoveVertical :size="15" aria-hidden="true" />Dra i høyden</button>
        <button type="button" title="Alt tilbake der det sto fra start" @click="resetAll"><ListRestart :size="15" aria-hidden="true" />Tilbakestill rommet</button>
      </div>
      <p class="hint">Dra en modell, en hobby eller et av rommets egne hjørner for å flytte det – det holder seg inne i rommet og fester seg til veggen når du kommer nær. Hold Shift mens du drar for å løfte det. Scrollhjul = drei · Shift + scroll = størrelse. Trykk på gulvet for å velge bort.</p>
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
.hgt { display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; border-radius: 12px; background: var(--glass-strong); color: var(--text-2); font-size: 0.78rem; flex: 1; min-width: 180px; }
.hgt input { flex: 1; accent-color: var(--accent); } .hgt span { min-width: 4.2em; text-align: right; font-variant-numeric: tabular-nums; }
.modes { display: flex; gap: 6px; flex-wrap: wrap; }
.modes button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border: 1px solid var(--glass-border); border-radius: 999px; background: transparent; color: var(--text-2); font: inherit; font-size: 0.8rem; cursor: pointer; }
.modes button.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
.hint { margin: 0; font-size: 0.76rem; color: var(--text-3); line-height: 1.4; }
.err { margin: 0; padding: 7px 10px; border-radius: 10px; background: rgba(210, 75, 75, 0.14); color: #b23a3a; font-size: 0.82rem; }
</style>
