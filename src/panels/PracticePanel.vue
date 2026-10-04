<script setup>
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { timer, timerState, formatTime, toggle, reset, setIntervalSeconds, setSound } from '../composables/useTimer'
import { room } from '../composables/useRoom'
import ChordPractice from '../components/ChordPractice.vue'

// re-evaluates every frame while the timer runs (timer.now ticks)
const st = computed(() => { void timer.now; void timer.running; void timer.pausedMs; void timer.interval; return timerState() })
const status = computed(() => (st.value.go ? 'Spill!' : !st.value.started ? 'Klar' : !st.value.running ? 'Pause' : 'Vent'))
const presets = [5, 10, 15, 20, 30, 60]

const R = 46
const C = 2 * Math.PI * R
const dash = computed(() => C * (1 - (st.value.go ? 1 : st.value.progress)))

function onKey(e) {
  if (e.target.tagName === 'INPUT' || room.practiceTab !== 'timer') return
  if (e.code === 'Space') { e.preventDefault(); toggle() }
  else if (e.key === 'r' || e.key === 'R') reset()
}

// keep the screen awake while practising
let lock = null
async function wake(on) {
  try {
    if (on && !lock && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen')
    if (!on && lock) { await lock.release(); lock = null }
  } catch { lock = null }
}
watch(() => timer.running, (r) => wake(r), { immediate: true })
const onVis = () => { if (!document.hidden && timer.running) { lock = null; wake(true) } }

onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVis)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVis)
  wake(false)
})
</script>

<template>
  <section class="focus glass" :class="{ go: st.go && room.practiceTab === 'timer', running: st.running, chords: room.practiceTab === 'akkorder' }">
    <nav class="ptabs" role="tablist" aria-label="Øving">
      <button role="tab" :aria-selected="room.practiceTab === 'timer'" :class="{ on: room.practiceTab === 'timer' }" @click="room.practiceTab = 'timer'">Timer</button>
      <button role="tab" :aria-selected="room.practiceTab === 'akkorder'" :class="{ on: room.practiceTab === 'akkorder' }" @click="room.practiceTab = 'akkorder'">Akkorder</button>
    </nav>

    <ChordPractice v-if="room.practiceTab === 'akkorder'" class="chordpane" />

    <template v-else>
    <button class="dial" @click="toggle" :aria-label="st.running ? 'Pause' : 'Start'">
      <svg viewBox="0 0 100 100">
        <circle class="track" cx="50" cy="50" :r="R" />
        <circle class="ring" cx="50" cy="50" :r="R" :style="{ strokeDasharray: C, strokeDashoffset: dash }" />
      </svg>
      <span class="center">
        <span class="status">{{ status }}</span>
        <span class="time">{{ formatTime(st.ms) }}</span>
        <span class="sub">Runde {{ st.cycle + 1 }} · {{ st.left }}s igjen</span>
      </span>
    </button>

    <div class="buttons">
      <button class="btn primary big" @click="toggle">
        {{ st.running ? 'Pause' : st.started ? 'Fortsett' : 'Start' }}
      </button>
      <button class="btn big" @click="reset" :disabled="!st.started">Nullstill</button>
    </div>

    <div class="settings">
      <div class="presets" role="group" aria-label="Intervall">
        <button v-for="p in presets" :key="p" class="chip-btn" :class="{ on: timer.interval === p }" @click="setIntervalSeconds(p)">{{ p }}s</button>
        <label class="custom">
          <input type="number" min="1" max="3600" :value="timer.interval" @change="(e) => setIntervalSeconds(e.target.value)" aria-label="Eget intervall i sekunder" />
          <span>s</span>
        </label>
      </div>
      <label class="toggle">
        <input type="checkbox" :checked="timer.sound" @change="(e) => setSound(e.target.checked)" />
        <span class="sw"></span>
        Pip
      </label>
    </div>

    <p class="keys">Trykk på ringen eller mellomrom for start/pause · R nullstiller</p>
    </template>
  </section>
</template>

<style scoped>
.focus {
  --c: #f0a040;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 26px 26px 18px;
  border-radius: 36px;
  max-height: 100%;
  overflow-y: auto;
  animation: focusIn 0.7s var(--spring) both;
}
@keyframes focusIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } }
.focus.go { --c: #3cc47e; }
.focus.chords { align-items: stretch; overflow-y: auto; max-height: 100%; }
.chordpane { width: 100%; }
.ptabs { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--glass-strong); border: 1px solid var(--glass-border); align-self: center; }
.ptabs button { padding: 7px 18px; border: 0; border-radius: 999px; background: transparent; color: var(--text-2); font: 700 0.9rem var(--font); cursor: pointer; }
.ptabs button.on { background: var(--text); color: var(--bg); }

.dial {
  position: relative;
  width: min(52vh, 78vw, 420px);
  aspect-ratio: 1;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  color: var(--text);
  border-radius: 50%;
  transition: transform 0.5s var(--spring);
}
.dial:hover { transform: scale(1.015); }
.dial:active { transform: scale(0.985); }
.dial svg { width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
.track { fill: none; stroke: var(--accent-soft); stroke-width: 5; }
.ring {
  fill: none;
  stroke: var(--c);
  stroke-width: 5;
  stroke-linecap: round;
  filter: drop-shadow(0 0 3px color-mix(in srgb, var(--c) 60%, transparent));
  transition: stroke 0.3s;
}
.focus.go .dial { animation: pulse 0.6s var(--ease) 2; }
@keyframes pulse { 50% { transform: scale(1.04); } }

.center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.status {
  font-size: clamp(0.85rem, 2.2vh, 1.1rem);
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-3);
  transition: color 0.3s;
}
.focus.running .status, .focus.go .status { color: var(--c); }
.time {
  font: 800 clamp(3rem, 10vh, 5.6rem) var(--font-display);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
  line-height: 1;
}
.sub { font-size: clamp(0.85rem, 2vh, 1rem); color: var(--text-2); font-variant-numeric: tabular-nums; }

.buttons { display: flex; gap: 10px; }
.btn.big { min-width: 150px; justify-content: center; padding: 14px 26px; font-size: 1.05rem; }
.btn:disabled { opacity: 0.45; cursor: default; transform: none; }

.settings { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; }
.presets { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
.chip-btn {
  padding: 7px 13px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, transform 0.4s var(--spring);
}
.chip-btn:hover { transform: translateY(-2px); }
.chip-btn.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.custom { display: flex; align-items: center; gap: 4px; color: var(--text-3); font-size: 0.85rem; }
.custom input {
  width: 60px;
  padding: 6px 8px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-strong);
  color: var(--text);
  font: 600 0.85rem var(--font);
  text-align: center;
}
.toggle { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-2); cursor: pointer; }
.toggle input { display: none; }
.sw { width: 36px; height: 22px; border-radius: 99px; background: var(--accent-soft); position: relative; transition: background 0.3s; flex: none; }
.sw::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); transition: transform 0.4s var(--spring); }
.toggle input:checked + .sw { background: var(--accent); }
.toggle input:checked + .sw::after { transform: translateX(14px); }
.keys { font-size: 0.78rem; color: var(--text-3); text-align: center; }

@media (max-width: 900px) {
  .focus { padding: 20px 16px 16px; gap: 14px; }
  .dial { width: min(44vh, 84vw); }
  .btn.big { min-width: 120px; padding: 12px 20px; }
  .keys { display: none; }
}
</style>
