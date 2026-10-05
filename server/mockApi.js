// Dev-only stand-in for public/api.php (used by `npm run dev`, never deployed).
// Keeps everything in memory; password is "utvikling".
import { Readable } from 'node:stream'
import { seed } from './mockSeed.js'

export function mockApi() {
  const db = { trips: [], photos: [], books: [], recordings: [], songs: [{ id: 1, title: 'Wonderwall', artist: 'Oasis', chords: 'Em7 G Dsus4 A7sus4', bpm: 87, beats: 4, capo: 2, ug_url: null, notes: 'Strumming: D DU UDU', sheet: '[Vers]\nEm7  G  Dsus4  A7sus4\nToday is gonna be the day\n\n[Refreng]\nC  D  Em\nAnd after all' }], seq: 1 }
  const files = new Map() // path -> { type, buf }
  seed(db, files)
  let loggedIn = false
  const mock = {} // scratch state for the stand-in endpoints
  const sp = { lock: 0, lockSeconds: 600, now: { playing: false }, recent: [], queued: [] }
  const SP_ALBUMS = [
    ['Blue Hour', 'The Midnight Club', '#2b6cb0'], ['Paper Planes', 'Northern Lights', '#d69e2e'], ['Fjord', 'Aurora Sky', '#38a169'],
    ['Late Night Drive', 'Neon Coast', '#805ad5'], ['Wooden Room', 'Acoustic Days', '#c05621'], ['Static', 'Low Tide', '#2d3748'],
    ['Summer Tapes', 'Vintage Radio', '#e53e3e'], ['Glass', 'Clear Water', '#319795'],
  ]
    // 65 records, like the real shelf
    .flatMap((x, k, all) => Array.from({ length: Math.ceil(65 / all.length) }, (_, j) => [j ? `${x[0]} ${j + 1}` : x[0], x[1], `hsl(${(k * 47 + j * 23) % 360}, 45%, 45%)`]))
    .slice(0, 65)
    .map(([name, artist, color], i) => ({ id: 'a' + i, uri: `spotify:album:mockalbum${String(i).padStart(10, '0')}`, name, artist, year: String(2015 + (i % 10)), image: null, color, url: null, tracks: 10 + (i % 6), added: 1760000000 - i * 86400 }))
  // tiny coloured squares as stand-in covers
  const mockCover = (h) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="hsl(${h % 360},60%,50%)"/><circle cx="4" cy="4" r="1.6" fill="#fff"/></svg>`)}`
  const MOCK_TITLES = ['Intro', 'Golden Hour', 'Slow Down', 'Northern Sky', 'Paper Hearts', 'Drift', 'Home', 'Waves', 'Late Again', 'Outro', 'Echoes', 'Morning']
  const mockAlbumTracks = (id) => Array.from({ length: 6 + (id.charCodeAt(id.length - 1) % 7) }, (_, i) => ({ uri: `spotify:track:mocktrack${id}${String(i).padStart(4, '0')}`, name: MOCK_TITLES[i % 12], artist: 'Mock Artist', ms: 150000 + i * 17000, n: i + 1, img: mockCover(i * 53) }))
  SP_ALBUMS.forEach((a, i) => { a.image = a.image_large = a.thumb = mockCover(i * 29 + 10) }) // coloured stand-in covers
  const SP_PLAYLISTS = ['Øving – fokus', 'Gitarhelter', 'Søndagsmorgen', 'Treningsmiks', 'Roadtrip 2025'].map((name, i) => ({
    id: 'p' + i, uri: `spotify:playlist:mockplaylist${String(i).padStart(10, '0')}`, name, owner: 'Benjamin', image: null, thumb: mockCover(i * 90 + 20), count: 20 + i * 7, url: null,
  }))

  const send = (res, status, data) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }

  async function readBody(req) {
    const ct = req.headers['content-type'] || ''
    if (!ct) return { fields: {}, file: null }
    const request = new Request('http://x', { method: 'POST', headers: req.headers, body: Readable.toWeb(req), duplex: 'half' })
    if (ct.startsWith('application/json')) return { fields: await request.json(), file: null }
    const fd = await request.formData()
    const fields = {}
    let file = null
    for (const [k, v] of fd) {
      if (typeof v === 'string') fields[k] = v
      else if (v.size) file = v
    }
    return { fields, file }
  }

  const blank = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : v)

  return {
    name: 'niben-mock-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://x')
        if (url.pathname.startsWith('/uploads/')) {
          const f = files.get(url.pathname.slice(1))
          if (!f) return next()
          res.setHeader('Content-Type', f.type)
          return res.end(f.buf)
        }
        if (url.pathname === '/thumb.php') {
          // the real one makes small JPEGs; here the original is good enough
          const f = files.get(`uploads/photos/${url.searchParams.get('f')}`)
          if (!f) { res.statusCode = 404; return res.end() }
          res.setHeader('Content-Type', f.type)
          return res.end(f.buf)
        }
        if (url.pathname !== '/api.php') return next()
        const action = url.searchParams.get('action')
        const isPost = req.method === 'POST'
        const needAdmin = () => {
          if (!loggedIn) { send(res, 401, { error: 'Du må logge inn.' }); return false }
          if (req.headers['x-niben'] !== '1') { send(res, 403, { error: 'Ugyldig forespørsel.' }); return false }
          return true
        }
        const { fields: b, file } = isPost ? await readBody(req) : { fields: {}, file: null }
        const store = async (sub, f) => {
          const ext = sub === 'photos' ? 'jpg' : (f.name.split('.').pop() || 'mp3').toLowerCase()
          const path = `uploads/${sub}/${Math.random().toString(16).slice(2).padEnd(20, '0').slice(0, 20)}.${ext}`
          files.set(path, { type: f.type || 'application/octet-stream', buf: Buffer.from(await f.arrayBuffer()) })
          return path
        }

        switch (action) {
          case 'content':
            return send(res, 200, {
              trips: db.trips.map((t) => ({ ...t, photos: db.photos.filter((p) => p.trip_id === t.id) }))
                .sort((a, b) => String(b.date_from || b.year || '').localeCompare(String(a.date_from || a.year || ''))),
              books: [...db.books].reverse(),
              recordings: [...db.recordings].reverse(),
              songs: db.songs,
              about: db.about || null,
              texts: db.texts || {},
            })
          case 'texts_save': {
            if (!needAdmin()) return
            const out = {}
            for (const [k, v] of Object.entries(b.texts || {})) if (/^[a-z0-9_.]{1,60}$/.test(k) && typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 1500)
            db.texts = out
            return send(res, 200, { ok: true, texts: out })
          }
          case 'song_save': {
            if (!needAdmin()) return
            const row = { id: b.id || Date.now(), title: b.title, artist: b.artist || null, chords: b.chords, bpm: b.bpm || null, beats: b.beats || null, capo: b.capo || null, ug_url: b.ug_url || null, notes: b.notes || null, sheet: b.sheet || null }
            db.songs = db.songs.filter((x) => x.id !== row.id).concat(row)
            return send(res, 200, { ok: true, id: row.id })
          }
          case 'song_delete':
            if (!needAdmin()) return
            db.songs = db.songs.filter((x) => x.id !== b.id)
            return send(res, 200, { ok: true })
          case 'limits':
            return send(res, 200, { upload_max_filesize: '64M', post_max_size: '64M', max_execution_time: '30', uploads_writable: true })
          case 'me':
            return send(res, 200, { admin: loggedIn })
          case 'login':
            if (b.password !== 'utvikling') return send(res, 401, { error: 'Feil passord.' })
            loggedIn = true
            return send(res, 200, { admin: true })
          case 'logout':
            loggedIn = false
            return send(res, 200, { admin: false })
          case 'trip_save': {
            if (!needAdmin()) return
            if (!blank(b.country)) return send(res, 400, { error: 'Velg et land.' })
            if (!blank(b.title)) return send(res, 400, { error: 'Skriv en tittel.' })
            const row = {
              country: b.country, place: blank(b.place), title: b.title,
              year: blank(b.year) ? Number(b.year) : (blank(b.date_from) ? Number(String(b.date_from).slice(0, 4)) : null),
              date_from: blank(b.date_from), date_to: blank(b.date_to), body: blank(b.body),
            }
            let id = Number(b.id) || 0
            if (id) Object.assign(db.trips.find((t) => t.id === id), row)
            else { id = db.seq++; db.trips.push({ id, ...row }) }
            ;(b.photos || []).forEach((p, i) => {
              const ph = db.photos.find((x) => x.id === p.id)
              if (ph) { ph.caption = blank(p.caption); ph.sort = i }
            })
            db.photos.sort((a, b2) => a.sort - b2.sort)
            return send(res, 200, { id })
          }
          case 'trip_delete':
            if (!needAdmin()) return
            db.trips = db.trips.filter((t) => t.id !== Number(b.id))
            db.photos = db.photos.filter((p) => p.trip_id !== Number(b.id))
            return send(res, 200, { ok: true })
          case 'photo_upload': {
            if (!needAdmin()) return
            if (!file) return send(res, 400, { error: 'Mangler fil.' })
            const path = await store('photos', file)
            const id = db.seq++
            db.photos.push({ id, trip_id: Number(b.trip_id), path, caption: null, width: null, height: null, sort: db.photos.length })
            return send(res, 200, { id, path })
          }
          case 'photo_delete':
            if (!needAdmin()) return
            db.photos = db.photos.filter((p) => p.id !== Number(b.id))
            return send(res, 200, { ok: true })
          case 'book_save': {
            if (!needAdmin()) return
            if (!blank(b.title)) return send(res, 400, { error: 'Boka mangler tittel.' })
            const row = {
              title: b.title, author: blank(b.author), isbn: blank(b.isbn), ol_key: blank(b.ol_key), cover_url: blank(b.cover_url),
              published_year: blank(b.published_year), pages: blank(b.pages), read_on: blank(b.read_on),
              rating: blank(b.rating) ? Number(b.rating) : null, thoughts: blank(b.thoughts), quote: blank(b.quote),
            }
            let id = Number(b.id) || 0
            if (id) Object.assign(db.books.find((x) => x.id === id), row)
            else { id = db.seq++; db.books.push({ id, ...row }) }
            return send(res, 200, { id })
          }
          case 'book_delete':
            if (!needAdmin()) return
            db.books = db.books.filter((x) => x.id !== Number(b.id))
            return send(res, 200, { ok: true })
          case 'recording_save': {
            if (!needAdmin()) return
            if (!blank(b.title)) return send(res, 400, { error: 'Skriv en tittel.' })
            const yt = (String(b.youtube || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/) || [])[1] || (/^[\w-]{11}$/.test(b.youtube || '') ? b.youtube : null)
            const audio = file ? await store('audio', file) : null
            let id = Number(b.id) || 0
            const row = { guitar: b.guitar, title: b.title, recorded_on: blank(b.recorded_on), youtube: yt, notes: blank(b.notes) }
            if (id) {
              const r = db.recordings.find((x) => x.id === id)
              Object.assign(r, row, audio ? { audio_path: audio } : {})
            } else {
              if (!yt && !audio) return send(res, 400, { error: 'Legg til en lydfil eller en YouTube-lenke.' })
              id = db.seq++
              db.recordings.push({ id, ...row, audio_path: audio })
            }
            return send(res, 200, { id })
          }
          case 'recording_delete':
            if (!needAdmin()) return
            db.recordings = db.recordings.filter((x) => x.id !== Number(b.id))
            return send(res, 200, { ok: true })
          // ── Spotify (fake data, same lock rules as the real server) ──
          case 'spotify_public':
            return send(res, 200, {
              configured: true, connected: true, lock_until: sp.lock, lock_seconds: sp.lockSeconds, server_time: Math.floor(Date.now() / 1000),
              now: sp.now,
              albums: SP_ALBUMS, playlists: SP_PLAYLISTS,
            })
          case 'spotify_now':
            return send(res, 200, { configured: true, connected: true, now: sp.now, recent: sp.recent, lock_until: sp.lock, lock_seconds: sp.lockSeconds, server_time: Math.floor(Date.now() / 1000) })
          case 'github_tree': {
            // dev: ask GitHub directly (the real server caches this for an hour)
            const repo = url.searchParams.get('repo')
            const h = { 'User-Agent': 'niben-dev', Accept: 'application/vnd.github+json' }
            const info = await (await fetch(`https://api.github.com/repos/Ben9boyz/${repo}`, { headers: h })).json()
            const tree = await (await fetch(`https://api.github.com/repos/Ben9boyz/${repo}/git/trees/${info.default_branch || 'main'}?recursive=1`, { headers: h })).json()
            return send(res, 200, { owner: 'Ben9boyz', repo, branch: info.default_branch || 'main', url: info.html_url, description: info.description, pushed: info.pushed_at, truncated: !!tree.truncated, files: (tree.tree || []).filter((t) => t.type === 'blob').map((t) => ({ path: t.path, size: t.size || 0 })) })
          }
          case 'github_repos':
            return send(res, 200, { repos: [
              { name: 'niben', description: 'Min personlige nettside – et 3D-rom med Vue og Three.js.', language: 'Vue', topics: ['threejs', 'vite'], stars: 3, url: 'https://github.com/Ben9boyz/niben', homepage: 'https://niben.no', created: '2026', pushed: '2026-10-04T12:00:00Z' },
              { name: 'dotfiles', description: 'Oppsett for terminal og editor.', language: 'Shell', topics: [], stars: 0, url: 'https://github.com/Ben9boyz/dotfiles', homepage: null, created: '2024', pushed: '2026-05-01T12:00:00Z' },
              { name: 'chord-trainer', description: null, language: 'JavaScript', topics: ['guitar'], stars: 7, url: 'https://github.com/Ben9boyz/chord-trainer', homepage: null, created: '2025', pushed: '2026-02-01T12:00:00Z' },
            ] })
          case 'spotify_groups': {
            if (!mock.groups) {
              const groups = [{ id: 'fokus', name: 'Jobb og fokus' }, { id: 'jazz', name: 'Jazz fusion', parent: 'fokus' }, { id: 'trening', name: 'Trening' }, { id: 'rolig', name: 'Rolig' }, { id: 'annet', name: 'Annet' }]
              const guess = (t) => (/jazz/i.test(t) ? 'jazz' : /fokus|focus|study|soundtrack/i.test(t) ? 'fokus' : /trening|workout/i.test(t) ? 'trening' : /søndag|chill|rolig/i.test(t) ? 'rolig' : 'annet')
              const assign = {}
              for (const x of [...SP_PLAYLISTS, ...SP_ALBUMS]) assign[x.uri] = guess(x.name)
              mock.groups = { groups, assign, auto: Object.keys(assign) }
            }
            return send(res, 200, mock.groups)
          }
          case 'spotify_groups_save': {
            if (!needAdmin()) return
            if (b.groups) { mock.groups.groups = b.groups.map((g, i) => ({ id: g.id || `g${i}${Date.now() % 1000}`, name: g.name, ...(g.parent ? { parent: g.parent } : {}), ...(g.cover ? { cover: g.cover } : {}) })); const ids = mock.groups.groups.map((g) => g.id); for (const u in mock.groups.assign) if (!ids.includes(mock.groups.assign[u])) mock.groups.assign[u] = ids[ids.length - 1] }
            if (b.assign) for (const u in b.assign) { mock.groups.assign[u] = b.assign[u]; mock.groups.auto = mock.groups.auto.filter((x) => x !== u) }
            return send(res, 200, { ok: true, ...mock.groups })
          }
          case 'spotify_search': {
            if (!loggedIn) return send(res, 401, { error: 'Logg inn for å søke i hele Spotify.' })
            const q = String(url.searchParams.get('q') || '').trim()
            if (q.length < 2) return send(res, 200, { albums: [], tracks: [] })
            const albums = [0, 1, 2].map((i) => ({ id: `s${i}`, uri: `spotify:album:searchalbum${String(i).padStart(10, '0')}`, name: `${q} (album ${i + 1})`, artist: 'Søkeartist', year: String(2000 + i * 7), image: mockCover(i * 70 + 10), image_large: mockCover(i * 70 + 10), thumb: mockCover(i * 70 + 10), url: null, tracks: 9 + i }))
            const tracks = [0, 1, 2, 3].map((i) => ({ uri: `spotify:track:searchtrack${String(i).padStart(10, '0')}`, name: `${q} – låt ${i + 1}`, artist: 'Søkeartist', ms: 180000 + i * 20000, n: i + 1, img: mockCover(i * 50), album: albums[i % 3].name, album_uri: albums[i % 3].uri, album_artist: 'Søkeartist', album_image: albums[i % 3].image, album_image_large: albums[i % 3].image, album_url: null }))
            const playlists = [0, 1].map((i) => ({ id: `sp${i}`, uri: `spotify:playlist:searchlist${String(i).padStart(10, '0')}`, name: `${q} mix ${i + 1}`, owner: 'Spotify-bruker', image: mockCover(i * 90 + 40), thumb: mockCover(i * 90 + 40), count: 30 + i * 12, url: null }))
            const artists = [0, 1, 2].map((i) => ({ id: `sa${i}`, name: i ? `${q} ${['Band', 'Collective'][i - 1]}` : q, image: mockCover(i * 120 + 20), genres: ['indie', 'pop'].slice(0, 1 + (i % 2)) }))
            return send(res, 200, { albums, tracks, playlists, artists })
          }
          case 'spotify_tempo': {
            const id = url.searchParams.get('id') || ''
            let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997
            return send(res, 200, { bpm: 70 + (h % 90) })
          }
          case 'admin_status':
            if (!needAdmin()) return
            return send(res, 200, { counts: { trips: 4, books: 12, recordings: 3, photos: 38 }, spotify: { connected: true, lock_seconds: sp.lockSeconds, can_save: true, can_playlists: false }, steam: true, jpdb: false, translate: { configured: true, provider: 'anthropic', total: 214, languages: [{ lang: 'de', n: 120 }, { lang: 'en', n: 94 }] } })
          case 'admin_visits': {
            if (!needAdmin()) return
            const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10); const u = Math.max(0, Math.round(3 + 4 * Math.sin(i / 3) + (i % 5))); return { day: d, u, h: u * 3 } })
            return send(res, 200, { days, today: days[29].u, week: 31, month: 94, total: 212, returning: 37, hits_today: days[29].h })
          }
          case 'visit': return send(res, 200, { ok: true })
          case 'milestones': return send(res, 200, { items: mock.milestones || (mock.milestones = [{ key: 'rec:1', type: 'recording', title: 'Hotel California (akustisk)', sub: 'Nytt gitaropptak', image: null, t: Math.floor(Date.now() / 1000) - 3600 }, { key: 'anime:1', type: 'anime', title: 'Laid-Back Camp', sub: 'Klarer ordene i anime-en – 99 %', image: mockCover(160), t: Math.floor(Date.now() / 1000) - 86400 * 2 }, { key: 'book:1', type: 'book', title: 'The Order of Time', sub: 'Carlo Rovelli', image: mockCover(40), t: Math.floor(Date.now() / 1000) - 86400 * 6 }]) })
          case 'milestone_add': { if (!needAdmin()) return; (mock.milestones ||= []).unshift({ key: 'm' + Date.now(), type: b.type, title: b.title, sub: b.sub || '', image: null, t: Math.floor(Date.now() / 1000) }); return send(res, 200, { ok: true, items: mock.milestones }) }
          case 'milestone_delete': { if (!needAdmin()) return; mock.milestones = (mock.milestones || []).filter((m) => m.key !== b.key); return send(res, 200, { ok: true, items: mock.milestones }) }
          case 'home_live': { const k = mock.weather || 'rain'; const now = Math.floor(Date.now() / 1000); return send(res, 200, { configured: true, name: 'Oslo', kind: k, code: 61, temp: 7, cloud: 90, wind: 14, precip: 0.6, is_day: (mock.day ?? true), sunrise: [now - 6 * 3600, now + 18 * 3600], sunset: [now + 6 * 3600, now + 30 * 3600] }) }
          case 'home_get': if (!needAdmin()) return; return send(res, 200, { place: { name: 'Oslo' } })
          case 'home_search': if (!needAdmin()) return; return send(res, 200, { results: [{ name: 'Oslo', region: 'Oslo', country: 'Norge', lat: 59.91, lon: 10.75 }, { name: 'Osloveien', region: 'Troms', country: 'Norge', lat: 69.6, lon: 18.9 }] })
          case 'home_set': if (!needAdmin()) return; return send(res, 200, { ok: true })
          case 'wrapped': { const c = (h) => mockCover(h); return send(res, 200, { year: 2026, music: { plays: 1840, minutes: 6120, since: 1767225600, logging: true, tracks: [{ name: 'Slow Down', artist: 'The Midnight Club', image: c(40), n: 41 }, { name: 'Northern Sky', artist: 'Aurora Sky', image: c(120), n: 33 }, { name: 'Golden Hour', artist: 'Neon Coast', image: c(200), n: 28 }], albums: [{ album: 'Blue Hour 3', artist: 'The Midnight Club', image: c(40), album_uri: 'a1', n: 210 }, { album: 'Fjord 4', artist: 'Aurora Sky', image: c(120), album_uri: 'a2', n: 160 }, { album: 'Acoustic Days', artist: 'Acoustic', image: c(300), album_uri: 'a3', n: 120 }], artists: [{ artist: 'The Midnight Club', image: c(40), n: 400 }, { artist: 'Aurora Sky', image: c(120), n: 310 }] }, books: { count: 9, pages: 2840, list: [{ title: 'The Order of Time', cover_url: c(10) }, { title: 'Dune', cover_url: c(220) }], best: { title: 'The Order of Time', rating: 5 } }, travel: { trips: 3, countries: ['Island', 'Japan', 'Italia'], photos: 204, list: [{ id: 1, country: 'Island', place: 'Laufey', title: 'Island laufey' }] }, guitar: { recordings: 4 }, games: { hours_now: 1240, gained: 118, since: '2026-01-04', top: [{ name: 'ELDEN RING', hours: 214 }] }, japanese: { known: 436, gained: 120, since: '2026-01-04', days: 188, reviews: 5400 } }) }
          case 'guestbook_list': return send(res, 200, { items: [{ id: 1, name: 'Mia', msg: 'Kjempefin side! Elsker rommet.', t: Math.floor(Date.now() / 1000) - 86400 * 3 }] })
          case 'guestbook_add': return send(res, 200, { ok: true, pending: true })
          case 'admin_guestbook': if (!needAdmin()) return; return send(res, 200, { items: [{ id: 2, name: 'Even', msg: 'Hei! Hvor er gitaren fra?', t: Math.floor(Date.now() / 1000) - 600, status: 'pending' }, { id: 1, name: 'Mia', msg: 'Kjempefin side! Elsker rommet.', t: Math.floor(Date.now() / 1000) - 86400 * 3, status: 'approved' }] })
          case 'admin_guestbook_set': if (!needAdmin()) return; return send(res, 200, { ok: true })
          case 'practice_calendar': { const days = {}; for (let i = 0; i < 200; i++) if ((i * 7 + 3) % 5 !== 0 || i < 12) days[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)] = 1 + (i % 6); return send(res, 200, { days, streak: 12, best: 31, total: 640, active: Object.keys(days).length }) }
          case 'admin_best_friend':
            if (!needAdmin()) return
            return send(res, 200, { ok: true, id: (b && b.id) || '76561198148569463' })
          case 'admin_translate_clear':
            if (!needAdmin()) return
            return send(res, 200, { ok: true })
          case 'translate': {
            // dev: pretend to translate (the real server asks Claude / Google and keeps the answers)
            const tag = (b.lang || '??').toUpperCase()
            return send(res, 200, { texts: (b.texts || []).map((t) => `[${tag}] ${t}`) })
          }
          case 'spotify_artist': {
            if (!loggedIn) return send(res, 401, { error: 'Logg inn for å åpne artister.' })
            const nm = url.searchParams.get('name') || 'Mock Artist'
            const albums = Array.from({ length: 7 }, (_, i) => ({ id: `ar${i}`, uri: `spotify:album:artistalbum${String(i).padStart(10, '0')}`, name: ['Northern Lights', 'Slow Burn', 'Echoes', 'Paper Hearts', 'Late Again', 'Golden Hour', 'Home'][i], artist: nm, year: String(2024 - i * 3), type: i % 3 === 2 ? 'single' : 'album', image: mockCover(i * 37 + 3), image_large: mockCover(i * 37 + 3), thumb: mockCover(i * 37 + 3), url: null, tracks: 8 + i }))
            return send(res, 200, { id: 'mockartist00000001', uri: 'spotify:artist:mockartist00000001', name: nm, genres: ['jazz fusion', 'instrumental'], image: mockCover(200), image_large: mockCover(200), url: null, albums })
          }
          case 'spotify_queue': {
            const ctx = sp.now?.context || ''
            const id = /^spotify:(album|playlist):/.test(ctx) ? ctx.split(':')[2] : ''
            const all = id ? mockAlbumTracks(id) : []
            const at = all.findIndex((t) => t.uri === sp.now?.uri)
            const rest = (at >= 0 ? all.slice(at + 1) : all.slice(1, 5))
            return send(res, 200, { tracks: [...sp.queued, ...rest] })
          }
          case 'spotify_devices':
            if (!needAdmin()) return
            return send(res, 200, { devices: [{ id: 'dev00000000000000000001', name: 'niben.no', type: 'Computer', active: true, volume: 70 }, { id: 'dev00000000000000000002', name: 'iPhone', type: 'Smartphone', active: false, volume: 50 }] })
          case 'spotify_enqueue': {
            if (!needAdmin()) return
            // a song from some album: remember which album it is on (the mock song ids are "mocktrack<albumId><n>")
            const m = /^spotify:track:mocktrack(.+?)\d{4}$/.exec(b.uri || '')
            const alb = m && SP_ALBUMS.find((a) => a.uri.endsWith(m[1]))
            if (alb) sp.queued.push({ uri: b.uri, name: 'I køen', artist: alb.artist, ms: 180000, img: alb.thumb, album_uri: alb.uri, album: alb.name, album_artist: alb.artist, album_image: alb.image })
            return send(res, 200, { ok: true })
          }
          case 'spotify_transfer': case 'spotify_volume':
            if (!needAdmin()) return
            return send(res, 200, { ok: true })
          case 'spotify_repeat':
            if (!needAdmin()) return
            sp.now.repeat = b.state
            return send(res, 200, { ok: true })
          case 'spotify_liked':
            if (!needAdmin()) return
            if (isPost) { sp.liked = !!b.on; return send(res, 200, { ok: true, liked: sp.liked }) }
            return send(res, 200, { liked: !!sp.liked })
          case 'spotify_follow':
            if (!needAdmin()) return
            return send(res, 200, { ok: true })
          case 'spotify_save': case 'spotify_unsave':
            if (!needAdmin()) return
            return send(res, 200, { ok: true })
          case 'spotify_playlist_add':
            if (!needAdmin()) return
            return send(res, 200, { ok: true })
          case 'spotify_play': {
            if (!needAdmin()) return
            const now = Math.floor(Date.now() / 1000)
            if (sp.lock > now) return send(res, 423, { error: `Låst – du kan bytte om ${Math.ceil((sp.lock - now) / 60)} min.`, lock_until: sp.lock, server_time: now })
            const item = [...SP_ALBUMS, ...SP_PLAYLISTS].find((x) => x.uri === b.uri) || (/^spotify:album:/.test(b.uri || '') ? { name: 'Album fra søk', artist: 'Søk' } : null)
            if (!item) return send(res, 400, { error: 'Ugyldig Spotify-lenke.' })
            sp.lock = now + sp.lockSeconds
            const pick = /^spotify:(album|playlist):/.test(item.uri) ? mockAlbumTracks(item.uri.split(':')[2])[2] : null
            if (/^spotify:album:/.test(item.uri)) sp.recent = [{ uri: item.uri, name: item.name, artist: item.artist, image: item.image, image_large: item.image }, ...sp.recent.filter((r) => r.uri !== item.uri)].slice(0, 10)
            sp.now = { playing: true, progress_ms: 61000, duration_ms: pick?.ms || 214000, name: pick ? pick.name : `Første låt fra ${item.name}`, artist: item.artist || item.owner, album: item.name, image: item.image, uri: pick?.uri, context: item.uri, at: now }
            return send(res, 200, { ok: true, lock_until: sp.lock, server_time: now })
          }
          case 'spotify_lock': {
            if (!needAdmin()) return
            const now = Math.floor(Date.now() / 1000)
            if (sp.lock > now) return send(res, 423, { error: `Låsen er på – den kan endres om ${Math.ceil((sp.lock - now) / 60)} min.`, lock_until: sp.lock, lock_seconds: sp.lockSeconds, server_time: now })
            sp.lockSeconds = Math.max(0, +b.seconds || 0)
            return send(res, 200, { ok: true, lock_seconds: sp.lockSeconds, lock_until: sp.lock, server_time: now })
          }
          case 'spotify_control': {
            if (!needAdmin()) return
            const now = Math.floor(Date.now() / 1000)
            if (b.op === 'seek' && sp.lock > now) return send(res, 423, { error: 'Låst – hør ferdig 🎧', lock_until: sp.lock, server_time: now })
            if (b.op === 'pause') sp.now.playing = false
            if (b.op === 'resume') sp.now.playing = true
            if (b.op === 'seek') sp.now.progress_ms = +b.ms || 0
            if (b.op === 'shuffle') sp.now.shuffle = !!b.state
            return send(res, 200, { ok: true })
          }
          case 'spotify_token':
            if (!needAdmin()) return
            return send(res, 200, { token: 'mock', expires: 0, streaming: false }) // no real Spotify in dev
          case 'discover_get':
            return send(res, 200, { picks: db.picks || [], recs: db.recs || [], at: db.recsAt || 0, hasKey: !!db.lfKey })
          case 'discover_key':
            if (!needAdmin()) return
            db.lfKey = (b.key || '').trim()
            return send(res, 200, { ok: true, hasKey: !!db.lfKey })
          case 'discover_add': {
            if (!needAdmin()) return
            const m = String(b.url || '').match(/(album|track)[/:]([A-Za-z0-9]{10,40})/)
            if (!m) return send(res, 400, { error: 'Det der ser ikke ut som en Spotify-lenke til et album eller en låt.' })
            const i = (db.picks || []).length
            const row = { id: m[2], uri: `spotify:${m[1]}:${m[2]}`, type: m[1], name: m[1] === 'album' ? `Foreslått album ${i + 1}` : `Foreslått låt ${i + 1}`, artist: 'Mock Artist', year: '2025', image: mockCover(i * 53 + 11), image_large: mockCover(i * 53 + 11), thumb: mockCover(i * 53 + 11), url: `https://open.spotify.com/${m[1]}/${m[2]}`, note: String(b.note || '').slice(0, 300), t: Math.floor(Date.now() / 1000) }
            db.picks = [row, ...(db.picks || []).filter((x) => x.uri !== row.uri)]
            return send(res, 200, { ok: true, pick: row })
          }
          case 'discover_del':
            if (!needAdmin()) return
            db.picks = (db.picks || []).filter((x) => x.uri !== b.uri)
            return send(res, 200, { ok: true })
          case 'discover_refresh': {
            if (!needAdmin()) return
            if (!db.lfKey) return send(res, 400, { error: 'Legg inn en Last.fm-nøkkel først.' })
            db.recs = Array.from({ length: 12 }, (_, i) => ({ id: `rec${i}`, uri: `spotify:album:recalbum${String(i).padStart(10, '0')}`, type: 'album', name: ['Midnight Tapes', 'Soft Static', 'Glass Garden', 'Paper Moons', 'Long Way Home', 'Blue Hour', 'Salt', 'Dust & Honey', 'Evergreen', 'Low Light', 'Satellites', 'Hollow'][i], artist: ['Nova Lane', 'Pale Sun', 'The Harbour', 'Mira Fell'][i % 4], year: String(2025 - (i % 6)), image: mockCover(i * 41 + 7), image_large: mockCover(i * 41 + 7), thumb: mockCover(i * 41 + 7), why: 'Ligner på Acoustic Days, Aurora Sky', score: 3 - i * 0.1 }))
            db.recsAt = Math.floor(Date.now() / 1000)
            return send(res, 200, { ok: true, recs: db.recs, at: db.recsAt })
          }
          case 'decor_get':
            return send(res, 200, { items: db.decor || [] })
          case 'decor_upload': {
            if (!needAdmin()) return
            if (!file) return send(res, 400, { error: 'Mangler fil.' })
            if (!/\.glb$/i.test(file.name || '')) return send(res, 400, { error: 'Bare .glb-filer (én fil med alt i). Konverter andre formater til GLB først.' })
            const path = await store('models', file)
            const item = { id: Math.random().toString(16).slice(2, 12), file: path, name: String(b?.name || file.name.replace(/\.glb$/i, '')).slice(0, 50), x: 0, y: 0, z: 1.2, rot: 0, scale: 1, visible: true }
            db.decor = [...(db.decor || []), item]
            return send(res, 200, { ok: true, item })
          }
          case 'decor_save': {
            if (!needAdmin()) return
            const byId = new Map((b.items || []).map((i) => [String(i.id), i]))
            db.decor = (db.decor || []).map((d) => { const n = byId.get(d.id); return n ? { ...d, x: +n.x, y: +n.y || 0, z: +n.z, rot: +n.rot, scale: +n.scale || 1, visible: n.visible !== false, name: n.name ?? d.name } : d })
            return send(res, 200, { ok: true, items: db.decor })
          }
          case 'decor_delete':
            if (!needAdmin()) return
            db.decor = (db.decor || []).filter((d) => d.id !== b.id)
            return send(res, 200, { ok: true })
          case 'about_get':
            return send(res, 200, { about: db.about || null })
          case 'about_photo': {
            if (!needAdmin()) return
            if (!file) return send(res, 400, { error: 'Mangler fil.' })
            const path = await store('photos', file)
            db.about = { ...(db.about || {}), bilde: path }
            return send(res, 200, { ok: true, bilde: path })
          }
          case 'about_save':
            if (!needAdmin()) return
            db.about = { bilde: db.about?.bilde || null, tagline: b.tagline || '', tekst: b.tekst || '', lenker: (b.lenker || []).filter((l) => l.navn && /^https?:\/\//.test(l.url || '')) }
            return send(res, 200, { ok: true, about: db.about })
          case 'steam_public': {
            const now = Math.floor(Date.now() / 1000)
            const G = [[1245620, 'ELDEN RING', 214.5, 6.2, 1, [31, 42]], [413150, 'Stardew Valley', 160.1, 0, 9, [24, 49]], [1086940, "Baldur's Gate 3", 132, 11.4, 0, [18, 54]], [367520, 'Hollow Knight', 88.3, 0, 30, [40, 63]], [730, 'Counter-Strike 2', 76, 1.5, 3, [1, 1]], [1145360, 'Hades', 61.2, 0, 60, [33, 49]], [620, 'Portal 2', 24.8, 0, 200, [51, 51]], [105600, 'Terraria', 22, 0, 400, null], [892970, 'Valheim', 19.5, 0, 120, null], [1794680, 'Vampire Survivors', 12, 0, 75, [120, 230]], [753640, 'Outer Wilds', 18.4, 0, 500, [20, 31]], [4000, "Garry's Mod", 9, 0, 900, null]]
            const games = G.map(([appid, name, hours, recent, days, ach]) => ({ appid, name, hours, recent, last: now - days * 86400 - 3600, ...(ach ? { ach: { done: ach[0], total: ach[1] } } : {}) }))
            const byLast = [...games].sort((a, b) => b.last - a.last)
            return send(res, 200, {
              configured: true,
              profile: { name: 'niben', avatar: mockCover(200), url: 'https://steamcommunity.com', state: 'Pålogget', online: true, playing: { appid: 1086940, name: "Baldur's Gate 3", since: now - 4980 }, last_online: now - 600, since: now - 86400 * 365 * 11 },
              library: { two_weeks: 18.9, backlog: 45, platform: { win: 1180, mac: 0, linux: 60 }, genres: [{ name: 'RPG', hours: 420 }, { name: 'Indie', hours: 310 }, { name: 'Action', hours: 260 }, { name: 'Adventure', hours: 170 }, { name: 'Simulation', hours: 160 }], longest: { name: 'ELDEN RING', hours: 214.5 }, count: 143, played: 98, hours: 1240, level: 27, recent: byLast.slice(0, 6), top: games.map(({ ach, ...g }) => g), hidden: false },
              live: { players: 84213, info: { genres: ['RPG', 'Strategy'], score: 96, dev: 'Larian Studios', year: '2023', text: 'Gather your party and return to the Forgotten Realms in a tale of fellowship and betrayal, survival and sacrifice, and the lure of absolute power.' }, news: { title: 'Patch 8: crossplay, photo mode and 12 new subclasses', text: 'The biggest update so far brings a photo mode, crossplay between all platforms and a long list of fixes.', url: 'https://store.steampowered.com' }, ach: [{ name: 'Tav the Dark Urge', text: 'Complete the game as the Dark Urge', icon: mockCover(120), at: now - 86400 * 2, rarity: 9.4 }, { name: 'Bard of Baldur', text: 'Play three songs for the party', icon: mockCover(250), at: now - 86400 * 5, rarity: 31.2 }] },
              friends: { count: 24, online: 5, best: { id: '1', name: 'Kristian', avatar: mockCover(300), url: 'https://steamcommunity.com', online: true, state: 'Pålogget', playing: 'Helldivers 2', since: now - 86400 * 365 * 9, last: now - 300, shared: [{ appid: 1245620, name: 'ELDEN RING', mine: 214.5, theirs: 188 }, { appid: 1086940, name: "Baldur's Gate 3", mine: 132, theirs: 140 }, { appid: 730, name: 'Counter-Strike 2', mine: 76, theirs: 410 }], shared_count: 9 }, list: [{ id: '2', name: 'Mia', avatar: mockCover(60), url: '#', online: true, state: 'Pålogget', playing: 'Valheim', last: now }, { id: '3', name: 'Even', avatar: mockCover(160), url: '#', online: true, state: 'Borte', playing: null, last: now }, { id: '4', name: 'Thea', avatar: mockCover(220), url: '#', online: false, state: 'Frakoblet', playing: null, last: now - 86400 * 3 }] },
              at: now,
            })
          }
          case 'jpdb_parse': {
            // dev: the real jpdb (read only) with the key from public/_jpdb.php, if it's there
            const fs = await import('node:fs')
            const key = (fs.existsSync('public/_jpdb.php') ? fs.readFileSync('public/_jpdb.php', 'utf8') : '').match(/'api_key'\s*=>\s*'([^']+)'/)?.[1]
            if (!key) return send(res, 502, { error: 'Ingen jpdb-nøkkel lokalt.' })
            const r = await fetch('https://jpdb.io/api/v1/parse', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: b.text, position_length_encoding: 'utf16', token_fields: ['vocabulary_index', 'position', 'length', 'furigana'], vocabulary_fields: ['vid', 'sid', 'spelling', 'reading', 'frequency_rank', 'meanings', 'card_state', 'part_of_speech', 'pitch_accent'] }) })
            const j = await r.json()
            if (!r.ok) return send(res, 502, { error: j.error_message || 'jpdb-feil' })
            return send(res, 200, {
              tokens: j.tokens.map((t) => ({ v: t[0], pos: t[1], len: t[2], furi: t[3] })),
              vocab: j.vocabulary.map(([vid, sid, spelling, reading, freq, meanings, state, pos, pitch]) => ({ vid, sid, spelling, reading, freq, meanings: (meanings || []).slice(0, 5), state: state || [], pos: pos || [], pitch: pitch?.[0] || null })),
            })
          }
          case 'jpdb_words': {
            const W = [['可愛い', 'かわいい', 'cute; adorable', ['known'], 1400, 'LHHLL'], ['猫', 'ねこ', 'cat', ['learning'], 1600, 'HLL'], ['今日', 'きょう', 'today', ['due'], 200, 'HHLL'], ['服', 'ふく', 'clothes', ['new'], 1200, 'LH'], ['人形', 'にんぎょう', 'doll', ['new'], 3200, 'LHHH'], ['作る', 'つくる', 'to make', ['known'], 300, 'LHL'], ['学校', 'がっこう', 'school', ['learning'], 400, 'LHHH'], ['恋', 'こい', 'love', ['failed'], 2100, 'HL'], ['衣装', 'いしょう', 'costume', ['new'], 5000, 'LHHH'], ['写真', 'しゃしん', 'photograph', ['known'], 900, 'LHH']]
            return send(res, 200, { words: W.map(([spelling, reading, meaning, state, freq, pitch], i) => ({ vid: 1000 + i, sid: 2000 + i, spelling, reading, meaning, state, freq, pitch })), decks: [{ id: 7, name: 'Egne ord' }] })
          }
          case 'jpdb_add':
            if (!needAdmin()) return
            return send(res, 200, { ok: true, deck: b.deck === 'new' ? 8 : b.deck })
          case 'jpdb_public':
            return send(res, 200, { configured: true, decks: [{ id: 1, name: 'Sono Bisque Doll wa Koi wo Suru - Episode 1', words: 448, known: 2.8, learning: 4.5 }], anime: [
              { title: 'Yuru Camp△', parts: 12, known: 91.4, learning: 94, anilist: 98444, url: 'https://anilist.co/anime/98444', en: 'Laid-Back Camp', native: 'ゆるキャン△', year: 2018, cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx98444-Vzysp1EsrzgD.jpg', color: '#f1ae5d' },
              { title: 'K-ON!', parts: 1, known: 84.2, learning: 88, anilist: 5680, url: 'https://anilist.co/anime/5680', en: 'K-ON!', native: 'けいおん!', year: 2009, cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5680-r3AI3Cwfv0Aq.png', color: '#e47843' },
              { title: 'SPY×FAMILY', parts: 3, known: 72.5, learning: 80, anilist: 140960, url: 'https://anilist.co/anime/140960', en: 'SPY x FAMILY', native: 'SPY×FAMILY', year: 2022, cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140960-Kb6R5nYQfjmP.jpg', color: '#c9f1f1' },
              { title: 'Bocchi the Rock!', parts: 1, known: 61, learning: 70, anilist: 130003, url: 'https://anilist.co/anime/130003', en: 'BOCCHI THE ROCK!', native: 'ぼっち・ざ・ろっく！', year: 2022, cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx130003-HTDmeL4RGeJ4.png', color: '#e4bb50' },
              { title: 'Sousou no Frieren', parts: 1, known: 40.3, learning: 52, anilist: 154587, url: 'https://anilist.co/anime/154587', en: 'Frieren: Beyond Journey’s End', native: '葬送のフリーレン', year: 2023, cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg', color: '#bbf1a1' },
              { title: 'Shingeki no Kyojin', parts: 1, known: 21, learning: 30, anilist: 16498, url: 'https://anilist.co/anime/16498', en: 'Attack on Titan', native: '進撃の巨人', year: 2013, cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg', color: '#f1a143' },
              { title: 'Sono Bisque Doll wa Koi wo Suru', parts: 1, known: 2.8, learning: 4.5, anilist: 132405, url: 'https://anilist.co/anime/132405', en: 'My Dress-Up Darling', native: 'その着せ替え人形は恋をする', year: 2022, cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx132405-qP7FQYGmNI3d.jpg', color: '#e46b5d' },
            ],  count: { due: 3, learning: 2, known: 6, new: 436 },
              word: { vid: 1, sid: 1, spelling: '可愛い', reading: 'かわいい', meanings: [['cute', 'adorable', 'charming']], pos: ['adj-i'], pitch: 'LHHL', freq: 900, state: ['learning'] } })
          case 'jpdb_queue': {
            if (!needAdmin()) return
            const mk = (vid, spelling, reading, meanings, pitch, kind) => ({ vid, sid: vid * 7, spelling, reading, meanings: [meanings], pos: ['n'], pitch, freq: vid * 40, state: [kind], due: null })
            return send(res, 200, {
              due: [mk(11, '衣装', 'いしょう', ['clothing', 'costume'], 'LHHH', 'due'), mk(12, '雛人形', 'ひなにんぎょう', ['hina doll'], 'LHHHLL', 'due'), mk(13, '作る', 'つくる', ['to make', 'to produce'], 'LHL', 'due')],
              new: [mk(21, '夢', 'ゆめ', ['dream'], 'HL', 'new'), mk(22, '恥ずかしい', 'はずかしい', ['embarrassing', 'shy'], 'LHHHL', 'new')].slice(0, +b.new || 0),
            })
          }
          case 'jpdb_review':
            if (!needAdmin()) return
            return send(res, 200, { ok: true, state: ['learning'], due: null })
          case 'spotify_tracks': {
            const id = url.searchParams.get('id')
            if (url.searchParams.get('type') === 'playlist' && id.endsWith('3')) return send(res, 200, { hidden: true, tracks: [] })
            const n = 6 + (id.charCodeAt(id.length - 1) % 7)
            const pl = url.searchParams.get('type') === 'playlist'
            return send(res, 200, { tracks: Array.from({ length: n }, (_, i) => ({ ...(pl ? { album: `Albumet ${i % 4 + 1}`, album_uri: `spotify:album:plalbum${String(i % 4).padStart(10, '0')}`, album_artist: `Artist ${i % 3 + 1}`, album_image: mockCover((i % 4) * 60 + 5), album_image_large: mockCover((i % 4) * 60 + 5) } : {}), artist_id: 'mockartist00000001', uri: `spotify:track:mocktrack${id}${String(i).padStart(4, '0')}`, name: ['Intro', 'Golden Hour', 'Slow Down', 'Northern Sky', 'Paper Hearts', 'Drift', 'Home', 'Waves', 'Late Again', 'Outro', 'Echoes', 'Morning'][i % 12], artist: pl ? `Artist ${i % 3 + 1}` : 'Mock Artist', ms: 150000 + i * 17000, n: i + 1, img: mockCover(i * 53) })) })
          }
          case 'spotify_refresh':
          case 'spotify_disconnect':
            if (!needAdmin()) return
            return send(res, 200, { ok: true })
          default:
            return send(res, 404, { error: 'Ukjent handling.' })
        }
      })
    },
  }
}
