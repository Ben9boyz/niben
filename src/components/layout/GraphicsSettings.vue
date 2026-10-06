<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { X, Gauge, RotateCcw } from 'lucide-vue-next'
import { gfx, gfxUi, GROUPS, PRESET_LABELS, setPreset, setOptionLoose, setShowFps, type GfxKey, type GfxItem } from '@/composables/ui/useGraphics'
import { room } from '@/composables/room/useRoom'
import { admin } from '@/composables/site/useAdmin'
import { inputOf, selectOf } from '@/lib/dom'

// Innstillinger → Grafikk. "Auto" = the room picks what suits this device and keeps the frame rate up on its own.
// Everything else is up to you: pick a preset, or change single things (that makes it "Egen").
type Info = NonNullable<typeof room.api>['gfxInfo']
const info = ref<Info | null>(null)
let timer: ReturnType<typeof setInterval> | undefined
watch(() => gfxUi.open, (o) => {
  clearInterval(timer)
  if (o) { const poll = () => { info.value = room.api?.gfxInfo || null }; poll(); timer = setInterval(poll, 600) }
}, { immediate: true })
const onKey = (e: KeyboardEvent) => { if (gfxUi.open && e.key === 'Escape') gfxUi.open = false }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => { clearInterval(timer); window.removeEventListener('keydown', onKey) })
const auto = computed(() => gfx.mode === 'auto')
// what is shown in the controls: my choices – or, in Auto, what the device is using
const val = (k: GfxKey): string | number | boolean => {
  const a = auto.value ? info.value?.auto?.[k] : undefined
  return a !== undefined && a !== 'auto' ? a : gfx[k]
}
const shown = (k: GfxKey) => (k === 'res' && auto.value ? (info.value?.pixelRatio ? Math.round(info.value.pixelRatio * 100) / 100 : gfx.res) : val(k))
const classLabel: Record<string, string> = { low: 'Lav', high: 'Høy', ultra: 'Ultra' }
const pick = (item: Extract<GfxItem, { type: 'select' }>, v: string) => setOptionLoose(item.key, item.options.some((o) => typeof o[0] === 'number') ? Number(v) : v, info.value?.auto)
const options = (item: Extract<GfxItem, { type: 'select' }>): [string | number, string][] => (item.key === 'res' && auto.value && info.value && !item.options.some((o) => o[0] === shown('res')) ? [[Number(shown('res')), `${String(shown('res')).replace('.', ',')}× (auto)`], ...item.options] : item.options)
const close = () => { gfxUi.open = false }
</script>

<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="gfxUi.open" class="gbg" @click.self="close" @keydown.esc="close">
        <section class="gwin glass" role="dialog" aria-label="Grafikk" translate="no">
          <header>
            <b><Gauge :size="17" aria-hidden="true" />Grafikk</b>
            <button class="x" aria-label="Lukk" @click="close"><X :size="18" /></button>
          </header>

          <div class="presets" role="group" aria-label="Forhåndsvalg">
            <button v-for="p in PRESET_LABELS" :key="p[0]" :class="{ on: gfx.preset === p[0] }" @click="setPreset(p[0])">{{ p[1] }}</button>
          </div>
          <p class="auto" v-if="auto">
            <b>Automatisk.</b> Rommet velger selv ut fra enheten<template v-if="info"> (kjent som «{{ classLabel[info.quality] || info.quality }}»)</template> og senker eller øker oppløsningen når bildefrekvensen faller eller har god plass.
            Endre noe under for å ta over selv.
          </p>
          <p class="auto" v-else>Dine egne valg. <button class="lnk" @click="setPreset('auto')"><RotateCcw :size="13" aria-hidden="true" />Tilbake til automatisk</button></p>

          <div v-if="info" class="live">
            <span><b>{{ info.fps || '–' }}</b> fps</span>
            <span><b>{{ Math.round(info.pixelRatio * 100) / 100 }}×</b> oppløsning</span>
            <template v-if="admin.mine">
              <span :title="'Tegnekall per bilde (alle trinn)'"><b>{{ info.calls }}</b> anrop</span>
              <span><b>{{ Math.round(info.triangles / 1000) }}k</b> trekanter</span>
              <span><b>{{ info.lights }}</b> lys</span>
              <span><b>{{ classLabel[info.quality] || info.quality }}</b> nivå</span>
            </template>
            <span v-if="info.gpu" class="gpu" :title="info.gpu">{{ info.gpu.replace(/^angle \((.*)\)$/, '$1').slice(0, 44) }}</span>
          </div>

          <div class="body">
            <section v-for="g in GROUPS" :key="g.title" class="grp">
              <h4>{{ g.title }}</h4>
              <div v-for="it in g.items" :key="it.key" class="opt">
                <span class="t"><b>{{ it.label }}</b><small v-if="it.hint">{{ it.hint }}</small></span>
                <select v-if="it.type === 'select'" :value="shown(it.key)" :aria-label="it.label" @change="pick(it, selectOf($event).value)">
                  <option v-for="o in options(it)" :key="o[0]" :value="o[0]">{{ o[1] }}</option>
                </select>
                <button v-else-if="it.type === 'toggle'" class="tg" :class="{ on: !!val(it.key) }" role="switch" :aria-checked="!!val(it.key)" :aria-label="it.label" @click="setOptionLoose(it.key, !val(it.key), info?.auto)"><i></i></button>
                <span v-else class="rng"><input type="range" :min="it.min" :max="it.max" :step="it.step" :value="val(it.key)" :aria-label="it.label" @input="setOptionLoose(it.key, +inputOf($event).value, info?.auto)" /><em>{{ it.fmt(+val(it.key)) }}</em></span>
              </div>
            </section>
            <section class="grp">
              <h4>Annet</h4>
              <div class="opt"><span class="t"><b>Vis bildefrekvens</b><small>En liten teller nede i hjørnet.</small></span>
                <button class="tg" :class="{ on: gfx.showFps }" role="switch" :aria-checked="gfx.showFps" aria-label="Vis bildefrekvens" @click="setShowFps(!gfx.showFps)"><i></i></button></div>
            </section>
          </div>
        </section>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.gbg { position: fixed; inset: 0; z-index: 95; display: grid; place-items: center; padding: 16px; background: rgba(8, 12, 20, 0.42); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
.gwin.gwin { position: relative; display: flex; flex-direction: column; gap: 10px; width: min(560px, 100%); max-height: min(86dvh, 760px); padding: 18px 18px 8px; border-radius: 24px; background: var(--bg); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4); }
header { display: flex; align-items: center; justify-content: space-between; }
header b { display: inline-flex; align-items: center; gap: 8px; font-size: 1.15rem; }
.x { display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 50%; background: var(--glass-strong); color: var(--text-2); cursor: pointer; }
.presets { display: flex; gap: 3px; padding: 3px; border-radius: 13px; background: var(--glass-strong); }
.presets button { flex: 1; padding: 8px 4px; border: 0; border-radius: 10px; background: transparent; color: var(--text-2); font: 600 0.84rem var(--font); cursor: pointer; }
.presets button.on { background: var(--bg); color: var(--accent); box-shadow: 0 1px 5px rgba(0, 0, 0, 0.16); }
.auto { margin: 0; padding: 9px 12px; border-radius: 12px; background: var(--accent-soft); color: var(--text-2); font-size: 0.8rem; line-height: 1.4; }
.auto b { color: var(--accent); }
.lnk { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; color: var(--accent); font: 600 0.8rem var(--font); cursor: pointer; }
.live { display: flex; flex-wrap: wrap; gap: 6px 16px; padding: 0 4px; font-size: 0.78rem; color: var(--text-3); }
.live b { color: var(--text); font-variant-numeric: tabular-nums; }
.gpu { margin-left: auto; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.body { overflow-y: auto; overscroll-behavior: contain; display: grid; gap: 14px; padding: 4px 2px 12px; }
.grp { display: grid; gap: 2px; }
h4 { margin: 0 0 4px; padding: 0 4px; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.opt { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 8px 6px; border-radius: 11px; }
.opt:hover { background: var(--glass-strong); }
.t { display: grid; min-width: 0; }
.t b { font-weight: 600; font-size: 0.9rem; }
.t small { font-size: 0.72rem; color: var(--text-3); line-height: 1.3; }
select { flex: none; max-width: 170px; padding: 7px 10px; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--glass-strong); color: var(--text); font: 600 0.84rem var(--font); }
.tg { position: relative; flex: none; width: 42px; height: 24px; padding: 0; border: 0; border-radius: 999px; background: var(--glass-border); cursor: pointer; transition: background 0.2s; }
.tg i { position: absolute; left: 3px; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); transition: transform 0.2s; }
.tg.on { background: var(--accent); }
.tg.on i { transform: translateX(18px); }
.rng { display: flex; align-items: center; gap: 8px; flex: none; }
.rng input { width: 120px; accent-color: var(--accent); }
.rng em { width: 44px; font-style: normal; font-size: 0.78rem; color: var(--text-3); text-align: right; font-variant-numeric: tabular-nums; }
@media (max-width: 600px) { .opt { gap: 8px; } .rng input { width: 90px; } select { max-width: 140px; } }
</style>
