// Loads Spotify's Web Playback SDK once, shared by the owner's player (useWebPlayer) and the
// listener page (/musicplayer).
let sdkPromise = null

export function loadSpotifySdk() {
  if (window.Spotify) return Promise.resolve()
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      window.onSpotifyWebPlaybackSDKReady = resolve
      const s = document.createElement('script')
      s.src = 'https://sdk.scdn.co/spotify-player.js'
      s.async = true
      s.onerror = () => { sdkPromise = null; reject(new Error('Fikk ikke lastet Spotify-spilleren.')) }
      document.head.appendChild(s)
    })
  }
  return sdkPromise
}
