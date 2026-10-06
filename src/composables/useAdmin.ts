import { computed, reactive } from 'vue'
import { reloadData } from './useData'

/** `loggedIn` = I (the owner) am logged in. `mine` = logged in AND the room on screen is my own – what the music and
 *  every other "change this room" control hinges on (so a visitor in somebody else's room only sees, never controls). */
export const admin = reactive({ checked: false, loggedIn: false, mine: false })
export interface AccountUser { id: number; username: string; owner: boolean }
/** Any logged-in account (me or a user), and whether the room on screen is theirs. */
export const account = reactive({ user: null as AccountUser | null, mine: false })
/** Logged in with some account. */
export const signedIn = computed(() => admin.loggedIn || !!account.user)
/** Allowed to change what is in this room: logged in AND it is my own room. */
export const canManage = computed(() => account.mine)

/** An error from api.php: the server's message, its `code` (e.g. 'device_missing') and the HTTP status. */
export class ApiError extends Error {
  code?: string
  status?: number
}

/** The part of every reply the client looks at. */
interface ReplyBase { error?: string; code?: string }
export type ApiBody = Record<string, unknown> | FormData | null | undefined
export interface ApiOptions { onProgress?: (fraction: number) => void; query?: string }

/** Calls api.php. `body` may be a plain object (sent as JSON) or FormData (for uploads). `T` is the reply's shape. */
export async function api<T extends object = Record<string, never>>(action: string, body?: ApiBody, { onProgress, query = '' }: ApiOptions = {}): Promise<T> {
  const url = `api.php?action=${encodeURIComponent(action)}${query}`
  if (body instanceof FormData && onProgress) {
    // XHR gives upload progress for large audio files
    return new Promise<T>((resolve, reject) => {
      const x = new XMLHttpRequest()
      x.open('POST', url)
      x.setRequestHeader('X-Niben', '1')
      x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total) }
      x.onload = () => {
        let json: ReplyBase = {}
        try { json = JSON.parse(x.responseText) as ReplyBase } catch { /* not JSON */ }
        const text = (x.responseText || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140)
        if (x.status === 413) reject(new Error(json.error || 'Filen er for stor for serveren.'))
        else if (x.status >= 400 || json.error) reject(new Error(json.error || `Feil ${x.status}${text ? `: ${text}` : ''}`))
        else resolve(json as T)
      }
      x.onerror = () => reject(new Error('Nettverksfeil – opplastingen ble avbrutt (for stor fil eller ustabilt nett?)'))
      x.timeout = 10 * 60 * 1000
      x.ontimeout = () => reject(new Error('Opplastingen tok for lang tid.'))
      x.send(body)
    })
  }
  const headers: Record<string, string> = { 'X-Niben': '1' }
  const init: RequestInit = { method: body ? 'POST' : 'GET', headers, credentials: 'same-origin' }
  if (body instanceof FormData) init.body = body
  else if (body) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const r = await fetch(url, init)
  let json: ReplyBase = {}
  try { json = (await r.json()) as ReplyBase } catch { /* empty or not JSON */ }
  if (!r.ok || json.error) {
    if (r.status === 401) { admin.loggedIn = false; admin.mine = false }
    const err = new ApiError(json.error || `Feil ${r.status}`)
    err.code = json.code
    err.status = r.status
    throw err
  }
  return json as T
}

/** The message of whatever was thrown. */
export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export async function checkLogin(): Promise<void> {
  try {
    const r = await api<{ admin: boolean; user?: AccountUser | null; room?: { mine: boolean } }>('me')
    admin.loggedIn = !!r.admin
    account.user = r.user ?? null
    account.mine = !!r.room?.mine
    admin.mine = account.mine
    if (r.admin) { try { localStorage.setItem('niben-me', '1') } catch { /* private mode */ } }
  } catch {
    admin.loggedIn = false
    admin.mine = false
  }
  admin.checked = true
}

export async function login(password: string): Promise<void> {
  await api('login', { password })
  admin.loggedIn = true
  admin.mine = true
  try { localStorage.setItem('niben-me', '1') } catch { /* private mode */ } // this browser is me: not counted as a visitor
  await checkLogin()
  refreshSongs()
}

/** Username (or e-mail) + password. The room changes with the account, so the page starts over. */
export async function userLogin(username: string, password: string): Promise<void> {
  const r = await api<{ user: AccountUser }>('user_login', { username, password })
  if (r.user.owner) { try { localStorage.setItem('niben-me', '1') } catch { /* private mode */ } }
  location.reload()
}

/** Ask for an account – the owner has to approve it before it can log in. */
export async function registerAccount(username: string, email: string, password: string, website = ''): Promise<void> {
  await api('user_register', { username, email, password, website })
}

export async function logout(): Promise<void> {
  try { await api('logout', {}) } catch { /* already out */ }
  admin.loggedIn = false
  admin.mine = false
  account.user = null
  location.reload() // (back to my room)
}

// chord sheets are only sent to a logged-in admin, so reload the data when that changes
function refreshSongs(): void {
  reloadData().catch(() => {})
}

/**
 * Shrinks a photo in the browser before upload: max 2400 px, JPEG.
 * Re-encoding through a canvas also drops all EXIF data (including GPS position).
 */
export async function shrinkImage(file: File, maxEdge = 2400, quality = 0.85): Promise<File> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) throw new Error('Nettleseren kan ikke tegne bilder.')
  g.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Klarte ikke å pakke bildet.'))), 'image/jpeg', quality))
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
}
