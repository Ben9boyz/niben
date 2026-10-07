import { describe, it, expect } from 'vitest'
import { SKINS, validSkin } from '@/composables/ui/useSkin'

describe('skins', () => {
  it('knows every listed skin and nothing else', () => {
    for (const k of SKINS) expect(validSkin(k.id)).toBe(k.id)
    expect(validSkin('chrome')).toBeNull()
    expect(validSkin('')).toBeNull()
    expect(validSkin(undefined)).toBeNull()
    expect(validSkin(' clay ')).toBe('clay')
  })
  it('has the standard first and six materials', () => {
    expect(SKINS[0]!.id).toBeNull()
    expect(SKINS.map((k) => k.id).slice(1)).toEqual(['clay', 'keys', 'material', 'skeu', 'flat', 'glass'])
  })
})
