// «Akvariet» – the room's first game, made to be played for days. Feed the fish; a fed fish drops coins; coins buy new and
// better fish, decorations and upgrades. Layers that keep it going:
//   · fish grow: every meal is experience, up to level 25 – a grown fish earns far more (and gets a name of its own)
//   · rare variants: a bought fish can turn out shiny (×3) or gold (×10); the fish book collects every species in every variant
//   · decorations in the tank (a castle, coral, a chest …), each with its own bonus, drawn in the water
//   · quests (three at a time, new ones keep coming), events (gold rain, feeding frenzy …), chests in the sand, a daily gift
//   · pearls: from level 30 you can move to a new sea – start again, keep pearls that make everything faster for good, buy
//     lasting perks with them; each sea looks different (fresh water → coral reef → kelp forest → deep sea → ice fjord → volcano)
//   · a hundred levels a sea, and trophies on the way that can be put in the room
// This file is only the rules and the simulation – no drawing – so the page (a canvas) and the 3D room show the same tank and
// the tests can play it. The tank is 1 × 1 (x to the right, y downward). Time is in seconds.

// ── chance (the tests can make it predictable) ──
let rng: () => number = Math.random
export const setRng = (f: () => number): void => { rng = f }
const rnd = (a: number, b: number): number => a + rng() * (b - a)
const pick = <T>(l: readonly T[]): T => l[Math.floor(rng() * l.length) % l.length]!

export interface Species {
  id: string
  name: string
  cost: number
  /** coins a second while it is fed (a new, level 1 fish) */
  rate: number
  /** length when grown, as a share of the tank's width */
  size: number
  color: string
  color2: string
  pattern: 'plain' | 'stripes' | 'spots' | 'fins' | 'glow'
  unlock: number
  /** hunger lost a second */
  hunger: number
  /** tank widths a second */
  speed: number
  /** a line for the fish book */
  fact: string
}

export const SPECIES: Species[] = [
  { id: 'guppy', name: 'Guppy', cost: 5, rate: 0.5, size: 0.05, color: '#ff9f43', color2: '#ffd166', pattern: 'fins', unlock: 1, hunger: 1 / 70, speed: 0.12, fact: 'Får unger i stedet for å legge egg.' },
  { id: 'neon', name: 'Neontetra', cost: 30, rate: 2, size: 0.045, color: '#2e86de', color2: '#ff4757', pattern: 'stripes', unlock: 2, hunger: 1 / 75, speed: 0.15, fact: 'Stripen lyser for å holde stimen samlet i mørkt vann.' },
  { id: 'platy', name: 'Platy', cost: 120, rate: 6, size: 0.06, color: '#ff6b6b', color2: '#feca57', pattern: 'plain', unlock: 4, hunger: 1 / 80, speed: 0.11, fact: 'En av de letteste fiskene å ha – og den spiser alt.' },
  { id: 'klovn', name: 'Klovnefisk', cost: 450, rate: 18, size: 0.07, color: '#ff7f11', color2: '#ffffff', pattern: 'stripes', unlock: 7, hunger: 1 / 85, speed: 0.1, fact: 'Bor i sjøanemoner – slimet beskytter den mot neslene.' },
  { id: 'skalar', name: 'Skalar', cost: 1600, rate: 55, size: 0.085, color: '#dfe6e9', color2: '#2d3436', pattern: 'stripes', unlock: 11, hunger: 1 / 90, speed: 0.08, fact: 'Kommer fra Amazonas, der den gjemmer seg mellom røtter.' },
  { id: 'diskus', name: 'Diskus', cost: 6000, rate: 170, size: 0.09, color: '#e17055', color2: '#0984e3', pattern: 'spots', unlock: 16, hunger: 1 / 95, speed: 0.07, fact: 'Foreldrene mater ungene med et slim fra huden.' },
  { id: 'kampfisk', name: 'Kampfisk', cost: 22000, rate: 520, size: 0.08, color: '#6c5ce7', color2: '#fd79a8', pattern: 'fins', unlock: 22, hunger: 1 / 100, speed: 0.09, fact: 'Puster luft fra overflaten med et eget organ.' },
  { id: 'koi', name: 'Koi', cost: 80000, rate: 1600, size: 0.12, color: '#ffffff', color2: '#e84118', pattern: 'spots', unlock: 29, hunger: 1 / 105, speed: 0.07, fact: 'Kan bli over hundre år gammel.' },
  { id: 'kule', name: 'Kulefisk', cost: 300000, rate: 5000, size: 0.09, color: '#f6e58d', color2: '#7f8c8d', pattern: 'spots', unlock: 37, hunger: 1 / 110, speed: 0.06, fact: 'Blåser seg opp med vann når den blir redd.' },
  { id: 'sjohest', name: 'Sjøhest', cost: 1.1e6, rate: 15000, size: 0.08, color: '#f9ca24', color2: '#f0932b', pattern: 'plain', unlock: 46, hunger: 1 / 115, speed: 0.04, fact: 'Det er hannen som bærer eggene.' },
  { id: 'rokke', name: 'Rokke', cost: 4e6, rate: 48000, size: 0.14, color: '#596275', color2: '#c8d6e5', pattern: 'spots', unlock: 56, hunger: 1 / 120, speed: 0.06, fact: 'Har skjelett av brusk, ikke bein.' },
  { id: 'hai', name: 'Revhai', cost: 15e6, rate: 150000, size: 0.18, color: '#8395a7', color2: '#dfe4ea', pattern: 'plain', unlock: 67, hunger: 1 / 125, speed: 0.09, fact: 'Kan hvile på bunnen – de fleste haier må svømme hele tiden.' },
  { id: 'gull', name: 'Keisergullfisk', cost: 6e7, rate: 480000, size: 0.12, color: '#ffd32a', color2: '#ff9f1a', pattern: 'glow', unlock: 79, hunger: 1 / 130, speed: 0.07, fact: 'Sies å ha svømt i keiserens dam i tusen år.' },
  { id: 'drage', name: 'Dragefisk', cost: 2.5e8, rate: 1.6e6, size: 0.16, color: '#7bed9f', color2: '#a29bfe', pattern: 'glow', unlock: 91, hunger: 1 / 140, speed: 0.08, fact: 'Ingen vet hvor den kommer fra. Den lyser når den er glad.' },
]
export const speciesOf = (id: string): Species => SPECIES.find((s) => s.id === id) ?? SPECIES[0]!

// ── variants ──
export type Variant = 'normal' | 'skinnende' | 'gull'
export const VARIANTS: { id: Variant; name: string; mult: number; bit: number }[] = [
  { id: 'normal', name: 'Vanlig', mult: 1, bit: 1 },
  { id: 'skinnende', name: 'Skinnende', mult: 3, bit: 2 },
  { id: 'gull', name: 'Gull', mult: 10, bit: 4 },
]
const variantOf = (v: string | undefined): (typeof VARIANTS)[number] => VARIANTS.find((x) => x.id === v) ?? VARIANTS[0]!

// ── levels ──
export const MAX_LEVEL = 100
/** Coins collected (in this sea) to reach a level. */
export const coinsForLevel = (n: number): number => (n <= 1 ? 0 : Math.round(40 * (Math.pow(1.165, n - 1) - 1) / 0.165))
export function levelOf(total: number): number {
  let n = 1
  while (n < MAX_LEVEL && total >= coinsForLevel(n + 1)) n++
  return n
}
export function levelProgress(total: number): number {
  const n = levelOf(total)
  if (n >= MAX_LEVEL) return 1
  const a = coinsForLevel(n), b = coinsForLevel(n + 1)
  return Math.min(1, (total - a) / (b - a))
}
/** A fish's own level from the meals it has had (1 … 25). */
export const FISH_MAX = 25
export const fishLevel = (xp: number): number => Math.min(FISH_MAX, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 2.5)))
export const xpForFishLevel = (l: number): number => Math.ceil(Math.pow(Math.max(0, l - 1), 2) * 2.5)

// ── the seas (one for each move with pearls; after the last they go round again, hotter) ──
export interface Biome { id: string; name: string; water: [string, string, string]; sand: [string, string]; plant: string[]; bonus: number; text: string }
export const BIOMES: Biome[] = [
  { id: 'fersk', name: 'Ferskvann', water: ['#5ad1f5', '#1f7fbf', '#0d3f6b'], sand: ['#e9d59c', '#c9ae6b'], plant: ['#2f9e57', '#3fbf6a', '#21734a'], bonus: 1, text: 'Et rolig vann med siv og stein' },
  { id: 'rev', name: 'Korallrevet', water: ['#7ee8fa', '#25a6c9', '#0b5f84'], sand: ['#fbe9c6', '#e7c99a'], plant: ['#ff6b81', '#ffa94d', '#c56cf0'], bonus: 1.25, text: 'Korall i alle farger' },
  { id: 'tare', name: 'Tareskogen', water: ['#8fd3c1', '#2c8c7a', '#0e4a43'], sand: ['#cdb98f', '#9c8a62'], plant: ['#6b8e23', '#8fae3a', '#4f6d1a'], bonus: 1.5, text: 'Høy, vaiende tare' },
  { id: 'dyp', name: 'Dyphavet', water: ['#1e3c72', '#0f2350', '#050b1f'], sand: ['#4b4f63', '#2e3142'], plant: ['#00d2d3', '#54a0ff', '#5f27cd'], bonus: 1.8, text: 'Mørkt – men det lyser' },
  { id: 'is', name: 'Isfjorden', water: ['#dff6ff', '#8ecae6', '#3a6b8a'], sand: ['#f1f5f9', '#cbd5e1'], plant: ['#a5d8ff', '#e7f5ff', '#74c0fc'], bonus: 2.2, text: 'Kaldt, klart og blått' },
  { id: 'vulkan', name: 'Vulkanhavet', water: ['#ff9966', '#b23a48', '#3d0c11'], sand: ['#3b2f2f', '#1c1414'], plant: ['#ff4500', '#ffa500', '#ff6347'], bonus: 2.7, text: 'Varme kilder og glødende stein' },
]
export const biomeOf = (prestiges: number): Biome => BIOMES[Math.min(prestiges, BIOMES.length - 1)]!

// ── upgrades (for coins, reset when moving to a new sea) ──
export type UpgradeId = 'tank' | 'food' | 'feeder' | 'magnet'
export interface Upgrade { id: UpgradeId; name: string; text: (lvl: number) => string; max: number; cost: (lvl: number) => number; unlock: number }
export const UPGRADES: Upgrade[] = [
  { id: 'tank', name: 'Større tank', text: (l) => `Plass til ${maxFish(l + 1)} fisker`, max: 10, cost: (l) => Math.round(60 * Math.pow(3.6, l)), unlock: 2 },
  { id: 'food', name: 'Bedre fôr', text: (l) => `+${(l + 1) * 15} % mynter, fisken blir mettere og vokser fortere`, max: 12, cost: (l) => Math.round(40 * Math.pow(3.2, l)), unlock: 3 },
  { id: 'feeder', name: 'Fôrautomat', text: (l) => `Fôrer av seg selv hvert ${feederEvery(l + 1)}. sekund – også når du er borte`, max: 6, cost: (l) => Math.round(400 * Math.pow(6, l)), unlock: 6 },
  { id: 'magnet', name: 'Myntmagnet', text: (l) => (l === 0 ? 'Plukker opp myntene av seg selv' : `Plukker opp ${l + 1} × så fort`), max: 4, cost: (l) => Math.round(900 * Math.pow(9, l)), unlock: 9 },
]
export const upgradeOf = (id: UpgradeId): Upgrade => UPGRADES.find((u) => u.id === id)!
export const maxFish = (tank: number): number => 4 + tank * 3
export const feederEvery = (lvl: number): number => (lvl <= 0 ? 0 : Math.max(6, Math.round(40 / lvl)))

// ── decorations in the tank (for coins, reset with the sea) ──
export type DecorId = 'slott' | 'korall' | 'kiste' | 'vrak' | 'bobler' | 'lykt'
export interface Decor { id: DecorId; name: string; text: (lvl: number) => string; max: number; cost: (lvl: number) => number; unlock: number }
export const DECORS: Decor[] = [
  { id: 'slott', name: 'Sandslott', text: (l) => `+${(l + 1) * 10} % mynter`, max: 8, cost: (l) => Math.round(250 * Math.pow(4.2, l)), unlock: 5 },
  { id: 'korall', name: 'Korall', text: (l) => `Fiskene blir ${Math.round((1 - Math.pow(0.92, l + 1)) * 100)} % senere sultne`, max: 8, cost: (l) => Math.round(600 * Math.pow(4.5, l)), unlock: 8 },
  { id: 'bobler', name: 'Boblemaskin', text: (l) => `+${(l + 1) * 20} % vekst (erfaring per måltid)`, max: 8, cost: (l) => Math.round(1500 * Math.pow(4.8, l)), unlock: 12 },
  { id: 'kiste', name: 'Skattekiste', text: (l) => `Skattekister i sanden ${l + 1} × så ofte`, max: 6, cost: (l) => Math.round(5000 * Math.pow(6, l)), unlock: 15 },
  { id: 'lykt', name: 'Havlykt', text: (l) => `${(l + 1) * 50} % større sjanse for sjeldne fisker`, max: 6, cost: (l) => Math.round(20000 * Math.pow(7, l)), unlock: 20 },
  { id: 'vrak', name: 'Skipsvrak', text: (l) => `+${(l + 1) * 25} % mens du er borte`, max: 6, cost: (l) => Math.round(60000 * Math.pow(7, l)), unlock: 26 },
]
export const decorOf = (id: DecorId): Decor => DECORS.find((d) => d.id === id)!

// ── perks (for pearls, kept for good) ──
export type PerkId = 'verdi' | 'start' | 'sult' | 'flaks' | 'borte' | 'automat' | 'oppdrag' | 'vekst'
export interface Perk { id: PerkId; name: string; text: (lvl: number) => string; max: number; cost: (lvl: number) => number }
export const PERKS: Perk[] = [
  { id: 'verdi', name: 'Perlemor', text: (l) => `+${(l + 1) * 25} % mynter, for alltid`, max: 20, cost: (l) => 2 + l * 2 },
  { id: 'start', name: 'Arv', text: (l) => `Start hvert hav med ${fmtCoins(startCoins(l + 1))} mynter`, max: 8, cost: (l) => 3 + l * 3 },
  { id: 'vekst', name: 'Vekstkraft', text: (l) => `Fiskene vokser ${(l + 1) * 30} % fortere`, max: 10, cost: (l) => 3 + l * 3 },
  { id: 'sult', name: 'Metthet', text: (l) => `Fiskene blir ${(l + 1) * 6} % senere sultne`, max: 8, cost: (l) => 4 + l * 3 },
  { id: 'flaks', name: 'Flaks', text: (l) => `Dobbel sjanse for sjeldne fisker × ${l + 1}`, max: 5, cost: (l) => 6 + l * 6 },
  { id: 'borte', name: 'Tålmodighet', text: (l) => `Tjen i ${8 + (l + 1) * 2} timer mens du er borte, ${50 + (l + 1) * 8} % så fort`, max: 6, cost: (l) => 4 + l * 4 },
  { id: 'automat', name: 'Fast automat', text: (l) => `Start hvert hav med fôrautomat nivå ${l + 1}`, max: 4, cost: (l) => 8 + l * 8 },
  { id: 'oppdrag', name: 'Oppdragsbok', text: (l) => `${4 + l} oppdrag samtidig, større belønning`, max: 3, cost: (l) => 10 + l * 10 },
]
export const perkOf = (id: PerkId): Perk => PERKS.find((p) => p.id === id)!
const startCoins = (l: number): number => (l <= 0 ? 15 : Math.round(15 * Math.pow(12, l)))
/** Pearls ever earned make everything faster: +4 % each. */
export const pearlBonus = (pearlsEver: number): number => 1 + pearlsEver * 0.04
/** Moving on is possible from this level. */
export const PRESTIGE_LEVEL = 30
/** Pearls a move would give now. */
export const pearlsFor = (total: number): number => (levelOf(total) < PRESTIGE_LEVEL ? 0 : Math.floor(Math.sqrt(total / 2500)))

// ── trophies ──
export type Tier = 'bronse' | 'solv' | 'gull' | 'platina' | 'diamant' | 'legende'
export interface Trophy { id: string; name: string; text: string; tier: Tier; won: (s: TankState) => boolean }
const maxFishLvl = (s: TankState): number => s.fish.reduce((a, f) => Math.max(a, fishLevel(f.xp)), 0)
const dexCount = (s: TankState, bit: number): number => SPECIES.filter((sp) => ((s.dex[sp.id] ?? 0) & bit) !== 0).length
export const TROPHIES: Trophy[] = [
  { id: 'first', name: 'Første fisk', text: 'Kjøp din første fisk', tier: 'bronse', won: (s) => s.stats.bought >= 1 },
  { id: 'lvl5', name: 'Akvarist', text: 'Nå nivå 5', tier: 'bronse', won: (s) => s.best >= 5 },
  { id: 'fed100', name: 'Matmor', text: 'Gi fisken mat 100 ganger', tier: 'bronse', won: (s) => s.stats.fed >= 100 },
  { id: 'quest1', name: 'Oppdragsgiver', text: 'Fullfør et oppdrag', tier: 'bronse', won: (s) => s.stats.quests >= 1 },
  { id: 'chest1', name: 'Skattejeger', text: 'Åpne en skattekiste', tier: 'bronse', won: (s) => s.stats.chests >= 1 },
  { id: 'lvl10', name: 'Fiskevenn', text: 'Nå nivå 10', tier: 'solv', won: (s) => s.best >= 10 },
  { id: 'full', name: 'Fullt hus', text: 'Fyll en tank med plass til minst ti', tier: 'solv', won: (s) => s.fish.length >= maxFish(s.up.tank) && s.up.tank >= 2 },
  { id: 'feeder', name: 'Automatisk', text: 'Kjøp en fôrautomat', tier: 'solv', won: (s) => s.up.feeder >= 1 },
  { id: 'grown', name: 'Oppvekst', text: 'Få en fisk til nivå 10', tier: 'solv', won: (s) => maxFishLvl(s) >= 10 },
  { id: 'shiny', name: 'Det glitrer', text: 'Få en skinnende fisk', tier: 'solv', won: (s) => dexCount(s, 2) >= 1 },
  { id: 'streak7', name: 'Trofast', text: 'Kom tilbake sju dager på rad', tier: 'solv', won: (s) => s.daily.best >= 7 },
  { id: 'lvl25', name: 'Rev-bygger', text: 'Nå nivå 25', tier: 'gull', won: (s) => s.best >= 25 },
  { id: 'koi', name: 'Koi-dammen', text: 'Ha tre koi samtidig', tier: 'gull', won: (s) => s.fish.filter((f) => f.sp === 'koi').length >= 3 },
  { id: 'million', name: 'Millionær', text: 'Samle en million mynter', tier: 'gull', won: (s) => s.stats.coins >= 1e6 },
  { id: 'prest1', name: 'Nytt hav', text: 'Flytt til et nytt hav', tier: 'gull', won: (s) => s.prestiges >= 1 },
  { id: 'quest25', name: 'Pliktoppfyllende', text: 'Fullfør 25 oppdrag', tier: 'gull', won: (s) => s.stats.quests >= 25 },
  { id: 'dex', name: 'Fiskeboka', text: 'Ha hatt alle 14 arter', tier: 'gull', won: (s) => dexCount(s, 1) >= SPECIES.length },
  { id: 'lvl50', name: 'Havforsker', text: 'Nå nivå 50', tier: 'platina', won: (s) => s.best >= 50 },
  { id: 'shark', name: 'Hai i tanken', text: 'Kjøp en revhai', tier: 'platina', won: (s) => s.fish.some((f) => f.sp === 'hai') },
  { id: 'gold', name: 'Gullfeber', text: 'Få en gullfisk-variant', tier: 'platina', won: (s) => dexCount(s, 4) >= 1 },
  { id: 'max', name: 'Fullvoksen', text: 'Få en fisk til nivå 25', tier: 'platina', won: (s) => maxFishLvl(s) >= FISH_MAX },
  { id: 'prest3', name: 'Havvandrer', text: 'Flytt hav tre ganger', tier: 'platina', won: (s) => s.prestiges >= 3 },
  { id: 'streak30', name: 'En hel måned', text: 'Kom tilbake 30 dager på rad', tier: 'platina', won: (s) => s.daily.best >= 30 },
  { id: 'lvl75', name: 'Dyphavsdykker', text: 'Nå nivå 75', tier: 'diamant', won: (s) => s.best >= 75 },
  { id: 'billion', name: 'Skattkammer', text: 'Samle en milliard mynter', tier: 'diamant', won: (s) => s.stats.coins >= 1e9 },
  { id: 'shinydex', name: 'Glitrende samling', text: 'Ha hatt alle arter skinnende', tier: 'diamant', won: (s) => dexCount(s, 2) >= SPECIES.length },
  { id: 'prest6', name: 'Vulkanfarer', text: 'Nå Vulkanhavet', tier: 'diamant', won: (s) => s.prestiges >= BIOMES.length - 1 },
  { id: 'dragon', name: 'Dragetemmer', text: 'Kjøp en dragefisk', tier: 'legende', won: (s) => s.fish.some((f) => f.sp === 'drage') || ((s.dex.drage ?? 0) & 1) !== 0 },
  { id: 'lvl100', name: 'Havets hersker', text: 'Nå nivå 100', tier: 'legende', won: (s) => s.best >= MAX_LEVEL },
  { id: 'golddex', name: 'Kongens akvarium', text: 'Ha hatt alle arter i gull', tier: 'legende', won: (s) => dexCount(s, 4) >= SPECIES.length },
]
export const TIER_COLORS: Record<Tier, [string, string]> = {
  bronse: ['#cd7f32', '#8a5a2b'], solv: ['#d7dde4', '#8e99a6'], gull: ['#ffd700', '#b8860b'],
  platina: ['#e5f1f8', '#7fa6bf'], diamant: ['#b9f2ff', '#4fc3f7'], legende: ['#d9a7ff', '#7b2ff7'],
}
export const TIER_NAMES: Record<Tier, string> = { bronse: 'Bronse', solv: 'Sølv', gull: 'Gull', platina: 'Platina', diamant: 'Diamant', legende: 'Legende' }
export const trophyOf = (id: string): Trophy | undefined => TROPHIES.find((t) => t.id === id)

// ── quests ──
export type QuestKind = 'feed' | 'coins' | 'buy' | 'level' | 'grow' | 'chest' | 'upgrade'
export interface Quest { id: string; kind: QuestKind; target: number; base: number; reward: number; pearls: number; text: string }

// ── the state (what is saved) and the moving things (what is not) ──
export interface Fish { id: string; sp: string; hunger: number; xp: number; variant: Variant; name?: string; x: number; y: number; vx: number; vy: number; coinT: number }
export interface TankState {
  v: 2
  coins: number
  /** coins collected in this sea – decides the level */
  total: number
  /** the highest level ever reached (in any sea) */
  best: number
  fish: Fish[]
  up: Record<UpgradeId, number>
  decor: Record<DecorId, number>
  perks: Record<PerkId, number>
  pearls: number
  pearlsEver: number
  prestiges: number
  /** species → the variants had (1 normal, 2 shiny, 4 gold) */
  dex: Record<string, number>
  quests: Quest[]
  daily: { day: string; streak: number; best: number }
  trophies: string[]
  stats: { fed: number; bought: number; collected: number; coins: number; quests: number; chests: number; upgrades: number; events: number }
  last: number
}
export interface Coin { x: number; y: number; value: number; age: number; id: number; rain?: boolean }
export interface Pellet { x: number; y: number; id: number }
export type EventKind = 'gullregn' | 'matfest' | 'stimfeber'
export interface GameEvent { kind: EventKind; left: number; dur: number }
export const EVENTS: Record<EventKind, { name: string; text: string; dur: number }> = {
  gullregn: { name: 'Gullregn', text: 'Mynter regner ned – fang dem!', dur: 20 },
  matfest: { name: 'Matfest', text: 'Dobbel vekst av hvert måltid', dur: 60 },
  stimfeber: { name: 'Stimfeber', text: 'Alle fisker gir dobbelt så mye', dur: 45 },
}
export interface Chest { x: number; age: number }
export interface Tank { s: TankState; coins: Coin[]; pellets: Pellet[]; nextId: number; feederT: number; magnetT: number; event: GameEvent | null; eventT: number; chest: Chest | null; chestT: number; rainT: number }

let seq = 0
const uid = (): string => Date.now().toString(36) + (seq++).toString(36) + Math.floor(rng() * 46656).toString(36)
const zeroUp = (): Record<UpgradeId, number> => ({ tank: 0, food: 0, feeder: 0, magnet: 0 })
const zeroDecor = (): Record<DecorId, number> => ({ slott: 0, korall: 0, kiste: 0, vrak: 0, bobler: 0, lykt: 0 })
const zeroPerks = (): Record<PerkId, number> => ({ verdi: 0, start: 0, sult: 0, flaks: 0, borte: 0, automat: 0, oppdrag: 0, vekst: 0 })
export const dayKey = (ms: number): string => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export function newState(now = Date.now()): TankState {
  return {
    v: 2, coins: 15, total: 0, best: 1, fish: [], up: zeroUp(), decor: zeroDecor(), perks: zeroPerks(), pearls: 0, pearlsEver: 0, prestiges: 0, dex: {}, quests: [],
    daily: { day: '', streak: 0, best: 0 }, trophies: [], stats: { fed: 0, bought: 0, collected: 0, coins: 0, quests: 0, chests: 0, upgrades: 0, events: 0 }, last: now,
  }
}
const num = (v: unknown, d = 0, lo = 0, hi = 1e18): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)
const rec = <K extends string>(keys: readonly K[], src: unknown, max: (k: K) => number): Record<K, number> => {
  const o = {} as Record<K, number>
  const r = (src && typeof src === 'object' ? src : {}) as Record<string, unknown>
  for (const k of keys) o[k] = Math.round(num(r[k], 0, 0, max(k)))
  return o
}
/** A saved state read back (an old v1 one is brought up to date; anything odd is set right). */
export function fromSaved(raw: unknown, now = Date.now()): TankState {
  const s = newState(now)
  if (!raw || typeof raw !== 'object') return s
  const r = raw as Record<string, unknown>
  s.coins = num(r.coins, 15)
  s.total = num(r.total)
  s.up = rec(UPGRADES.map((u) => u.id), r.up, (k) => upgradeOf(k).max)
  s.decor = rec(DECORS.map((d) => d.id), r.decor, (k) => decorOf(k).max)
  s.perks = rec(PERKS.map((p) => p.id), r.perks, (k) => perkOf(k).max)
  s.pearls = Math.floor(num(r.pearls))
  s.pearlsEver = Math.max(s.pearls, Math.floor(num(r.pearlsEver)))
  s.prestiges = Math.floor(num(r.prestiges, 0, 0, 1000))
  s.best = Math.max(levelOf(s.total), Math.floor(num(r.best, 1, 1, MAX_LEVEL)))
  const fish = Array.isArray(r.fish) ? r.fish : []
  s.fish = fish.slice(0, maxFish(s.up.tank)).filter((f): f is Record<string, unknown> => !!f && typeof f === 'object' && SPECIES.some((x) => x.id === (f as Record<string, unknown>).sp)).map((f) => ({
    id: typeof f.id === 'string' ? f.id.slice(0, 24) : uid(), sp: String(f.sp), hunger: num(f.hunger, 0.6, 0, 1), xp: num(f.xp, 0, 0, 1e6), variant: variantOf(typeof f.variant === 'string' ? f.variant : undefined).id,
    x: rnd(0.15, 0.85), y: rnd(0.2, 0.7), vx: rnd(-1, 1) * 0.05, vy: 0, coinT: rnd(0, 4),
    ...(typeof f.name === 'string' && f.name.trim() ? { name: f.name.trim().slice(0, 20) } : {}),
  }))
  const dex = (r.dex && typeof r.dex === 'object' ? r.dex : {}) as Record<string, unknown>
  for (const sp of SPECIES) { const v = Math.floor(num(dex[sp.id], 0, 0, 7)); if (v) s.dex[sp.id] = v }
  for (const f of s.fish) s.dex[f.sp] = (s.dex[f.sp] ?? 0) | variantOf(f.variant).bit | 1
  s.quests = (Array.isArray(r.quests) ? r.quests : []).filter((q): q is Quest => !!q && typeof q === 'object' && typeof (q as Quest).kind === 'string').slice(0, 6).map((q) => ({
    id: String(q.id).slice(0, 24), kind: q.kind, target: num(q.target, 1, 1), base: num(q.base), reward: num(q.reward), pearls: Math.floor(num(q.pearls, 0, 0, 5)), text: String(q.text ?? '').slice(0, 80),
  }))
  const d = (r.daily && typeof r.daily === 'object' ? r.daily : {}) as Record<string, unknown>
  s.daily = { day: typeof d.day === 'string' ? d.day.slice(0, 10) : '', streak: Math.floor(num(d.streak, 0, 0, 10000)), best: Math.floor(num(d.best, 0, 0, 10000)) }
  s.trophies = (Array.isArray(r.trophies) ? r.trophies : []).filter((t): t is string => typeof t === 'string' && !!trophyOf(t))
  const st = (r.stats && typeof r.stats === 'object' ? r.stats : {}) as Record<string, unknown>
  s.stats = { fed: num(st.fed), bought: num(st.bought), collected: num(st.collected), coins: Math.max(num(st.coins), s.total), quests: num(st.quests), chests: num(st.chests), upgrades: num(st.upgrades), events: num(st.events) }
  s.last = num(r.last, now, 0, now)
  return s
}
/** What is saved (where a fish swims is left out). */
export function toSaved(s: TankState): TankState {
  return { ...s, fish: s.fish.map((f) => ({ id: f.id, sp: f.sp, hunger: Math.round(f.hunger * 1000) / 1000, xp: Math.round(f.xp * 10) / 10, variant: f.variant, x: 0, y: 0, vx: 0, vy: 0, coinT: 0, ...(f.name ? { name: f.name } : {}) })) }
}
export const makeTank = (s: TankState): Tank => ({ s, coins: [], pellets: [], nextId: 1, feederT: 0, magnetT: 0, event: null, eventT: rnd(150, 300), chest: null, chestT: rnd(120, 240), rainT: 0 })

// ── what a fish is worth ──
/** All the multipliers that apply to every coin: food, the castle, pearls, perks, the sea. */
export const coinMult = (s: TankState): number =>
  (1 + s.up.food * 0.15) * (1 + s.decor.slott * 0.1) * pearlBonus(s.pearlsEver) * (1 + s.perks.verdi * 0.25) * biomeOf(s.prestiges).bonus
/** Coins a second one fish makes when fed. */
export const fishRate = (s: TankState, f: Fish): number => speciesOf(f.sp).rate * (1 + (fishLevel(f.xp) - 1) * 0.15) * variantOf(f.variant).mult * coinMult(s)
const hungerMult = (s: TankState): number => Math.pow(0.92, s.decor.korall) * (1 - s.perks.sult * 0.06)
const xpMult = (s: TankState): number => (1 + s.up.food * 0.05) * (1 + s.decor.bobler * 0.2) * (1 + s.perks.vekst * 0.3)
/** How big a fish is drawn (a young one is small). */
export const fishSize = (f: Fish): number => speciesOf(f.sp).size * (0.6 + 0.4 * Math.min(1, (fishLevel(f.xp) - 1) / 10))
/** Coins a second the tank makes right now (fed fish only), and when every fish is fed. */
export const earningRate = (s: TankState): number => s.fish.reduce((a, f) => a + (f.hunger > 0 ? fishRate(s, f) : 0), 0)
export const fullRate = (s: TankState): number => s.fish.reduce((a, f) => a + fishRate(s, f), 0)

// ── coming back ──
/** What the fish made while you were away – at most 8 hours (more with the perk), half as fast as when you are there (faster
 *  with the wreck and the perk), and only as long as they had food (a feeder keeps them fed the whole time). Returns the coins. */
export function catchUp(s: TankState, now = Date.now()): number {
  const capH = 8 + s.perks.borte * 2
  const away = Math.min(capH * 3600, Math.max(0, (now - s.last) / 1000))
  s.last = now
  if (away < 30 || !s.fish.length) return 0
  const speed = (0.5 + s.perks.borte * 0.08) * (1 + s.decor.vrak * 0.25)
  let earned = 0
  for (const f of s.fish) {
    const h = speciesOf(f.sp).hunger * hungerMult(s)
    const fedFor = s.up.feeder > 0 ? away : Math.min(away, f.hunger / h)
    earned += fishRate(s, f) * fedFor * speed
    f.hunger = s.up.feeder > 0 ? Math.max(f.hunger, 0.6) : Math.max(0, f.hunger - h * away)
  }
  earned = Math.floor(earned)
  addCoins(s, earned)
  return earned
}
function addCoins(s: TankState, v: number): void {
  s.coins += v
  s.total += v
  s.stats.coins += v
  s.best = Math.max(s.best, levelOf(s.total))
}
/** The daily gift: once a calendar day, bigger the more days in a row (up to 30). Returns what was given, or null. */
export function claimDaily(s: TankState, now = Date.now()): { coins: number; pearls: number; streak: number } | null {
  const today = dayKey(now)
  if (s.daily.day === today) return null
  const yesterday = dayKey(now - 86400000)
  s.daily.streak = s.daily.day === yesterday ? s.daily.streak + 1 : 1
  s.daily.best = Math.max(s.daily.best, s.daily.streak)
  s.daily.day = today
  const k = Math.min(30, s.daily.streak)
  const coins = Math.max(50 * k, Math.round(fullRate(s) * 60 * (2 + k)))
  const pearls = k % 7 === 0 ? Math.max(1, Math.floor(k / 7)) : 0
  addCoins(s, coins)
  if (pearls) { s.pearls += pearls; s.pearlsEver += pearls }
  return { coins, pearls, streak: s.daily.streak }
}
export const dailyReady = (s: TankState, now = Date.now()): boolean => s.daily.day !== dayKey(now)

// ── what the player does ──
export type Result = { ok: true } | { ok: false; why: string }
const lvl = (s: TankState): number => levelOf(s.total)
export function canBuyFish(s: TankState, id: string): Result {
  const sp = speciesOf(id)
  if (lvl(s) < sp.unlock) return { ok: false, why: `Låses opp på nivå ${sp.unlock}` }
  if (s.fish.length >= maxFish(s.up.tank)) return { ok: false, why: 'Tanken er full – kjøp en større' }
  if (s.coins < sp.cost) return { ok: false, why: 'Ikke nok mynter' }
  return { ok: true }
}
/** The chance that a bought fish turns out shiny / gold. */
export function variantChance(s: TankState): { skinnende: number; gull: number } {
  const luck = (1 + s.decor.lykt * 0.5) * Math.pow(2, s.perks.flaks)
  return { skinnende: Math.min(0.5, (1 / 40) * luck), gull: Math.min(0.2, (1 / 400) * luck) }
}
export function buyFish(t: Tank, id: string): Result & { fish?: Fish } {
  const r = canBuyFish(t.s, id)
  if (!r.ok) return r
  const sp = speciesOf(id)
  const ch = variantChance(t.s)
  const roll = rng()
  const variant: Variant = roll < ch.gull ? 'gull' : roll < ch.gull + ch.skinnende ? 'skinnende' : 'normal'
  t.s.coins -= sp.cost
  const f: Fish = { id: uid(), sp: sp.id, hunger: 0.8, xp: 0, variant, x: rnd(0.2, 0.8), y: 0.05, vx: rnd(-1, 1) * 0.05, vy: 0.3, coinT: rnd(0, 3) }
  t.s.fish.push(f)
  t.s.dex[sp.id] = (t.s.dex[sp.id] ?? 0) | variantOf(variant).bit | 1
  t.s.stats.bought++
  return { ok: true, fish: f }
}
/** Selling a fish gives half of what it cost (more for a grown or rare one). */
export const sellValue = (f: Fish): number => Math.floor(speciesOf(f.sp).cost / 2 * (1 + (fishLevel(f.xp) - 1) * 0.1) * variantOf(f.variant).mult)
export function sellFish(t: Tank, fishId: string): number {
  const i = t.s.fish.findIndex((f) => f.id === fishId)
  if (i < 0) return 0
  const back = sellValue(t.s.fish[i]!)
  t.s.fish.splice(i, 1)
  t.s.coins += back
  return back
}
export function renameFish(s: TankState, fishId: string, name: string): void {
  const f = s.fish.find((x) => x.id === fishId)
  if (!f) return
  const n = name.trim().slice(0, 20)
  if (n) f.name = n; else delete f.name
}
export function canUpgrade(s: TankState, id: UpgradeId): Result {
  const u = upgradeOf(id), l = s.up[id]
  if (l >= u.max) return { ok: false, why: 'Helt oppgradert' }
  if (lvl(s) < u.unlock) return { ok: false, why: `Låses opp på nivå ${u.unlock}` }
  if (s.coins < u.cost(l)) return { ok: false, why: 'Ikke nok mynter' }
  return { ok: true }
}
export function upgrade(t: Tank, id: UpgradeId): Result {
  const r = canUpgrade(t.s, id)
  if (!r.ok) return r
  t.s.coins -= upgradeOf(id).cost(t.s.up[id])
  t.s.up[id]++
  t.s.stats.upgrades++
  return { ok: true }
}
export function canDecor(s: TankState, id: DecorId): Result {
  const d = decorOf(id), l = s.decor[id]
  if (l >= d.max) return { ok: false, why: 'Helt oppgradert' }
  if (lvl(s) < d.unlock) return { ok: false, why: `Låses opp på nivå ${d.unlock}` }
  if (s.coins < d.cost(l)) return { ok: false, why: 'Ikke nok mynter' }
  return { ok: true }
}
export function buyDecor(t: Tank, id: DecorId): Result {
  const r = canDecor(t.s, id)
  if (!r.ok) return r
  t.s.coins -= decorOf(id).cost(t.s.decor[id])
  t.s.decor[id]++
  t.s.stats.upgrades++
  return { ok: true }
}
export function canPerk(s: TankState, id: PerkId): Result {
  const p = perkOf(id), l = s.perks[id]
  if (l >= p.max) return { ok: false, why: 'Helt oppgradert' }
  if (s.pearls < p.cost(l)) return { ok: false, why: 'Ikke nok perler' }
  return { ok: true }
}
export function buyPerk(t: Tank, id: PerkId): Result {
  const r = canPerk(t.s, id)
  if (!r.ok) return r
  t.s.pearls -= perkOf(id).cost(t.s.perks[id])
  t.s.perks[id]++
  if (id === 'oppdrag') fillQuests(t.s)
  return { ok: true }
}
/** Moving to a new sea: coins, fish, upgrades and decorations go; pearls come (and stay, with the perks, the fish book, the
 *  trophies and the best level). The new sea looks different and pays more. */
export function prestige(t: Tank, now = Date.now()): number {
  const gain = pearlsFor(t.s.total)
  if (gain <= 0) return 0
  const s = t.s
  s.best = Math.max(s.best, levelOf(s.total))
  s.pearls += gain
  s.pearlsEver += gain
  s.prestiges++
  s.coins = startCoins(s.perks.start)
  s.total = 0
  s.fish = []
  s.up = { ...zeroUp(), feeder: s.perks.automat }
  s.decor = zeroDecor()
  s.quests = []
  s.last = now
  t.coins = []; t.pellets = []; t.event = null; t.chest = null
  fillQuests(s)
  return gain
}
/** A pinch of food dropped at x (it sinks; the nearest hungry fish goes for it). */
export function feed(t: Tank, x: number, y = 0.04): boolean {
  if (t.pellets.length >= 8 + t.s.up.food) return false
  t.pellets.push({ x: Math.min(0.97, Math.max(0.03, x)), y, id: t.nextId++ })
  return true
}
export function collect(t: Tank, coinId: number): number {
  const i = t.coins.findIndex((c) => c.id === coinId)
  if (i < 0) return 0
  const v = t.coins[i]!.value
  t.coins.splice(i, 1)
  addCoins(t.s, v)
  t.s.stats.collected++
  return v
}
export function coinAt(t: Tank, x: number, y: number, reach = 0.04): Coin | null {
  let best: Coin | null = null, bd = reach
  for (const c of t.coins) { const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; best = c } }
  return best
}
/** The chest in the sand, if a point is on it. */
export const chestAt = (t: Tank, x: number, y: number): boolean => !!t.chest && Math.abs(t.chest.x - x) < 0.05 && y > 0.78
export type ChestPrize = { kind: 'coins'; coins: number } | { kind: 'pearls'; pearls: number } | { kind: 'decor'; decor: DecorId } | { kind: 'xp'; xp: number }
/** Opening the chest: coins (several minutes' worth), now and then pearls, a free decoration level or a growth spurt. */
export function openChest(t: Tank): ChestPrize | null {
  if (!t.chest) return null
  t.chest = null
  const s = t.s
  s.stats.chests++
  const r = rng()
  let prize: ChestPrize
  if (r < 0.08 && lvl(s) >= 20) { const p = 1 + Math.floor(rng() * 3); s.pearls += p; s.pearlsEver += p; prize = { kind: 'pearls', pearls: p } }
  else if (r < 0.2) {
    const can = DECORS.filter((d) => s.decor[d.id] < d.max && lvl(s) >= d.unlock)
    if (can.length) { const d = pick(can); s.decor[d.id]++; prize = { kind: 'decor', decor: d.id } } else { const c = chestCoins(s); addCoins(s, c); prize = { kind: 'coins', coins: c } }
  } else if (r < 0.35 && s.fish.length) { const xp = 20 + lvl(s) * 2; for (const f of s.fish) f.xp += xp; prize = { kind: 'xp', xp } }
  else { const c = chestCoins(s); addCoins(s, c); prize = { kind: 'coins', coins: c } }
  return prize
}
const chestCoins = (s: TankState): number => Math.max(25 * lvl(s), Math.round(fullRate(s) * rnd(180, 420)))

// ── quests ──
const QUEST_KINDS: QuestKind[] = ['feed', 'coins', 'buy', 'level', 'grow', 'chest', 'upgrade']
function questValue(s: TankState, kind: QuestKind): number {
  switch (kind) {
    case 'feed': return s.stats.fed
    case 'coins': return s.stats.coins
    case 'buy': return s.stats.bought
    case 'level': return lvl(s)
    case 'grow': return maxFishLvl(s)
    case 'chest': return s.stats.chests
    case 'upgrade': return s.stats.upgrades
  }
}
export function newQuest(s: TankState): Quest {
  const L = lvl(s)
  const busy = new Set(s.quests.map((q) => q.kind))
  const kinds = QUEST_KINDS.filter((k) => !busy.has(k) && (k !== 'chest' || L >= 4) && (k !== 'level' || L < MAX_LEVEL) && (k !== 'grow' || (s.fish.length > 0 && maxFishLvl(s) < FISH_MAX)))
  const kind = pick(kinds.length ? kinds : ['feed', 'coins'] as QuestKind[])
  const big = 1 + s.perks.oppdrag * 0.5
  let target = 1, text = ''
  const base = kind === 'level' || kind === 'grow' ? 0 : questValue(s, kind)
  switch (kind) {
    case 'feed': target = 20 + Math.round(L * 1.5 / 5) * 5; text = `Gi fisken mat ${target} ganger`; break
    case 'coins': target = Math.max(100, Math.round(Math.max(fullRate(s), 1) * rnd(240, 600) / 10) * 10); text = `Samle ${fmtCoins(target)} mynter`; break
    case 'buy': target = 2 + Math.floor(L / 15); text = `Kjøp ${target} fisker`; break
    case 'level': target = Math.min(MAX_LEVEL, L + 1 + Math.floor(rng() * 2)); text = `Nå nivå ${target}`; break
    case 'grow': target = Math.min(FISH_MAX, maxFishLvl(s) + 1 + Math.floor(rng() * 2)); text = `Få en fisk til nivå ${target}`; break
    case 'chest': target = 1 + Math.floor(L / 30); text = target > 1 ? `Åpne ${target} skattekister` : 'Åpne en skattekiste'; break
    case 'upgrade': target = 2 + Math.floor(L / 25); text = `Kjøp ${target} oppgraderinger eller pynt`; break
  }
  const reward = Math.round(Math.max(60 + L * 20, Math.max(fullRate(s), 1) * rnd(300, 700)) * big)
  const pearls = L >= PRESTIGE_LEVEL && rng() < 0.12 * big ? 1 : 0
  return { id: uid(), kind, target, base, reward, pearls, text }
}
export const questSlots = (s: TankState): number => 3 + s.perks.oppdrag
export function fillQuests(s: TankState): void { while (s.quests.length < questSlots(s)) s.quests.push(newQuest(s)) }
export function questProgress(s: TankState, q: Quest): number { return Math.min(1, Math.max(0, (questValue(s, q.kind) - q.base) / q.target)) }
export const questDone = (s: TankState, q: Quest): boolean => questValue(s, q.kind) - q.base >= q.target
/** Takes the reward of a finished quest; a new one takes its place. */
export function claimQuest(t: Tank, questId: string): Quest | null {
  const s = t.s
  const i = s.quests.findIndex((q) => q.id === questId)
  const q = s.quests[i]
  if (!q || !questDone(s, q)) return null
  s.quests.splice(i, 1)
  addCoins(s, q.reward)
  if (q.pearls) { s.pearls += q.pearls; s.pearlsEver += q.pearls }
  s.stats.quests++
  fillQuests(s)
  return q
}
/** Swapping a quest for another (costs a little). */
export const rerollCost = (s: TankState): number => Math.max(20, Math.round(fullRate(s) * 30))
export function rerollQuest(t: Tank, questId: string): Result {
  const s = t.s
  const i = s.quests.findIndex((q) => q.id === questId)
  if (i < 0) return { ok: false, why: 'Fant ikke oppdraget' }
  const c = rerollCost(s)
  if (s.coins < c) return { ok: false, why: 'Ikke nok mynter' }
  s.coins -= c
  s.quests.splice(i, 1)
  fillQuests(s)
  return { ok: true }
}

/** Trophies won that were not won before (they are added to the state). */
export function newTrophies(s: TankState): Trophy[] {
  const out: Trophy[] = []
  for (const tr of TROPHIES) if (!s.trophies.includes(tr.id) && tr.won(s)) { s.trophies.push(tr.id); out.push(tr) }
  return out
}

// ── the simulation ──
export interface StepEvents { collected: number; levelUp: number | null; fedFish: number; grew: Fish[]; event: EventKind | null; chest: boolean }
export function step(t: Tank, dt: number): StepEvents {
  const s = t.s
  const ev: StepEvents = { collected: 0, levelUp: null, fedFish: 0, grew: [], event: null, chest: false }
  const lvl0 = lvl(s)
  dt = Math.min(dt, 0.25)
  // the feeder
  if (s.up.feeder > 0) {
    t.feederT += dt
    if (t.feederT >= feederEvery(s.up.feeder)) { t.feederT = 0; for (let i = 0; i < 2 + s.up.feeder; i++) feed(t, rnd(0.1, 0.9)) }
  }
  // events: one every few minutes while you play
  if (t.event) { t.event.left -= dt; if (t.event.left <= 0) t.event = null }
  else if (s.fish.length) {
    t.eventT -= dt
    if (t.eventT <= 0) {
      const kind = pick(Object.keys(EVENTS) as EventKind[])
      t.event = { kind, left: EVENTS[kind].dur, dur: EVENTS[kind].dur }
      t.eventT = rnd(180, 360)
      s.stats.events++
      ev.event = kind
    }
  }
  // gold rain: coins fall from above
  if (t.event?.kind === 'gullregn') {
    t.rainT += dt
    while (t.rainT > 0.35) { t.rainT -= 0.35; t.coins.push({ x: rnd(0.05, 0.95), y: 0.02, value: Math.max(1, Math.round(Math.max(fullRate(s), 2) * 2)), age: 0, id: t.nextId++, rain: true }) }
  }
  // a chest now and then in the sand (from level 4)
  if (!t.chest && lvl(s) >= 4) {
    t.chestT -= dt * (1 + s.decor.kiste)
    if (t.chestT <= 0) { t.chest = { x: rnd(0.12, 0.88), age: 0 }; t.chestT = rnd(240, 480); ev.chest = true }
  } else if (t.chest) { t.chest.age += dt; if (t.chest.age > 90) t.chest = null }
  for (const p of t.pellets) p.y = Math.min(0.9, p.y + dt * 0.09)
  const feast = t.event?.kind === 'matfest' ? 2 : 1
  const frenzy = t.event?.kind === 'stimfeber' ? 2 : 1
  const hm = hungerMult(s)
  for (const f of s.fish) {
    const sp = speciesOf(f.sp)
    f.hunger = Math.max(0, f.hunger - sp.hunger * hm * dt)
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
      if (d < Math.max(0.03, fishSize(f) * 0.6)) {
        t.pellets.splice(t.pellets.indexOf(target), 1)
        f.hunger = Math.min(1, f.hunger + 0.45 + s.up.food * 0.04)
        const before = fishLevel(f.xp)
        f.xp += xpMult(s) * feast
        if (fishLevel(f.xp) > before) ev.grew.push(f)
        s.stats.fed++
        ev.fedFish++
      }
    } else {
      if (rng() < dt * 0.4) { f.vx = rnd(-1, 1) * speed; f.vy = rnd(-0.4, 0.4) * speed }
      f.vx += (Math.sign(f.vx || 1) * speed - f.vx) * dt * 0.5
    }
    f.x += f.vx * dt
    f.y += f.vy * dt
    if (f.x < 0.06) { f.x = 0.06; f.vx = Math.abs(f.vx) }
    if (f.x > 0.94) { f.x = 0.94; f.vx = -Math.abs(f.vx) }
    if (f.y < 0.1) { f.y = 0.1; f.vy = Math.abs(f.vy) * 0.5 }
    if (f.y > 0.8) { f.y = 0.8; f.vy = -Math.abs(f.vy) * 0.5 }
    if (f.hunger > 0) {
      const every = 2.5 + sp.size * 30
      f.coinT += dt
      if (f.coinT >= every) {
        f.coinT = 0
        t.coins.push({ x: f.x, y: f.y, value: Math.max(1, Math.round(fishRate(s, f) * every * frenzy)), age: 0, id: t.nextId++ })
      }
    }
  }
  for (const c of t.coins) { c.age += dt; c.y = c.rain ? Math.min(0.86, c.y + dt * 0.18) : Math.max(0.03, c.y - dt * 0.025) }
  if (s.up.magnet > 0) {
    t.magnetT += dt
    const every = 1.6 / s.up.magnet
    while (t.magnetT >= every && t.coins.length) { t.magnetT -= every; ev.collected += collect(t, t.coins[0]!.id) }
    if (!t.coins.length) t.magnetT = 0
  }
  t.coins = t.coins.filter((c) => c.age < 25)
  if (t.coins.length > 80) t.coins.splice(0, t.coins.length - 80)
  const lvl1 = lvl(s)
  if (lvl1 > lvl0) ev.levelUp = lvl1
  return ev
}

/** 1 234 · 12,3 k · 4,5 mill · 2,1 mrd · 3,2 bill */
export function fmtCoins(n: number): string {
  const f = (x: number): string => x.toLocaleString('nb-NO', { maximumFractionDigits: x < 10 ? 1 : 0 })
  if (n < 10 && n % 1) return (Math.round(n * 10) / 10).toLocaleString('nb-NO')
  if (n < 10000) return Math.floor(n).toLocaleString('nb-NO')
  if (n < 1e6) return `${f(n / 1e3)} k`
  if (n < 1e9) return `${f(n / 1e6)} mill`
  if (n < 1e12) return `${f(n / 1e9)} mrd`
  return `${f(n / 1e12)} bill`
}
