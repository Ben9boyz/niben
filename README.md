# niben.no

Personal hobby site: a 3D room (Three.js) with stations for guitars, books, travel, code projects,
an "about me" wall and a listening corner with Spotify — plus a plain, non-3D version of every page.

- **Front end:** Vue 3 + vue-router, Vite, Three.js (render on demand, adaptive resolution), Lucide icons
- **Back end:** PHP 8.3 (`public/api.php`) + MySQL, hosted on Webhuset
- **Spotify:** OAuth for the owner, record shelf / iPod / turntable, Web Playback SDK, switch lock
- **Apps:** installable PWA, and desktop apps (`desktop/`, Electron with Widevine) — "niben" and
  "niben musikk" (`#/musicplayer`), both loading the live site

## Develop

```bash
npm install
npm run dev        # local mock API (server/mockApi.js) – admin password "utvikling"
```

## Set up / deploy

Copy `.deploy.local.example` to `.deploy.local` and fill in the FTP/database hosts (not committed).

```bash
./setup.sh           # database + admin password → public/_config.php (not in git)
./spotify-setup.sh   # Spotify Client ID/Secret → public/_spotify.php (not in git)
./deploy.sh          # build + FTP upload (password from the macOS keychain)
./deploy.sh ftp 'index*' _spotify.inc.php   # only some files
```

Desktop apps: `cd desktop && npm install && npm run dist` (niben) / `npm run dist:music` (niben musikk).

`public/_config.php`, `public/_spotify.php` and uploads are deliberately **not** in this repository.
