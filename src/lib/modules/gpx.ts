// A GPX file (what a watch, Strava, Komoot … exports) turned into one workout: distance, time, climbing, and the route as a small
// drawing. Everything is worked out in the browser – the file itself is never sent anywhere.
export interface Workout { date: string; km: number; min: number; hm: number; route: string; name: string }

const rad = (d: number): number => (d * Math.PI) / 180
function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** At most `n` points along the route, scaled to a 0–999 square (x,y pairs) so it fits in a short text. */
export function routeText(pts: [number, number][], n = 44): string {
  if (pts.length < 2) return ''
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const k = Math.cos(rad(lat0)) // (a degree of longitude is shorter the further north you are)
  const xy = pts.map((p) => [p[1] * k, p[0]] as [number, number])
  const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1])
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1
  const pick = (i: number): [number, number] => xy[Math.round((i * (xy.length - 1)) / (n - 1))]!
  const out: string[] = []
  const count = Math.min(n, xy.length)
  for (let i = 0; i < count; i++) {
    const [x, y] = count === xy.length ? xy[i]! : pick(i)
    out.push(`${Math.round(((x - minX) / span) * 999)},${Math.round((1 - (y - minY) / span) * 999)}`)
  }
  return out.join(' ')
}

export function parseGpx(xml: string): Workout | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return null
  const pts = [...doc.getElementsByTagName('trkpt')]
  if (pts.length < 2) return null
  const ll: [number, number][] = []
  let km = 0, up = 0
  let prevEle: number | null = null
  let t0 = 0, t1 = 0
  for (const p of pts) {
    const lat = Number(p.getAttribute('lat')), lon = Number(p.getAttribute('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const last = ll[ll.length - 1]
    if (last) km += haversine(last, [lat, lon])
    ll.push([lat, lon])
    const ele = Number(p.getElementsByTagName('ele')[0]?.textContent)
    if (Number.isFinite(ele)) { if (prevEle !== null && ele - prevEle > 0.5) up += ele - prevEle; prevEle = ele }
    const time = Date.parse(p.getElementsByTagName('time')[0]?.textContent ?? '')
    if (Number.isFinite(time)) { if (!t0) t0 = time; t1 = time }
  }
  if (ll.length < 2) return null
  const name = doc.getElementsByTagName('name')[0]?.textContent?.trim() ?? ''
  return {
    date: t0 ? new Date(t0).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    km: Math.round(km * 100) / 100,
    min: t0 && t1 > t0 ? Math.round((t1 - t0) / 60000) : 0,
    hm: Math.round(up),
    route: routeText(ll),
    name: name.slice(0, 60),
  }
}

/** The route text back as a drawing (an SVG path in a 0–999 square). */
export const routePath = (route: string): string => route.split(' ').map((p, i) => `${i ? 'L' : 'M'}${p}`).join(' ')

/** "5:12 min/km" for something you walk or run, "24,3 km/t" for the rest. */
export function paceText(km: number, min: number, kind: string | undefined): string {
  if (!(km > 0) || !(min > 0)) return ''
  if (kind === 'Løping' || kind === 'Gåtur' || kind === 'Fottur') {
    const per = min / km
    const m = Math.floor(per), s = Math.round((per - m) * 60)
    return `${m}:${String(s === 60 ? 0 : s).padStart(2, '0')} min/km`
  }
  return `${(Math.round((km / (min / 60)) * 10) / 10).toString().replace('.', ',')} km/t`
}
