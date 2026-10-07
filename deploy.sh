#!/bin/bash
# Bygger nettsiden og laster den opp til niben.no.
#   ./deploy.sh        – FTP (standard)
#   ./deploy.sh sftp   – SFTP (virker ikke hos Webhuset med FTP-passordet)
#   ./deploy.sh ftp api.php _spotify.inc.php   – bare disse filene (raskt)
#   ./deploy.sh app    – desktop-appen (desktop/dist) til niben.no/app/
#   ./deploy.sh clean  – rydd bort gamle byggfiler på serveren (spør før noe slettes)
#
# Lagre FTP-passordet i nøkkelringen én gang, så slipper du å skrive det:
#   security add-generic-password -s niben-ftp -a <FTP-brukernavn> -w
#
# FTP-bruker og server står i .deploy.local (ikke i git – se .deploy.local.example).
set -e
cd "$(dirname "$0")"

[ -f .deploy.local ] && . ./.deploy.local
: "${FTP_USER:?Mangler FTP_USER – kopier .deploy.local.example til .deploy.local}"
: "${FTP_HOST:?Mangler FTP_HOST – kopier .deploy.local.example til .deploy.local}"
USER_NAME="$FTP_USER"
HOST="$FTP_HOST"
MODE="${1:-ftp}"
shift || true
ONLY="$*" # optional: just these files

if [ "$MODE" != "clean" ]; then
  echo "Bygger nettsiden …"
  npm run build
fi
cd dist

upload_sftp() {
  # one session for everything; the password is asked for by ssh itself (never stored)
  local batch
  batch="$(mktemp)"
  echo "cd www" > "$batch"
  for f in ${ONLY:-* .user.ini}; do
    [ -f "$f" ] || continue
    printf 'put "%s"\n' "$f" >> "$batch"
  done
  echo "bye" >> "$batch"
  echo "Laster opp med SFTP – skriv FTP-passordet når du blir spurt:"
  sftp -q -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password,keyboard-interactive \
    "$USER_NAME@$HOST" < "$batch"
  local rc=$?
  rm -f "$batch"
  return $rc
}

ftp_password() {
  # stored once in the macOS keychain (see the comment at the top), otherwise asked for
  PASS="$(security find-generic-password -s niben-ftp -a "$USER_NAME" -w 2>/dev/null || true)"
  if [ -z "$PASS" ]; then
    read -s -p "FTP-passord for $USER_NAME: " PASS
    echo
  fi
}

upload_ftp() {
  ftp_password
  local FTP_HOST="ftp://$HOST/www"
  local failed=() f

  # one file: upload under a temporary name and swap it in only when it arrived whole –
  # a cut-off upload can then never break the live file
  # (the password goes via stdin, so it never shows up in the process list)
  upload_one() {
    local f="$1" attempt tmp want got
    for attempt in $(seq 1 "${TRIES:-5}"); do
      tmp=".up-$f.$$.$attempt.tmp" # a fresh temporary name each try: a leftover from a cut-off try can't block the next
      if printf 'user = "%s:%s"\n' "$USER_NAME" "$PASS" | curl --ssl-reqd -sS --connect-timeout 20 --max-time 300 -K - -T "$f" "$FTP_HOST/$tmp" -Q "-RNFR $tmp" -Q "-RNTO $f"; then return 0; fi
      echo "    prøver igjen ($attempt/${TRIES:-5}) …"; sleep $((attempt * 2))
    done
    # (never upload straight to the live name as a fallback: when the host refuses the file, a half-written
    # copy is left behind – on 2026-10-05 that broke _spotify.inc.php and with it the whole API)
    return 1
  }

  # index.html goes up LAST, and only when everything else arrived: it points at the new script
  # files, so with one of them missing the whole site would be blank (happened 2026-10-05)
  local page="" ok_any=""
  for f in ${ONLY:-* .user.ini}; do
    [ -f "$f" ] || continue
    if [ "$f" = "index.html" ]; then page="$f"; continue; fi
    if upload_one "$f"; then echo "  ✓ $f"; ok_any=1; else echo "  ✗ $f"; failed+=("$f"); fi
    # nothing gets through at all (the server isn't letting us in): stop instead of hammering it
    if [ -z "$ok_any" ] && [ "${#failed[@]}" -ge 2 ]; then
      echo "  Serveren slipper ikke inn opplastinger nå – stopper. Prøv igjen senere."
      unset PASS
      return 1
    fi
  done

  # the host sometimes answers 451 for a stretch (many connections in a row): wait a little, then
  # go through the files that failed once more
  if [ "${#failed[@]}" -gt 0 ]; then
    echo "  Venter litt og prøver de ${#failed[@]} som feilet på nytt …"; sleep 25
    local still=()
    for f in "${failed[@]}"; do
      if upload_one "$f"; then echo "  ✓ $f"; else echo "  ✗ $f"; still+=("$f"); fi
    done
    failed=("${still[@]}")
  fi
  if [ -n "$page" ]; then
    if [ "${#failed[@]}" -gt 0 ]; then
      echo "  ! index.html er IKKE lastet opp (filer mangler) – siden viser fortsatt forrige versjon."
    elif upload_one "$page"; then echo "  ✓ $page"; else echo "  ✗ $page"; failed+=("$page"); fi
  fi
  unset PASS
  if [ "${#failed[@]}" -gt 0 ]; then
    echo "  Disse mangler fortsatt – kjør: ./deploy.sh ftp ${failed[*]}${page:+ index.html}"
    return 1
  fi
}

upload_app() {
  # the desktop app installers + version.json → niben.no/app/
  ftp_password
  local DIR="../desktop/dist"
  local VER
  VER="$(node -p "require('../desktop/package.json').version")"
  printf '{ "version": "%s", "mac": "app/niben-mac-arm64.dmg", "windows": "app/niben-win-x64.exe" }\n' "$VER" > "$DIR/version.json"
  local FAILED=0
  for f in niben-mac-arm64.dmg niben-win-x64.exe version.json; do
    [ -f "$DIR/$f" ] || { echo "  – $f finnes ikke (bygg med: cd desktop && npm run dist)"; continue; }
    local ok=0 tmp=".up-$f.tmp"
    for attempt in $(seq 1 "${TRIES:-5}"); do
      if printf 'user = "%s:%s"\n' "$USER_NAME" "$PASS" | curl --ssl-reqd -sS --ftp-create-dirs -K - -T "$DIR/$f" "ftp://$HOST/www/app/$tmp" -Q "-RNFR $tmp" -Q "-RNTO $f"; then ok=1; break; fi
      echo "    prøver igjen ($attempt/${TRIES:-5}) …"; sleep $((attempt * 2))
    done
    if [ "$ok" = 1 ]; then echo "  ✓ app/$f"; else echo "  ✗ app/$f"; FAILED=1; fi
  done
  unset PASS
  [ "$FAILED" = 0 ]
}

# Old build files pile up on the server (every build gets new names). Delete the ones the live site no
# longer uses: start from niben.no/index.html, follow every script it loads, keep those – and only ever
# touch built script names (name-xxxxxxxx.js) and leftover temp files. Asks first (YES=1 skips that).
clean_ftp() {
  local live remote doomed n
  live="$(mktemp)"; remote="$(mktemp)"; doomed="$(mktemp)"
  echo "Finner filene siden bruker nå …"
  if ! node ../scripts/live-files.mjs > "$live"; then echo "  Klarte ikke å lese hele den publiserte siden – rydder ikke."; return 1; fi
  [ "$(wc -l < "$live")" -gt 10 ] || { echo "  Fant for få filer – rydder ikke."; return 1; }
  ftp_password
  printf 'user = "%s:%s"\n' "$USER_NAME" "$PASS" | curl --ssl-reqd -sS --connect-timeout 20 --max-time 60 -K - --list-only -X "NLST -a" "ftp://$HOST/www/" | tr -d '\r' > "$remote" || { unset PASS; echo "  Fikk ikke lest mappa på serveren."; return 1; }
  grep -E '^[A-Za-z0-9._-]+-[A-Za-z0-9_-]{8}(-[a-z0-9]+)?\.js$|^\.up-.*\.tmp$' "$remote" | grep -vxF -f "$live" > "$doomed" || true
  n=$(wc -l < "$doomed" | tr -d ' ')
  echo "  Siden bruker $(wc -l < "$live" | tr -d ' ') filer. $n gamle filer kan slettes:"
  sed 's/^/    /' "$doomed"
  if [ "$n" = 0 ]; then unset PASS; echo "  Ingenting å rydde."; return 0; fi
  if [ "${YES:-}" != 1 ]; then
    [ -t 0 ] || { unset PASS; echo "  (Ingenting slettet – kjør med YES=1 for å slette.)"; return 0; }
    read -r -p "  Slette disse $n filene? (j/N) " ans
    [ "$ans" = "j" ] || [ "$ans" = "J" ] || { unset PASS; echo "  Ingenting slettet."; return 0; }
  fi
  # 25 at a time, one connection each
  local args=() k=0 gone=0
  while IFS= read -r f; do
    # "*" = one file that's already gone (550) doesn't stop the rest of the batch
    # (quote commands run before curl changes into www/, hence the path)
    args+=(-Q "*DELE www/$f"); k=$((k + 1))
    if [ "$k" -ge 25 ]; then
      printf 'user = "%s:%s"\n' "$USER_NAME" "$PASS" | curl --ssl-reqd -sS --connect-timeout 20 --max-time 120 -K - "${args[@]}" "ftp://$HOST/www/" -o /dev/null && gone=$((gone + k))
      args=(); k=0
    fi
  done < "$doomed"
  if [ "$k" -gt 0 ]; then
    printf 'user = "%s:%s"\n' "$USER_NAME" "$PASS" | curl --ssl-reqd -sS --connect-timeout 20 --max-time 120 -K - "${args[@]}" "ftp://$HOST/www/" -o /dev/null && gone=$((gone + k))
  fi
  unset PASS
  echo "  Slettet $gone gamle filer."
}

if [ "$MODE" = "clean" ]; then
  clean_ftp || exit 1
  exit 0
elif [ "$MODE" = "app" ]; then
  upload_app || { echo "Noen filer feilet – se meldingene over."; exit 1; }
elif [ "$MODE" = "ftp" ]; then
  upload_ftp || { echo "Noen filer feilet – se meldingene over."; exit 1; }
else
  set +e
  upload_sftp
  rc=$?
  set -e
  if [ $rc -ne 0 ]; then
    echo
    echo "SFTP virket ikke (kode $rc). Prøver med FTP i stedet …"
    upload_ftp || { echo "Noen filer feilet – se meldingene over."; exit 1; }
  fi
fi
echo "Ferdig! Åpne https://niben.no"
