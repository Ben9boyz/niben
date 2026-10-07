// «Akvariet» – the first mini game. Feed the fish; a fed fish drops coins; coins buy new and better fish and upgrades for the
// tank. A hundred levels, trophies on the way that can be put in the room. This file is only the rules and the simulation –
// no drawing – so the page (a canvas) and the 3D room can both show the same tank, and the tests can play it.
//
// The tank is 1 × 1 (x to the right, y downward). Time is in seconds.

export interface Species {
  id: string
  name: string
  cost: number
  /** coins a second while it is fed */
  rate: number
  /** length, as a share of the tank's width */
  size: number
  color: string
  color2: string
  pattern: 'plain' | 'stripes' | 'spots' | 'fins' | 'glow'
  /** the level it can be bought from */
  unlock: number
  /** how fast it gets hungry (hunger lost a second) */
  hunger: number
  /** how fast it swims (tank widths a second) */
  speed: number
}

export const SPECIES: Species[] = [
  { id: 'guppy', name: 'Guppy', cost: 5, rate: 0.5, size: 0.05, color: '#ff9f43', color2: '#ffd166', pattern: 'fins', unlock: 1, hunger: 1 / 70, speed: 0.12 },
  { id: 'neon', name: 'Neontetra', cost: 30, rate: 2, size: 0.045, color: '#2e86de', color2: '#ff4757', pattern: 'stripes', unlock: 2, hunger: 1 / 75, speed: 0.15 },
  { id: 'platy', name: 'Platy', cost: 120, rate: 6, size: 0.06, color: '#ff6b6b', color2: '#feca57', pattern: 'plain', unlock: 4, hunger: 1 / 80, speed: 0.11 },
  { id: 'klovn', name: 'Klovnefisk', cost: 450, rate: 18, size: 0.07, color: '#ff7f11', color2: '#ffffff', pattern: 'stripes', unlock: 7, hunger: 1 / 85, speed: 0.1 },
  { id: 'skalar', name: 'Skalar', cost: 1600, rate: 55, size: 0.085, color: '#dfe6e9', color2: '#2d3436', pattern: 'stripes', unlock: 11, hunger: 1 / 90, speed: 0.08 },
  { id: 'diskus', name: 'Diskus', cost: 6000, rate: 170, size: 0.09, color: '#e17055', color2: '#0984e3', pattern: 'spots', unlock: 16, hunger: 1 / 95, speed: 0.07 },
  { id: 'kampfisk', name: 'Kampfisk', cost: 22000, rate: 520, size: 0.08, color: '#6c5ce7', color2: '#fd79a8', pattern: 'fins', unlock: 22, hunger: 1 / 100, speed: 0.09 },
  { id: 'koi', name: 'Koi', cost: 80000, rate: 1600, size: 0.12, color: '#ffffff', color2: '#e84118', pattern: 'spots', unlock: 29, hunger: 1 / 105, speed: 0.07 },
  { id: 'kule', name: 'Kulefisk', cost: 300000, rate: 5000, size: 0.09, color: '#f6e58d', color2: '#7f8c8d', pattern: 'spots', unlock: 37, hunger: 1 / 110, speed: 0.06 },
  { id: 'sjohest', name: 'Sjøhest', cost: 1.1e6, rate: 15000, size: 0.08, color: '#f9ca24', color2: '#f0932b', pattern: 'plain', unlock: 46, hunger: 1 / 115, speed: 0.04 },
  { id: 'rokke', name: 'Rokke', cost: 4e6, rate: 48000, size: 0.14, color: '#596275', color2: '#c8d6e5', pattern: 'spots', unlock: 56, hunger: 1 / 120, speed: 0.06 },
  { id: 'hai', name: 'Revhai', cost: 15e6, rate: 150000, size: 0.18, color: '#8395a7', color2: '#dfe4ea', pattern: 'plain', unlock: 67, hunger: 1 / 125, speed: 0.09 },
  { id: 'gull', name: 'Keisergullfisk', cost: 6e7, rate: 480000, size: 0.12, color: '#ffd32a', color2: '#ff9f1a', pattern: 'glow', unlock: 79, hunger: 1 / 130, speed: 0.07 },
  { id: 'drage', name: 'Dragefisk', cost: 2.5e8, rate: 1.6e6, size: 0.16, color: '#7bed9f', color2: '#a29bfe', pattern: 'glow', unlock: 91, hunger: 1 / 140, speed: 0.08 },
]
export const speciesOf = (id: string): Species => SPECIES.find((s) => s.id === id) ?? SPECIES[0]!

export const MAX_LEVEL = 100
/** Coins that have to be collected (all in all) to reach a level. Level 1 is where you start. */
export const coinsForLevel = (n: number): number => (n <= 1 ? 0 : Math.round(40 * (Math.pow(1.165, n - 1) - 1) / 0.165))
export function levelOf(total: number): number {
  let n = 1
  while (n < MAX_LEVEL && total >= coinsForLevel(n + 1)) n++
  return n
}
/** How far into the level (0..1). */
export function levelProgress(total: number): number {
  const n = levelOf(total)
  if (n >= MAX_LEVEL) return 1
  const a = coinsForLevel(n), b = coinsForLevel(n + 1)
  return Math.min(1, (total - a) / (b - a))
}

// ── upgrades ──
export interface Upgrade { id: UpgradeId; name: string; text: (lvl: number) => string; max: number; cost: (lvl: number) => number; unlock: number }
export type UpgradeId = 'tank' | 'food' | 'feeder' | 'magnet'
export const UPGRADES: Upgrade[] = [
  { id: 'tank', name: 'Større tank', text: (l) => `Plass til ${maxFish(l + 1)} fisker`, max: 10, cost: (l) => Math.round(60 * Math.pow(3.6, l)), unlock: 2 },
  { id: 'food', name: 'Bedre fôr', text: (l) => `+${(l + 1) * 15} % mynter, fisken blir mettere`, max: 12, cost: (l) => Math.round(40 * Math.pow(3.2, l)), unlock: 3 },
  { id: 'feeder', name: 'Fôrautomat', text: (l) => `Fôrer av seg selv hvert ${feederEvery(l + 1)}. sekund – også når du er borte`, max: 6, cost: (l) => Math.round(400 * Math.pow(6, l)), unlock: 6 },
  { id: 'magnet', name: 'Myntmagnet', text: (l) => (l === 0 ? 'Plukker opp myntene av seg selv' : `Plukker opp ${l + 1} × så fort`), max: 4, cost: (l) => Math.round(900 * Math.pow(9, l)), unlock: 9 },
]
export const upgradeOf = (id: UpgradeId): Upgrade => UPGRADES.find((u) => u.id === id)!
export const maxFish = (tank: number): number => 4 + tank * 3
export const feederEvery = (lvl: number): number => (lvl <= 0 ? 0 : Math.max(6, Math.round(40 / lvl)))
const coinBonus = (food: number): number => 1 + food * 0.15

// ── trophies ──
export type Tier = 'bronse' | 'solv' | 'gull' | 'platina' | 'diamant' | 'legende'
export interface Trophy { id: string; name: string; text: string; tier: Tier; won: (s: TankState) => boolean }
export const TROPHIES: Trophy[] = [
  { id: 'first', name: 'Første fisk', text: 'Kjøp din første fisk', tier: 'bronse', won: (s) => s.stats.bought >= 1 },
  { id: 'lvl5', name: 'Akvarist', text: 'Nå nivå 5', tier: 'bronse', won: (s) => levelOf(s.total) >= 5 },
  { id: 'fed100', name: 'Matmor', text: 'Gi fisken mat 100 ganger', tier: 'bronse', won: (s) => s.stats.fed >= 100 },
  { id: 'lvl10', name: 'Fiskevenn', text: 'Nå nivå 10', tier: 'solv', won: (s) => levelOf(s.total) >= 10 },
  { id: 'full', name: 'Fullt hus', text: 'Fyll tanken helt opp', tier: 'solv', won: (s) => s.fish.length >= maxFish(s.up.tank) && s.up.tank >= 2 },
  { id: 'feeder', name: 'Automatisk', text: 'Kjøp en fôrautomat', tier: 'solv', won: (s) => s.up.feeder >= 1 },
  { id: 'lvl25', name: 'Rev-bygger', text: 'Nå nivå 25', tier: 'gull', won: (s) => levelOf(s.total) >= 25 },
  { id: 'koi', name: 'Koi-dammen', text: 'Ha tre koi samtidig', tier: 'gull', won: (s) => s.fish.filter((f) => f.sp === 'koi').length >= 3 },
  { id: 'million', name: 'Millionær', text: 'Samle en million mynter', tier: 'gull', won: (s) => s.total >= 1e6 },
  { id: 'lvl50', name: 'Havforsker', text: 'Nå nivå 50', tier: 'platina', won: (s) => levelOf(s.total) >= 50 },
  { id: 'shark', name: 'Hai i tanken', text: 'Kjøp en revhai', tier: 'platina', won: (s) => s.fish.some((f) => f.sp === 'hai') },
  { id: 'lvl75', name: 'Dyphavsdykker', text: 'Nå nivå 75', tier: 'diamant', won: (s) => levelOf(s.total) >= 75 },
  { id: 'billion', name: 'Skattkammer', text: 'Samle en milliard mynter', tier: 'diamant', won: (s) => s.total >= 1e9 },
  { id: 'dragon', name: 'Dragetemmer', text: 'Kjøp en dragefisk', tier: 'legende', won: (s) => s.fish.some((f) => f.sp === 'drage') },
  { id: 'lvl100', name: 'Havets hersker', text: 'Nå nivå 100', tier: 'legende', won: (s) => levelOf(s.total) >= MAX_LEVEL },
]
export const TIER_COLORS: Record<Tier, [string, string]> = {
  bronse: ['#cd7f32', '#8a5a2b'], solv: ['#d7dde4', '#8e99a6'], gull: ['#ffd700', '#b8860b'],
  platina: ['#e5f1f8', '#7fa6bf'], diamant: ['#b9f2ff', '#4fc3f7'], legende: ['#d9a7ff', '#7b2ff7'],
}
export const TIER_NAMES: Record<Tier, string> = { bronse: 'Bronse', solv: 'Sølv', gull: 'Gull', platina: 'Platina', diamant: 'Diamant', legende: 'Legende' }
export const trophyOf = (id: string): Trophy | undefined => TROPHIES.find((t) => t.id === id)

// ── the state (what is saved) and the moving things (what is not) ──
export interface Fish { id: string; sp: string; hunger: number; x: number; y: number; vx: number; vy: number; coinT: number; name?: string }
export interface TankState {
  v: 1
  coins: number
  /** every coin ever collected – decides the level */
  total: number
  fish: Fish[]
  up: Record<UpgradeId, number>
  trophies: string[]
  /** the trophies standing in the room */
  placed: string[]
  stats: { fed: number; bought: number; collected: number }
  /** when it was last played (ms) – for what is earned while away */
  last: number
}
export interface Coin { x: number; y: number; value: number; age: number; id: number }
export interface Pellet { x: number; y: number; id: number }
export interface Tank { s: TankState; coins: Coin[]; pellets: Pellet[]; nextId: number; feederT: number; magnetT: number }

let seq = 0
const uid = (): string => Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5)
const rnd = (a: number, b: number): number => a + Math.random() * (b - a)

export function newState(now = Date.now()): TankState {
  return { v: 1, coins: 15, total: 0, fish: [], up: { tank: 0, food: 0, feeder: 0, magnet: 0 }, trophies: [], placed: [], stats: { fed: 0, bought: 0, collected: 0 }, last: now }
}
const num = (v: unknown, d = 0, lo = 0, hi = 1e15): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)
/** A saved state read back (anything missing or odd is set right). */
export function fromSaved(raw: unknown, now = Date.now()): TankState {
  const s = newState(now)
  if (!raw || typeof raw !== 'object') return s
  const r = raw as Partial<TankState> & { up?: Partial<Record<UpgradeId, number>>; stats?: Partial<TankState['stats']> }
  s.coins = num(r.coins, 15)
  s.total = num(r.total)
  for (const u of UPGRADES) s.up[u.id] = Math.round(num(r.up?.[u.id], 0, 0, u.max))
  s.fish = (Array.isArray(r.fish) ? r.fish : []).slice(0, maxFish(s.up.tank)).filter((f): f is Fish => !!f && typeof f === 'object' && SPECIES.some((x) => x.id === (f as Fish).sp)).map((f) => ({
    id: typeof f.id === 'string' ? f.id.slice(0, 24) : uid(), sp: f.sp, hunger: num(f.hunger, 0.6, 0, 1), x: rnd(0.15, 0.85), y: rnd(0.2, 0.7), vx: rnd(-1, 1), vy: 0, coinT: rnd(0, 4),
    ...(typeof f.name === 'string' && f.name.trim() ? { name: f.name.trim().slice(0, 20) } : {}),
  }))
  s.trophies = (Array.isArray(r.trophies) ? r.trophies : []).filter((t): t is string => typeof t === 'string' && !!trophyOf(t))
  s.placed = (Array.isArray(r.placed) ? r.placed : []).filter((t): t is string => typeof t === 'string' && s.trophies.includes(t))
  s.stats = { fed: num(r.stats?.fed), bought: num(r.stats?.bought), collected: num(r.stats?.collected) }
  s.last = num(r.last, now, 0, now)
  return s
}
/** What is saved (the moving bits – where a fish swims – are left out). */
export function toSaved(s: TankState): TankState {
  return { ...s, fish: s.fish.map((f) => ({ id: f.id, sp: f.sp, hunger: Math.round(f.hunger * 1000) / 1000, x: 0, y: 0, vx: 0, vy: 0, coinT: 0, ...(f.name ? { name: f.name } : {}) })) }
}
export const makeTank = (s: TankState): Tank => ({ s, coins: [], pellets: [], nextId: 1, feederT: 0, magnetT: 0 })

/** Coins a second the tank makes right now (fed fish only). */
export function earningRate(s: TankState): number {
  return s.fish.reduce((a, f) => a + (f.hunger > 0 ? speciesOf(f.sp).rate : 0), 0) * coinBonus(s.up.food)
}
/** The coins a second the tank makes when every fish is fed. */
export const fullRate = (s: TankState): number => s.fish.reduce((a, f) => a + speciesOf(f.sp).rate, 0) * coinBonus(s.up.food)

/** Coming back: what the fish made while you were away (at most 8 hours, half as fast as when you are there – and only as long
 *  as they had food: a feeder keeps them fed the whole time). Returns the coins added. */
export function catchUp(s: TankState, now = Date.now()): number {
  const away = Math.min(8 * 3600, Math.max(0, (now - s.last) / 1000))
  s.last = now
  if (away < 30 || !s.fish.length) return 0
  let earned = 0
  for (const f of s.fish) {
    const sp = speciesOf(f.sp)
    const fedFor = s.up.feeder > 0 ? away : Math.min(away, f.hunger / sp.hunger)
    earned += sp.rate * coinBonus(s.up.food) * fedFor * 0.5
    f.hunger = s.up.feeder > 0 ? Math.max(f.hunger, 0.6) : Math.max(0, f.hunger - sp.hunger * away)
  }
  earned = Math.floor(earned)
  s.coins += earned
  s.total += earned
  return earned
}

// ── what the player does ──
export type Result = { ok: true } | { ok: false; why: string }
export function canBuyFish(s: TankState, id: string): Result {
  const sp = speciesOf(id)
  if (levelOf(s.total) < sp.unlock) return { ok: false, why: `Låses opp på nivå ${sp.unlock}` }
  if (s.fish.length >= maxFish(s.up.tank)) return { ok: false, why: 'Tanken er full – kjøp en større' }
  if (s.coins < sp.cost) return { ok: false, why: 'Ikke nok mynter' }
  return { ok: true }
}
export function buyFish(t: Tank, id: string): Result {
  const r = canBuyFish(t.s, id)
  if (!r.ok) return r
  const sp = speciesOf(id)
  t.s.coins -= sp.cost
  t.s.fish.push({ id: uid(), sp: sp.id, hunger: 0.8, x: rnd(0.2, 0.8), y: 0.05, vx: rnd(-1, 1), vy: 0.3, coinT: rnd(0, 3) })
  t.s.stats.bought++
  return { ok: true }
}
/** Selling a fish back gives half of what it cost. */
export function sellFish(t: Tank, fishId: string): number {
  const i = t.s.fish.findIndex((f) => f.id === fishId)
  if (i < 0) return 0
  const back = Math.floor(speciesOf(t.s.fish[i]!.sp).cost / 2)
  t.s.fish.splice(i, 1)
  t.s.coins += back
  return back
}
export function canUpgrade(s: TankState, id: UpgradeId): Result {
  const u = upgradeOf(id), l = s.up[id]
  if (l >= u.max) return { ok: false, why: 'Helt oppgradert' }
  if (levelOf(s.total) < u.unlock) return { ok: false, why: `Låses opp på nivå ${u.unlock}` }
  if (s.coins < u.cost(l)) return { ok: false, why: 'Ikke nok mynter' }
  return { ok: true }
}
export function upgrade(t: Tank, id: UpgradeId): Result {
  const r = canUpgrade(t.s, id)
  if (!r.ok) return r
  t.s.coins -= upgradeOf(id).cost(t.s.up[id])
  t.s.up[id]++
  return { ok: true }
}
/** A pinch of food dropped at x (it sinks; the nearest hungry fish goes for it). At most a few in the water at once. */
export function feed(t: Tank, x: number, y = 0.04): boolean {
  if (t.pellets.length >= 8 + t.s.up.food) return false
  t.pellets.push({ x: Math.min(0.97, Math.max(0.03, x)), y, id: t.nextId++ })
  return true
}
/** Picking up a coin (a click on it). Returns its value. */
export function collect(t: Tank, coinId: number): number {
  const i = t.coins.findIndex((c) => c.id === coinId)
  if (i < 0) return 0
  const v = t.coins[i]!.value
  t.coins.splice(i, 1)
  t.s.coins += v
  t.s.total += v
  t.s.stats.collected++
  return v
}
/** The coin under a point (within reach), if any. */
export function coinAt(t: Tank, x: number, y: number, reach = 0.04): Coin | null {
  let best: Coin | null = null, bd = reach
  for (const c of t.coins) { const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; best = c } }
  return best
}
/** Trophies won that were not won before (they are added to the state). */
export function newTrophies(s: TankState): Trophy[] {
  const out: Trophy[] = []
  for (const tr of TROPHIES) if (!s.trophies.includes(tr.id) && tr.won(s)) { s.trophies.push(tr.id); out.push(tr) }
  return out
}

// ── the simulation ──
export interface StepEvents { collected: number; levelUp: number | null; fedFish: number }
/** Moves everything on by dt seconds: hunger, swimming, food sinking and being eaten, coins dropping and floating up,
 *  the feeder and the magnet. */
export function step(t: Tank, dt: number): StepEvents {
  const s = t.s
  const ev: StepEvents = { collected: 0, levelUp: null, fedFish: 0 }
  const lvl0 = levelOf(s.total)
  dt = Math.min(dt, 0.25)
  // the feeder drops a pinch now and then
  if (s.up.feeder > 0) {
    t.feederT += dt
    if (t.feederT >= feederEvery(s.up.feeder)) { t.feederT = 0; for (let i = 0; i < 2 + s.up.feeder; i++) feed(t, rnd(0.1, 0.9)) }
  }
  // food sinks to the sand and lies there a while
  for (const p of t.pellets) p.y = Math.min(0.9, p.y + dt * 0.09)
  for (const f of s.fish) {
    const sp = speciesOf(f.sp)
    f.hunger = Math.max(0, f.hunger - sp.hunger * dt)
    // hungry: off to the nearest pellet; otherwise wander
    let target: Pellet | null = null
    if (f.hunger < 0.85 && t.pellets.length) {
      let bd = Infinity
      for (const p of t.pellets) { const d = Math.hypot(p.x - f.x, p.y - f.y); if (d < bd) { bd = d; target = p } }
    }
    const speed = sp.speed * (target ? 1.8 : 1)
    if (target) {
      const dx = target.x - f.x, dy = target.y - f.y, d = Math.hypot(dx, dy) || 1
      f.vx += (dx / d * speed - f.vx) * Math.min(1, dt * 4)
      f.vy += (dy / d * speed - f.vy) * Math.min(1, dt * 4)
      if (d < sp.size * 0.6) { // eaten
        t.pellets.splice(t.pellets.indexOf(target), 1)
        f.hunger = Math.min(1, f.hunger + 0.45 + s.up.food * 0.04)
        s.stats.fed++
        ev.fedFish++
      }
    } else {
      if (Math.random() < dt * 0.4) { f.vx = rnd(-1, 1) * speed; f.vy = rnd(-0.4, 0.4) * speed }
      f.vx += (Math.sign(f.vx || 1) * speed - f.vx) * dt * 0.5
    }
    f.x += f.vx * dt
    f.y += f.vy * dt
    if (f.x < 0.06) { f.x = 0.06; f.vx = Math.abs(f.vx) }
    if (f.x > 0.94) { f.x = 0.94; f.vx = -Math.abs(f.vx) }
    if (f.y < 0.1) { f.y = 0.1; f.vy = Math.abs(f.vy) * 0.5 }
    if (f.y > 0.82) { f.y = 0.82; f.vy = -Math.abs(f.vy) * 0.5 }
    // a fed fish drops a coin every few seconds (a bigger fish: rarer but worth more)
    if (f.hunger > 0) {
      const every = 2.5 + sp.size * 30
      f.coinT += dt
      if (f.coinT >= every) {
        f.coinT = 0
        t.coins.push({ x: f.x, y: f.y, value: Math.max(1, Math.round(sp.rate * every * coinBonus(s.up.food))), age: 0, id: t.nextId++ })
      }
    }
  }
  // coins drift slowly up and are gone after a while if nobody takes them (the magnet takes them first)
  for (const c of t.coins) { c.age += dt; c.y = Math.max(0.03, c.y - dt * 0.025) }
  if (s.up.magnet > 0) {
    t.magnetT += dt
    const every = 1.6 / s.up.magnet
    while (t.magnetT >= every && t.coins.length) { t.magnetT -= every; ev.collected += collect(t, t.coins[0]!.id) }
    if (!t.coins.length) t.magnetT = 0
  }
  t.coins = t.coins.filter((c) => c.age < 25)
  if (t.coins.length > 60) t.coins.splice(0, t.coins.length - 60)
  const lvl1 = levelOf(s.total)
  if (lvl1 > lvl0) ev.levelUp = lvl1
  return ev
}

/** 1 234 · 12,3 k · 4,5 mill · 2,1 mrd */
export function fmtCoins(n: number): string {
  const f = (x: number): string => x.toLocaleString('nb-NO', { maximumFractionDigits: x < 10 ? 1 : 0 })
  if (n < 10 && n % 1) return (Math.round(n * 10) / 10).toLocaleString('nb-NO')
  if (n < 10000) return Math.floor(n).toLocaleString('nb-NO')
  if (n < 1e6) return `${f(n / 1e3)} k`
  if (n < 1e9) return `${f(n / 1e6)} mill`
  return `${f(n / 1e9)} mrd`
}
