import { reactive } from 'vue'
import { reloadData } from './useData'

export const admin = reactive({ checked: false, loggedIn: false })

/** Calls api.php. `body` may be a plain object (sent as JSON) or FormData (for uploads). */
export async function api(action, body, { onProgress } = {}) {
  const url = `api.php?action=${encodeURIComponent(action)}`
  if (body instanceof FormData && onProgress) {
    // XHR gives upload progress for large audio files
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest()
      x.open('POST', url)
      x.setRequestHeader('X-Niben', '1')
      x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
      x.onload = () => {
        let json = {}
        try { json = JSON.parse(x.responseText) } catch {}
        const text = (x.responseText || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140)
        if (x.status === 413) reject(new Error(json.error || 'Filen er for stor for serveren.'))
        else if (x.status >= 400 || json.error) reject(new Error(json.error || `Feil ${x.status}${text ? `: ${text}` : ''}`))
        else resolve(json)
      }
      x.onerror = () => reject(new Error('Nettverksfeil – opplastingen ble avbrutt (for stor fil eller ustabilt nett?)'))
      x.timeout = 10 * 60 * 1000
      x.ontimeout = () => reject(new Error('Opplastingen tok for lang tid.'))
      x.send(body)
    })
  }
  const opts = { method: body ? 'POST' : 'GET', headers: { 'X-Niben': '1' }, credentials: 'same-origin' }
  if (body instanceof FormData) opts.body = body
  else if (body) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const r = await fetch(url, opts)
  let json = {}
  try { json = await r.json() } catch {}
  if (!r.ok || json.error) {
    if (r.status === 401) admin.loggedIn = false
    const err = new Error(json.error || `Feil ${r.status}`)
    err.code = json.code
    err.status = r.status
    throw err
  }
  return json
}

export async function checkLogin() {
  try {
    const r = await api('me')
    admin.loggedIn = !!r.admin
  } catch {
    admin.loggedIn = false
  }
  admin.checked = true
}

export async function login(password) {
  await api('login', { password })
  admin.loggedIn = true
  refreshSongs()
}

export async function logout() {
  try { await api('logout', {}) } catch {}
  admin.loggedIn = false
  refreshSongs()
}

// chord sheets are only sent to a logged-in admin, so reload the data when that changes
function refreshSongs() {
  reloadData().catch(() => {})
}

/**
 * Shrinks a photo in the browser before upload: max 2400 px, JPEG.
 * Re-encoding through a canvas also drops all EXIF data (including GPS position).
 */
export async function shrinkImage(file, maxEdge = 2400, quality = 0.85) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d').drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', quality))
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
}
