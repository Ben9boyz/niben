#!/bin/bash
# Lagrer Spotify-appens Client ID og Client Secret i public/_spotify.php (lastes opp med deploy.sh).
set -e
cd "$(dirname "$0")"
echo "Lag en app på https://developer.spotify.com/dashboard og legg inn denne Redirect URI:"
echo "    https://niben.no/spotify-callback.php"
echo
read -r -p "  Client ID: " CID
read -r -s -p "  Client Secret (vises ikke): " CSECRET; echo
if ! [[ "$CID" =~ ^[A-Za-z0-9]{20,40}$ ]]; then echo "Client ID ser ikke riktig ut."; exit 1; fi
if ! [[ "$CSECRET" =~ ^[A-Za-z0-9]{20,40}$ ]]; then echo "Client Secret ser ikke riktig ut."; exit 1; fi
umask 077
cat > public/_spotify.php <<PHP
<?php
// Laget av spotify-setup.sh – IKKE del denne filen.
return ['client_id' => '$CID', 'client_secret' => '$CSECRET'];
PHP
echo "Lagret. Kjør ./deploy.sh for å laste opp."
