// Uploaded trip photos are up to 2400 px. Lists show small copies made by thumb.php; the full image
// is only loaded when a photo is opened.
const UPLOADED = /^uploads\/photos\/([a-f0-9]{20}\.jpg)$/

/** Small version of a photo (long edge `w`: 400 or 900). Anything else is returned as it is. */
export function thumb<T extends string | null | undefined>(src: T, w: 400 | 900 = 400): T | string {
  const m = UPLOADED.exec(src ?? '')
  return m ? `thumb.php?f=${m[1]}&w=${w}` : src
}
