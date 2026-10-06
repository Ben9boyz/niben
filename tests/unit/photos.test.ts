import { describe, it, expect } from 'vitest'
import { thumb } from '../../src/lib/photos'

describe('thumb', () => {
  it('points an uploaded photo at the small copy', () => {
    expect(thumb('uploads/photos/0123456789abcdef0123.jpg', 400)).toBe('thumb.php?f=0123456789abcdef0123.jpg&w=400')
    expect(thumb('uploads/photos/0123456789abcdef0123.jpg', 900)).toBe('thumb.php?f=0123456789abcdef0123.jpg&w=900')
  })

  it('leaves everything else as it is', () => {
    expect(thumb('https://example.com/a.jpg')).toBe('https://example.com/a.jpg')
    expect(thumb('uploads/photos/../../secret.jpg')).toBe('uploads/photos/../../secret.jpg')
    expect(thumb(null)).toBe(null)
  })
})
