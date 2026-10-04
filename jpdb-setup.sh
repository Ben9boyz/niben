#!/bin/bash
# Lagrer jpdb-API-nøkkelen i public/_jpdb.php (lastes opp med deploy.sh, ligger ikke i git).
# Nøkkelen finner du nederst på https://jpdb.io/settings («API key»).
set -e
cd "$(dirname "$0")"
read -r -s -p "  jpdb API-nøkkel (vises ikke): " KEY; echo
if ! [[ "$KEY" =~ ^[A-Za-z0-9_-]{16,128}$ ]]; then echo "Nøkkelen ser ikke riktig ut."; exit 1; fi
# sjekk at jpdb godtar den
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://jpdb.io/api/v1/ping -H "Authorization: Bearer $KEY")
if [ "$CODE" != "200" ]; then echo "jpdb godtok ikke nøkkelen (svar $CODE)."; exit 1; fi
umask 077
cat > public/_jpdb.php <<PHP
<?php
// Laget av jpdb-setup.sh – IKKE del denne filen.
return ['api_key' => '$KEY'];
PHP
echo "Lagret og godkjent av jpdb ✓"
