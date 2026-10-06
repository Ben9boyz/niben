import { describe, it, expect } from 'vitest'
import { findChord, parseProgression, transposeChord, parseSheet } from '../../src/lib/chords'

describe('chords', () => {
  it('finds a shape by name, by alias and for a slash chord', () => {
    expect(findChord('G')?.name).toBe('G')
    expect(findChord('Hm')?.name).toBe('Bm')
    expect(findChord('G/B')?.name).toBe('G')
    expect(findChord('Xyz')).toBeNull()
    expect(findChord(null)).toBeNull()
  })

  it('splits a progression however it was written', () => {
    expect(parseProgression('G D Em C')).toEqual(['G', 'D', 'Em', 'C'])
    expect(parseProgression('G - D | Em, C')).toEqual(['G', 'D', 'Em', 'C'])
    expect(parseProgression('')).toEqual([])
  })

  it('transposes, keeping the bass note and the flat spelling', () => {
    expect(transposeChord('Am7/G', 2)).toBe('Bm7/A')
    expect(transposeChord('C', 0)).toBe('C')
    expect(transposeChord('Bb', 2)).toBe('C')
    expect(transposeChord('C', -1)).toBe('B')
  })

  it('splits a sheet in sections, and only a line of nothing but chords is a chord line', () => {
    const s = parseSheet('[Vers]\nG   D\nA man walked in\n\n[Refreng]\nEm C')
    expect(s.map((x) => x.name)).toEqual(['Vers', 'Refreng'])
    const first = s[0]?.lines[0] ?? []
    expect(first.filter((t) => t.chord).map((t) => t.t)).toEqual(['G', 'D'])
    expect((s[0]?.lines[1] ?? []).some((t) => t.chord)).toBe(false) // "A" in the lyrics is not a chord
  })

  it('moves the chords of a sheet with the transposition', () => {
    const s = parseSheet('G D', 2)
    expect((s[0]?.lines[0] ?? []).filter((t) => t.chord).map((t) => t.t)).toEqual(['A', 'E'])
  })
})
