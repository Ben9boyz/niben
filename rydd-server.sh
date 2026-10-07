#!/bin/bash
# Rydder gamle filer på niben.no over FTP – uten adminpanelet (når opplasting eller admin ikke virker).
#
#   ./rydd-server.sh          viser hva som kan slettes, og spør før noe slettes
#   ./rydd-server.sh --ja     sletter uten å spørre
#
# Hva den sletter – og bare det:
#   · gamle programfiler med byggenavn (Navn-AbCd1234.js / .wasm) som siden IKKE bruker lenger
#     (den leser index.html, timer.html, manifest.json og sw.js PÅ SERVEREN og følger alt de laster, også indirekte);
#   · halvferdige opplastinger som ble liggende igjen (.up-….tmp).
# Den rører aldri PHP-filer, _config.php, _steam.php, _jpdb.php, _spotify.php, uploads/, bilder, modeller eller mapper.
# Mangler siden en fil den trenger (en opplasting som ikke ble ferdig), avbryter den uten å slette noe.
#
# Samme innlogging som deploy.sh (.deploy.local + passordet i nøkkelringen, eller det spørres om).
set -e
cd "$(dirname "$0")"
[ -f .deploy.local ] && . ./.deploy.local
: "${FTP_USER:?Mangler FTP_USER – kopier .deploy.local.example til .deploy.local}"
: "${FTP_HOST:?Mangler FTP_HOST – kopier .deploy.local.example til .deploy.local}"
REMOTE_DIR="${FTP_DIR:-www}"
TLS="${FTP_TLS---ssl-reqd}" # (FTP_TLS="" bare for testing mot en lokal server uten TLS)
YES=""; [ "${1:-}" = "--ja" ] && YES=1

PASS="${FTP_PASS:-$(security find-generic-password -s niben-ftp -a "$FTP_USER" -w 2>/dev/null || true)}"
if [ -z "$PASS" ]; then read -r -s -p "FTP-passord for $FTP_USER: " PASS; echo; fi
W="$(mktemp -d)"
trap 'rm -rf "$W"; unset PASS' EXIT
BASE="ftp://$FTP_HOST/$REMOTE_DIR"
# the password goes in on stdin, so it never shows in the process list
ftp() { printf 'user = "%s:%s"\n' "$FTP_USER" "$PASS" | curl $TLS -sS --connect-timeout 20 --max-time 600 -K - "$@"; }
NAME='[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}(-[a-z0-9]{4,12})?\.(js|wasm)'

echo "Henter fillisten fra $FTP_HOST/$REMOTE_DIR …"
ftp -X 'NLST -a' --list-only "$BASE/" > "$W/all" 2>/dev/null || ftp --list-only "$BASE/" > "$W/all"
sed -e 's#^.*/##' -e 's/\r$//' "$W/all" | sort -u > "$W/all.txt"
echo "  $(wc -l < "$W/all.txt" | tr -d ' ') filer og mapper i $REMOTE_DIR/"
grep -qx 'index.html' "$W/all.txt" || { echo "Fant ikke index.html på serveren – avbryter uten å slette noe."; exit 1; }

# 1) what the site uses: start from its pages, then follow what each file loads (a level at a time, one connection per level)
: > "$W/keep"; : > "$W/missing"; : > "$W/todo"
for f in index.html timer.html manifest.json sw.js; do
  grep -qx "$f" "$W/all.txt" || continue
  ftp "$BASE/$f" -o "$W/root"
  grep -oE "$NAME" "$W/root" >> "$W/todo" || true
done
level=0
while [ -s "$W/todo" ] && [ $level -lt 20 ]; do
  level=$((level + 1))
  sort -u "$W/todo" | grep -vxF -f "$W/keep" > "$W/new" || true
  : > "$W/todo"
  [ -s "$W/new" ] || break
  cat "$W/new" >> "$W/keep"
  args=()
  while read -r f; do
    if ! grep -qx "$f" "$W/all.txt"; then echo "$f" >> "$W/missing"; continue; fi
    case "$f" in *.js) args+=("$BASE/$f" -o "$W/dl-$f") ;; esac
  done < "$W/new"
  if [ ${#args[@]} -gt 0 ]; then
    ftp "${args[@]}"
    for f in "$W"/dl-*; do [ -f "$f" ] && { grep -oE "$NAME" "$f" >> "$W/todo" || true; rm -f "$f"; }; done
  fi
done
echo "  Siden bruker $(wc -l < "$W/keep" | tr -d ' ') programfiler."
if [ -s "$W/missing" ]; then
  echo
  echo "Siden mangler disse filene på serveren (en opplasting som ikke ble ferdig):"
  sed 's/^/    /' "$W/missing"
  echo "Last opp alt på nytt først (./deploy.sh). Ingenting er slettet."
  exit 1
fi

# 2) what can go: build-named files nobody uses + leftovers from cut-off uploads
{ grep -E "^$NAME\$" "$W/all.txt" | grep -vxF -f "$W/keep" || true; grep -E '^\.up-.*\.tmp$' "$W/all.txt" || true; } | sort -u > "$W/old"
n=$(grep -c . "$W/old" || true)
if [ "$n" = 0 ]; then echo; echo "Ingen gamle filer – alt på serveren er i bruk. 👍"; exit 0; fi
echo
echo "Dette kan slettes ($n filer):"
sed 's/^/    /' "$W/old"
if [ -z "$YES" ]; then
  echo
  read -r -p "Slette disse $n filene fra serveren? Skriv ja: " svar
  [ "$svar" = "ja" ] || { echo "Ingenting er slettet."; exit 0; }
fi

# 3) delete, 25 at a time on one connection ('*' = go on if one of them fails)
echo "Sletter …"
split -l 25 "$W/old" "$W/chunk-"
for c in "$W"/chunk-*; do
  q=()
  while read -r f; do q+=(-Q "*DELE $REMOTE_DIR/$f"); done < "$c" # (the commands run from the login folder, before curl steps into www/)
  ftp --list-only "${q[@]}" "$BASE/" -o /dev/null || true
done
ftp --list-only "$BASE/" | sed -e 's#^.*/##' -e 's/\r$//' | sort -u > "$W/after"
left=$(grep -cxF -f "$W/old" "$W/after" || true)
echo "Ferdig: $((n - left)) av $n filer slettet.${left:+}"
[ "$left" = 0 ] || { echo "Disse ble ikke slettet (rettigheter på serveren?):"; grep -xF -f "$W/old" "$W/after" | sed 's/^/    /'; }
