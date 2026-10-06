// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseGpx, paceText, routePath, routeText } from '@/lib/modules/gpx'

const gpx = (pts: [number, number, number, string][]): string =>
  `<?xml version="1.0"?><gpx><trk><name>Morgentur</name><trkseg>${pts.map(([la, lo, el, t]) => `<trkpt lat="${la}" lon="${lo}"><ele>${el}</ele><time>${t}</time></trkpt>`).join('')}</trkseg></trk></gpx>`

describe('GPX import', () => {
  it('works out distance, time, climbing and a short route', () => {
    // ~1.11 km north in 6 minutes, 30 m up
    const w = parseGpx(gpx([[60, 10, 100, '2026-03-01T07:00:00Z'], [60.005, 10, 115, '2026-03-01T07:03:00Z'], [60.01, 10, 130, '2026-03-01T07:06:00Z']]))
    expect(w).not.toBeNull()
    expect(w!.km).toBeGreaterThan(1.05)
    expect(w!.km).toBeLessThan(1.15)
    expect(w!.min).toBe(6)
    expect(w!.hm).toBe(30)
    expect(w!.date).toBe('2026-03-01')
    expect(w!.name).toBe('Morgentur')
    expect(w!.route).toMatch(/^\d{1,3},\d{1,3}( \d{1,3},\d{1,3})+$/)
    expect(routePath(w!.route).startsWith('M')).toBe(true)
  })
  it('refuses a file with no track', () => {
    expect(parseGpx('<gpx></gpx>')).toBeNull()
    expect(parseGpx('not xml <<<')).toBeNull()
  })
  it('keeps a long track short enough to be saved', () => {
    const pts: [number, number][] = Array.from({ length: 3000 }, (_, i) => [60 + i * 0.00001, 10 + Math.sin(i / 50) * 0.001])
    expect(routeText(pts).length).toBeLessThan(700)
  })
  it('says pace for running and speed for the rest', () => {
    expect(paceText(10, 50, 'Løping')).toBe('5:00 min/km')
    expect(paceText(30, 60, 'Sykling')).toBe('30 km/t')
    expect(paceText(0, 10, 'Løping')).toBe('')
  })
})
