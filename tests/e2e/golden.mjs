// A safety net for refactoring three/listening.ts (not a CI test): the 3D room is put in a set of states and every object
// in the scene (where it is, whether it shows, its size and colour) is written down, together with a picture. After the
// refactor the same states must give the same scene.
//   NIBEN_GOLDEN_OUT=/tmp/before ./tests/e2e/run-golden.sh        capture
//   node tests/e2e/golden.mjs diff /tmp/before /tmp/after          compare (exit 1 on a difference)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'

const [cmd, a, b] = process.argv.slice(2)

if (cmd === 'diff') {
  const TOL = 0.03
  let bad = 0
  for (const f of readdirSync(a).filter((x) => x.endsWith('.json'))) {
    const A = JSON.parse(readFileSync(`${a}/${f}`, 'utf8')), B = JSON.parse(readFileSync(`${b}/${f}`, 'utf8'))
    const byPath = (list) => { const m = new Map(); for (const o of list) { const k = o[0]; (m.get(k) ?? m.set(k, []).get(k)).push(o) } return m }
    const ma = byPath(A), mb = byPath(B)
    const problems = []
    for (const [k, la] of ma) {
      const lb = mb.get(k)
      if (!lb || lb.length !== la.length) { problems.push(`${k}: ${la.length} → ${lb?.length ?? 0} objects`); continue }
      la.forEach((x, i) => {
        const y = lb[i]
        const num = x.slice(1, 7).every((v, j) => Math.abs(v - y[1 + j]) <= TOL)
        if (!num || x[7] !== y[7] || x[8] !== y[8]) problems.push(`${k}: ${JSON.stringify(x.slice(1))} → ${JSON.stringify(y.slice(1))}`)
      })
    }
    for (const k of mb.keys()) if (!ma.has(k)) problems.push(`${k}: new`)
    console.log(`${f}: ${A.length} objects${problems.length ? `, ${problems.length} differ` : ' – same'}`)
    problems.slice(0, 12).forEach((p) => console.log('   ', p))
    bad += problems.length
  }
  process.exit(bad ? 1 : 0)
}

// ── capture ──
const { launch, openPage, ownerClient, mockSpotify, db, closePages } = await import('./helpers.mjs')
const out = process.env.NIBEN_GOLDEN_OUT
mkdirSync(out, { recursive: true })
const owner = await ownerClient()
await owner.post('me_settings', { sections: { lytte: true } })
mockSpotify({ albums: 8, device: true })
db('connect', '1')
const browser = await launch()
const page = await openPage(browser, { mode: 'rom', width: 1100, height: 700, hash: '/lytte' })
await page.waitForFunction(() => !!window.__room, null, { timeout: 40000 })
await page.waitForTimeout(6000)
await page.addStyleTag({ content: '.dock, .nav-wrap, .mtop, .loader { display: none !important }' })
await page.evaluate(() => window.__room.setCalm(true))

// (the candle flame flickers on its own: left out)
const dump = async () => (await page.evaluate(() => window.__room.dumpScene())).filter((o) => !(o[8] === 'e8a24e' && o[7] === 99))
const same = (x, y) => x.length === y.length && x.every((o, i) => o[0] === y[i][0] && o[7] === y[i][7] && o.slice(1, 7).every((v, j) => Math.abs(v - y[i][1 + j]) < 0.004))
const shoot = async (name) => {
  // wait until nothing moves any more (records slide and the camera settles at a pace that depends on the machine)
  let prev = await dump()
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(700)
    const now = await dump()
    if (same(prev, now) && i > 2) break
    prev = now
  }
  writeFileSync(`${out}/${name}.png`, await page.screenshot())
  writeFileSync(`${out}/${name}.json`, JSON.stringify(prev))
}
const album = (n) => `spotify:album:ALB${n}`
// the stores of the page itself (the same module instances the page uses)
const withStores = (fn, arg) => page.evaluate(async ([src, a]) => {
  const spotify = (await import('/src/composables/useSpotify.ts')).spotify
  const room = (await import('/src/composables/useRoom.ts')).room
  return new Function('spotify', 'room', 'arg', `return (${src})(spotify, room, arg)`)(spotify, room, a)
}, [fn.toString(), arg])

await page.evaluate(() => window.__room.goTo('lytte', { instant: true }))
await shoot('1-shelf')

await page.evaluate((u) => window.__room.setMusicView({ selected: u }), album(3))
await shoot('2-record-out')

await page.evaluate((u) => window.__room.setMusicView({ selected: u, flip: true }), album(3))
await shoot('3-record-flipped')

await page.evaluate(() => window.__room.setMusicView({}))
await withStores((spotify) => {
  spotify.now = { playing: true, name: 'Track 4', artist: 'X', album: 'Album 4', uri: 'spotify:track:T000000000004', context: 'spotify:album:ALB4', image: null, image_large: null, progress_ms: 20000, duration_ms: 200000, shuffle: false, at: Math.floor(Date.now() / 1000) }
}, null)
await shoot('4-playing')

await page.evaluate(() => window.__room.setMusicView({ deck: true }))
await shoot('5-deck-view')

await page.evaluate(() => window.__room.setMusicView({ ipod: true }))
await shoot('6-ipod-held')

await page.evaluate(() => window.__room.setMusicView({ ipod: true, big: true }))
await shoot('7-ipod-big')

await page.evaluate((u) => window.__room.setMusicView({ peek: u }), album(6))
await shoot('8-peek')

await page.evaluate(() => window.__room.setMusicView({}))
await page.evaluate(() => window.__room.setStack([{ uri: 'spotify:album:ALB1', name: 'Album 1', artist: 'X', queued: true }, { uri: 'spotify:album:ALB2', name: 'Album 2', artist: 'X' }]))
await shoot('9-stack')

await page.evaluate(() => window.__room.goTo('hjem', { instant: true }))
await shoot('10-home')

console.log('saved', readdirSync(out).filter((x) => x.endsWith('.json')).join(', '))
console.log('page errors:', page.errors)
await closePages()
await browser.close()
