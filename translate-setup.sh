#!/bin/bash
# Slår på oversettelse av nettsiden (alle språk). Lagrer nøkkelen i public/_translate.php
# (lastes opp med deploy.sh, ligger ikke i git). Hver setning oversettes bare én gang og lagres i databasen.
#   1) Claude (Anthropic): https://console.anthropic.com/settings/keys   – best kvalitet, billig (Haiku)
#   2) Google Translate:   https://console.cloud.google.com/apis/credentials  (slå på «Cloud Translation API»)
set -e
cd "$(dirname "$0")"
echo "Hvilken oversetter vil du bruke?"
echo "  1) Claude (Anthropic)"
echo "  2) Google Translate"
read -r -p "Valg [1/2]: " CH
read -r -s -p "API-nøkkel (vises ikke): " KEY; echo
KEY="$(echo -n "$KEY" | tr -d '[:space:]')"
if [ -z "$KEY" ]; then echo "Ingen nøkkel."; exit 1; fi
case "$CH" in
  2) PROVIDER=google ;;
  *) PROVIDER=anthropic ;;
esac
# prøv at nøkkelen virker
if [ "$PROVIDER" = anthropic ]; then
  CODE=$(curl -s -o /dev/null -w "%{http_code}" https://api.anthropic.com/v1/messages \
    -H "x-api-key: $KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" \
    -d '{"model":"claude-haiku-4-5-20251001","max_tokens":8,"messages":[{"role":"user","content":"hi"}]}')
else
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://translation.googleapis.com/language/translate/v2?key=$KEY&q=hei&source=no&target=en")
fi
if [ "$CODE" != "200" ]; then echo "Nøkkelen ble ikke godtatt (svar $CODE)."; exit 1; fi
umask 077
cat > public/_translate.php <<PHP
<?php
// Laget av translate-setup.sh – IKKE del denne filen.
return ['provider' => '$PROVIDER', 'key' => '$KEY'];
PHP
echo "Lagret ✓  ($PROVIDER). Kjør ./deploy.sh for å laste opp."
