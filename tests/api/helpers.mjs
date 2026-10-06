// Shared by the API tests: a client with its own cookies, and helpers for accounts and the fake Spotify.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'

export const API = process.env.NIBEN_API
export const DIR = process.env.NIBEN_TEST_DIR
export const OWNER_PASSWORD = process.env.NIBEN_OWNER_PASSWORD

/** One browser: keeps its cookies between calls. */
export class Client {
  cookies = new Map()
  async call(action, { body, query = '', method } = {}) {
    const headers = { 'X-Niben': '1' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    if (cookie) headers.Cookie = cookie
    const res = await fetch(`${API}?action=${action}${query}`, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';')
      const i = pair.indexOf('=')
      const name = pair.slice(0, i), value = pair.slice(i + 1)
      if (value === '' || /expires=Thu, 01 Jan 1970/i.test(line)) this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* not JSON (feed, redirect …) */ }
    return { status: res.status, json, text, headers: res.headers }
  }
  get = (action, query = '') => this.call(action, { query })
  post = (action, body = {}) => this.call(action, { body })
  /** the room the server says this browser is looking at */
  roomCookie = () => this.cookies.get('niben_r')
}

export async function ownerClient() {
  const c = new Client()
  const r = await c.post('login', { password: OWNER_PASSWORD })
  assert.equal(r.status, 200, 'owner login')
  return c
}

let counter = 0
/** A new approved account that is logged in. Returns { client, name, id }. */
export async function makeUser(owner, name = `u${Date.now().toString(36)}${counter++}`) {
  const pw = 'passpass1'
  clearLimits()
  const v = new Client()
  const reg = await v.post('user_register', { username: name, email: `${name}@example.com`, password: pw })
  assert.equal(reg.status, 200, `register ${name}: ${reg.text}`)
  const list = await owner.get('admin_users')
  const id = list.json.users.find((u) => u.username === name).id
  const ok = await owner.post('admin_user_set', { id, do: 'approve' })
  assert.equal(ok.status, 200)
  const c = new Client()
  const login = await c.post('user_login', { username: name, password: pw })
  assert.equal(login.status, 200, `login ${name}: ${login.text}`)
  return { client: c, name, id, password: pw, email: `${name}@example.com` }
}

/** A visitor (nobody logged in) who is looking at somebody's room. */
export async function visitorIn(name) {
  const v = new Client()
  const r = await v.post('room_set', { username: name })
  assert.equal(r.status, 200, `room_set ${name}: ${r.text}`)
  return v
}

// ── the fake Spotify ──
export const mockSpotify = (state) => writeFileSync(`${DIR}/spotify-mock.json`, JSON.stringify(state))
export const spotifyCalls = () => readFileSync(`${DIR}/spotify-calls.log`, 'utf8').split('\n').filter(Boolean)
export const clearCalls = () => writeFileSync(`${DIR}/spotify-calls.log`, '')
export const mailLog = () => readFileSync(`${DIR}/mail.log`, 'utf8')

/** Runs tests/api/db.php (clean database, connect a room to Spotify, read a stored value …). */
export function db(...args) {
  return execFileSync('php', ['tests/api/db.php', ...args], { env: process.env, encoding: 'utf8' })
}
/** The flood protection counts per IP and everything here comes from one: start each test with clean counters. */
export function clearLimits() {
  try { db('exec', 'DELETE FROM rate_limits') } catch { /* no table yet: nothing is counted */ }
  try { db('exec', 'DELETE FROM login_attempts') } catch { /* same */ }
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
