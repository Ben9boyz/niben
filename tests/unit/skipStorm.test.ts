import { describe, it, expect } from 'vitest'
import { skipWatch } from '@/lib/skipStorm'

describe('skipWatch', () => {
  it('sees songs flying past by themselves', () => {
    const w = skipWatch()
    expect(w.note(0)).toBe(false)
    expect(w.note(1500)).toBe(false)
    expect(w.note(3000)).toBe(true)
  })
  it('songs that end normally are not a run', () => {
    const w = skipWatch()
    expect(w.note(0)).toBe(false)
    expect(w.note(200_000)).toBe(false)
    expect(w.note(400_000)).toBe(false)
  })
  it('somebody pressing next quickly is not a run', () => {
    const w = skipWatch()
    for (let t = 0; t < 5000; t += 1000) { w.user(t); expect(w.note(t + 300)).toBe(false) }
  })
})
