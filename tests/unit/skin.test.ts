import { describe, it, expect } from 'vitest'
import { SKINS, DEFAULT_SKIN, validSkin } from '@/composables/ui/useSkin'

describe('skins', () => {
  it('knows every listed skin; anything else is the standard (Taster)', () => {
    for (const k of SKINS) expect(validSkin(k.id)).toBe(k.id)
    expect(DEFAULT_SKIN).toBe('keys')
    expect(validSkin('chrome')).toBe('keys')
    expect(validSkin('')).toBe('keys')
    expect(validSkin(undefined)).toBe('keys')
    expect(validSkin(' clay ')).toBe('clay')
  })
  it('has Taster first, the six materials, and the old look last', () => {
    expect(SKINS.map((k) => k.id)).toEqual(['keys', 'clay', 'material', 'skeu', 'flat', 'glass', 'alu'])
  })
})
