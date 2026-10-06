/** A web address that may go in a link or a picture: http(s) only – never javascript:, and nothing that can break out of a CSS url(). */
export const safeUrl = (u: unknown): string | null => (typeof u === 'string' && /^https?:\/\/[^\s"'<>()\\]+$/i.test(u) ? u : null)
