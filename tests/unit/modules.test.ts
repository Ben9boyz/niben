import { describe, expect, it } from 'vitest'
import { CATALOG, CATEGORIES } from '@/lib/modules/catalog'
import { MODELS } from '@/three/moduleModels'

describe('the hobby catalogue', () => {
  it('every kind has its own id, a category that exists and a 3D model of its own', () => {
    const ids = CATALOG.map((k) => k.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const k of CATALOG) {
      expect(CATEGORIES, k.id).toContain(k.cat)
      expect(MODELS[k.id], `${k.id} needs a model in three/moduleModels.ts`).toBeTypeOf('function')
      expect(k.id).toMatch(/^[a-z][a-z0-9_]{1,23}$/) // (what the server accepts)
    }
  })
  it('the first field is what an entry is called, and field keys are what the server keeps', () => {
    for (const k of CATALOG) {
      for (const f of k.fields) expect(f.k).toMatch(/^[a-z][a-z0-9_]{0,23}$/i)
      if (k.stat) expect(k.fields.map((f) => f.k), k.id).toContain(k.stat.field)
      if (k.fields.some((f) => f.kind === 'select')) for (const f of k.fields.filter((x) => x.kind === 'select')) expect(f.options?.length, `${k.id}.${f.k}`).toBeGreaterThan(1)
    }
  })
})
