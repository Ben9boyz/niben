# niben.no

Waddup

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

## Several users

Mail: new-account notices go to `admin_email` in `_config.php` (or the e-mail on the owner's account); users get mail when approved and for "Glemt passord?" (reset link, valid 1 h). Set `mail_log` in `_config.php` to a file path to write mails there instead of sending them (testing).


Anybody can ask for an account (Admin → Opprett konto: username, e-mail, password). The owner approves it under
Admin → Brukere; only then can it log in. An approved user gets a room of their own (trips, books, guitars, recordings,
songs, "Om meg", a guestbook, practice calendar and "Året") and manages it in their own admin panel, where they can also switch corners of the room off (Japanese,
Spill …) and add their own integrations under Innstillinger: Spotify (through the site's Spotify app: the owner adds each user's Spotify e-mail in the Spotify dashboard), jpdb, Steam, GitHub, Last.fm and a home town for the weather (keys stored encrypted, see `public/_users.inc.php`). The room icon in the menu switches
between rooms; the room is kept in the cookie `niben_room` and every API request is about that room. Without a cookie the
owner's room is shown (a logged-in user starts in their own). The owner is user 1 and still logs in with the admin
password (leave the username empty) – nothing that already exists moves. Spotify stays in the owner's room for now.

```bash
php -S 127.0.0.1:8099   # (in a copy of public/ with a test _config.php)
NIBEN_API=http://127.0.0.1:8099 npm run dev   # the frontend against a real api.php + MySQL instead of the mock
```

Desktop apps: `cd desktop && npm install && npm run dist` (niben) / `npm run dist:music` (niben musikk).

`public/_config.php`, `public/_spotify.php` and uploads are deliberately **not** in this repository.
