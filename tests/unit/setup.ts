// What the browser has and jsdom does not: the stores read these when they are imported.
if (!window.matchMedia) {
  window.matchMedia = ((query: string): MediaQueryList => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia
}
