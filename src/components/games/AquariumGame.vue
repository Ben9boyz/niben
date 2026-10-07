<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Coins, Fish, Trophy, ArrowUpCircle, Maximize2, Minimize2, Lock, Check, Home, Sparkles, X } from 'lucide-vue-next'
import { canManage } from '@/composables/site/useAdmin'
import { games, loadGame, scheduleSave, placeTrophy, trophyItem, tankVersion } from '@/composables/games/useAquarium'
import {
  SPECIES, UPGRADES, TROPHIES, TIER_COLORS, TIER_NAMES, MAX_LEVEL, speciesOf, levelOf, levelProgress, coinsForLevel, maxFish, fullRate, earningRate,
  canBuyFish, buyFish, canUpgrade, upgrade, feed, collect, coinAt, step, newTrophies, sellFish, fmtCoins, type Species, type Fish as FishT, type Trophy as TrophyT,
} from '@/lib/games/aquarium'

// «Akvariet»: the tank on a canvas, the shop under it. Tap the water to drop food, tap a coin to pick it up.
const props = defineProps<{ id: string }>()
const mine = computed(() => canManage.value)
const game = computed(() => games.get(props.id) ?? null)
const wrap = ref<HTMLElement | null>(null)
const cv = ref<HTMLCanvasElement | null>(null)
const tick = ref(0) // (the page reads the tank a few times a second – the tank itself is not reactive)
const tab = ref<'fisk' | 'opp' | 'trofeer' | 'tank'>('fisk')
const toast = ref<{ text: string; sub?: string; kind: 'level' | 'trophy' | 'info' } | null>(null)
let toastT: ReturnType<typeof setTimeout> | undefined
function say(text: string, sub = '', kind: 'level' | 'trophy' | 'info' = 'info'): void {
  toast.value = { text, sub, kind }
  clearTimeout(toastT)
  toastT = setTimeout(() => (toast.value = null), kind === 'info' ? 2200 : 4200)
}
watch(() => [props.id, mine.value] as const, ([id, m]) => { void loadGame(id, m).then((g) => { if (g?.away) say(`Mens du var borte: +${fmtCoins(g.away)} mynter`, 'Fiskene har jobbet', 'info') }) }, { immediate: true })

// ── the HUD (read from the tank on the beat) ──
const s = computed(() => { void tick.value; const st = game.value?.tank.s; return st ? { ...st } : null }) // (a fresh copy on each beat, so everything that reads it follows)
const level = computed(() => (s.value ? levelOf(s.value.total) : 1))
const prog = computed(() => (s.value ? levelProgress(s.value.total) : 0))
const toNext = computed(() => (s.value && level.value < MAX_LEVEL ? coinsForLevel(level.value + 1) - s.value.total : 0))
const rate = computed(() => (s.value ? earningRate(s.value) : 0))
const full = computed(() => (s.value ? fullRate(s.value) : 0))
const room = computed(() => (s.value ? maxFish(s.value.up.tank) : 4))
const nextUnlock = computed(() => SPECIES.find((x) => x.unlock > level.value) ?? null)
const hungry = computed(() => (s.value ? s.value.fish.filter((f) => f.hunger < 0.2).length : 0))

// ── what the player does ──
function act(fn: () => { ok: boolean; why?: string }, done: string): void {
  const g = game.value
  if (!g || !mine.value) return
  const r = fn()
  if (!r.ok) { say((r as { why: string }).why); return }
  say(done)
  after()
}
function after(): void {
  const g = game.value
  if (!g) return
  for (const tr of newTrophies(g.tank.s)) { say(`Nytt trofé: ${tr.name}`, `${TIER_NAMES[tr.tier]} – sett det i rommet under «Trofeer»`, 'trophy') }
  tankVersion.n++
  scheduleSave(props.id)
  tick.value++
}
const buy = (sp: Species): void => act(() => buyFish(game.value!.tank, sp.id), `${sp.name} er i tanken`)
const up = (id: (typeof UPGRADES)[number]['id']): void => act(() => upgrade(game.value!.tank, id), 'Oppgradert')
function sell(f: FishT): void {
  const g = game.value
  if (!g || !confirm(`Selge ${f.name || speciesOf(f.sp).name} for ${fmtCoins(Math.floor(speciesOf(f.sp).cost / 2))} mynter?`)) return
  sellFish(g.tank, f.id); after()
}
const placeErr = ref('')
async function place(t: TrophyT): Promise<void> {
  placeErr.value = await placeTrophy(props.id, t.id)
  if (!placeErr.value) say(`${t.name} står nå i rommet`, 'Flytt det i «Rediger rommet»', 'info')
}
const won = (t: TrophyT): boolean => !!s.value?.trophies.includes(t.id)

// ── the canvas ──
const floats: { x: number; y: number; text: string; age: number }[] = []
const bubbles: { x: number; y: number; r: number; v: number }[] = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, v: 0.04 + Math.random() * 0.08 }))
const plants = Array.from({ length: 9 }, (_, i) => ({ x: 0.04 + i * 0.115 + Math.random() * 0.04, h: 0.18 + Math.random() * 0.2, c: i % 3, ph: Math.random() * 6 }))
let raf = 0, last = 0, simT = 0, beat = 0
let W = 800, H = 500, dpr = 1
function resize(): void {
  const c = cv.value
  if (!c) return
  const r = c.getBoundingClientRect()
  dpr = Math.min(2, window.devicePixelRatio || 1)
  W = Math.max(200, r.width); H = Math.max(140, r.height)
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr)
}
function point(e: PointerEvent): { x: number; y: number } {
  const r = cv.value!.getBoundingClientRect()
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
}
function onTap(e: PointerEvent): void {
  const g = game.value
  if (!g) return
  const p = point(e)
  if (!mine.value) { say('Bare eieren av rommet kan mate fiskene her – men se på dem så lenge du vil'); return }
  const c = coinAt(g.tank, p.x, p.y, 0.05)
  if (c) { const v = collect(g.tank, c.id); floats.push({ x: c.x, y: c.y, text: `+${fmtCoins(v)}`, age: 0 }); afterCollect(); return }
  if (feed(g.tank, p.x, Math.min(p.y, 0.3))) { if (navigator.vibrate) navigator.vibrate(8) }
}
let lvlSeen = 0
function afterCollect(): void {
  const g = game.value
  if (!g) return
  const l = levelOf(g.tank.s.total)
  if (lvlSeen && l > lvlSeen) {
    const opens = SPECIES.filter((x) => x.unlock === l).map((x) => x.name).concat(UPGRADES.filter((u) => u.unlock === l).map((u) => u.name))
    say(`Nivå ${l}!`, opens.length ? `Nytt: ${opens.join(', ')}` : `${MAX_LEVEL - l} nivåer igjen`, 'level')
  }
  lvlSeen = l
  for (const tr of newTrophies(g.tank.s)) say(`Nytt trofé: ${tr.name}`, `${TIER_NAMES[tr.tier]} – sett det i rommet under «Trofeer»`, 'trophy')
  scheduleSave(props.id)
}

function fishPath(x: CanvasRenderingContext2D, f: FishT, sp: Species, t: number): void {
  const L = sp.size * W * 1.45, Hh = L * (sp.id === 'skalar' || sp.id === 'diskus' ? 0.9 : sp.id === 'rokke' ? 0.35 : sp.id === 'sjohest' ? 1.1 : 0.48)
  const dir = f.vx >= 0 ? 1 : -1
  const wag = Math.sin(t * (6 + sp.speed * 20) + f.x * 40) * 0.35
  x.save()
  x.translate(f.x * W, f.y * H)
  x.scale(dir, 1)
  const sad = f.hunger <= 0
  if (sp.pattern === 'glow') { x.shadowColor = sp.color2; x.shadowBlur = 14 + Math.sin(t * 3) * 6 }
  // tail
  x.fillStyle = sp.color2
  x.globalAlpha = sp.pattern === 'fins' ? 0.8 : 1
  x.beginPath()
  x.moveTo(-L * 0.38, 0)
  x.lineTo(-L * (sp.pattern === 'fins' ? 0.78 : 0.62), -Hh * (0.55 + wag * 0.3))
  x.quadraticCurveTo(-L * 0.5, 0, -L * (sp.pattern === 'fins' ? 0.78 : 0.62), Hh * (0.55 - wag * 0.3))
  x.closePath(); x.fill()
  x.globalAlpha = 1
  // body
  const gr = x.createLinearGradient(0, -Hh / 2, 0, Hh / 2)
  gr.addColorStop(0, sp.color); gr.addColorStop(1, sp.pattern === 'plain' ? sp.color2 : sp.color)
  x.fillStyle = gr
  x.beginPath(); x.ellipse(0, 0, L / 2, Hh / 2, 0, 0, Math.PI * 2); x.fill()
  x.shadowBlur = 0
  // the pattern
  x.save(); x.beginPath(); x.ellipse(0, 0, L / 2, Hh / 2, 0, 0, Math.PI * 2); x.clip()
  x.fillStyle = sp.color2
  if (sp.pattern === 'stripes') for (const k of [-0.18, 0.08]) x.fillRect(k * L, -Hh, L * 0.1, Hh * 2)
  if (sp.pattern === 'spots') for (let i = 0; i < 5; i++) { x.beginPath(); x.arc((Math.sin(i * 7.3) * 0.3) * L, (Math.cos(i * 3.1) * 0.25) * Hh, L * 0.07, 0, Math.PI * 2); x.fill() }
  x.restore()
  // fin on top
  x.fillStyle = sp.color2; x.globalAlpha = 0.85
  x.beginPath(); x.moveTo(-L * 0.1, -Hh * 0.42); x.quadraticCurveTo(L * 0.02, -Hh * (sp.pattern === 'fins' ? 1.2 : 0.85), L * 0.16, -Hh * 0.4); x.fill()
  x.globalAlpha = 1
  // eye
  x.fillStyle = '#fff'; x.beginPath(); x.arc(L * 0.28, -Hh * 0.08, Math.max(2, L * 0.07), 0, Math.PI * 2); x.fill()
  x.fillStyle = '#111'; x.beginPath(); x.arc(L * 0.3, -Hh * 0.08 + (sad ? 1 : 0), Math.max(1.2, L * 0.035), 0, Math.PI * 2); x.fill()
  x.restore()
  // hungry: a little bubble with a pellet in it
  if (f.hunger < 0.2) {
    const bx = f.x * W + 4, by = f.y * H - Hh - 12 + Math.sin(t * 4) * 2
    x.fillStyle = sad ? 'rgba(255,90,90,0.9)' : 'rgba(255,255,255,0.85)'
    x.beginPath(); x.arc(bx, by, 7, 0, Math.PI * 2); x.fill()
    x.fillStyle = '#8a5a2b'; x.beginPath(); x.arc(bx, by, 2.6, 0, Math.PI * 2); x.fill()
  }
}
function draw(t: number): void {
  const c = cv.value, g = game.value
  if (!c) return
  const x = c.getContext('2d')
  if (!x) return
  x.setTransform(dpr, 0, 0, dpr, 0, 0)
  // the water: deeper further down
  const wg = x.createLinearGradient(0, 0, 0, H)
  wg.addColorStop(0, '#5ad1f5'); wg.addColorStop(0.55, '#1f7fbf'); wg.addColorStop(1, '#0d3f6b')
  x.fillStyle = wg; x.fillRect(0, 0, W, H)
  // light from above, slowly swaying
  x.save(); x.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 5; i++) {
    const cx = (0.15 + i * 0.2 + Math.sin(t * 0.3 + i) * 0.04) * W
    const lg = x.createLinearGradient(cx, 0, cx, H * 0.85)
    lg.addColorStop(0, 'rgba(255,255,255,0.16)'); lg.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = lg
    x.beginPath(); x.moveTo(cx - W * 0.03, 0); x.lineTo(cx + W * 0.03, 0); x.lineTo(cx + W * 0.09, H * 0.85); x.lineTo(cx - W * 0.05, H * 0.85); x.fill()
  }
  x.restore()
  // the sand, with a few ripples and stones
  const sandY = H * 0.88
  const sg = x.createLinearGradient(0, sandY, 0, H)
  sg.addColorStop(0, '#e9d59c'); sg.addColorStop(1, '#c9ae6b')
  x.fillStyle = sg
  x.beginPath(); x.moveTo(0, sandY)
  for (let i = 0; i <= 20; i++) x.lineTo((i / 20) * W, sandY + Math.sin(i * 1.7) * 4)
  x.lineTo(W, H); x.lineTo(0, H); x.fill()
  x.fillStyle = '#8a94a3'
  for (const [sx, sr] of [[0.22, 14], [0.27, 9], [0.71, 18], [0.78, 10]] as const) { x.beginPath(); x.ellipse(sx * W, sandY + 6, sr * 1.4, sr, 0, Math.PI, 0); x.fill() }
  // plants, swaying
  for (const p of plants) {
    x.strokeStyle = ['#2f9e57', '#3fbf6a', '#21734a'][p.c]!
    x.lineWidth = 5; x.lineCap = 'round'
    for (let k = -1; k <= 1; k++) {
      x.beginPath(); x.moveTo(p.x * W + k * 5, sandY + 4)
      const sw = Math.sin(t * 1.1 + p.ph + k) * 14
      x.quadraticCurveTo(p.x * W + k * 8 + sw, sandY - p.h * H * 0.5, p.x * W + k * 10 + sw * 1.6, sandY - p.h * H * (0.9 + k * 0.1))
      x.stroke()
    }
  }
  // bubbles from the bubbler in the corner, and drifting ones
  x.fillStyle = 'rgba(255,255,255,0.35)'
  for (const b of bubbles) { x.beginPath(); x.arc((b.x + Math.sin(t * 2 + b.y * 10) * 0.004) * W, b.y * H, b.r, 0, Math.PI * 2); x.fill() }
  if (g) {
    const tk = g.tank
    // food
    x.fillStyle = '#9b6b3a'
    for (const p of tk.pellets) { x.beginPath(); x.arc(p.x * W, p.y * H, 3.2, 0, Math.PI * 2); x.fill() }
    // fish (the biggest at the back)
    for (const f of [...tk.s.fish].sort((a, b) => speciesOf(b.sp).size - speciesOf(a.sp).size)) fishPath(x, f, speciesOf(f.sp), t)
    // coins: gold, turning (a squashed circle), a glint
    for (const co of tk.coins) {
      const cx = co.x * W, cy = co.y * H, r = 10 + Math.min(6, Math.log10(co.value + 1) * 1.8)
      const sq = Math.abs(Math.cos(t * 3 + co.id))
      x.globalAlpha = co.age > 20 ? Math.max(0, (25 - co.age) / 5) : 1
      x.fillStyle = '#b8860b'; x.beginPath(); x.ellipse(cx, cy, r * Math.max(0.25, sq), r, 0, 0, Math.PI * 2); x.fill()
      x.fillStyle = '#ffd700'; x.beginPath(); x.ellipse(cx, cy, r * Math.max(0.2, sq) * 0.8, r * 0.8, 0, 0, Math.PI * 2); x.fill()
      x.fillStyle = 'rgba(255,255,255,0.8)'; x.beginPath(); x.arc(cx - r * 0.25 * sq, cy - r * 0.3, r * 0.18, 0, Math.PI * 2); x.fill()
      x.globalAlpha = 1
    }
    // "+12" floating up
    x.font = 'bold 15px system-ui, sans-serif'; x.textAlign = 'center'
    for (const fl of floats) { x.globalAlpha = Math.max(0, 1 - fl.age); x.fillStyle = '#fff6b0'; x.fillText(fl.text, fl.x * W, fl.y * H - fl.age * 40); x.globalAlpha = 1 }
    if (!tk.s.fish.length) {
      x.fillStyle = 'rgba(255,255,255,0.92)'; x.font = '600 16px system-ui, sans-serif'
      x.fillText(mine.value ? 'Tanken er tom – kjøp en guppy under!' : 'Ingen fisk her ennå', W / 2, H * 0.45)
    }
  }
  // the glass: a soft shine at the edge
  const gl = x.createLinearGradient(0, 0, W, 0)
  gl.addColorStop(0, 'rgba(255,255,255,0.12)'); gl.addColorStop(0.08, 'rgba(255,255,255,0)'); gl.addColorStop(0.92, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,0.1)')
  x.fillStyle = gl; x.fillRect(0, 0, W, H)
}
function frame(now: number): void {
  raf = requestAnimationFrame(frame)
  const dt = Math.min(0.1, (now - (last || now)) / 1000)
  last = now
  if (document.hidden) return
  simT += dt
  const g = game.value
  if (g) {
    const ev = step(g.tank, dt)
    if (ev.collected || ev.fedFish) { if (ev.collected) afterCollect(); if (mine.value) scheduleSave(props.id, 15000) }
    if (ev.levelUp && !ev.collected) afterCollect()
  }
  for (const b of bubbles) { b.y -= b.v * dt; if (b.y < -0.02) { b.y = 1.02; b.x = Math.random() < 0.5 ? 0.92 + Math.random() * 0.04 : Math.random() } }
  for (const fl of floats) fl.age += dt
  while (floats.length && floats[0]!.age > 1) floats.shift()
  draw(simT)
  beat += dt
  if (beat > 0.25) { beat = 0; tick.value++ }
}
let ro: ResizeObserver | undefined
onMounted(() => {
  resize()
  ro = new ResizeObserver(resize)
  if (cv.value) ro.observe(cv.value)
  raf = requestAnimationFrame(frame)
  lvlSeen = s.value ? levelOf(s.value.total) : 0
})
onBeforeUnmount(() => { cancelAnimationFrame(raf); ro?.disconnect(); clearTimeout(toastT) })
watch(game, (g) => { if (g && !lvlSeen) lvlSeen = levelOf(g.tank.s.total) })

// full screen: the tank and the shop, nothing else
const big = ref(false)
async function toggleBig(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await wrap.value?.requestFullscreen()
  } catch { big.value = !big.value }
}
const onFs = (): void => { big.value = !!document.fullscreenElement; setTimeout(resize, 50) }
onMounted(() => document.addEventListener('fullscreenchange', onFs))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onFs))

// a small picture of a species for the shop
function swatch(sp: Species): Record<string, string> { return { '--c1': sp.color, '--c2': sp.color2 } }
</script>

<template>
  <section ref="wrap" class="aq" :class="{ big }" aria-label="Akvariet – et spill">
    <header class="hud">
      <span class="money" title="Mynter"><Coins :size="18" aria-hidden="true" /><b data-test="coins">{{ fmtCoins(s?.coins ?? 0) }}</b><small>{{ fmtCoins(rate) }}/s{{ full > rate ? ` (${fmtCoins(full)} mette)` : '' }}</small></span>
      <span class="lvl" :title="level < MAX_LEVEL ? `${fmtCoins(toNext)} mynter til nivå ${level + 1}` : 'Høyeste nivå!'">
        <b>Nivå {{ level }}</b><span class="bar"><i :style="{ width: `${Math.round(prog * 100)}%` }"></i></span><small>{{ level < MAX_LEVEL ? `${fmtCoins(toNext)} til neste` : 'Maks!' }}</small>
      </span>
      <span class="fishn" :title="`${s?.fish.length ?? 0} av ${room} plasser`"><Fish :size="16" aria-hidden="true" />{{ s?.fish.length ?? 0 }}/{{ room }}<em v-if="hungry" class="hungry">{{ hungry }} sulten{{ hungry > 1 ? 'e' : '' }}</em></span>
      <button class="ib" type="button" :aria-label="big ? 'Avslutt fullskjerm' : 'Fullskjerm'" @click="toggleBig"><Minimize2 v-if="big" :size="16" /><Maximize2 v-else :size="16" /></button>
    </header>

    <div class="tank">
      <canvas ref="cv" :class="{ play: mine }" aria-label="Akvariet. Trykk i vannet for å slippe fôr, trykk på en mynt for å plukke den opp." @pointerdown="onTap"></canvas>
      <transition name="pop">
        <div v-if="toast" class="toast" :class="toast.kind" role="status">
          <Trophy v-if="toast.kind === 'trophy'" :size="20" /><Sparkles v-else-if="toast.kind === 'level'" :size="20" />
          <span><b>{{ toast.text }}</b><small v-if="toast.sub">{{ toast.sub }}</small></span>
        </div>
      </transition>
      <p v-if="mine && s && !s.stats.fed && s.fish.length" class="hint">Trykk i vannet for å gi fisken mat – mette fisker slipper mynter. Trykk på myntene!</p>
    </div>

    <nav class="tabs" role="tablist" aria-label="Butikken">
      <button role="tab" :aria-selected="tab === 'fisk'" :class="{ on: tab === 'fisk' }" @click="tab = 'fisk'"><Fish :size="15" />Fisk</button>
      <button role="tab" :aria-selected="tab === 'opp'" :class="{ on: tab === 'opp' }" @click="tab = 'opp'"><ArrowUpCircle :size="15" />Oppgraderinger</button>
      <button role="tab" :aria-selected="tab === 'trofeer'" :class="{ on: tab === 'trofeer' }" @click="tab = 'trofeer'"><Trophy :size="15" />Trofeer <small>{{ s?.trophies.length ?? 0 }}/{{ TROPHIES.length }}</small></button>
      <button role="tab" :aria-selected="tab === 'tank'" :class="{ on: tab === 'tank' }" @click="tab = 'tank'"><Home :size="15" />Tanken</button>
    </nav>

    <div v-if="s" class="shop">
      <template v-if="tab === 'fisk'">
        <button v-for="sp in SPECIES" :key="sp.id" class="card" :class="{ locked: level < sp.unlock }" :disabled="!mine || !canBuyFish(s, sp.id).ok" :title="canBuyFish(s, sp.id).ok ? `Kjøp ${sp.name}` : (canBuyFish(s, sp.id) as { why: string }).why" @click="buy(sp)">
          <span class="sw" :class="sp.pattern" :style="swatch(sp)"><i></i></span>
          <b>{{ sp.name }}</b>
          <small v-if="level < sp.unlock"><Lock :size="11" /> Nivå {{ sp.unlock }}</small>
          <small v-else>{{ fmtCoins(sp.rate) }}/s når mett</small>
          <span class="price"><Coins :size="12" />{{ fmtCoins(sp.cost) }}</span>
        </button>
        <p v-if="nextUnlock" class="muted">Neste fisk: <b>{{ nextUnlock.name }}</b> på nivå {{ nextUnlock.unlock }}.</p>
      </template>
      <template v-else-if="tab === 'opp'">
        <button v-for="u in UPGRADES" :key="u.id" class="card wide" :class="{ locked: level < u.unlock }" :disabled="!mine || !canUpgrade(s, u.id).ok" @click="up(u.id)">
          <b>{{ u.name }} <small>{{ s.up[u.id] }}/{{ u.max }}</small></b>
          <small>{{ s.up[u.id] >= u.max ? 'Helt oppgradert' : level < u.unlock ? `Låses opp på nivå ${u.unlock}` : u.text(s.up[u.id]) }}</small>
          <span v-if="s.up[u.id] < u.max" class="price"><Coins :size="12" />{{ fmtCoins(u.cost(s.up[u.id])) }}</span>
          <span v-else class="price ok"><Check :size="12" /></span>
        </button>
      </template>
      <template v-else-if="tab === 'trofeer'">
        <p v-if="placeErr" class="notice error">{{ placeErr }}</p>
        <div v-for="t in TROPHIES" :key="t.id" class="trophy" :class="{ won: won(t) }" :style="{ '--t1': TIER_COLORS[t.tier][0], '--t2': TIER_COLORS[t.tier][1] }">
          <span class="cup"><Trophy :size="24" /></span>
          <span class="tt"><b>{{ t.name }}</b><small>{{ TIER_NAMES[t.tier] }} · {{ t.text }}</small></span>
          <template v-if="won(t) && mine">
            <span v-if="trophyItem(id, t.id)" class="in"><Check :size="13" />I rommet</span>
            <button v-else class="btn soft small" type="button" @click="place(t)">Sett i rommet</button>
          </template>
          <Lock v-else-if="!won(t)" :size="14" class="lk" />
        </div>
      </template>
      <template v-else>
        <p v-if="!s.fish.length" class="muted">Ingen fisk ennå.</p>
        <div v-for="f in s.fish" :key="f.id" class="mine-fish">
          <span class="sw" :class="speciesOf(f.sp).pattern" :style="swatch(speciesOf(f.sp))"><i></i></span>
          <b>{{ speciesOf(f.sp).name }}</b>
          <span class="hb" :title="`Mett: ${Math.round(f.hunger * 100)} %`"><i :style="{ width: `${Math.round(f.hunger * 100)}%`, background: f.hunger < 0.2 ? '#e5484d' : '#30a46c' }"></i></span>
          <button v-if="mine" class="ib" type="button" :aria-label="`Selg ${speciesOf(f.sp).name}`" title="Selg (halv pris)" @click="sell(f)"><X :size="14" /></button>
        </div>
      </template>
    </div>
    <p v-if="game?.error" class="notice error">Kunne ikke lagre: {{ game.error }}</p>
    <p v-if="!mine" class="muted">Dette er akvariet til den som eier rommet. Du kan se på – bare eieren kan mate og kjøpe.</p>
  </section>
</template>

<style scoped>
.aq { display: grid; gap: 10px; }
.aq.big { background: var(--bg); padding: 14px; overflow: auto; height: 100vh; box-sizing: border-box; align-content: start; }
.hud { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.money { display: inline-flex; align-items: baseline; gap: 6px; color: #b8860b; } .money b { font-size: 1.35rem; color: var(--text); font-variant-numeric: tabular-nums; } .money small { color: var(--text-3); font-size: 0.75rem; }
.money svg { align-self: center; }
.lvl { flex: 1; min-width: 180px; display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 8px; align-items: center; }
.lvl b { font-size: 0.9rem; } .lvl small { grid-column: 2; font-size: 0.72rem; color: var(--text-3); }
.bar { height: 8px; border-radius: 99px; background: var(--glass-border); overflow: hidden; } .bar i { display: block; height: 100%; background: linear-gradient(90deg, #4fc3f7, #7b2ff7); border-radius: 99px; transition: width 0.3s; }
.fishn { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; font-size: 0.85rem; color: var(--text-2); }
.hungry { font-style: normal; font-weight: 600; font-size: 0.72rem; color: #e5484d; margin-left: 4px; }
.ib { all: unset; cursor: pointer; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: var(--text-2); } .ib:hover { background: var(--glass-border); }
.tank { position: relative; }
canvas { display: block; width: 100%; aspect-ratio: 16 / 9; border-radius: 18px; box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.25), 0 10px 30px rgba(0, 40, 80, 0.25); touch-action: manipulation; }
.aq.big canvas { aspect-ratio: auto; height: min(62vh, 56vw); }
canvas.play { cursor: crosshair; }
.hint { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); margin: 0; padding: 6px 12px; border-radius: 99px; background: rgba(0, 0, 0, 0.45); color: #fff; font-size: 0.8rem; white-space: nowrap; pointer-events: none; animation: bob 2s ease-in-out infinite; }
@keyframes bob { 50% { transform: translate(-50%, -4px); } }
.toast { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 9px 16px; border-radius: 14px; background: rgba(10, 30, 60, 0.82); color: #fff; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3); pointer-events: none; max-width: 90%; }
.toast span { display: grid; } .toast small { opacity: 0.8; font-size: 0.75rem; }
.toast.level { background: linear-gradient(135deg, #4fc3f7, #7b2ff7); } .toast.trophy { background: linear-gradient(135deg, #b8860b, #ffd700); color: #2b1d00; }
.pop-enter-active { transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s; } .pop-leave-active { transition: opacity 0.3s; }
.pop-enter-from { transform: translate(-50%, -12px) scale(0.85); opacity: 0; } .pop-leave-to { opacity: 0; }
.tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.tabs button { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 999px; font-size: 0.85rem; font-weight: 600; color: var(--text-2); }
.tabs button.on { background: var(--accent-soft); color: var(--accent); } .tabs small { opacity: 0.7; }
.shop { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.card { all: unset; box-sizing: border-box; cursor: pointer; position: relative; display: grid; gap: 3px; padding: 10px 10px 30px; border-radius: 14px; border: 1px solid var(--glass-border); background: var(--glass-strong); transition: transform 0.2s, border-color 0.2s; }
.card:hover:not(:disabled) { transform: translateY(-2px); border-color: var(--accent); }
.card:disabled { cursor: default; opacity: 0.6; } .card.locked { filter: grayscale(0.8); }
.card.wide { grid-column: span 2; } .card b small { font-weight: 600; color: var(--text-3); }
.card small { font-size: 0.74rem; color: var(--text-3); display: inline-flex; align-items: center; gap: 3px; }
.price { position: absolute; left: 10px; bottom: 8px; display: inline-flex; align-items: center; gap: 3px; font-weight: 800; font-size: 0.8rem; color: #b8860b; } .price.ok { color: #30a46c; }
.sw { position: relative; width: 46px; height: 22px; } .sw::before { content: ''; position: absolute; inset: 2px 4px 2px 12px; border-radius: 50%; background: linear-gradient(var(--c1), var(--c2)); }
.sw::after { content: ''; position: absolute; left: 0; top: 4px; border-style: solid; border-width: 7px 12px 7px 0; border-color: transparent var(--c2) transparent transparent; transform: scaleX(-1); }
.sw.stripes::before { background: repeating-linear-gradient(90deg, var(--c1) 0 7px, var(--c2) 7px 10px); } .sw.spots::before { background: radial-gradient(circle at 40% 40%, var(--c2) 0 3px, transparent 4px), radial-gradient(circle at 70% 60%, var(--c2) 0 3px, transparent 4px), var(--c1); }
.sw.glow::before { box-shadow: 0 0 10px var(--c2); }
.sw i { position: absolute; right: 9px; top: 7px; width: 4px; height: 4px; border-radius: 50%; background: #111; z-index: 1; }
.trophy { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 14px; border: 1px solid var(--glass-border); opacity: 0.55; }
.trophy.won { opacity: 1; background: color-mix(in srgb, var(--t1) 12%, transparent); border-color: color-mix(in srgb, var(--t1) 60%, transparent); }
.cup { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; color: var(--text-3); background: var(--glass-strong); }
.trophy.won .cup { color: var(--t2); background: radial-gradient(circle at 35% 30%, #fff, var(--t1)); box-shadow: 0 0 14px color-mix(in srgb, var(--t1) 60%, transparent); }
.tt { flex: 1; display: grid; } .tt small { font-size: 0.74rem; color: var(--text-3); }
.in { display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; font-weight: 700; color: #30a46c; } .lk { color: var(--text-3); }
.mine-fish { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; padding: 4px 6px; }
.mine-fish b { min-width: 110px; font-size: 0.86rem; }
.hb { flex: 1; height: 6px; border-radius: 99px; background: var(--glass-border); overflow: hidden; } .hb i { display: block; height: 100%; border-radius: 99px; }
.muted { grid-column: 1 / -1; margin: 0; color: var(--text-3); font-size: 0.82rem; }
@media (max-width: 520px) { .card.wide { grid-column: 1 / -1; } .shop { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); } }
</style>
