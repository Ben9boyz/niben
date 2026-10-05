// Dev-only stand-in for public/api.php (used by `npm run dev`, never deployed).
// Keeps everything in memory; password is "utvikling".
import { Readable } from 'node:stream'
import { seed } from './mockSeed.js'

export function mockApi() {
  const db = { trips: [], photos: [], books: [], recordings: [], songs: [{ id: 1, title: 'Wonderwall', artist: 'Oasis', chords: 'Em7 G Dsus4 A7sus4', bpm: 87, beats: 4, capo: 2, ug_url: null, notes: 'Strumming: D DU UDU', sheet: '[Vers]\nEm7  G  Dsus4  A7sus4\nToday is gonna be the day\n\n[Refreng]\nC  D  Em\nAnd after all' }], seq: 1 }
  const files = new Map() // path -> { type, buf }
  seed(db, files)
  let loggedIn = false
  const sp = { lock: 0, lockSeconds: 600, now: { playing: false } }
  const SP_ALBUMS = [
    ['Blue Hour', 'The Midnight Club', '#2b6cb0'], ['Paper Planes', 'Northern Lights', '#d69e2e'], ['Fjord', 'Aurora Sky', '#38a169'],
    ['Late Night Drive', 'Neon Coast', '#805ad5'], ['Wooden Room', 'Acoustic Days', '#c05621'], ['Static', 'Low Tide', '#2d3748'],
    ['Summer Tapes', 'Vintage Radio', '#e53e3e'], ['Glass', 'Clear Water', '#319795'],
  ]
    // 65 records, like the real shelf
    .flatMap((x, k, all) => Array.from({ length: Math.ceil(65 / all.length) }, (_, j) => [j ? `${x[0]} ${j + 1}` : x[0], x[1], `hsl(${(k * 47 + j * 23) % 360}, 45%, 45%)`]))
    .slice(0, 65)
    .map(([name, artist, color], i) => ({ id: 'a' + i, uri: `spotify:album:mockalbum${String(i).padStart(10, '0')}`, name, artist, year: String(2015 + (i % 10)), image: null, color, url: null, tracks: 10 + (i % 6) }))
  // tiny coloured squares as stand-in covers
  const mockCover = (h) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="hsl(${h % 360},60%,50%)"/><circle cx="4" cy="4" r="1.6" fill="#fff"/></svg>`)}`
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
            })
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
            return send(res, 200, { configured: true, connected: true, now: sp.now, lock_until: sp.lock, lock_seconds: sp.lockSeconds, server_time: Math.floor(Date.now() / 1000) })
          case 'github_repos':
            return send(res, 200, { repos: [
              { name: 'niben', description: 'Min personlige nettside – et 3D-rom med Vue og Three.js.', language: 'Vue', topics: ['threejs', 'vite'], stars: 3, url: 'https://github.com/Ben9boyz/niben', homepage: 'https://niben.no', created: '2026', pushed: '2026-10-04T12:00:00Z' },
              { name: 'dotfiles', description: 'Oppsett for terminal og editor.', language: 'Shell', topics: [], stars: 0, url: 'https://github.com/Ben9boyz/dotfiles', homepage: null, created: '2024', pushed: '2026-05-01T12:00:00Z' },
              { name: 'chord-trainer', description: null, language: 'JavaScript', topics: ['guitar'], stars: 7, url: 'https://github.com/Ben9boyz/chord-trainer', homepage: null, created: '2025', pushed: '2026-02-01T12:00:00Z' },
            ] })
          case 'spotify_search': {
            if (!loggedIn) return send(res, 401, { error: 'Logg inn for å søke i hele Spotify.' })
            const q = String(url.searchParams.get('q') || '').trim()
            if (q.length < 2) return send(res, 200, { albums: [], tracks: [] })
            const albums = [0, 1, 2].map((i) => ({ id: `s${i}`, uri: `spotify:album:searchalbum${String(i).padStart(10, '0')}`, name: `${q} (album ${i + 1})`, artist: 'Søkeartist', year: String(2000 + i * 7), image: mockCover(i * 70 + 10), image_large: mockCover(i * 70 + 10), thumb: mockCover(i * 70 + 10), url: null, tracks: 9 + i }))
            const tracks = [0, 1, 2, 3].map((i) => ({ uri: `spotify:track:searchtrack${String(i).padStart(10, '0')}`, name: `${q} – låt ${i + 1}`, artist: 'Søkeartist', ms: 180000 + i * 20000, n: i + 1, img: mockCover(i * 50), album: albums[i % 3].name, album_uri: albums[i % 3].uri, album_artist: 'Søkeartist', album_image: albums[i % 3].image, album_image_large: albums[i % 3].image, album_url: null }))
            const playlists = [0, 1].map((i) => ({ id: `sp${i}`, uri: `spotify:playlist:searchlist${String(i).padStart(10, '0')}`, name: `${q} mix ${i + 1}`, owner: 'Spotify-bruker', image: mockCover(i * 90 + 40), thumb: mockCover(i * 90 + 40), count: 30 + i * 12, url: null }))
            return send(res, 200, { albums, tracks, playlists })
          }
          case 'spotify_follow':
            if (!needAdmin()) return
            return send(res, 200, { ok: true })
          case 'spotify_save':
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
            sp.now = { playing: true, progress_ms: 0, duration_ms: 214000, name: b.track ? `Valgt låt fra ${item.name}` : `Første låt fra ${item.name}`, artist: item.artist || item.owner, album: item.name, image: item.image, context: item.uri, at: now }
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
          case 'about_get':
            return send(res, 200, { about: db.about || null })
          case 'about_save':
            if (!needAdmin()) return
            db.about = { tagline: b.tagline || '', tekst: b.tekst || '', lenker: (b.lenker || []).filter((l) => l.navn && /^https?:\/\//.test(l.url || '')) }
            return send(res, 200, { ok: true, about: db.about })
          case 'steam_public': {
            const now = Math.floor(Date.now() / 1000)
            const G = [[1245620, 'ELDEN RING', 214.5, 6.2, 1, [31, 42]], [413150, 'Stardew Valley', 160.1, 0, 9, [24, 49]], [1086940, "Baldur's Gate 3", 132, 11.4, 0, [18, 54]], [367520, 'Hollow Knight', 88.3, 0, 30, [40, 63]], [730, 'Counter-Strike 2', 76, 1.5, 3, [1, 1]], [1145360, 'Hades', 61.2, 0, 60, [33, 49]], [620, 'Portal 2', 24.8, 0, 200, [51, 51]], [105600, 'Terraria', 22, 0, 400, null], [892970, 'Valheim', 19.5, 0, 120, null], [1794680, 'Vampire Survivors', 12, 0, 75, [120, 230]], [753640, 'Outer Wilds', 18.4, 0, 500, [20, 31]], [4000, "Garry's Mod", 9, 0, 900, null]]
            const games = G.map(([appid, name, hours, recent, days, ach]) => ({ appid, name, hours, recent, last: now - days * 86400 - 3600, ...(ach ? { ach: { done: ach[0], total: ach[1] } } : {}) }))
            const byLast = [...games].sort((a, b) => b.last - a.last)
            return send(res, 200, {
              configured: true,
              profile: { name: 'niben', avatar: mockCover(200), url: 'https://steamcommunity.com', state: 'Pålogget', online: true, playing: { appid: 1086940, name: "Baldur's Gate 3" }, last_online: now - 600 },
              library: { count: 143, played: 98, hours: 1240, level: 27, recent: byLast.slice(0, 6), top: games.map(({ ach, ...g }) => g), hidden: false },
              at: now,
            })
          }
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
            return send(res, 200, { tracks: Array.from({ length: n }, (_, i) => ({ uri: `spotify:track:mocktrack${id}${String(i).padStart(4, '0')}`, name: ['Intro', 'Golden Hour', 'Slow Down', 'Northern Sky', 'Paper Hearts', 'Drift', 'Home', 'Waves', 'Late Again', 'Outro', 'Echoes', 'Morning'][i % 12], artist: 'Mock Artist', ms: 150000 + i * 17000, n: i + 1, img: mockCover(i * 53) })) })
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
