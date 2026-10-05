/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

// Spotify's Web Playback SDK (loaded from sdk.scdn.co)
interface SpotifyPlayerState {
  paused: boolean
  position: number
  duration: number
  track_window: { current_track: { uri: string; name: string; artists: { name: string }[]; album: { name: string; uri: string; images: { url: string }[] } } }
}
interface SpotifyPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(event: string, cb: (arg: never) => void): boolean
  removeListener(event: string): boolean
  getCurrentState(): Promise<SpotifyPlayerState | null>
  setVolume(v: number): Promise<void>
  togglePlay(): Promise<void>
  activateElement?(): Promise<void>
  _options?: { id?: string }
}
interface Window {
  Spotify?: { Player: new (options: { name: string; getOAuthToken: (cb: (token: string) => void) => void; volume?: number }) => SpotifyPlayer }
  onSpotifyWebPlaybackSDKReady?: () => void
}

// the desktop app ("niben musikk") adds this through its preload script
interface NibenAppBridge { kind?: string; [key: string]: unknown }
interface Window { nibenApp?: NibenAppBridge }
