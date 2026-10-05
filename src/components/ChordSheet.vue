<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { ChevronLeft, Minus, Plus, Play, Pause, ArrowUpRight, Timer, Guitar, Save } from 'lucide-vue-next'
import ChordDiagram from './ChordDiagram.vue'
import StrumEditor from './StrumEditor.vue'
import { parseSheet, transposeChord, parseProgression, findChord } from '../lib/chords'
import { playSong, type SongOptions } from '../lib/strum'
import type { Song } from '../composables/useData'
import type { SheetSection } from '../lib/chords'
import { admin, api, errorMessage } from '../composables/useAdmin'
import { reloadData } from '../composables/useData'

// My chord sheet for a song, like on Ultimate Guitar: transpose, text size, auto-scroll – plus the
// strumming pattern, hearing it strummed through the chords (the chord being played lights up in the
// sheet), a metronome, and the chord shape when you point at (or tap) a chord in the sheet.
const props = defineProps<{ song: Song }>()
defineEmits<{ back: [] }>()

const shift = ref(0)
const size = ref(1)
const scrolling = ref(false)
const speed = ref(3)
const root = ref<HTMLElement | null>(null)
const sections = computed(() => parseSheet(props.song.ark, shift.value))

// every chord in the sheet in reading order (that's the order they're played in), with its place
const seq = computed(() => {
  const out: { t: string; key: string }[] = []
  sections.value.forEach((s, si) => s.lines.forEach((l, li) => l.forEach((x, k) => { if (x.chord) out.push({ t: x.t, key: `${si}-${li}-${k}` }) })))
  return out
})
const seqIndex = computed(() => new Map(seq.value.map((x, i) => [x.key, i])))
const progression = computed(() => (seq.value.length ? seq.value.map((x) => x.t) : parseProgression(props.song.akkorder).map((c) => transposeChord(c, shift.value))))
const used = computed(() => [...new Set(progression.value)].filter((c) => findChord(c)))
const keyLabel = computed(() => (shift.value > 0 ? `+${shift.value}` : `${shift.value}`))

// ── strumming, playback, metronome ──
const pattern = ref(props.song.slagmonster || 'D-DU-UDU')
const bpm = ref(props.song.bpm || 80)
const beatsPerChord = ref(props.song.slag || 4)
const playing = ref(false) // the chords strummed
const metronome = ref(false)
const follow = ref(true) // keep the chord being played in view
const now = ref({ chord: -1, slot: -1, beat: -1 })
let player: ReturnType<typeof playSong> | null = null

function syncPlayer() {
  const want = playing.value || metronome.value
  if (!want) { player?.stop(); player = null; now.value = { chord: -1, slot: -1, beat: -1 }; return }
  const opts: Partial<SongOptions> & { chords: string[] } = { chords: progression.value, pattern: pattern.value, bpm: bpm.value, beatsPerChord: beatsPerChord.value, capo: props.song.capo || 0, strum: playing.value, click: metronome.value, onStep: (s) => { now.value = s } }
  if (player) player.set(opts)
  else player = playSong(opts)
}
watch([playing, metronome], syncPlayer)
watch([pattern, bpm, beatsPerChord, progression], () => player && syncPlayer())
onBeforeUnmount(() => player?.stop())

// the chord being played: light it up in the sheet and keep it in view
const activeKey = computed(() => (playing.value && now.value.chord >= 0 ? seq.value[now.value.chord]?.key : null))
watch(activeKey, async (k) => {
  if (!k || !follow.value) return
  await nextTick()
  root.value?.querySelector(`[data-k="${k}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
})

// save the pattern / tempo on the song (admin)
const saveMsg = ref('')
async function savePattern() {
  const s = props.song
  try {
    await api('song_save', { id: s.id, title: s.tittel, artist: s.artist || '', chords: s.akkorder, bpm: bpm.value, beats: beatsPerChord.value, capo: s.capo || 0, ug_url: s.ug || '', notes: s.notat || '', sheet: s.ark || '', practising: !!s.ovrer, strum: pattern.value })
    await reloadData()
    saveMsg.value = 'Lagret.'
  } catch (e) {
    saveMsg.value = errorMessage(e)
  }
  setTimeout(() => (saveMsg.value = ''), 2500)
}

// ── the chord shape under the pointer (or tapped) ──
const tip = ref<{ name: string; x: number; y: number } | null>(null)
function showTip(e: Event, name: string) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = Math.min(Math.max(8, r.left + r.width / 2 - 60), window.innerWidth - 128)
  const y = r.top > 190 ? r.top - 172 : r.bottom + 8
  tip.value = { name, x, y }
}
const tapTip = (e: Event, name: string) => (tip.value?.name === name ? (tip.value = null) : showTip(e, name))

// ── auto-scroll ──
let raf = 0
let last = 0
function loop(t: number) {
  if (!scrolling.value) return
  const el = scroller()
  if (el && last) el.scrollTop += ((t - last) / 1000) * speed.value * 8
  last = t
  raf = requestAnimationFrame(loop)
}
// the panel scrolls, not the window – find the nearest scrolling parent
function scroller(): Element | null {
  let el = root.value?.parentElement ?? null
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
  <div ref="root" class="sheet" translate="no" :style="{ '--s': size }">
    <header>
      <button class="back" @click="$emit('back')"><ChevronLeft :size="16" />Sanger</button>
      <div class="sh-title">
        <b>{{ song.tittel }}</b>
        <small>{{ song.artist }}<template v-if="song.capo"> · capo {{ song.capo }}</template></small>
      </div>
    </header>

    <div class="tools">
      <span class="grp play">
        <button :class="{ on: playing }" :title="playing ? 'Stopp' : 'Hør akkordene i slagmønsteret'" @click="playing = !playing"><Pause v-if="playing" :size="14" /><Guitar v-else :size="14" />{{ playing ? 'Stopp' : 'Spill' }}</button>
        <button :class="{ on: metronome }" title="Metronom" @click="metronome = !metronome"><Timer :size="14" />Metronom</button>
        <span class="bpm"><button aria-label="Saktere" @click="bpm = Math.max(40, bpm - 4)"><Minus :size="13" /></button><b>{{ bpm }}</b><button aria-label="Raskere" @click="bpm = Math.min(220, bpm + 4)"><Plus :size="13" /></button><i>BPM</i></span>
      </span>
      <span class="grp" title="Transponer"><button aria-label="Ned en halvtone" @click="shift = Math.max(-11, shift - 1)"><Minus :size="14" /></button><b>{{ keyLabel }}</b><button aria-label="Opp en halvtone" @click="shift = Math.min(11, shift + 1)"><Plus :size="14" /></button><i>toneart</i></span>
      <span class="grp"><button aria-label="Mindre tekst" @click="size = Math.max(0.8, +(size - 0.1).toFixed(1))">A</button><button class="big" aria-label="Større tekst" @click="size = Math.min(1.8, +(size + 0.1).toFixed(1))">A</button></span>
      <span class="grp"><button :class="{ on: scrolling }" @click="scrolling = !scrolling"><Pause v-if="scrolling" :size="14" /><Play v-else :size="14" />Rull</button><input v-model.number="speed" type="range" min="1" max="10" aria-label="Rullehastighet" /></span>
    </div>

    <!-- strumming pattern -->
    <section class="strumbox">
      <div class="sb-head">
        <b>Slagmønster</b>
        <label class="bpc">Slag per akkord <input v-model.number="beatsPerChord" type="number" min="1" max="16" /></label>
        <label class="fol"><input v-model="follow" type="checkbox" /> Følg med i arket</label>
        <button v-if="admin.loggedIn" class="save" @click="savePattern"><Save :size="13" />Lagre på sangen</button>
        <small v-if="saveMsg" class="msg">{{ saveMsg }}</small>
      </div>
      <StrumEditor v-model="pattern" :active="playing ? now.slot : -1" />
    </section>

    <div v-if="used.length" class="shapes">
      <ChordDiagram v-for="c in used" :key="c" :name="c" :size="72" :class="{ cur: playing && progression[now.chord] === c }" />
    </div>

    <p v-if="!song.ark" class="empty">Ingen akkordark lagt inn ennå – «Spill» går gjennom akkordene til sangen. Lim inn arket på admin-siden under «Sanger». <a v-if="song.ug" :href="song.ug" target="_blank" rel="noopener">Åpne kilden <ArrowUpRight :size="13" /></a></p>
    <section v-for="(s, i) in sections" :key="i" class="part">
      <h4 v-if="s.name">{{ s.name }}</h4>
      <div v-for="(line, j) in s.lines" :key="j" class="line">
        <template v-for="(tok, k) in line" :key="k">
          <span
            v-if="tok.chord"
            class="ch"
            :class="{ now: activeKey === `${i}-${j}-${k}`, done: playing && (seqIndex.get(`${i}-${j}-${k}`) ?? Infinity) < now.chord }"
            :data-k="`${i}-${j}-${k}`"
            tabindex="0"
            @mouseenter="showTip($event, tok.t)"
            @mouseleave="tip = null"
            @click="tapTip($event, tok.t)"
          >{{ tok.t }}</span>
          <span v-else>{{ tok.t }}</span>
        </template>
        <br v-if="!line.length" />
      </div>
    </section>

    <teleport to="body">
      <div v-if="tip" class="chord-tip glass" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"><ChordDiagram :name="tip.name" :size="104" /></div>
    </teleport>
  </div>
</template>

<style scoped>
.sheet { width: 100%; max-width: 760px; display: grid; gap: 14px; }
header { display: flex; align-items: center; gap: 12px; }
.back { display: inline-flex; align-items: center; border: 0; background: var(--accent-soft); color: var(--accent); padding: 6px 12px; border-radius: 999px; font: 600 0.85rem var(--font); cursor: pointer; }
.sh-title { display: grid; min-width: 0; }
.sh-title b { font-size: 1.1rem; }
.sh-title small { color: var(--text-3); font-size: 0.82rem; }
.tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; position: sticky; top: 0; z-index: 2; padding: 6px 0; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.grp { display: inline-flex; align-items: center; gap: 4px; padding: 3px; border-radius: 999px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.grp button { display: inline-flex; align-items: center; gap: 4px; min-width: 30px; height: 30px; justify-content: center; padding: 0 9px; border: 0; border-radius: 999px; background: transparent; color: var(--text-2); font: 700 0.8rem var(--font); cursor: pointer; }
.grp button.big { font-size: 1.05rem; }
.grp button.on { background: var(--accent); color: #fff; }
.grp b { min-width: 26px; text-align: center; font-variant-numeric: tabular-nums; }
.grp i { font-style: normal; font-size: 0.7rem; color: var(--text-3); padding-right: 8px; }
.grp input[type=range] { width: 70px; accent-color: var(--accent); margin-right: 6px; }
.bpm { display: inline-flex; align-items: center; }
.bpm button { min-width: 26px; padding: 0 4px; }
.strumbox { display: grid; gap: 8px; padding: 12px 14px; border-radius: 16px; background: var(--glass-strong); border: 1px solid var(--glass-border); }
.sb-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 0.8rem; color: var(--text-2); }
.sb-head > b { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.bpc input { width: 46px; margin-left: 4px; padding: 3px 6px; border-radius: 8px; border: 1px solid var(--glass-border); background: var(--glass); color: var(--text); }
.fol { display: inline-flex; align-items: center; gap: 4px; }
.save { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; padding: 5px 11px; border: 0; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font: 600 0.76rem var(--font); cursor: pointer; }
.msg { color: var(--text-3); }
.shapes { display: flex; flex-wrap: wrap; gap: 8px; }
.shapes :deep(.cur) { border-radius: 12px; box-shadow: 0 0 0 2px var(--accent); background: var(--accent-soft); }
.empty { color: var(--text-2); font-size: 0.9rem; }
.empty a { color: var(--accent); display: inline-flex; align-items: center; gap: 2px; }
.part { display: grid; gap: 2px; padding-bottom: 10px; }
.part h4 { margin: 8px 0 2px; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-3); }
.line { white-space: pre-wrap; font: 500 calc(1rem * var(--s)) / 1.55 ui-monospace, 'SF Mono', Menlo, monospace; color: var(--text); }
.ch { font-weight: 800; color: var(--accent); cursor: help; border-radius: 4px; padding: 0 1px; transition: background 0.15s, color 0.15s; }
.ch:hover { background: var(--accent-soft); }
.ch.now { background: var(--accent); color: #fff; }
.ch.done { opacity: 0.55; }
.chord-tip { position: fixed; z-index: 300; padding: 8px 10px; border-radius: 14px; background: var(--bg); box-shadow: 0 14px 34px rgba(0, 0, 0, 0.25); pointer-events: none; }
</style>
