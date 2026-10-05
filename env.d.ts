/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

// Spotify's Web Playback SDK (loaded from sdk.scdn.co)
interface SpotifyImage { url: string; width?: number; height?: number }
interface SpotifyTrackInfo { uri: string; name: string; artists: { name: string }[]; album: { name: string; uri: string; images: SpotifyImage[] } }
interface SpotifyPlayerState {
  paused: boolean
  shuffle: boolean
  position: number
  duration: number
  context: { uri: string | null }
  track_window: { current_track: SpotifyTrackInfo | null }
}
interface SpotifyPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(event: 'ready' | 'not_ready', cb: (p: { device_id: string }) => void): boolean
  addListener(event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error', cb: (e: { message: string }) => void): boolean
  addListener(event: 'player_state_changed', cb: (s: SpotifyPlayerState | null) => void): boolean
  pause(): Promise<void>
  resume(): Promise<void>
  seek(ms: number): Promise<void>
  nextTrack(): Promise<void>
  previousTrack(): Promise<void>
  setVolume(v: number): Promise<void>
  activateElement(): Promise<void>
}
interface Window {
  Spotify?: { Player: new (options: { name: string; getOAuthToken: (cb: (token: string) => void) => void; volume?: number }) => SpotifyPlayer }
  onSpotifyWebPlaybackSDKReady?: () => void
}

// the desktop app ("niben musikk") adds this through its preload script
interface NibenAppBridge { kind?: string; drm?: boolean; [key: string]: unknown }
interface Window { nibenApp?: NibenAppBridge }

// Safari's prefixed audio context
interface Window { webkitAudioContext?: typeof AudioContext }
