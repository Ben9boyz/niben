<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { ChevronLeft, Minus, Plus, Play, Pause, ArrowUpRight } from 'lucide-vue-next'
import ChordDiagram from './ChordDiagram.vue'
import { parseSheet, transposeChord, parseProgression, findChord } from '../lib/chords'

// My own chord sheet for a song, shown calmly: one song, big chords, transpose, text size and
// slow auto-scroll. The sheet is pasted in by me on the admin page and only visible when I'm logged in.
const props = defineProps({ song: { type: Object, required: true } })
defineEmits(['back'])

const shift = ref(0)
const size = ref(1)
const scrolling = ref(false)
const speed = ref(3)
const root = ref(null)
const sections = computed(() => parseSheet(props.song.ark, shift.value))
const used = computed(() => {
  const all = sections.value.flatMap((s) => s.lines.flatMap((l) => l.filter((x) => x.chord).map((x) => x.t)))
  const list = all.length ? all : parseProgression(props.song.akkorder).map((c) => transposeChord(c, shift.value))
  return [...new Set(list)].filter((c) => findChord(c))
})
const keyLabel = computed(() => (shift.value > 0 ? `+${shift.value}` : `${shift.value}`))

let raf = 0
let last = 0
function loop(t) {
  if (!scrolling.value) return
  const el = scroller()
  if (el && last) el.scrollTop += ((t - last) / 1000) * speed.value * 8
  last = t
  raf = requestAnimationFrame(loop)
}
// the panel scrolls, not the window – find the nearest scrolling parent
function scroller() {
  let el = root.value?.parentElement
  while (el && el.scrollHeight <= el.clientHeight + 1) el = el.parentElement
  return el || document.scrollingElement
}
watch(scrolling, (on) => {
  cancelAnimationFrame(raf)
  last = 0
  if (on) raf = requestAnimationFrame(loop)
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div ref="root" class="sheet" :style="{ '--s': size }">
    <header>
      <button class="back" @click="$emit('back')"><ChevronLeft :size="16" />Sanger</button>
      <div class="title">
        <b>{{ song.tittel }}</b>
        <small>{{ song.artist }}<template v-if="song.capo"> · capo {{ song.capo }}</template><template v-if="song.bpm"> · {{ song.bpm }} BPM</template></small>
      </div>
    </header>

    <div class="tools">
      <span class="grp" title="Transponer"><button aria-label="Ned en halvtone" @click="shift = Math.max(-11, shift - 1)"><Minus :size="14" /></button><b>{{ keyLabel }}</b><button aria-label="Opp en halvtone" @click="shift = Math.min(11, shift + 1)"><Plus :size="14" /></button><i>toneart</i></span>
      <span class="grp"><button aria-label="Mindre tekst" @click="size = Math.max(0.8, +(size - 0.1).toFixed(1))">A</button><button class="big" aria-label="Større tekst" @click="size = Math.min(1.8, +(size + 0.1).toFixed(1))">A</button></span>
      <span class="grp"><button :class="{ on: scrolling }" @click="scrolling = !scrolling"><Pause v-if="scrolling" :size="14" /><Play v-else :size="14" />Rull</button><input v-model.number="speed" type="range" min="1" max="10" aria-label="Rullehastighet" /></span>
    </div>

    <div v-if="used.length" class="shapes"><ChordDiagram v-for="c in used" :key="c" :name="c" :size="72" /></div>

    <p v-if="!song.ark" class="empty">Ingen akkordark lagt inn ennå. Lim det inn på admin-siden under «Sanger». <a v-if="song.ug" :href="song.ug" target="_blank" rel="noopener">Åpne kilden <ArrowUpRight :size="13" /></a></p>
    <section v-for="(s, i) in sections" :key="i" class="part">
      <h4 v-if="s.name">{{ s.name }}</h4>
      <div v-for="(line, j) in s.lines" :key="j" class="line"><template v-for="(tok, k) in line" :key="k"><span :class="{ ch: tok.chord }">{{ tok.t }}</span></template><br v-if="!line.length" /></div>
    </section>
  </div>
</template>

<style scoped>
.sheet { width: 100%; max-width: 640px; display: grid; gap: 14px; }
header { display: flex; align-items: center; gap: 12px; }
.back { display: inline-flex; align-items: center; border: 0; background: var(--accent-soft); color: var(--accent); padding: 6px 12px; border-radius: 999px; font: 600 0.85rem var(--font); cursor: pointer; }
.title { display: grid; min-width: 0; }
.title b { font-size: 1.1rem; }
.title small { color: var(--text-3); }
.tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; position: sticky; top: 0; z-index: 2; padding: 6px 0; backdrop-filter: blur(10px); }
.grp { display: inline-flex; align-items: center; gap: 4px; padding: 3px; border-radius: 999px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.grp button { display: inline-flex; align-items: center; gap: 4px; min-width: 30px; height: 30px; justify-content: center; padding: 0 8px; border: 0; border-radius: 999px; background: transparent; color: var(--text-2); font: 700 0.8rem var(--font); cursor: pointer; }
.grp button.big { font-size: 1.05rem; }
.grp button.on { background: var(--accent); color: #fff; }
.grp b { min-width: 26px; text-align: center; font-variant-numeric: tabular-nums; }
.grp i { font-style: normal; font-size: 0.7rem; color: var(--text-3); padding-right: 8px; }
.grp input { width: 70px; accent-color: var(--accent); margin-right: 6px; }
.shapes { display: flex; flex-wrap: wrap; gap: 8px; }
.empty { color: var(--text-2); font-size: 0.9rem; }
.empty a { color: var(--accent); display: inline-flex; align-items: center; gap: 2px; }
.part { display: grid; gap: 2px; padding-bottom: 10px; }
.part h4 { margin: 8px 0 2px; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
.line { white-space: pre-wrap; font: 500 calc(1rem * var(--s)) / 1.55 ui-monospace, 'SF Mono', Menlo, monospace; color: var(--text); }
.ch { font-weight: 800; color: var(--accent); }
</style>
