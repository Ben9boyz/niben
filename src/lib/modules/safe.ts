/** A web address that may go in a link or a picture: http(s) only – never javascript:, and nothing that can break out of a CSS url().
 *  (A picture uploaded to the site itself – uploads/photos/… – is fine too.) */
export const safeUrl = (u: unknown): string | null => (typeof u === 'string' && (/^https?:\/\/[^\s"'<>()\\]+$/i.test(u) || isUpload(u)) ? u : null)
/** A picture uploaded here (not a web address). */
export const isUpload = (u: unknown): u is string => typeof u === 'string' && /^uploads\/photos\/[a-f0-9]{20}\.jpg$/.test(u)
