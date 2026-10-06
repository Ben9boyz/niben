#!/bin/bash
# Lagrer Strava-appens Client ID og Client Secret i public/_strava.php (lastes opp sammen med siden – ikke del filen).
set -e
cd "$(dirname "$0")"
echo "Lag en app på https://www.strava.com/settings/api"
echo "  Authorization Callback Domain:  niben.no"
echo
read -r -p "  Client ID (bare tall): " CID
read -r -s -p "  Client Secret (vises ikke): " CSECRET; echo
if ! [[ "$CID" =~ ^[0-9]{3,12}$ ]]; then echo "Client ID ser ikke riktig ut."; exit 1; fi
if ! [[ "$CSECRET" =~ ^[a-f0-9]{30,50}$ ]]; then echo "Client Secret ser ikke riktig ut."; exit 1; fi
umask 077
cat > public/_strava.php <<PHP
<?php
// Laget av strava-setup.sh – IKKE del denne filen.
return ['client_id' => '$CID', 'client_secret' => '$CSECRET'];
PHP
echo "Lagret i public/_strava.php. Last den opp til www/ (én gang) – så kan hvert rom koble til sin Strava under Admin → Tilkoblinger."
