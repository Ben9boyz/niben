<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Coins, Fish, Trophy, ArrowUpCircle, Maximize2, Minimize2, Lock, Check, Home, Sparkles, X, Gem, Castle, ScrollText, BookOpen, Gift, RefreshCw, Pencil, Waves, Timer } from 'lucide-vue-next'
import { canManage } from '@/composables/site/useAdmin'
import { games, loadGame, scheduleSave, placeTrophy, trophyItem, tankVersion } from '@/composables/games/useAquarium'
import {
  SPECIES, UPGRADES, DECORS, PERKS, TROPHIES, VARIANTS, EVENTS, TIER_COLORS, TIER_NAMES, MAX_LEVEL, FISH_MAX, PRESTIGE_LEVEL, speciesOf, levelOf, levelProgress, coinsForLevel,
  maxFish, fullRate, earningRate, canBuyFish, buyFish, canUpgrade, upgrade, canDecor, buyDecor, canPerk, buyPerk, feed, collect, coinAt, chestAt, openChest, step, newTrophies,
  sellFish, sellValue, renameFish, fmtCoins, fishLevel, xpForFishLevel, fishRate, fishSize, biomeOf, BIOMES, pearlsFor, pearlBonus, prestige, questProgress, questDone,
  claimQuest, rerollQuest, rerollCost, claimDaily, dailyReady, variantChance,
  type Species, type Fish as FishT, type Trophy as TrophyT, type Tank, type ChestPrize,
} from '@/lib/games/aquarium'

// «Akvariet»: the tank on a canvas, everything else in the tabs under it. Tap the water to drop food, a coin to pick it up,
// a chest in the sand to open it, a fish to see who it is.
const props = defineProps<{ id: string }>()
const mine = computed(() => canManage.value)
const game = computed(() => games.get(props.id) ?? null)
const wrap = ref<HTMLElement | null>(null)
const cv = ref<HTMLCanvasElement | null>(null)
const tick = ref(0)
type Tab = 'fisk' | 'tank' | 'pynt' | 'opp' | 'oppdrag' | 'perler' | 'bok' | 'trofeer'
const tab = ref<Tab>('fisk')
type ToastKind = 'level' | 'trophy' | 'info' | 'rare' | 'event'
// messages wait their turn (a gift, three trophies and a level at once are shown one after another, not on top of each other)
interface Toast { text: string; sub?: string; kind: ToastKind }
const toast = ref<Toast | null>(null)
const queue: Toast[] = []
let toastT: ReturnType<typeof setTimeout> | undefined
function showNext(): void {
  toast.value = queue.shift() ?? null
  if (toast.value) toastT = setTimeout(showNext, toast.value.kind === 'info' ? 2200 : 3800)
}
function say(text: string, sub = '', kind: ToastKind = 'info'): void {
  if (toast.value?.kind === 'info' && kind === 'info') { clearTimeout(toastT); toast.value = null } // (a plain note is simply replaced)
  queue.push({ text, sub, kind })
  while (queue.length > 6) { const i = queue.findIndex((q) => q.kind === 'info'); queue.splice(i >= 0 ? i : 0, 1) }
  if (!toast.value) showNext()
}
watch(() => [props.id, mine.value] as const, ([id, m]) => { void loadGame(id, m).then((g) => { if (g?.away) say(`Mens du var borte: +${fmtCoins(g.away)} mynter`, 'Fiskene har jobbet', 'info') }) }, { immediate: true })

// ── the HUD (read from the tank on the beat – the tank itself is not reactive) ──
const tk = (): Tank | null => game.value?.tank ?? null
const s = computed(() => { void tick.value; const st = tk()?.s; return st ? { ...st } : null })
const level = computed(() => (s.value ? levelOf(s.value.total) : 1))
const prog = computed(() => (s.value ? levelProgress(s.value.total) : 0))
const toNext = computed(() => (s.value && level.value < MAX_LEVEL ? coinsForLevel(level.value + 1) - s.value.total : 0))
const rate = computed(() => (s.value ? earningRate(s.value) : 0))
const full = computed(() => (s.value ? fullRate(s.value) : 0))
const room = computed(() => (s.value ? maxFish(s.value.up.tank) : 4))
const biome = computed(() => biomeOf(s.value?.prestiges ?? 0))
const nextUnlock = computed(() => SPECIES.find((x) => x.unlock > level.value) ?? null)
const hungry = computed(() => (s.value ? s.value.fish.filter((f) => f.hunger < 0.2).length : 0))
const event = computed(() => { void tick.value; return tk()?.event ?? null })
const questsReady = computed(() => (s.value ? s.value.quests.filter((q) => questDone(s.value!, q)).length : 0))
const daily = computed(() => !!s.value && mine.value && dailyReady(s.value))
const gain = computed(() => (s.value ? pearlsFor(s.value.total) : 0))
const luck = computed(() => (s.value ? variantChance(s.value) : { skinnende: 0, gull: 0 }))

// ── what the player does ──
function after(): void {
  const g = game.value
  if (!g) return
  for (const tr of newTrophies(g.tank.s)) say(`Nytt trofé: ${tr.name}`, `${TIER_NAMES[tr.tier]} – sett det i rommet under «Trofeer»`, 'trophy')
  tankVersion.n++
  scheduleSave(props.id)
  tick.value++
}
function act(r: { ok: boolean; why?: string }, done: string): void {
  if (!r.ok) { say(r.why ?? 'Det gikk ikke'); return }
  if (done) say(done)
  after()
}
function buy(sp: Species): void {
  const t = tk()
  if (!t || !mine.value) return
  const r = buyFish(t, sp.id)
  if (r.ok && r.fish && r.fish.variant !== 'normal') { say(`${r.fish.variant === 'gull' ? 'GULL' : 'Skinnende'} ${sp.name}!`, r.fish.variant === 'gull' ? 'Ti ganger så mye verdt – en av fire hundre' : 'Tre ganger så mye verdt', 'rare'); after(); return }
  act(r, `${sp.name} er i tanken`)
}
const up = (id: (typeof UPGRADES)[number]['id']): void => { const t = tk(); if (t && mine.value) act(upgrade(t, id), 'Oppgradert') }
const decorate = (id: (typeof DECORS)[number]['id']): void => { const t = tk(); if (t && mine.value) act(buyDecor(t, id), 'Ny pynt i tanken') }
const perk = (id: (typeof PERKS)[number]['id']): void => { const t = tk(); if (t && mine.value) act(buyPerk(t, id), 'Perlen er brukt – for alltid') }
function sell(f: FishT): void {
  const t = tk()
  if (!t || !confirm(`Selge ${f.name || speciesOf(f.sp).name} for ${fmtCoins(sellValue(f))} mynter?`)) return
  sellFish(t, f.id); after()
}
function rename(f: FishT): void {
  const t = tk()
  if (!t) return
  const n = prompt(`Navn på ${speciesOf(f.sp).name}:`, f.name ?? '')
  if (n === null) return
  renameFish(t.s, f.id, n); after()
}
function claim(qid: string): void {
  const t = tk()
  if (!t) return
  const q = claimQuest(t, qid)
  if (q) { say(`Oppdrag fullført: +${fmtCoins(q.reward)}`, q.pearls ? `og ${q.pearls} perle!` : q.text, 'level'); after() }
}
function reroll(qid: string): void { const t = tk(); if (t) act(rerollQuest(t, qid), 'Nytt oppdrag') }
function gift(): void {
  const t = tk()
  if (!t) return
  const g = claimDaily(t.s)
  if (g) { say(`Dagens gave: +${fmtCoins(g.coins)}${g.pearls ? ` og ${g.pearls} perle${g.pearls > 1 ? 'r' : ''}` : ''}`, `${g.streak} dag${g.streak > 1 ? 'er' : ''} på rad${g.streak < 30 ? ' – kom tilbake i morgen for mer' : ''}`, 'level'); after() }
}
function moveSea(): void {
  const t = tk()
  if (!t) return
  const next = biomeOf(t.s.prestiges + 1)
  if (!confirm(`Flytte til ${next.name}?\n\nDu får ${gain.value} perler (+${gain.value * 4} % for alltid). Mynter, fisker, oppgraderinger og pynt blir igjen her. Perler, evner, fiskeboka og trofeene tar du med.`)) return
  const p = prestige(t)
  if (p) { say(`Velkommen til ${next.name}!`, `+${p} perler · alt gir ${Math.round((pearlBonus(t.s.pearlsEver) * next.bonus - 1) * 100)} % mer`, 'event'); tab.value = 'fisk'; after() }
}
const placeErr = ref('')
async function place(t: TrophyT): Promise<void> {
  placeErr.value = await placeTrophy(props.id, t.id)
  if (!placeErr.value) say(`${t.name} står nå i rommet`, 'Flytt det i «Rediger rommet»', 'info')
}
const won = (t: TrophyT): boolean => !!s.value?.trophies.includes(t.id)
const dexHas = (sp: Species, bit: number): boolean => ((s.value?.dex[sp.id] ?? 0) & bit) !== 0
const dexCount = computed(() => (s.value ? SPECIES.reduce((a, sp) => a + VARIANTS.filter((v) => ((s.value!.dex[sp.id] ?? 0) & v.bit) !== 0).length, 0) : 0))
function prizeText(p: ChestPrize): [string, string] {
  if (p.kind === 'coins') return [`Skattekiste: +${fmtCoins(p.coins)} mynter`, 'Glitrende!']
  if (p.kind === 'pearls') return [`Skattekiste: ${p.pearls} perle${p.pearls > 1 ? 'r' : ''}!`, 'Sjelden fangst']
  if (p.kind === 'decor') return [`Skattekiste: ${DECORS.find((d) => d.id === p.decor)?.name} +1`, 'Gratis pynt i tanken']
  return [`Skattekiste: vekstdrikk (+${p.xp} erfaring)`, 'Alle fiskene vokser']
}

// ── the canvas ──
const floats: { x: number; y: number; text: string; age: number; color: string }[] = []
const sparks: { x: number; y: number; vx: number; vy: number; age: number; color: string }[] = []
const bubbles: { x: number; y: number; r: number; v: number }[] = Array.from({ length: 30 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, v: 0.04 + Math.random() * 0.08 }))
const plants = Array.from({ length: 9 }, (_, i) => ({ x: 0.04 + i * 0.115 + Math.random() * 0.04, h: 0.18 + Math.random() * 0.2, c: i % 3, ph: Math.random() * 6 }))
const motes = Array.from({ length: 24 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * 6 }))
let raf = 0, last = 0, simT = 0, beat = 0
let W = 800, H = 450, dpr = 1
let tag: { f: FishT; until: number } | null = null
function resize(): void {
  const c = cv.value
  if (!c) return
  const r = c.getBoundingClientRect()
  dpr = Math.min(2, window.devicePixelRatio || 1)
  W = Math.max(200, r.width); H = Math.max(120, r.height)
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr)
}
function point(e: PointerEvent): { x: number; y: number } {
  const r = cv.value!.getBoundingClientRect()
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
}
function burst(x: number, y: number, color: string, n = 14): void { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 0.1 + Math.random() * 0.25; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, color }) } }
function onTap(e: PointerEvent): void {
  const t = tk()
  if (!t) return
  const p = point(e)
  // a fish under the finger: who is it?
  const f = t.s.fish.find((x) => Math.abs(x.x - p.x) < fishSize(x) * 0.8 && Math.abs(x.y - p.y) < fishSize(x) * 0.5 * (W / H))
  if (!mine.value) { if (f) tag = { f, until: simT + 3 }; else say('Bare eieren av rommet kan mate fiskene her – men se så mye du vil'); return }
  const c = coinAt(t, p.x, p.y, 0.05)
  if (c) { const v = collect(t, c.id); floats.push({ x: c.x, y: c.y, text: `+${fmtCoins(v)}`, age: 0, color: '#fff6b0' }); afterCollect(); return }
  if (chestAt(t, p.x, p.y)) {
    const prize = openChest(t)
    if (prize) { const [a, b] = prizeText(prize); say(a, b, 'rare'); burst(p.x, 0.86, '#ffd700', 30); after() }
    return
  }
  if (f && p.y > 0.12) tag = { f, until: simT + 3 }
  if (feed(t, p.x, Math.min(p.y, 0.3)) && navigator.vibrate) navigator.vibrate(8)
}
let lvlSeen = 0
function afterCollect(): void {
  const t = tk()
  if (!t) return
  const l = levelOf(t.s.total)
  if (lvlSeen && l > lvlSeen) {
    const opens = [...SPECIES.filter((x) => x.unlock === l).map((x) => x.name), ...UPGRADES.filter((u) => u.unlock === l).map((u) => u.name), ...DECORS.filter((d) => d.unlock === l).map((d) => d.name)]
    say(`Nivå ${l}!`, opens.length ? `Nytt: ${opens.join(', ')}` : l === PRESTIGE_LEVEL ? 'Du kan nå flytte til et nytt hav (Perler)' : `${MAX_LEVEL - l} nivåer igjen i ${biome.value.name}`, 'level')
    burst(0.5, 0.4, '#a29bfe', 26)
  }
  lvlSeen = l
  for (const tr of newTrophies(t.s)) say(`Nytt trofé: ${tr.name}`, `${TIER_NAMES[tr.tier]} – sett det i rommet under «Trofeer»`, 'trophy')
  scheduleSave(props.id)
}

function drawFish(x: CanvasRenderingContext2D, f: FishT, t: number): void {
  const sp = speciesOf(f.sp)
  const L = fishSize(f) * W * 1.45
  const Hh = L * (sp.id === 'skalar' || sp.id === 'diskus' ? 0.9 : sp.id === 'rokke' ? 0.35 : sp.id === 'sjohest' ? 1.1 : 0.48)
  const dir = f.vx >= 0 ? 1 : -1
  const wag = Math.sin(t * (6 + sp.speed * 20) + f.x * 40) * 0.35
  const gold = f.variant === 'gull', shiny = f.variant === 'skinnende'
  const c1 = gold ? '#ffd700' : sp.color, c2 = gold ? '#ff9f1a' : sp.color2
  x.save()
  x.translate(f.x * W, f.y * H)
  x.scale(dir, 1)
  const sad = f.hunger <= 0
  if (sp.pattern === 'glow' || gold || shiny) { x.shadowColor = gold ? '#ffd700' : shiny ? '#ffffff' : c2; x.shadowBlur = 12 + Math.sin(t * 3 + f.x * 9) * 6 }
  x.fillStyle = c2
  x.globalAlpha = sp.pattern === 'fins' ? 0.8 : 1
  x.beginPath()
  x.moveTo(-L * 0.38, 0)
  x.lineTo(-L * (sp.pattern === 'fins' ? 0.78 : 0.62), -Hh * (0.55 + wag * 0.3))
  x.quadraticCurveTo(-L * 0.5, 0, -L * (sp.pattern === 'fins' ? 0.78 : 0.62), Hh * (0.55 - wag * 0.3))
  x.closePath(); x.fill()
  x.globalAlpha = 1
  const gr = x.createLinearGradient(0, -Hh / 2, 0, Hh / 2)
  gr.addColorStop(0, c1); gr.addColorStop(1, sp.pattern === 'plain' ? c2 : c1)
  x.fillStyle = gr
  x.beginPath(); x.ellipse(0, 0, L / 2, Hh / 2, 0, 0, Math.PI * 2); x.fill()
  x.shadowBlur = 0
  x.save(); x.beginPath(); x.ellipse(0, 0, L / 2, Hh / 2, 0, 0, Math.PI * 2); x.clip()
  x.fillStyle = c2
  if (sp.pattern === 'stripes') for (const k of [-0.18, 0.08]) x.fillRect(k * L, -Hh, L * 0.1, Hh * 2)
  if (sp.pattern === 'spots') for (let i = 0; i < 5; i++) { x.beginPath(); x.arc((Math.sin(i * 7.3) * 0.3) * L, (Math.cos(i * 3.1) * 0.25) * Hh, L * 0.07, 0, Math.PI * 2); x.fill() }
  if (shiny || gold) { const sx = -L / 2 + ((t * 0.6) % 1.6) * L; const sh = x.createLinearGradient(sx, 0, sx + L * 0.25, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.75)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = sh; x.fillRect(-L, -Hh, L * 2, Hh * 2) }
  x.restore()
  x.fillStyle = c2; x.globalAlpha = 0.85
  x.beginPath(); x.moveTo(-L * 0.1, -Hh * 0.42); x.quadraticCurveTo(L * 0.02, -Hh * (sp.pattern === 'fins' ? 1.2 : 0.85), L * 0.16, -Hh * 0.4); x.fill()
  x.globalAlpha = 1
  x.fillStyle = '#fff'; x.beginPath(); x.arc(L * 0.28, -Hh * 0.08, Math.max(2, L * 0.07), 0, Math.PI * 2); x.fill()
  x.fillStyle = '#111'; x.beginPath(); x.arc(L * 0.3, -Hh * 0.08 + (sad ? 1 : 0), Math.max(1.2, L * 0.035), 0, Math.PI * 2); x.fill()
  // a crown on the gold ones
  if (gold) { x.fillStyle = '#ffd700'; x.beginPath(); x.moveTo(-L * 0.1, -Hh * 0.55); x.lineTo(-L * 0.06, -Hh * 0.85); x.lineTo(0, -Hh * 0.65); x.lineTo(L * 0.06, -Hh * 0.85); x.lineTo(L * 0.1, -Hh * 0.55); x.fill() }
  x.restore()
  if (shiny && Math.random() < 0.08) sparks.push({ x: f.x + (Math.random() - 0.5) * fishSize(f), y: f.y + (Math.random() - 0.5) * 0.04, vx: 0, vy: -0.03, age: 0, color: '#ffffff' })
  if (f.hunger < 0.2) {
    const bx = f.x * W + 4, by = f.y * H - Hh - 12 + Math.sin(t * 4) * 2
    x.fillStyle = sad ? 'rgba(255,90,90,0.9)' : 'rgba(255,255,255,0.85)'
    x.beginPath(); x.arc(bx, by, 7, 0, Math.PI * 2); x.fill()
    x.fillStyle = '#8a5a2b'; x.beginPath(); x.arc(bx, by, 2.6, 0, Math.PI * 2); x.fill()
  }
}
// the decorations, standing on the sand (they grow a little with their level)
function drawDecor(x: CanvasRenderingContext2D, t: number, sandY: number): void {
  const d = tk()?.s.decor
  if (!d) return
  if (d.vrak) { // a wreck, half sunk, on the left
    const k = 0.9 + d.vrak * 0.05
    x.fillStyle = '#5b4636'; x.beginPath(); x.moveTo(W * 0.02, sandY); x.lineTo(W * 0.05, sandY - 40 * k); x.lineTo(W * 0.2, sandY - 52 * k); x.lineTo(W * 0.24, sandY); x.fill()
    x.strokeStyle = '#3e2f24'; x.lineWidth = 4; x.beginPath(); x.moveTo(W * 0.12, sandY - 48 * k); x.lineTo(W * 0.13, sandY - 120 * k); x.stroke()
    x.fillStyle = 'rgba(240,230,210,0.5)'; x.beginPath(); x.moveTo(W * 0.13, sandY - 118 * k); x.lineTo(W * 0.2, sandY - 92 * k); x.lineTo(W * 0.13, sandY - 70 * k); x.fill()
  }
  if (d.slott) { // a sand castle with towers and a flag
    const k = 0.8 + d.slott * 0.08, cx = W * 0.32
    x.fillStyle = '#d9b97a'
    x.fillRect(cx - 34 * k, sandY - 40 * k, 68 * k, 40 * k)
    for (const dx of [-34, 14]) { x.fillRect(cx + dx * k, sandY - 62 * k, 20 * k, 62 * k); for (let i = 0; i < 3; i++) x.fillRect(cx + (dx + i * 7) * k, sandY - 68 * k, 4 * k, 6 * k) }
    x.fillStyle = '#4a3b22'; x.beginPath(); x.arc(cx, sandY - 4 * k, 9 * k, Math.PI, 0); x.fill()
    x.strokeStyle = '#4a3b22'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx + 24 * k, sandY - 68 * k); x.lineTo(cx + 24 * k, sandY - 86 * k); x.stroke()
    x.fillStyle = '#e74c3c'; x.beginPath(); x.moveTo(cx + 24 * k, sandY - 86 * k); x.lineTo(cx + 24 * k + 12 + Math.sin(t * 3) * 3, sandY - 81 * k); x.lineTo(cx + 24 * k, sandY - 76 * k); x.fill()
  }
  if (d.korall) { // coral fans, swaying
    const cols = ['#ff6b81', '#ffa94d', '#c56cf0']
    for (let i = 0; i < Math.min(5, d.korall); i++) {
      const cx = W * (0.55 + i * 0.07), h = 30 + d.korall * 4 + i * 5
      x.strokeStyle = cols[i % 3]!; x.lineWidth = 4; x.lineCap = 'round'
      for (let b = -2; b <= 2; b++) { x.beginPath(); x.moveTo(cx, sandY); x.quadraticCurveTo(cx + b * 6 + Math.sin(t + i) * 3, sandY - h * 0.6, cx + b * 10 + Math.sin(t + i) * 5, sandY - h); x.stroke() }
    }
  }
  if (d.bobler) { // the bubbler: a little diver's helmet
    const cx = W * 0.9
    x.fillStyle = '#b7c4d1'; x.beginPath(); x.arc(cx, sandY - 22, 11, 0, Math.PI * 2); x.fill()
    x.fillStyle = '#4fc3f7'; x.beginPath(); x.arc(cx, sandY - 22, 6, 0, Math.PI * 2); x.fill()
    x.fillStyle = '#e1b12c'; x.fillRect(cx - 8, sandY - 12, 16, 12)
  }
  if (d.kiste) { // a treasure chest, lid open, gold showing
    const cx = W * 0.46, k = 0.9 + d.kiste * 0.06
    x.fillStyle = '#8b5a2b'; x.fillRect(cx - 16 * k, sandY - 16 * k, 32 * k, 16 * k)
    x.fillStyle = '#ffd700'; x.beginPath(); x.ellipse(cx, sandY - 16 * k, 14 * k, 5 * k, 0, 0, Math.PI * 2); x.fill()
    x.fillStyle = '#6d4520'; x.save(); x.translate(cx - 16 * k, sandY - 16 * k); x.rotate(-0.6); x.fillRect(0, -12 * k, 32 * k, 12 * k); x.restore()
  }
  if (d.lykt) { // a lantern hanging from above, glowing
    const cx = W * 0.72, y = H * 0.18 + Math.sin(t) * 3
    x.strokeStyle = 'rgba(255,255,255,0.4)'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx, y - 12); x.stroke()
    const g = x.createRadialGradient(cx, y, 2, cx, y, 40 + d.lykt * 6); g.addColorStop(0, 'rgba(255,230,140,0.7)'); g.addColorStop(1, 'rgba(255,230,140,0)')
    x.fillStyle = g; x.beginPath(); x.arc(cx, y, 40 + d.lykt * 6, 0, Math.PI * 2); x.fill()
    x.fillStyle = '#ffe08a'; x.fillRect(cx - 6, y - 10, 12, 18)
  }
}
function draw(t: number): void {
  const c = cv.value, tank = tk()
  if (!c) return
  const x = c.getContext('2d')
  if (!x) return
  const b = biome.value
  x.setTransform(dpr, 0, 0, dpr, 0, 0)
  const wg = x.createLinearGradient(0, 0, 0, H)
  wg.addColorStop(0, b.water[0]); wg.addColorStop(0.55, b.water[1]); wg.addColorStop(1, b.water[2])
  x.fillStyle = wg; x.fillRect(0, 0, W, H)
  x.save(); x.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 5; i++) {
    const cx = (0.15 + i * 0.2 + Math.sin(t * 0.3 + i) * 0.04) * W
    const lg = x.createLinearGradient(cx, 0, cx, H * 0.85)
    lg.addColorStop(0, b.id === 'dyp' ? 'rgba(120,200,255,0.06)' : 'rgba(255,255,255,0.16)'); lg.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = lg
    x.beginPath(); x.moveTo(cx - W * 0.03, 0); x.lineTo(cx + W * 0.03, 0); x.lineTo(cx + W * 0.09, H * 0.85); x.lineTo(cx - W * 0.05, H * 0.85); x.fill()
  }
  // each sea has its own floating things: glowing motes in the deep, embers by the volcano, snow in the fjord
  if (b.id === 'dyp' || b.id === 'vulkan' || b.id === 'is') {
    for (const m of motes) {
      const my = b.id === 'vulkan' ? (m.y - t * 0.03 + 10) % 1 : b.id === 'is' ? (m.y + t * 0.02) % 1 : m.y
      x.fillStyle = b.id === 'dyp' ? `rgba(0,230,255,${0.3 + 0.3 * Math.sin(t * 2 + m.ph)})` : b.id === 'vulkan' ? 'rgba(255,140,60,0.7)' : 'rgba(255,255,255,0.8)'
      x.beginPath(); x.arc((m.x + Math.sin(t * 0.5 + m.ph) * 0.01) * W, my * H, b.id === 'is' ? 2 : 1.6, 0, Math.PI * 2); x.fill()
    }
  }
  x.restore()
  const sandY = H * 0.88
  const sg = x.createLinearGradient(0, sandY, 0, H)
  sg.addColorStop(0, b.sand[0]); sg.addColorStop(1, b.sand[1])
  x.fillStyle = sg
  x.beginPath(); x.moveTo(0, sandY)
  for (let i = 0; i <= 20; i++) x.lineTo((i / 20) * W, sandY + Math.sin(i * 1.7) * 4)
  x.lineTo(W, H); x.lineTo(0, H); x.fill()
  if (b.id === 'vulkan') for (const vx of [0.18, 0.63]) { const g = x.createRadialGradient(vx * W, sandY, 2, vx * W, sandY, 30); g.addColorStop(0, `rgba(255,${Math.round(120 + Math.sin(t * 2) * 40)},40,0.9)`); g.addColorStop(1, 'rgba(255,80,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(vx * W, sandY, 30, Math.PI, 0); x.fill() }
  x.fillStyle = b.id === 'is' ? '#e2e8f0' : '#8a94a3'
  for (const [sx, sr] of [[0.22, 14], [0.27, 9], [0.71, 18], [0.78, 10]] as const) { x.beginPath(); x.ellipse(sx * W, sandY + 6, sr * 1.4, sr, 0, Math.PI, 0); x.fill() }
  for (const p of plants) {
    x.strokeStyle = b.plant[p.c]!
    x.lineWidth = b.id === 'tare' ? 8 : 5; x.lineCap = 'round'
    const tall = b.id === 'tare' ? 2.2 : 1
    for (let k = -1; k <= 1; k++) {
      x.beginPath(); x.moveTo(p.x * W + k * 5, sandY + 4)
      const sw = Math.sin(t * 1.1 + p.ph + k) * 14
      x.quadraticCurveTo(p.x * W + k * 8 + sw, sandY - p.h * H * 0.5 * tall, p.x * W + k * 10 + sw * 1.6, sandY - p.h * H * (0.9 + k * 0.1) * tall)
      x.stroke()
    }
  }
  drawDecor(x, t, sandY)
  x.fillStyle = 'rgba(255,255,255,0.35)'
  for (const bb of bubbles) { x.beginPath(); x.arc((bb.x + Math.sin(t * 2 + bb.y * 10) * 0.004) * W, bb.y * H, bb.r, 0, Math.PI * 2); x.fill() }
  if (tank) {
    // a chest in the sand, glinting
    if (tank.chest) {
      const cx = tank.chest.x * W, cy = sandY + 2, bob = Math.sin(t * 4) * 1.5
      const g = x.createRadialGradient(cx, cy - 10, 2, cx, cy - 10, 34); g.addColorStop(0, 'rgba(255,215,0,0.55)'); g.addColorStop(1, 'rgba(255,215,0,0)')
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy - 10, 34, 0, Math.PI * 2); x.fill()
      x.fillStyle = '#8b5a2b'; x.fillRect(cx - 15, cy - 18 + bob, 30, 16)
      x.fillStyle = '#6d4520'; x.fillRect(cx - 16, cy - 24 + bob, 32, 8)
      x.fillStyle = '#ffd700'; x.fillRect(cx - 3, cy - 20 + bob, 6, 7)
    }
    x.fillStyle = '#9b6b3a'
    for (const p of tank.pellets) { x.beginPath(); x.arc(p.x * W, p.y * H, 3.2, 0, Math.PI * 2); x.fill() }
    for (const f of [...tank.s.fish].sort((a, bb) => fishSize(bb) - fishSize(a))) drawFish(x, f, t)
    for (const co of tank.coins) {
      const cx = co.x * W, cy = co.y * H, r = 10 + Math.min(6, Math.log10(co.value + 1) * 1.8)
      const sq = Math.abs(Math.cos(t * 3 + co.id))
      x.globalAlpha = co.age > 20 ? Math.max(0, (25 - co.age) / 5) : 1
      x.fillStyle = '#b8860b'; x.beginPath(); x.ellipse(cx, cy, r * Math.max(0.25, sq), r, 0, 0, Math.PI * 2); x.fill()
      x.fillStyle = '#ffd700'; x.beginPath(); x.ellipse(cx, cy, r * Math.max(0.2, sq) * 0.8, r * 0.8, 0, 0, Math.PI * 2); x.fill()
      x.fillStyle = 'rgba(255,255,255,0.8)'; x.beginPath(); x.arc(cx - r * 0.25 * sq, cy - r * 0.3, r * 0.18, 0, Math.PI * 2); x.fill()
      x.globalAlpha = 1
    }
    // a name tag over the fish you tapped
    if (tag && simT < tag.until && tank.s.fish.includes(tag.f)) {
      const f = tag.f, sp = speciesOf(f.sp)
      const label = `${f.name ? `${f.name} · ` : ''}${sp.name}${f.variant !== 'normal' ? ` (${f.variant})` : ''} · nivå ${fishLevel(f.xp)}`
      x.font = '600 13px system-ui, sans-serif'
      const w = x.measureText(label).width + 16, tx = Math.min(W - w - 4, Math.max(4, f.x * W - w / 2)), ty = Math.max(4, f.y * H - fishSize(f) * W - 30)
      x.fillStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.roundRect(tx, ty, w, 22, 11); x.fill()
      x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText(label, tx + 8, ty + 15)
    }
    x.font = 'bold 15px system-ui, sans-serif'; x.textAlign = 'center'
    for (const fl of floats) { x.globalAlpha = Math.max(0, 1 - fl.age); x.fillStyle = fl.color; x.fillText(fl.text, fl.x * W, fl.y * H - fl.age * 40); x.globalAlpha = 1 }
    for (const sp of sparks) { x.globalAlpha = Math.max(0, 1 - sp.age); x.fillStyle = sp.color; x.beginPath(); x.arc(sp.x * W, sp.y * H, 2.2, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1 }
    if (!tank.s.fish.length) {
      x.fillStyle = 'rgba(255,255,255,0.92)'; x.font = '600 16px system-ui, sans-serif'; x.textAlign = 'center'
      x.fillText(mine.value ? `${b.name} – tanken er tom. Kjøp en guppy under!` : 'Ingen fisk her ennå', W / 2, H * 0.45)
    }
  }
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
  const t = tk()
  if (t) {
    const ev = step(t, dt)
    if (ev.collected || ev.levelUp) afterCollect()
    if (ev.fedFish && mine.value) scheduleSave(props.id, 15000)
    for (const f of ev.grew) { floats.push({ x: f.x, y: f.y, text: `Nivå ${fishLevel(f.xp)}!`, age: 0, color: '#9ef0ff' }); if (fishLevel(f.xp) % 5 === 0) say(`${f.name || speciesOf(f.sp).name} er nivå ${fishLevel(f.xp)}`, 'Den tjener mer for hvert nivå', 'info') }
    if (ev.event) { const e = EVENTS[ev.event]; say(e.name, e.text, 'event') }
    if (ev.chest) say('En skattekiste i sanden!', 'Trykk på den før den forsvinner', 'rare')
  }
  for (const bb of bubbles) { bb.y -= bb.v * dt; if (bb.y < -0.02) { bb.y = 1.02; bb.x = Math.random() < 0.5 ? 0.92 + Math.random() * 0.04 : Math.random() } }
  for (const fl of floats) fl.age += dt
  while (floats.length && floats[0]!.age > 1) floats.shift()
  for (const sp of sparks) { sp.age += dt * 1.4; sp.x += sp.vx * dt; sp.y += sp.vy * dt }
  for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i]!.age > 1) sparks.splice(i, 1)
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

function swatch(sp: Species, variant = 'normal'): Record<string, string> { return variant === 'gull' ? { '--c1': '#ffd700', '--c2': '#ff9f1a' } : { '--c1': sp.color, '--c2': sp.color2 } }
const TABS: { id: Tab; label: string; icon: typeof Fish }[] = [
  { id: 'fisk', label: 'Fisk', icon: Fish }, { id: 'tank', label: 'Tanken', icon: Home }, { id: 'pynt', label: 'Pynt', icon: Castle }, { id: 'opp', label: 'Oppgraderinger', icon: ArrowUpCircle },
  { id: 'oppdrag', label: 'Oppdrag', icon: ScrollText }, { id: 'perler', label: 'Perler', icon: Gem }, { id: 'bok', label: 'Fiskeboka', icon: BookOpen }, { id: 'trofeer', label: 'Trofeer', icon: Trophy },
]
const pct = (n: number): string => `${(Math.round(n * 1000) / 10).toLocaleString('nb-NO')} %`
const growth = (f: FishT): number => { const l = fishLevel(f.xp); if (l >= FISH_MAX) return 100; const a = xpForFishLevel(l), b = xpForFishLevel(l + 1); return Math.round(((f.xp - a) / (b - a)) * 100) }
</script>

<template>
  <section ref="wrap" class="aq" :class="{ big }" aria-label="Akvariet – et spill">
    <header class="hud">
      <span class="money" title="Mynter"><Coins :size="18" aria-hidden="true" /><b data-test="coins">{{ fmtCoins(s?.coins ?? 0) }}</b><small>{{ fmtCoins(rate) }}/s{{ full > rate ? ` (${fmtCoins(full)} mette)` : '' }}</small></span>
      <span v-if="s && s.pearlsEver" class="pearls" :title="`Perler: +${s.pearlsEver * 4} % på alt, for alltid`"><Gem :size="15" aria-hidden="true" /><b>{{ s.pearls }}</b></span>
      <span class="lvl" :title="level < MAX_LEVEL ? `${fmtCoins(toNext)} mynter til nivå ${level + 1}` : 'Høyeste nivå i dette havet!'">
        <b>Nivå {{ level }} <em>{{ biome.name }}</em></b><span class="bar"><i :style="{ width: `${Math.round(prog * 100)}%` }"></i></span><small>{{ level < MAX_LEVEL ? `${fmtCoins(toNext)} til neste` : 'Maks – flytt til et nytt hav!' }}</small>
      </span>
      <span class="fishn" :title="`${s?.fish.length ?? 0} av ${room} plasser`"><Fish :size="16" aria-hidden="true" />{{ s?.fish.length ?? 0 }}/{{ room }}<em v-if="hungry" class="hungry">{{ hungry }} sulten{{ hungry > 1 ? 'e' : '' }}</em></span>
      <button v-if="daily" class="giftb" type="button" title="Dagens gave" @click="gift"><Gift :size="16" />Dagens gave</button>
      <button class="ib" type="button" :aria-label="big ? 'Avslutt fullskjerm' : 'Fullskjerm'" @click="toggleBig"><Minimize2 v-if="big" :size="16" /><Maximize2 v-else :size="16" /></button>
    </header>

    <div class="tank">
      <canvas ref="cv" :class="{ play: mine }" aria-label="Akvariet. Trykk i vannet for å slippe fôr, på en mynt for å plukke den opp, på en kiste for å åpne den." @pointerdown="onTap"></canvas>
      <div v-if="event" class="event" :class="event.kind"><Timer :size="14" /><b>{{ EVENTS[event.kind].name }}</b> {{ EVENTS[event.kind].text }} <span class="eb"><i :style="{ width: `${(event.left / event.dur) * 100}%` }"></i></span></div>
      <transition name="pop">
        <div v-if="toast" class="toast" :class="toast.kind" role="status">
          <Trophy v-if="toast.kind === 'trophy'" :size="20" /><Sparkles v-else-if="toast.kind === 'level' || toast.kind === 'rare'" :size="20" /><Waves v-else-if="toast.kind === 'event'" :size="20" />
          <span><b>{{ toast.text }}</b><small v-if="toast.sub">{{ toast.sub }}</small></span>
        </div>
      </transition>
      <p v-if="mine && s && !s.stats.fed && s.fish.length" class="hint">Trykk i vannet for å gi fisken mat – mette fisker slipper mynter. Trykk på myntene!</p>
    </div>

    <nav class="tabs" role="tablist" aria-label="Spillet">
      <button v-for="tb in TABS" :key="tb.id" role="tab" :aria-selected="tab === tb.id" :class="{ on: tab === tb.id }" @click="tab = tb.id">
        <component :is="tb.icon" :size="15" />{{ tb.label }}
        <small v-if="tb.id === 'trofeer'">{{ s?.trophies.length ?? 0 }}/{{ TROPHIES.length }}</small>
        <small v-else-if="tb.id === 'bok'">{{ dexCount }}/{{ SPECIES.length * 3 }}</small>
        <i v-else-if="tb.id === 'oppdrag' && questsReady" class="dot">{{ questsReady }}</i>
        <i v-else-if="tb.id === 'perler' && gain" class="dot">!</i>
      </button>
    </nav>

    <div v-if="s" class="shop">
      <!-- fish to buy -->
      <template v-if="tab === 'fisk'">
        <button v-for="sp in SPECIES" :key="sp.id" class="card" :class="{ locked: level < sp.unlock }" :disabled="!mine || !canBuyFish(s, sp.id).ok" :title="canBuyFish(s, sp.id).ok ? `Kjøp ${sp.name}` : (canBuyFish(s, sp.id) as { why: string }).why" @click="buy(sp)">
          <span class="sw" :class="sp.pattern" :style="swatch(sp)"><i></i></span>
          <b>{{ sp.name }}</b>
          <small v-if="level < sp.unlock"><Lock :size="11" /> Nivå {{ sp.unlock }}</small>
          <small v-else>{{ fmtCoins(sp.rate) }}/s og opp</small>
          <span class="price"><Coins :size="12" />{{ fmtCoins(sp.cost) }}</span>
        </button>
        <p class="muted">Sjanse for sjelden fisk: skinnende {{ pct(luck.skinnende) }}, gull {{ pct(luck.gull) }}.<template v-if="nextUnlock"> Neste art: <b>{{ nextUnlock.name }}</b> på nivå {{ nextUnlock.unlock }}.</template></p>
      </template>

      <!-- my fish: level, growth, name, sell -->
      <template v-else-if="tab === 'tank'">
        <p v-if="!s.fish.length" class="muted">Ingen fisk ennå.</p>
        <div v-for="f in [...s.fish].sort((a, b) => fishRate(s!, b) - fishRate(s!, a))" :key="f.id" class="mine-fish" :class="f.variant">
          <span class="sw" :class="speciesOf(f.sp).pattern" :style="swatch(speciesOf(f.sp), f.variant)"><i></i></span>
          <span class="who"><b>{{ f.name || speciesOf(f.sp).name }}</b><small>{{ f.name ? speciesOf(f.sp).name + ' · ' : '' }}{{ f.variant !== 'normal' ? f.variant + ' · ' : '' }}{{ fmtCoins(fishRate(s, f)) }}/s</small></span>
          <span class="flv" :title="fishLevel(f.xp) < FISH_MAX ? `${Math.ceil(xpForFishLevel(fishLevel(f.xp) + 1) - f.xp)} måltider til neste nivå` : 'Fullvoksen'">
            <b>Nv {{ fishLevel(f.xp) }}</b><span class="hb"><i :style="{ width: `${growth(f)}%`, background: '#4fc3f7' }"></i></span>
          </span>
          <span class="hb" :title="`Mett: ${Math.round(f.hunger * 100)} %`"><i :style="{ width: `${Math.round(f.hunger * 100)}%`, background: f.hunger < 0.2 ? '#e5484d' : '#30a46c' }"></i></span>
          <button v-if="mine" class="ib" type="button" :aria-label="`Gi navn til ${speciesOf(f.sp).name}`" title="Gi navn" @click="rename(f)"><Pencil :size="14" /></button>
          <button v-if="mine" class="ib" type="button" :aria-label="`Selg ${speciesOf(f.sp).name}`" :title="`Selg for ${fmtCoins(sellValue(f))}`" @click="sell(f)"><X :size="14" /></button>
        </div>
      </template>

      <!-- decorations -->
      <template v-else-if="tab === 'pynt'">
        <button v-for="d in DECORS" :key="d.id" class="card wide" :class="{ locked: level < d.unlock }" :disabled="!mine || !canDecor(s, d.id).ok" @click="decorate(d.id)">
          <b>{{ d.name }} <small>{{ s.decor[d.id] }}/{{ d.max }}</small></b>
          <small>{{ s.decor[d.id] >= d.max ? 'Helt oppgradert' : level < d.unlock ? `Låses opp på nivå ${d.unlock}` : d.text(s.decor[d.id]) }}</small>
          <span v-if="s.decor[d.id] < d.max" class="price"><Coins :size="12" />{{ fmtCoins(d.cost(s.decor[d.id])) }}</span><span v-else class="price ok"><Check :size="12" /></span>
        </button>
      </template>

      <template v-else-if="tab === 'opp'">
        <button v-for="u in UPGRADES" :key="u.id" class="card wide" :class="{ locked: level < u.unlock }" :disabled="!mine || !canUpgrade(s, u.id).ok" @click="up(u.id)">
          <b>{{ u.name }} <small>{{ s.up[u.id] }}/{{ u.max }}</small></b>
          <small>{{ s.up[u.id] >= u.max ? 'Helt oppgradert' : level < u.unlock ? `Låses opp på nivå ${u.unlock}` : u.text(s.up[u.id]) }}</small>
          <span v-if="s.up[u.id] < u.max" class="price"><Coins :size="12" />{{ fmtCoins(u.cost(s.up[u.id])) }}</span><span v-else class="price ok"><Check :size="12" /></span>
        </button>
      </template>

      <!-- quests -->
      <template v-else-if="tab === 'oppdrag'">
        <div v-for="q in s.quests" :key="q.id" class="quest" :class="{ done: questDone(s, q) }">
          <span class="qt"><b>{{ q.text }}</b><small>Belønning: {{ fmtCoins(q.reward) }} mynter{{ q.pearls ? ` + ${q.pearls} perle` : '' }}</small><span class="hb"><i :style="{ width: `${Math.round(questProgress(s, q) * 100)}%`, background: '#a29bfe' }"></i></span></span>
          <button v-if="questDone(s, q)" class="btn primary small" type="button" :disabled="!mine" @click="claim(q.id)"><Gift :size="14" />Hent</button>
          <button v-else-if="mine" class="ib" type="button" :title="`Bytt oppdrag (${fmtCoins(rerollCost(s))} mynter)`" :aria-label="`Bytt oppdraget «${q.text}»`" @click="reroll(q.id)"><RefreshCw :size="14" /></button>
        </div>
        <p class="muted">{{ s.stats.quests }} oppdrag fullført. Et nytt kommer straks et er hentet.</p>
      </template>

      <!-- pearls: a new sea, and perks that last -->
      <template v-else-if="tab === 'perler'">
        <div class="sea">
          <span class="seas"><span v-for="(bm, i) in BIOMES" :key="bm.id" class="si" :class="{ here: i === Math.min(s.prestiges, BIOMES.length - 1), done: i < s.prestiges }" :style="{ background: `linear-gradient(${bm.water[0]}, ${bm.water[2]})` }" :title="`${bm.name}: ${bm.text} (×${bm.bonus})`"></span></span>
          <p><b>{{ biome.name }}</b> – {{ biome.text }}. Alt gir ×{{ biome.bonus }} her{{ s.pearlsEver ? `, og perlene dine +${s.pearlsEver * 4} %` : '' }}.</p>
          <p v-if="level < PRESTIGE_LEVEL" class="muted">Fra nivå {{ PRESTIGE_LEVEL }} kan du flytte til et nytt hav: du starter på nytt, men får perler som gjør alt raskere – for alltid.</p>
          <button v-else class="btn primary" type="button" :disabled="!mine || !gain" @click="moveSea"><Waves :size="15" />Flytt til {{ biomeOf(s.prestiges + 1).name }} (+{{ gain }} perler)</button>
        </div>
        <button v-for="p in PERKS" :key="p.id" class="card wide" :disabled="!mine || !canPerk(s, p.id).ok" @click="perk(p.id)">
          <b>{{ p.name }} <small>{{ s.perks[p.id] }}/{{ p.max }}</small></b>
          <small>{{ s.perks[p.id] >= p.max ? 'Helt oppgradert' : p.text(s.perks[p.id]) }}</small>
          <span v-if="s.perks[p.id] < p.max" class="price pearl"><Gem :size="12" />{{ p.cost(s.perks[p.id]) }}</span><span v-else class="price ok"><Check :size="12" /></span>
        </button>
      </template>

      <!-- the fish book -->
      <template v-else-if="tab === 'bok'">
        <div v-for="sp in SPECIES" :key="sp.id" class="dex" :class="{ seen: dexHas(sp, 1) }">
          <span class="sw" :class="sp.pattern" :style="dexHas(sp, 1) ? swatch(sp) : { '--c1': '#556', '--c2': '#445' }"><i></i></span>
          <span class="who"><b>{{ dexHas(sp, 1) ? sp.name : '???' }}</b><small>{{ dexHas(sp, 1) ? sp.fact : `Låses opp på nivå ${sp.unlock}` }}</small></span>
          <span class="vs"><i v-for="v in VARIANTS" :key="v.id" :class="[v.id, { have: dexHas(sp, v.bit) }]" :title="v.name"></i></span>
        </div>
      </template>

      <template v-else>
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
.pearls { display: inline-flex; align-items: center; gap: 4px; color: #a29bfe; font-weight: 800; } .pearls b { color: var(--text); }
.lvl { flex: 1; min-width: 180px; display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 8px; align-items: center; }
.lvl b { font-size: 0.9rem; } .lvl b em { font-style: normal; font-weight: 600; font-size: 0.72rem; color: var(--text-3); margin-left: 4px; } .lvl small { grid-column: 2; font-size: 0.72rem; color: var(--text-3); }
.bar { height: 8px; border-radius: 99px; background: var(--glass-border); overflow: hidden; } .bar i { display: block; height: 100%; background: linear-gradient(90deg, #4fc3f7, #7b2ff7); border-radius: 99px; transition: width 0.3s; }
.fishn { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; font-size: 0.85rem; color: var(--text-2); }
.hungry { font-style: normal; font-weight: 600; font-size: 0.72rem; color: #e5484d; margin-left: 4px; }
.giftb { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 99px; background: linear-gradient(135deg, #ff6b81, #ffa94d); color: #fff; font-weight: 800; font-size: 0.8rem; animation: wiggle 1.6s ease-in-out infinite; }
@keyframes wiggle { 0%, 100% { transform: rotate(0); } 10% { transform: rotate(-6deg); } 20% { transform: rotate(6deg); } 30% { transform: rotate(0); } }
.ib { all: unset; cursor: pointer; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: var(--text-2); flex: none; } .ib:hover { background: var(--glass-border); }
.tank { position: relative; }
canvas { display: block; width: 100%; aspect-ratio: 16 / 9; border-radius: 18px; box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.25), 0 10px 30px rgba(0, 40, 80, 0.25); touch-action: manipulation; }
.aq.big canvas { aspect-ratio: auto; height: min(62vh, 56vw); }
canvas.play { cursor: crosshair; }
.event { position: absolute; left: 12px; bottom: 12px; display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 99px; color: #fff; font-size: 0.78rem; background: rgba(0, 0, 0, 0.5); pointer-events: none; }
.event.gullregn { background: linear-gradient(90deg, #b8860b, #ffd700); color: #2b1d00; } .event.matfest { background: linear-gradient(90deg, #30a46c, #8fe3b0); color: #062; } .event.stimfeber { background: linear-gradient(90deg, #7b2ff7, #ff6b81); }
.eb { width: 60px; height: 4px; border-radius: 99px; background: rgba(255, 255, 255, 0.35); overflow: hidden; } .eb i { display: block; height: 100%; background: currentColor; }
.hint { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); margin: 0; padding: 6px 12px; border-radius: 99px; background: rgba(0, 0, 0, 0.45); color: #fff; font-size: 0.8rem; white-space: nowrap; pointer-events: none; animation: bob 2s ease-in-out infinite; }
@keyframes bob { 50% { transform: translate(-50%, -4px); } }
.toast { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 9px 16px; border-radius: 14px; background: rgba(10, 30, 60, 0.82); color: #fff; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3); pointer-events: none; max-width: 90%; }
.toast span { display: grid; } .toast small { opacity: 0.85; font-size: 0.75rem; }
.toast.level { background: linear-gradient(135deg, #4fc3f7, #7b2ff7); } .toast.trophy, .toast.rare { background: linear-gradient(135deg, #b8860b, #ffd700); color: #2b1d00; } .toast.event { background: linear-gradient(135deg, #0984e3, #00cec9); }
.pop-enter-active { transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s; } .pop-leave-active { transition: opacity 0.3s; }
.pop-enter-from { transform: translate(-50%, -12px) scale(0.85); opacity: 0; } .pop-leave-to { opacity: 0; }
.tabs { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.tabs::-webkit-scrollbar { display: none; }
.tabs button { all: unset; cursor: pointer; flex: none; position: relative; display: inline-flex; align-items: center; gap: 5px; padding: 7px 11px; border-radius: 999px; font-size: 0.84rem; font-weight: 600; color: var(--text-2); }
.tabs button.on { background: var(--accent-soft); color: var(--accent); } .tabs small { opacity: 0.7; }
.dot { font-style: normal; min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box; border-radius: 99px; background: #e5484d; color: #fff; font-size: 0.66rem; font-weight: 800; display: grid; place-items: center; }
.shop { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.card { all: unset; box-sizing: border-box; cursor: pointer; position: relative; display: grid; gap: 3px; padding: 10px 10px 30px; border-radius: 14px; border: 1px solid var(--glass-border); background: var(--glass-strong); transition: transform 0.2s, border-color 0.2s; }
.card:hover:not(:disabled) { transform: translateY(-2px); border-color: var(--accent); }
.card:disabled { cursor: default; opacity: 0.6; } .card.locked { filter: grayscale(0.8); }
.card.wide { grid-column: span 2; } .card b small { font-weight: 600; color: var(--text-3); }
.card small { font-size: 0.74rem; color: var(--text-3); display: inline-flex; align-items: center; gap: 3px; }
.price { position: absolute; left: 10px; bottom: 8px; display: inline-flex; align-items: center; gap: 3px; font-weight: 800; font-size: 0.8rem; color: #b8860b; } .price.ok { color: #30a46c; } .price.pearl { color: #a29bfe; }
.sw { position: relative; width: 46px; height: 22px; flex: none; } .sw::before { content: ''; position: absolute; inset: 2px 4px 2px 12px; border-radius: 50%; background: linear-gradient(var(--c1), var(--c2)); }
.sw::after { content: ''; position: absolute; left: 0; top: 4px; border-style: solid; border-width: 7px 12px 7px 0; border-color: transparent var(--c2) transparent transparent; transform: scaleX(-1); }
.sw.stripes::before { background: repeating-linear-gradient(90deg, var(--c1) 0 7px, var(--c2) 7px 10px); } .sw.spots::before { background: radial-gradient(circle at 40% 40%, var(--c2) 0 3px, transparent 4px), radial-gradient(circle at 70% 60%, var(--c2) 0 3px, transparent 4px), var(--c1); }
.sw.glow::before { box-shadow: 0 0 10px var(--c2); }
.sw i { position: absolute; right: 9px; top: 7px; width: 4px; height: 4px; border-radius: 50%; background: #111; z-index: 1; }
.mine-fish, .quest, .dex, .trophy { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 14px; }
.mine-fish.skinnende { background: linear-gradient(90deg, rgba(255, 255, 255, 0.5), transparent); } .mine-fish.gull { background: linear-gradient(90deg, rgba(255, 215, 0, 0.25), transparent); }
.who { display: grid; min-width: 120px; flex: 1; } .who b { font-size: 0.86rem; } .who small { font-size: 0.72rem; color: var(--text-3); }
.flv { display: grid; gap: 2px; width: 70px; font-size: 0.72rem; }
.hb { flex: 1; min-width: 50px; height: 6px; border-radius: 99px; background: var(--glass-border); overflow: hidden; display: block; } .hb i { display: block; height: 100%; border-radius: 99px; }
.quest { border: 1px solid var(--glass-border); } .quest.done { border-color: #a29bfe; background: rgba(162, 155, 254, 0.12); }
.qt { flex: 1; display: grid; gap: 3px; } .qt small { font-size: 0.74rem; color: var(--text-3); }
.sea { grid-column: 1 / -1; display: grid; gap: 8px; padding: 12px; border-radius: 16px; background: var(--glass-strong); }
.sea p { margin: 0; font-size: 0.86rem; }
.seas { display: flex; gap: 6px; } .si { width: 34px; height: 22px; border-radius: 8px; opacity: 0.45; } .si.done { opacity: 0.8; } .si.here { opacity: 1; outline: 2px solid var(--accent); outline-offset: 2px; }
.dex { opacity: 0.6; } .dex.seen { opacity: 1; }
.vs { display: flex; gap: 4px; } .vs i { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--glass-border); }
.vs i.normal.have { background: #4fc3f7; border-color: #4fc3f7; } .vs i.skinnende.have { background: #fff; border-color: #c8d6e5; box-shadow: 0 0 6px #fff; } .vs i.gull.have { background: #ffd700; border-color: #b8860b; box-shadow: 0 0 6px #ffd700; }
.trophy { border: 1px solid var(--glass-border); opacity: 0.55; }
.trophy.won { opacity: 1; background: color-mix(in srgb, var(--t1) 12%, transparent); border-color: color-mix(in srgb, var(--t1) 60%, transparent); }
.cup { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; color: var(--text-3); background: var(--glass-strong); }
.trophy.won .cup { color: var(--t2); background: radial-gradient(circle at 35% 30%, #fff, var(--t1)); box-shadow: 0 0 14px color-mix(in srgb, var(--t1) 60%, transparent); }
.tt { flex: 1; display: grid; } .tt small { font-size: 0.74rem; color: var(--text-3); }
.in { display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; font-weight: 700; color: #30a46c; } .lk { color: var(--text-3); }
.muted { grid-column: 1 / -1; margin: 0; color: var(--text-3); font-size: 0.82rem; }
@media (max-width: 520px) { .card.wide { grid-column: 1 / -1; } .shop { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); } .flv { width: 52px; } }
</style>
