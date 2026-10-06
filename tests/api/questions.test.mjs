import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client, ownerClient, makeUser, visitorIn } from './helpers.mjs'

test('the owner sets the questions, each room answers the ones it wants, and a question nobody answered is just empty', async () => {
  const owner = await ownerClient()
  const alice = await makeUser(owner)

  // there are questions from the start (a few ready ones), the same in every room
  const first = (await alice.client.get('content')).json.questions
  assert.ok(first.length >= 3, 'ready-made questions')

  // only the owner of the site can change them
  assert.ok([401, 403].includes((await alice.client.post('about_questions', { questions: [{ text: 'Hei?' }] })).status))
  const set = await owner.post('about_questions', { questions: [{ id: first[0].id, text: 'Låt som får meg i gang' }, { text: 'Sted jeg vil anbefale' }, { text: '   ' }] })
  assert.equal(set.status, 200, set.text)
  const qs = set.json.questions
  assert.equal(qs.length, 2, 'the empty one is dropped')
  assert.equal(qs[0].id, first[0].id, 'an existing question keeps its id')

  // alice answers one; an unknown id and a long answer are handled
  const saved = await alice.client.post('about_save', { tagline: 'hei', tekst: '', lenker: [], svar: { [qs[0].id]: 'Jazz', zzz: 'ukjent', [qs[1].id]: '' } })
  assert.equal(saved.status, 200, saved.text)
  assert.deepEqual(saved.json.about.svar, { [qs[0].id]: 'Jazz' })

  // a visitor in her room sees the answer, the main room does not have it
  const visitor = await visitorIn(alice.name)
  const c = (await visitor.get('content')).json
  assert.equal(c.about.svar[qs[0].id], 'Jazz')
  assert.deepEqual(c.questions.map((q) => q.id), qs.map((q) => q.id))
  const main = (await new Client().get('content')).json
  assert.ok(!main.about?.svar?.[qs[0].id], 'not in the main room')

  // saving the text again keeps the answers
  await alice.client.post('about_save', { tagline: 'nytt', tekst: 'tekst', lenker: [] })
  assert.equal((await alice.client.get('about_get')).json.about.svar[qs[0].id], 'Jazz')
})
