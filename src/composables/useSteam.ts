import { reactive } from 'vue'

// Gaming corner (Steam via the server): profile, what's being played right now, the library.
export interface SteamGame {
  appid: number
  name: string
  hours: number
  recent?: number
  last?: number
  ach?: { done: number; total: number } | null
}
export interface SteamProfile {
  name: string
  avatar?: string | null
  url?: string | null
  state?: string
  online?: boolean
  playing?: { appid: number; name: string; since?: number | null } | null
  last_online?: number | null
  since?: number | null
}
export interface SteamLibrary {
  count: number
  hours: number
  played?: number
  level?: number
  backlog?: number
  two_weeks?: number
  hidden?: boolean
  recent: SteamGame[]
  top: SteamGame[]
  longest?: { name: string; hours: number } | null
  genres?: { name: string; hours: number }[]
  platform?: { win: number; mac: number; linux: number }
}
export interface SteamAchievement { name: string; text?: string; icon?: string | null; at?: number | null; rarity?: number | null }
export interface SteamLive {
  players?: number | null
  info?: { genres?: string[]; score?: number | null; dev?: string; year?: string; text?: string } | null
  news?: { title: string; text?: string; url?: string } | null
  ach?: SteamAchievement[]
}
export interface SteamFriend {
  id: string
  name: string
  avatar?: string | null
  url?: string | null
  online?: boolean
  state?: string
  playing?: string | null
  since?: number | null
  last?: number | null
}
export interface SteamBestFriend extends SteamFriend {
  shared?: { appid: number; name: string; mine: number; theirs: number }[]
  shared_count?: number
}
export interface SteamFriends { best?: SteamBestFriend | null; list?: SteamFriend[]; online?: number; count?: number; hidden?: boolean }
interface SteamReply { configured?: boolean; error?: string; profile?: SteamProfile | null; library?: SteamLibrary | null; live?: SteamLive | null; friends?: SteamFriends | null }

export const steam = reactive({
  loaded: false,
  configured: false,
  error: null as string | null,
  profile: null as SteamProfile | null,
  library: null as SteamLibrary | null,
  live: null as SteamLive | null, // details about the game being played now (or the last one): players online, news, my newest unlocks
  friends: null as SteamFriends | null,
})

let loading: Promise<void> | null = null
let timer = 0
export function loadSteam(force = false): Promise<void> {
  if (loading && !force) return loading
  loading = fetch('api.php?action=steam_public', { cache: 'no-store' })
    .then((r) => r.json() as Promise<SteamReply>)
    .then((j) => {
      steam.configured = !!j.configured
      if (j.error) steam.error = j.error
      else {
        steam.error = null
        steam.profile = j.profile ?? null
        steam.library = j.library ?? null
        steam.live = j.live ?? null
        steam.friends = j.friends ?? null
      }
    })
    .catch(() => { steam.error = 'Fikk ikke kontakt med Steam.' })
    .finally(() => { steam.loaded = true })
  return loading
}

/** Keep "playing now" fresh while the gaming corner is open. Returns a stop function. */
export function watchSteam(): () => void {
  void loadSteam()
  clearInterval(timer)
  timer = window.setInterval(() => { if (!document.hidden) void loadSteam(true) }, 60000)
  return () => clearInterval(timer)
}

const CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps'
/** Wide store banner (460×215). */
export const headerImg = (appid: number | string): string => `${CDN}/${appid}/header.jpg`
/** Tall library cover (600×900) – not every (older) game has one; fall back to the banner. */
export const coverImg = (appid: number | string): string => `${CDN}/${appid}/library_600x900.jpg`
export const storeUrl = (appid: number | string): string => `https://store.steampowered.com/app/${appid}`

/** "i dag", "i går", "for 3 dager siden", "for 2 mnd. siden" … */
export function ago(unix: number | null | undefined): string {
  if (!unix) return ''
  const d = Math.floor((Date.now() / 1000 - unix) / 86400)
  if (d <= 0) return 'i dag'
  if (d === 1) return 'i går'
  if (d < 7) return `for ${d} dager siden`
  if (d < 30) return `for ${Math.round(d / 7)} uker siden`
  if (d < 365) return `for ${Math.round(d / 30)} mnd. siden`
  return `for ${Math.round(d / 365)} år siden`
}

export const fmtHours = (h: number): string => (h >= 100 ? Math.round(h).toLocaleString('nb-NO') : String(h).replace('.', ',')) + ' t'

/** "1 t 23 min" for a session that began at `unix`. */
export function sessionLen(unix: number | null | undefined): string {
  if (!unix) return ''
  const m = Math.max(1, Math.round((Date.now() / 1000 - unix) / 60))
  return m >= 60 ? `${Math.floor(m / 60)} t ${m % 60} min` : `${m} min`
}
export const fmtDate = (unix: number | null | undefined): string => (unix ? new Date(unix * 1000).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
export const fmtYears = (unix: number | null | undefined): string => (unix ? `${Math.max(1, Math.round((Date.now() / 1000 - unix) / 31557600))} år` : '')
