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


## Tests

`npm test` runs all three; each also runs alone. CI (`.github/workflows/ci.yml`) runs them on every push.

| | what | needs |
|---|---|---|
| `npm run test:unit` | vitest: room keys, which corners a room shows, chords, and that the browser stores forget one room and read the next | nothing |
| `npm run test:api` | `api.php` in a throw-away copy of `public/` against a **test database** (emptied first – its name must contain `test`), a fake Spotify and mail written to a file: accounts, approval, forgotten password, rooms that must not leak, who may control the music, caches | php, mysql/mariadb, node |
| `npm run test:e2e` | the real front end in Chromium: switching rooms without a reload, logging in from the cog, the grouped admin | the same + Chromium (`NIBEN_CHROMIUM=/path/to/chrome` to use one you have) |

The database is read from `NIBEN_TEST_DB` (default `niben_test`), `NIBEN_TEST_DB_USER`, `NIBEN_TEST_DB_PASS`, `NIBEN_TEST_DB_HOST`.
`npm run zip` builds `niben-upload.zip` for uploading (not kept in git).

### Refactoring the 3D listening corner

`src/three/listening.ts` ties the corner together (the shelf of records, what is held / playing, the per-frame update); the pieces
it is made of are in `src/three/listening/` (cabinet, turntable, decor, stack, wall, ipod, living, a loose record, textures …).
Before changing how the corner is built, take a snapshot of the scene and compare afterwards – every object's place, size, colour
and visibility in ten states (shelf, record out, playing, deck view, iPod held …):

```
NIBEN_GOLDEN_OUT=/tmp/before ./tests/e2e/run-golden.sh      # before
NIBEN_GOLDEN_OUT=/tmp/after  ./tests/e2e/run-golden.sh      # after
node tests/e2e/golden.mjs diff /tmp/before /tmp/after       # exit 1 on a difference (position tolerance 3 cm)
```

## Where things are (src/)

| folder | what |
|---|---|
| `pages/`, `panels/` | one page (the plain site) and one panel (the 3D room's side panel) per route |
| `components/` | `music/` player, library, queue · `vinyl/` the record / iPod overlays of the listening corner · `guitar/` tuner, chords, recordings · `japan/` words, practice · `content/` trips, books, about, guestbook, year · `room/` the 3D room's shell, room switcher, model editor · `layout/` navigation, menus, settings · `ui/` small shared bits · `admin/` the admin tabs |
| `composables/` | `music/` Spotify, queue, folders, web player · `site/` data, admin, texts, milestones, Steam, timer · `room/` which room, models, weather · `japan/` · `ui/` theme, mode, language, shortcuts … |
| `three/` | the 3D scene (`listening/` = the listening corner's parts) |
| `lib/` | plain helpers (no Vue state) |

Imports use `@/` for anything in `src/` (`import { spotify } from '@/composables/music/useSpotify'`); `./` only for a neighbour in the same folder.
