import { describe, it, expect, beforeEach } from 'vitest'
import {
  SPECIES, TROPHIES, BIOMES, MAX_LEVEL, FISH_MAX, PRESTIGE_LEVEL, coinsForLevel, levelOf, levelProgress, newState, makeTank, buyFish, feed, step, collect, upgrade, catchUp,
  newTrophies, fromSaved, toSaved, maxFish, earningRate, sellFish, canBuyFish, fmtCoins, setRng, fishLevel, fishRate, fillQuests, questDone, claimQuest, prestige, pearlsFor,
  buyPerk, buyDecor, openChest, claimDaily, dailyReady, rerollQuest, renameFish, biomeOf, variantChance,
} from '@/lib/games/aquarium'

// a predictable "random": a fixed sequence that repeats
const seqRng = (vals: number[]): (() => number) => { let i = 0; return () => vals[i++ % vals.length]! }
beforeEach(() => setRng(seqRng([0.5, 0.31, 0.77, 0.12, 0.64, 0.93, 0.45])))

describe('the aquarium game', () => {
  it('has a hundred levels that each cost more, and species that unlock along the way', () => {
    for (let n = 2; n <= MAX_LEVEL; n++) expect(coinsForLevel(n)).toBeGreaterThan(coinsForLevel(n - 1))
    expect(levelOf(0)).toBe(1)
    expect(levelOf(coinsForLevel(10))).toBe(10)
    expect(levelOf(coinsForLevel(10) - 1)).toBe(9)
    expect(levelOf(1e15)).toBe(MAX_LEVEL)
    expect(levelProgress(1e15)).toBe(1)
    const unlocks = SPECIES.map((s) => s.unlock)
    expect([...unlocks].sort((a, b) => a - b)).toEqual(unlocks)
    for (let i = 1; i < SPECIES.length; i++) expect(SPECIES[i]!.rate).toBeGreaterThan(SPECIES[i - 1]!.rate)
    for (const s of SPECIES) expect(s.cost / s.rate).toBeLessThan(400)
    expect(BIOMES.length).toBe(6)
  })

  it('buying, feeding and picking up coins: the money comes in and the level goes up', () => {
    const t = makeTank(newState(0))
    expect(buyFish(t, 'neon')).toEqual({ ok: false, why: 'Låses opp på nivå 2' })
    expect(buyFish(t, 'guppy').ok).toBe(true)
    expect(buyFish(t, 'guppy').ok).toBe(true)
    expect(t.s.coins).toBe(5)
    let got = 0
    for (let i = 0; i < 20 * 60 * 4; i++) {
      if (i % 80 === 0) feed(t, 0.5)
      step(t, 0.25)
      for (const c of [...t.coins]) got += collect(t, c.id)
    }
    expect(got).toBeGreaterThan(300)
    expect(t.s.stats.fed).toBeGreaterThan(5)
    expect(levelOf(t.s.total)).toBeGreaterThanOrEqual(3)
    expect(t.s.best).toBe(levelOf(t.s.total))
  })

  it('fish grow with every meal – a grown fish earns more and is drawn bigger', () => {
    const s = newState(0)
    const t = makeTank(s)
    buyFish(t, 'guppy')
    const f = s.fish[0]!
    const young = fishRate(s, f)
    expect(fishLevel(0)).toBe(1)
    f.xp = 250
    expect(fishLevel(f.xp)).toBe(11)
    expect(fishRate(s, f)).toBeCloseTo(young * 2.5)
    expect(fishLevel(1e9)).toBe(FISH_MAX)
    renameFish(s, f.id, '  Nemo  ')
    expect(s.fish[0]!.name).toBe('Nemo')
  })

  it('now and then a bought fish is shiny or gold – worth three and ten times as much, and noted in the fish book', () => {
    const t = makeTank(newState(0))
    t.s.coins = 1000
    setRng(() => 0.001) // (the luckiest roll there is)
    const r = buyFish(t, 'guppy')
    expect(r.ok && r.fish?.variant).toBe('gull')
    expect(t.s.dex.guppy).toBe(5)
    setRng(() => 0.02)
    expect(buyFish(t, 'guppy').fish?.variant).toBe('skinnende')
    expect(fishRate(t.s, t.s.fish[0]!)).toBeCloseTo(fishRate(t.s, t.s.fish[1]!) * 10 / 3)
    // the lantern and the luck perk make it likelier
    const base = variantChance(t.s).skinnende
    t.s.decor.lykt = 2; t.s.perks.flaks = 1
    expect(variantChance(t.s).skinnende).toBeCloseTo(base * 4)
  })

  it('a hungry fish makes nothing; food brings it back', () => {
    const t = makeTank(newState(0))
    buyFish(t, 'guppy')
    t.s.fish[0]!.hunger = 0
    expect(earningRate(t.s)).toBe(0)
    for (let i = 0; i < 40; i++) step(t, 0.25)
    expect(t.coins.filter((c) => !c.rain).length).toBe(0)
    feed(t, t.s.fish[0]!.x, t.s.fish[0]!.y)
    for (let i = 0; i < 200 && t.s.fish[0]!.hunger === 0; i++) step(t, 0.1)
    expect(t.s.fish[0]!.hunger).toBeGreaterThan(0)
    expect(t.s.fish[0]!.xp).toBeGreaterThan(0)
  })

  it('the tank has room for so many fish – a bigger one for more; decorations cost coins and give bonuses', () => {
    const t = makeTank(newState(0))
    t.s.coins = 1e7
    t.s.total = coinsForLevel(9)
    for (let i = 0; i < maxFish(0); i++) expect(buyFish(t, 'guppy').ok).toBe(true)
    expect(canBuyFish(t.s, 'guppy')).toEqual({ ok: false, why: 'Tanken er full – kjøp en større' })
    expect(upgrade(t, 'tank').ok).toBe(true)
    expect(buyFish(t, 'guppy').ok).toBe(true)
    expect(sellFish(t, t.s.fish[0]!.id)).toBeGreaterThan(0)
    const r0 = fishRate(t.s, t.s.fish[0]!)
    expect(buyDecor(t, 'slott').ok).toBe(true)
    expect(fishRate(t.s, t.s.fish[0]!)).toBeCloseTo(r0 * 1.1)
    expect(buyDecor(t, 'lykt')).toEqual({ ok: false, why: 'Låses opp på nivå 20' })
  })

  it('the magnet picks up the coins by itself; the feeder feeds by itself', () => {
    const t = makeTank(newState(0))
    t.s.total = coinsForLevel(10); t.s.coins = 1e6
    buyFish(t, 'guppy'); buyFish(t, 'guppy')
    upgrade(t, 'magnet'); upgrade(t, 'feeder')
    const coins0 = t.s.coins
    for (let i = 0; i < 4 * 300; i++) step(t, 0.25)
    expect(t.s.coins).toBeGreaterThan(coins0)
    expect(t.s.stats.fed).toBeGreaterThan(0)
    expect(t.s.fish.every((f) => f.hunger > 0)).toBe(true)
  })

  it('while you are away the fish earn a little – never more than eight hours (longer with the perk)', () => {
    const s = newState(0)
    const t = makeTank(s)
    s.coins = 100; buyFish(t, 'guppy')
    s.fish[0]!.hunger = 1
    const hourLater = catchUp(s, 3600 * 1000)
    expect(hourLater).toBeGreaterThan(0)
    expect(hourLater).toBeLessThan(0.5 * 3600)
    s.up.feeder = 1; s.fish[0]!.hunger = 1
    const day = catchUp(s, 3600 * 1000 + 24 * 3600 * 1000)
    expect(day).toBeCloseTo(0.5 * 0.5 * 8 * 3600, -2)
    s.perks.borte = 1
    const later = catchUp(s, 3600 * 1000 + 48 * 3600 * 1000)
    expect(later).toBeGreaterThan(day * 1.2)
  })

  it('quests: three at a time, a finished one pays out and a new one takes its place', () => {
    const t = makeTank(newState(0))
    t.s.coins = 100
    buyFish(t, 'guppy')
    fillQuests(t.s)
    expect(t.s.quests.length).toBe(3)
    expect(new Set(t.s.quests.map((q) => q.kind)).size).toBe(3)
    const q = t.s.quests[0]!
    expect(questDone(t.s, q)).toBe(false)
    expect(claimQuest(t, q.id)).toBeNull()
    // do it (whatever it is): push the counter it follows past the target
    const st = t.s.stats
    if (q.kind === 'feed') st.fed += q.target
    else if (q.kind === 'coins') st.coins += q.target
    else if (q.kind === 'buy') st.bought += q.target
    else if (q.kind === 'chest') st.chests += q.target
    else if (q.kind === 'upgrade') st.upgrades += q.target
    else if (q.kind === 'level') t.s.total = coinsForLevel(q.target)
    else if (q.kind === 'grow') t.s.fish[0]!.xp = 1e6
    expect(questDone(t.s, q)).toBe(true)
    const coins = t.s.coins
    expect(claimQuest(t, q.id)?.id).toBe(q.id)
    expect(t.s.coins).toBeGreaterThan(coins)
    expect(t.s.quests.length).toBe(3)
    expect(t.s.stats.quests).toBe(1)
    t.s.coins = 1e6
    const other = t.s.quests[0]!.id
    expect(rerollQuest(t, other).ok).toBe(true)
    expect(t.s.quests.some((x) => x.id === other)).toBe(false)
  })

  it('events and chests turn up while you play', () => {
    const t = makeTank(newState(0))
    t.s.total = coinsForLevel(10); t.s.coins = 1000
    buyFish(t, 'guppy')
    let events = 0, chests = 0
    for (let i = 0; i < 4 * 60 * 20; i++) { const e = step(t, 0.25); if (e.event) events++; if (e.chest) { chests++; expect(openChest(t)).not.toBeNull() } }
    expect(events).toBeGreaterThan(1)
    expect(chests).toBeGreaterThan(1)
    expect(t.s.stats.chests).toBe(chests)
  })

  it('a daily gift, bigger the more days in a row', () => {
    const s = newState(0)
    const day = 86400000
    const d1 = claimDaily(s, 10 * day)
    expect(d1?.streak).toBe(1)
    expect(claimDaily(s, 10 * day + 1000)).toBeNull()
    expect(dailyReady(s, 11 * day)).toBe(true)
    const d2 = claimDaily(s, 11 * day)
    expect(d2?.streak).toBe(2)
    expect(d2!.coins).toBeGreaterThan(d1!.coins)
    expect(claimDaily(s, 14 * day)?.streak).toBe(1) // (a day missed: from the start)
    expect(s.daily.best).toBe(2)
  })

  it('moving to a new sea: pearls for the coins collected, a fresh start that pays more, and perks that last', () => {
    const t = makeTank(newState(0))
    expect(pearlsFor(coinsForLevel(PRESTIGE_LEVEL - 1))).toBe(0)
    t.s.total = coinsForLevel(40); t.s.coins = 1e6
    buyFish(t, 'guppy'); upgrade(t, 'tank')
    t.s.trophies = ['first']
    const gain = pearlsFor(t.s.total)
    expect(gain).toBeGreaterThan(5)
    const r1 = fishRate(t.s, t.s.fish[0]!)
    expect(prestige(t)).toBe(gain)
    expect(t.s.prestiges).toBe(1)
    expect(t.s.fish).toEqual([])
    expect(t.s.total).toBe(0)
    expect(t.s.up.tank).toBe(0)
    expect(t.s.trophies).toEqual(['first'])
    expect(t.s.dex.guppy).toBe(1)
    expect(t.s.best).toBe(40)
    expect(biomeOf(t.s.prestiges).name).toBe('Korallrevet')
    expect(t.s.quests.length).toBe(3)
    buyFish(t, 'guppy')
    expect(fishRate(t.s, t.s.fish[0]!)).toBeGreaterThan(r1 * 1.25) // (the reef pays more, and so do the pearls)
    expect(buyPerk(t, 'verdi').ok).toBe(true)
    expect(t.s.perks.verdi).toBe(1)
    expect(t.s.pearls).toBe(gain - 2)
  })

  it('trophies are won once, and the state survives a save and a load (also an old one)', () => {
    const t = makeTank(newState(0))
    buyFish(t, 'guppy')
    t.s.total = coinsForLevel(10); t.s.best = 10
    const won = newTrophies(t.s).map((x) => x.id)
    expect(won).toEqual(expect.arrayContaining(['first', 'lvl5', 'lvl10']))
    expect(newTrophies(t.s)).toEqual([])
    t.s.fish[0]!.xp = 77; t.s.fish[0]!.name = 'Bob'
    const back = fromSaved(JSON.parse(JSON.stringify(toSaved(t.s))), 1)
    expect(back.fish.length).toBe(1)
    expect(back.fish[0]!.xp).toBe(77)
    expect(back.fish[0]!.name).toBe('Bob')
    expect(back.trophies).toEqual(t.s.trophies)
    expect(TROPHIES.length).toBeGreaterThanOrEqual(30)
    // a saved game from the first version
    const old = fromSaved({ v: 1, coins: 50, total: 900, fish: [{ id: 'x', sp: 'neon', hunger: 0.5 }], up: { tank: 1, food: 0, feeder: 0, magnet: 0 }, trophies: ['first'], placed: [], stats: { fed: 3, bought: 1, collected: 2 }, last: 0 }, 5)
    expect(old.v).toBe(2)
    expect(old.fish[0]!.variant).toBe('normal')
    expect(old.fish[0]!.xp).toBe(0)
    expect(old.dex.neon).toBe(1)
    expect(old.best).toBe(levelOf(900))
    // nonsense in, a sound state out
    const odd = fromSaved({ coins: 'lots', fish: [{ sp: 'kraken' }, null], up: { tank: 99 }, perks: { verdi: -4 } }, 5)
    expect(odd.coins).toBe(15)
    expect(odd.fish).toEqual([])
    expect(odd.up.tank).toBe(10)
    expect(odd.perks.verdi).toBe(0)
  })

  it('writes big numbers short', () => {
    expect(fmtCoins(950)).toBe('950')
    expect(fmtCoins(0.5)).toBe('0,5')
    expect(fmtCoins(12500)).toBe('13 k')
    expect(fmtCoins(4.5e6)).toBe('4,5 mill')
    expect(fmtCoins(2.1e9)).toBe('2,1 mrd')
    expect(fmtCoins(3.2e12)).toBe('3,2 bill')
  })
})
