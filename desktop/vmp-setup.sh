#!/bin/bash
# One-time: lets `npm run dist` VMP-sign the desktop apps, so Spotify plays inside them (see src/vmp.ts).
# castlabs EVS is free; the account is tied to this machine.
set -e
python3 -m pip install --upgrade castlabs-evs
echo
echo "Lag en castlabs EVS-konto (eller logg inn hvis du har en):"
python3 -m castlabs_evs.account signup || python3 -m castlabs_evs.account reauth
echo
echo "Ferdig. Bygg appen på nytt: npm run dist:mac (og npm run dist:music for niben musikk)."
