import { describe, it, expect } from 'vitest'
import { validAccent, deriveAccent, DEFAULT_ACCENT } from '../../src/composables/ui/useAccent'

describe('the accent colour', () => {
  it('only accepts #rrggbb, and the standard blue means "nothing to override"', () => {
    expect(validAccent('#E5484D')).toBe('#e5484d')
    expect(validAccent(DEFAULT_ACCENT)).toBeNull()
    for (const bad of ['red', '#fff', 'url(x)', '#12345g', '', null, undefined, '#e5484d;background:red']) expect(validAccent(bad)).toBeNull()
  })
  it('works out the four stylesheet values from one colour, lighter on the dark theme', () => {
    const l = deriveAccent('#e5484d', false)
    expect(l.accent).toBe('rgb(229 72 77)')
    expect(l.soft).toBe('rgba(229, 72, 77, 0.12)')
    const d = deriveAccent('#e5484d', true)
    const lum = (c: string) => c.match(/\d+/g)!.map(Number).reduce((a, b) => a + b, 0)
    expect(lum(d.accent)).toBeGreaterThan(lum(l.accent))
    expect(lum(l.accent2)).toBeGreaterThan(lum(l.accent))
  })
})
