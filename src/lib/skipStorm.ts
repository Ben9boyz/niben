// Spotify jumps to the next song by itself when it cannot play the one it was given (in the desktop app: a DRM
// licence Spotify will not hand out). Then the songs fly past – three or four in a few seconds, nobody pressing
// anything. This notices such a run: `note()` is told of every song change (and whether somebody just pressed
// next / previous / play), and answers true once there have been `limit` changes nobody asked for within `windowMs`.
export function skipWatch({ limit = 3, windowMs = 12000, userGraceMs = 2500 } = {}) {
  let changes: number[] = []
  let userAt = -Infinity
  return {
    /** Somebody pressed a button (skip, play, pick a song): the song changes that follow are wanted. */
    user(now: number): void { userAt = now },
    /** A song started. True = this is a run of failed songs. */
    note(now: number): boolean {
      if (now - userAt < userGraceMs) return false
      changes = changes.filter((t) => now - t < windowMs)
      changes.push(now)
      return changes.length >= limit
    },
    reset(): void { changes = [] },
  }
}
