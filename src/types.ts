// Shapes shared between the server (public/*.php), the stores in composables/ and the components.

/** A saved album, as the server sends it. */
export interface Album {
  id?: string
  uri: string
  name: string
  artist: string
  artist_id?: string | null
  year?: string
  image?: string | null
  image_large?: string | null
  thumb?: string | null
  url?: string | null
  tracks?: number | null
  added?: number | null
  color?: string | null
  type?: string // 'album' | 'single' (artist pages)
}

export interface Playlist {
  id?: string
  uri: string
  name: string
  owner?: string | null
  editable?: boolean | null
  image?: string | null
  image_large?: string | null
  thumb?: string | null
  count?: number | null
  url?: string | null
}

export interface Track {
  uri: string
  name: string
  artist?: string
  artist_id?: string | null
  ms?: number
  n?: number | null
  disc?: number | null
  img?: string | null
  album?: string
  album_uri?: string
  album_id?: string | null
  album_artist?: string
  album_image?: string | null
  album_image_large?: string | null
  album_url?: string | null
  no?: number | null
}

export interface NowPlaying {
  playing: boolean
  device?: string | null
  device_type?: string | null
  volume?: number | null
  repeat?: 'off' | 'context' | 'track'
  shuffle?: boolean
  progress_ms: number
  duration_ms: number
  name: string
  artist: string
  album: string
  album_uri?: string | null
  artist_id?: string | null
  image: string | null
  image_large?: string | null
  uri: string
  context: string | null
  url?: string | null
  at: number
}

/** What a play was started from (decides the turntable or the iPod). */
export interface PlayOrigin { uri: string; from: string | null; t: number }
export interface Notice { text: string; error: boolean; t: number }

export interface TrackList { tracks: Track[]; hidden?: boolean; error?: boolean }

/** A queue entry (my own queue, see useQueue). */
export interface QueueItem {
  uri: string
  name: string
  artist: string
  img: string
  ms: number
  album_uri: string | null
  album: string
  album_image: string
  no: number | null
  disc: number | null
}

export interface Group {
  id: string
  name: string
  parent?: string | null
  img?: string | null
  cover?: string | null
}

export interface Result { ok: boolean; error?: string }

/** A short status line under a form: saved / failed. */
export interface Flash { ok?: string; error?: string }

/** A tile in the cover grids (an album, a playlist, a search hit…). */
export interface GridItem { uri: string; name: string; sub?: string | null; image?: string | null; thumb?: string | null; artist_id?: string | null }
