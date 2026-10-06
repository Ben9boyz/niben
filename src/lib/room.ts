/** The id of the room on screen (a cookie the server keeps up to date). Browser-side caches are kept per room with it,
 *  so one room's albums, folders or queue never show in another. */
export function roomId(): string {
  try { return /(?:^|;\s*)niben_r=(\d+)/.exec(document.cookie)?.[1] ?? '1' } catch { return '1' }
}
/** `base` made room-specific: 'niben-grouping' → 'niben-grouping:r3'. */
export const roomKey = (base: string): string => `${base}:r${roomId()}`
