#!/bin/bash
# Bygger siden og pakker dist/ som niben-upload.zip (index.html sist, så siden bytter versjon først når alt annet er på plass).
set -e
cd "$(dirname "$0")/.."
npm run build
rm -f niben-upload.zip
(cd dist && ls | grep -v '^index.html$' | xargs zip -qr ../niben-upload.zip && zip -q ../niben-upload.zip index.html)
echo "niben-upload.zip: $(unzip -l niben-upload.zip | tail -1)"
