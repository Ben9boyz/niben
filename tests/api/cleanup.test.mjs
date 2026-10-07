import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, existsSync, utimesSync, rmSync } from 'node:fs'
import { DIR, ownerClient, makeUser } from './helpers.mjs'

// a pretend upload: index.html → index-AAAAAAAA-stamp.js → Page-BBBBBBBB.js (+ a wasm), and two old builds' files lying around
const put = (name, body, old = true) => { writeFileSync(`${DIR}/${name}`, body); if (old) { const t = Date.now() / 1000 - 86400; utimesSync(`${DIR}/${name}`, t, t) } }

test('old build files: only the unused ones with build names are found, nothing else is ever touched, and only on the owner’s word', async () => {
  put('index.html', '<script type="module" src="./index-AAAAAAAA-mzx1ab.js"></script>')
  put('index-AAAAAAAA-mzx1ab.js', 'import("./Page-BBBBBBBB.js"); new URL("draco_decoder-CCCCCCCC.wasm")')
  put('Page-BBBBBBBB.js', 'export default 1')
  put('draco_decoder-CCCCCCCC.wasm', 'x')
  put('index-OLDOLDOL-mzx0aa.js', 'old')
  put('Page-OLDOLD12.js', 'old')
  put('Page-JUSTNOW1.js', 'uploaded a moment ago', false)
  put('_notes-ABCDEFGH.php', '<?php // never touched')

  const owner = await ownerClient()
  const alice = await makeUser(owner)
  assert.ok([401, 403].includes((await alice.client.get('admin_cleanup')).status), 'the site owner only')

  const scan = (await owner.get('admin_cleanup')).json
  assert.deepEqual(scan.old.map((o) => o.name).sort(), ['Page-OLDOLD12.js', 'index-OLDOLDOL-mzx0aa.js'])
  assert.equal(scan.recent, 1, 'the file from a minute ago is left alone')
  assert.deepEqual(scan.missing, [])

  // only what is asked for (and was on the list) goes
  const del = await owner.post('admin_cleanup', { delete: true, names: ['Page-OLDOLD12.js', 'Page-BBBBBBBB.js', 'api.php'] })
  assert.equal(del.status, 200, del.text)
  assert.equal(del.json.deleted, 1)
  assert.ok(!existsSync(`${DIR}/Page-OLDOLD12.js`))
  for (const f of ['Page-BBBBBBBB.js', 'index-OLDOLDOL-mzx0aa.js', 'api.php', '_notes-ABCDEFGH.php', 'draco_decoder-CCCCCCCC.wasm']) assert.ok(existsSync(`${DIR}/${f}`), f)

  // an upload that isn't finished (the page points at a file that isn't there): nothing is deleted
  put('index.html', '<script type="module" src="./index-MISSING1-mzx2ab.js"></script>')
  assert.deepEqual((await owner.get('admin_cleanup')).json.missing, ['index-MISSING1-mzx2ab.js'])
  assert.equal((await owner.post('admin_cleanup', { delete: true, names: ['index-OLDOLDOL-mzx0aa.js'] })).status, 409)
  assert.ok(existsSync(`${DIR}/index-OLDOLDOL-mzx0aa.js`))

  for (const f of ['index.html', 'index-AAAAAAAA-mzx1ab.js', 'Page-BBBBBBBB.js', 'draco_decoder-CCCCCCCC.wasm', 'index-OLDOLDOL-mzx0aa.js', 'Page-JUSTNOW1.js', '_notes-ABCDEFGH.php']) rmSync(`${DIR}/${f}`, { force: true })
})
