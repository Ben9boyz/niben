#!/bin/bash
# Lagrer Steam-API-nøkkelen og Steam-ID-en din i public/_steam.php (lastes opp med deploy.sh, ligger ikke i git).
#   Nøkkel:  https://steamcommunity.com/dev/apikey  (domene: niben.no)
#   Profil:  lenken til profilen din, f.eks. https://steamcommunity.com/id/navn eller .../profiles/7656…
# Spilldetaljene må være offentlige: Steam → Profil → Rediger profil → Personvern → «Spilldetaljer: Offentlig».
set -e
cd "$(dirname "$0")"
read -r -s -p "  Steam API-nøkkel (vises ikke): " KEY; echo
if ! [[ "$KEY" =~ ^[A-Fa-f0-9]{32}$ ]]; then echo "Nøkkelen ser ikke riktig ut (32 tegn, 0-9 og A-F)."; exit 1; fi
read -r -p "  Steam-profil (lenke, brukernavn eller 17-sifret ID): " PROFILE
PROFILE="${PROFILE%/}"
PROFILE="${PROFILE##*/}"
if [[ "$PROFILE" =~ ^7656[0-9]{13}$ ]]; then
  SID="$PROFILE"
else
  if ! [[ "$PROFILE" =~ ^[A-Za-z0-9_-]{2,64}$ ]]; then echo "Fant ikke et brukernavn i det du skrev."; exit 1; fi
  SID=$(curl -s "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=$KEY&vanityurl=$PROFILE" \
    | sed -nE 's/.*"steamid":"([0-9]+)".*/\1/p')
  if [ -z "$SID" ]; then echo "Steam fant ikke profilen «$PROFILE» (eller nøkkelen ble ikke godtatt)."; exit 1; fi
fi
# sjekk at Steam godtar nøkkelen og finner profilen
NAME=$(curl -s "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=$KEY&steamids=$SID" \
  | sed -nE 's/.*"personaname":"([^"]*)".*/\1/p')
if [ -z "$NAME" ]; then echo "Steam godtok ikke nøkkelen eller fant ikke profilen."; exit 1; fi
GAMES=$(curl -s "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=$KEY&steamid=$SID" \
  | sed -nE 's/.*"game_count":([0-9]+).*/\1/p')
umask 077
cat > public/_steam.php <<PHP
<?php
// Laget av steam-setup.sh – IKKE del denne filen.
return ['api_key' => '$KEY', 'steamid' => '$SID'];
PHP
echo "Lagret ✓  Profil: $NAME"
if [ -z "$GAMES" ]; then
  echo "  NB: spillene dine er ikke synlige. Sett «Spilldetaljer» til Offentlig i Steam-personvernet."
else
  echo "  $GAMES spill funnet."
fi
