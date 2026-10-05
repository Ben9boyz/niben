// Dev-only test content for the mock API: lots of trips/photos, books, recordings and songs, so the
// pages can be checked with a realistic (and a bit extreme) amount of data. NIBEN_SEED=0 turns it off.

import type { Db, Files, Row } from './mockApi.ts'

type Shape = readonly [number, number]
const SHAPES: Shape[] = [[3, 4], [4, 3], [16, 9], [1, 1], [3, 4], [4, 3], [9, 16]]

function photoSvg(n: number, hue: number, [w, h]: Shape): string {
  const W = w * 120, H = h * 120
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},65%,58%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},55%,28%)"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<circle cx="${W * 0.72}" cy="${H * 0.3}" r="${Math.min(W, H) * 0.12}" fill="rgba(255,255,255,.55)"/>
<path d="M0 ${H * 0.75} L${W * 0.3} ${H * 0.5} L${W * 0.55} ${H * 0.7} L${W * 0.8} ${H * 0.45} L${W} ${H * 0.65} L${W} ${H} L0 ${H}Z" fill="rgba(0,0,0,.28)"/>
<text x="${W / 2}" y="${H / 2}" font-family="system-ui" font-weight="800" font-size="${Math.min(W, H) * 0.22}" fill="#fff" text-anchor="middle" dominant-baseline="middle">${n}</text>
</svg>`
}

const hex = (i: number) => i.toString(16).padStart(20, 'a')

export function seed(db: Db, files: Files): void {
  if (process.env.NIBEN_SEED === '0') return
  interface SeedTrip { country: string; place?: string | null; title: string; year?: number; date_from?: string; date_to?: string; body?: string; photos: number }
  const TRIPS: SeedTrip[] = [
    { country: 'Japan', place: 'Tokyo, Kyoto og Osaka', title: 'To uker i Japan', date_from: '2025-07-02', date_to: '2025-07-16', body: 'teamLab, ramen hver dag, og alt for mange togturer.\nShinkansen til Kyoto, tempelvandring og en kveld i Dotonbori.', photos: 82 },
    { country: 'Iceland', place: null, title: 'Island laufey', year: 2026, photos: 31 },
    { country: 'Italy', place: 'Roma', title: 'Påsketur til Roma med en veldig lang tittel som må brytes over flere linjer', date_from: '2024-03-28', date_to: '2024-04-02', body: 'Pizza, Colosseum og alt for mye gåing.', photos: 40 },
    { country: 'Norway', place: 'Lofoten', title: 'Lofoten', year: 2023, photos: 4 },
    { country: 'Sweden', place: 'Stockholm', title: 'Helgetur', date_from: '2023-05-12', photos: 2 },
    { country: 'Denmark', place: 'København', title: 'Tivoli', year: 2022, photos: 1 },
    { country: 'Spain', place: 'Barcelona', title: 'Sommer i Spania', year: 2022, body: 'Ingen bilder fra denne turen ennå.', photos: 0 },
    { country: 'Japan', place: 'Hokkaido', title: 'Vinter i Sapporo', date_from: '2026-01-20', date_to: '2026-01-27', photos: 51 },
    { country: 'United States of America', place: 'New York', title: 'NYC', year: 2019, photos: 12 },
  ]
  let n = 0
  for (const [ti, t] of TRIPS.entries()) {
    const id = db.seq++
    db.trips.push({ id, country: t.country, place: t.place || null, title: t.title, year: t.year || (t.date_from ? Number(t.date_from.slice(0, 4)) : null), date_from: t.date_from || null, date_to: t.date_to || null, body: t.body || null })
    for (let k = 0; k < t.photos; k++) {
      const shape = SHAPES[(k + ti) % SHAPES.length] ?? [1, 1] as const
      const path = `uploads/photos/${hex(++n)}.jpg`
      files.set(path, { type: 'image/svg+xml', buf: Buffer.from(photoSvg(k + 1, (ti * 47 + k * 13) % 360, shape)) })
      db.photos.push({ id: db.seq++, trip_id: id, path, caption: k % 9 === 2 ? `Bilde ${k + 1} – en liten bildetekst om hva som skjer her` : null, width: shape[0] * 600, height: shape[1] * 600, sort: k })
    }
  }

  const AUTHORS = ['Haruki Murakami', 'Jo Nesbø', 'Ursula K. Le Guin', 'Kazuo Ishiguro', 'Maja Lunde', 'Ted Chiang', 'Sally Rooney', 'Karl Ove Knausgård']
  const TITLES = ['Norwegian Wood', 'Snømannen', 'The Left Hand of Darkness', 'Klara and the Sun', 'Bienes historie', 'Stories of Your Life and Others', 'Normal People', 'Min kamp 1', 'Kafka on the Shore', 'A Wizard of Earthsea', 'Never Let Me Go', 'Exhalation', 'Blått', 'The Remains of the Day', 'Hodejegerne', 'Beautiful World, Where Are You']
  for (let k = 0; k < 34; k++) {
    db.books.push({
      id: db.seq++, title: (TITLES[k % TITLES.length] ?? '') + (k >= TITLES.length ? ` (${Math.floor(k / TITLES.length) + 1})` : ''), author: AUTHORS[k % AUTHORS.length],
      isbn: null, ol_key: null, cover_url: null, published_year: 1980 + (k * 7) % 44, pages: 180 + (k * 37) % 500,
      read_on: `20${String(18 + (k % 8)).padStart(2, '0')}-0${(k % 9) + 1}-1${k % 9}`, rating: (k % 5) + 1,
      thoughts: k % 3 ? 'Likte den godt. Rolig tempo, men slutten satt lenge i meg etterpå.' : 'En av de beste jeg har lest. '.repeat(6).trim(),
      quote: k % 4 === 0 ? 'Hvis du bare leser de bøkene alle andre leser, kan du bare tenke det alle andre tenker.' : null,
    })
  }

  const GUITARS = ['pacifica', 'fs820']
  for (let k = 0; k < 14; k++) {
    db.recordings.push({ id: db.seq++, guitar: GUITARS[k % 2] ?? 'pacifica', title: `Opptak ${k + 1}${k % 4 === 0 ? ' – første forsøk på en litt lengre låt' : ''}`, recorded_on: `2025-${String((k % 12) + 1).padStart(2, '0')}-0${(k % 9) + 1}`, youtube: k % 3 === 0 ? 'dQw4w9WgXcQ' : null, notes: k % 2 ? 'Fingerspill, capo 2.' : null, audio_path: null })
  }

  const SONGS: [string, string, string][] = [['Wish You Were Here', 'Pink Floyd', 'C D Am G'], ['Knockin\' on Heaven\'s Door', 'Bob Dylan', 'G D Am G D C'], ['Riptide', 'Vance Joy', 'Am G C'], ['Horse with No Name', 'America', 'Em D6/9'], ['Let It Be', 'The Beatles', 'C G Am F'], ['Stand by Me', 'Ben E. King', 'G Em C D'], ['Hallelujah', 'Leonard Cohen', 'C Am C Am F G C G'], ['Zombie', 'The Cranberries', 'Em C G D'], ['Hotel California', 'Eagles', 'Bm F# A E G D Em F#'], ['Perfect', 'Ed Sheeran', 'G Em C D'], ['Creep', 'Radiohead', 'G B C Cm']]
  SONGS.forEach(([title, artist, chords], k) => db.songs.push({ id: 100 + k, title, artist, chords, bpm: 70 + k * 6, beats: 4, capo: k % 3, ug_url: null, notes: k % 2 ? 'Slagmønster: D DU UDU' : null }))
}
