import { describe, it, expect } from 'vitest'
import { SPECIES, TROPHIES, MAX_LEVEL, coinsForLevel, levelOf, levelProgress, newState, makeTank, buyFish, feed, step, collect, upgrade, catchUp, newTrophies, fromSaved, toSaved, maxFish, earningRate, sellFish, canBuyFish, fmtCoins } from '@/lib/games/aquarium'

describe('the aquarium game', () => {
  it('has a hundred levels that each cost more than the last, and species that unlock along the way', () => {
    for (let n = 2; n <= MAX_LEVEL; n++) expect(coinsForLevel(n)).toBeGreaterThan(coinsForLevel(n - 1))
    expect(levelOf(0)).toBe(1)
    expect(levelOf(coinsForLevel(10))).toBe(10)
    expect(levelOf(coinsForLevel(10) - 1)).toBe(9)
    expect(levelOf(1e15)).toBe(MAX_LEVEL)
    expect(levelProgress(1e15)).toBe(1)
    const unlocks = SPECIES.map((s) => s.unlock)
    expect([...unlocks].sort((a, b) => a - b)).toEqual(unlocks)
    expect(unlocks.every((u) => u >= 1 && u <= MAX_LEVEL)).toBe(true)
    // each one is worth more than the last, and pays itself back in a few minutes of being fed
    for (let i = 1; i < SPECIES.length; i++) expect(SPECIES[i]!.rate).toBeGreaterThan(SPECIES[i - 1]!.rate)
    for (const s of SPECIES) expect(s.cost / s.rate).toBeLessThan(400)
  })

  it('buying, feeding and picking up coins: the money comes in and the level goes up', () => {
    const t = makeTank(newState(0))
    expect(buyFish(t, 'neon')).toEqual({ ok: false, why: 'Låses opp på nivå 2' })
    expect(buyFish(t, 'guppy').ok).toBe(true)
    expect(buyFish(t, 'guppy').ok).toBe(true)
    expect(t.s.coins).toBe(5)
    let got = 0
    for (let i = 0; i < 20 * 60 * 4; i++) { // twenty minutes, fed now and then, every coin picked up
      if (i % 80 === 0) feed(t, 0.5)
      step(t, 0.25)
      for (const c of [...t.coins]) got += collect(t, c.id)
    }
    expect(got).toBeGreaterThan(300)
    expect(t.s.stats.fed).toBeGreaterThan(5)
    expect(levelOf(t.s.total)).toBeGreaterThanOrEqual(3)
  })

  it('a hungry fish makes nothing; food brings it back', () => {
    const t = makeTank(newState(0))
    buyFish(t, 'guppy')
    t.s.fish[0]!.hunger = 0
    expect(earningRate(t.s)).toBe(0)
    for (let i = 0; i < 40; i++) step(t, 0.25)
    expect(t.coins.length).toBe(0)
    feed(t, t.s.fish[0]!.x, t.s.fish[0]!.y)
    for (let i = 0; i < 200 && t.s.fish[0]!.hunger === 0; i++) step(t, 0.1)
    expect(t.s.fish[0]!.hunger).toBeGreaterThan(0)
  })

  it('the tank has room for so many fish – a bigger one for more', () => {
    const t = makeTank(newState(0))
    t.s.coins = 1e6
    t.s.total = coinsForLevel(5)
    for (let i = 0; i < maxFish(0); i++) expect(buyFish(t, 'guppy').ok).toBe(true)
    expect(canBuyFish(t.s, 'guppy')).toEqual({ ok: false, why: 'Tanken er full – kjøp en større' })
    expect(upgrade(t, 'tank').ok).toBe(true)
    expect(buyFish(t, 'guppy').ok).toBe(true)
    const before = t.s.coins
    expect(sellFish(t, t.s.fish[0]!.id)).toBe(2)
    expect(t.s.coins).toBe(before + 2)
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

  it('while you are away the fish earn a little (as long as they have food) – never more than eight hours', () => {
    const s = newState(0)
    const t = makeTank(s)
    s.coins = 100; buyFish(t, 'guppy')
    s.fish[0]!.hunger = 1
    const hourLater = catchUp(s, 3600 * 1000)
    expect(hourLater).toBeGreaterThan(0)
    expect(hourLater).toBeLessThan(0.5 * 3600 * 1.0) // (it ran out of food long before the hour was up)
    s.up.feeder = 1; s.fish[0]!.hunger = 1
    const day = catchUp(s, 3600 * 1000 + 24 * 3600 * 1000)
    expect(day).toBeCloseTo(0.5 * 0.5 * 8 * 3600, -2) // (fed all the time, capped at eight hours)
  })

  it('trophies are won once, and the state survives a save and a load', () => {
    const t = makeTank(newState(0))
    buyFish(t, 'guppy')
    t.s.total = coinsForLevel(10)
    const won = newTrophies(t.s).map((x) => x.id)
    expect(won).toEqual(expect.arrayContaining(['first', 'lvl5', 'lvl10']))
    expect(newTrophies(t.s)).toEqual([])
    t.s.placed = ['lvl10', 'not-a-trophy']
    const back = fromSaved(JSON.parse(JSON.stringify(toSaved(t.s))), 1)
    expect(back.fish.length).toBe(1)
    expect(back.trophies).toEqual(t.s.trophies)
    expect(back.placed).toEqual(['lvl10'])
    expect(TROPHIES.length).toBeGreaterThanOrEqual(12)
    // nonsense in, a sound state out
    const odd = fromSaved({ coins: 'lots', fish: [{ sp: 'kraken' }, null], up: { tank: 99 } }, 5)
    expect(odd.coins).toBe(15)
    expect(odd.fish).toEqual([])
    expect(odd.up.tank).toBe(10)
  })

  it('writes big numbers short', () => {
    expect(fmtCoins(950)).toBe('950')
    expect(fmtCoins(0.5)).toBe('0,5')
    expect(fmtCoins(12500)).toBe('13 k')
    expect(fmtCoins(4.5e6)).toBe('4,5 mill')
    expect(fmtCoins(2.1e9)).toBe('2,1 mrd')
  })
})
