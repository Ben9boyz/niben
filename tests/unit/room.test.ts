import { describe, it, expect, beforeEach } from 'vitest'
import { roomId, roomKey } from '../../src/lib/room'

const setRoomCookie = (id: string | null): void => {
  document.cookie = id === null ? 'niben_r=; expires=Thu, 01 Jan 1970 00:00:00 GMT' : `niben_r=${id}`
}

describe('room keys', () => {
  beforeEach(() => setRoomCookie(null))

  it('is room 1 (the main room) until the server has said otherwise', () => {
    expect(roomId()).toBe('1')
    expect(roomKey('niben-grouping')).toBe('niben-grouping:r1')
  })

  it('follows the cookie the server keeps up to date', () => {
    setRoomCookie('3')
    expect(roomId()).toBe('3')
    expect(roomKey('niben-grouping')).toBe('niben-grouping:r3')
  })

  it('gives every room its own key for the same thing', () => {
    setRoomCookie('2')
    const a = roomKey('niben-spotify-lists-v2')
    setRoomCookie('3')
    expect(roomKey('niben-spotify-lists-v2')).not.toBe(a)
  })

  it('ignores a cookie that is not a room id', () => {
    setRoomCookie('abc')
    expect(roomId()).toBe('1')
  })
})
