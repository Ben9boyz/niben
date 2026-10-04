#!/bin/bash
# Setter opp tilgangen til databasen og admin-passordet for niben.no.
# Skriver public/_config.php (lastes opp med deploy.sh). Kjør på nytt for å bytte passord.
set -e
cd "$(dirname "$0")"

echo "Databasetilgang – trykk Enter for å bruke verdien i [klammer]:"
# defaults from .deploy.local (not in git), if it exists
[ -f "$(dirname "$0")/.deploy.local" ] && . "$(dirname "$0")/.deploy.local"
read -r -p "  Databasevert [${DB_HOST_DEFAULT:-}]: " DB_HOST
DB_HOST=${DB_HOST:-$DB_HOST_DEFAULT}
read -r -p "  Databasenavn [${DB_NAME_DEFAULT:-}]: " DB_NAME
DB_NAME=${DB_NAME:-$DB_NAME_DEFAULT}
read -r -p "  Brukernavn [${DB_USER_DEFAULT:-}]: " DB_USER
DB_USER=${DB_USER:-$DB_USER_DEFAULT}
case "$DB_HOST" in *.*) ;; *) echo "«$DB_HOST» ser ikke ut som et vertsnavn – start på nytt og trykk bare Enter."; exit 1 ;; esac
echo
echo "Skriv DATABASE-passordet (det du satte hos Webhuset). Det vises ikke mens du skriver."
read -r -s -p "  Database-passord: " DB_PASS; echo
echo
echo "Velg et ADMIN-passord for å logge inn på niben.no/#/admin (minst 8 tegn). Vises ikke mens du skriver."
read -r -s -p "  Admin-passord: " ADMIN_PW; echo
read -r -s -p "  Gjenta: " ADMIN_PW2; echo
if [ "$ADMIN_PW" != "$ADMIN_PW2" ]; then echo "Passordene er ikke like."; exit 1; fi
if [ ${#ADMIN_PW} -lt 8 ]; then echo "Passordet må være minst 8 tegn."; exit 1; fi

# verdiene sendes via miljøvariabler, aldri som argumenter (synlige i prosesslisten)
DB_HOST="$DB_HOST" DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASS="$DB_PASS" ADMIN_PW="$ADMIN_PW" node --input-type=module -e '
import bcrypt from "bcryptjs"
import { writeFileSync, chmodSync } from "node:fs"
const e = process.env
const q = (s) => "\x27" + String(s).replace(/\\/g, "\\\\").replace(/\x27/g, "\\\x27") + "\x27"
const hash = bcrypt.hashSync(e.ADMIN_PW, 12).replace(/^\$2b\$/, "$2y$")
const php = `<?php
// Laget av setup.sh – IKKE del denne filen.
return [
  "db_host" => ${q(e.DB_HOST)},
  "db_name" => ${q(e.DB_NAME)},
  "db_user" => ${q(e.DB_USER)},
  "db_pass" => ${q(e.DB_PASS)},
  "admin_hash" => ${q(hash)},
];
`
writeFileSync("public/_config.php", php)
chmodSync("public/_config.php", 0o600)
'
echo "Lagret. Kjør ./deploy.sh for å laste opp."
