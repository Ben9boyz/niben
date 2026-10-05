// Loads Spotify's Web Playback SDK once, shared by the owner's player (useWebPlayer) and the
// listener page (/musicplayer).
let sdkPromise: Promise<void> | null = null

export function loadSpotifySdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve()
  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve, reject) => {
      window.onSpotifyWebPlaybackSDKReady = () => resolve()
      const s = document.createElement('script')
      s.src = 'https://sdk.scdn.co/spotify-player.js'
      s.async = true
      s.onerror = () => { sdkPromise = null; reject(new Error('Fikk ikke lastet Spotify-spilleren.')) }
      document.head.appendChild(s)
    })
  }
  return sdkPromise
}
