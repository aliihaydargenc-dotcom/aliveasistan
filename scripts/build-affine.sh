#!/usr/bin/env bash
set -euo pipefail

AFFINE_TAG="${AFFINE_TAG:-v0.27.4}"
SRC_DIR=".affine-src"
OUT_DIR="dist"

rm -rf "$SRC_DIR" "$OUT_DIR"

echo "==> AFFiNE ${AFFINE_TAG} kaynak kodu aliniyor"
git clone --depth 1 --branch "$AFFINE_TAG" https://github.com/toeverything/AFFiNE.git "$SRC_DIR"

cd "$SRC_DIR"

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export HUSKY=0
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
export SENTRYCLI_SKIP_DOWNLOAD=1
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"

corepack enable

# Appwrite Sites icin mobil web uygulamasinin gerektirdigi workspace'leri kur.
yarn workspaces focus @affine/monorepo @affine/mobile

# Turkceyi hem i18next varsayilani hem de AFFiNE global ayar varsayilani yap.
node <<'NODE'
const fs = require('fs');

const i18nextPath = 'packages/frontend/i18n/src/i18next.ts';
let i18nextSrc = fs.readFileSync(i18nextPath, 'utf8');
i18nextSrc = i18nextSrc.replace(
  "const defaultLng: Language = 'en';",
  "const defaultLng: Language = 'tr';"
);
i18nextSrc = i18nextSrc.replace(
  'const fallbacks: string[] = [defaultLng];',
  "const fallbacks: string[] = [defaultLng, 'en'];"
);
if (!i18nextSrc.includes("const defaultLng: Language = 'tr';")) {
  throw new Error('Turkce i18next patch uygulanamadi');
}
fs.writeFileSync(i18nextPath, i18nextSrc);

const entityPath = 'packages/frontend/core/src/modules/i18n/entities/i18n.ts';
let entitySrc = fs.readFileSync(entityPath, 'utf8');
entitySrc = entitySrc.replace(
  "const language = this.currentLanguageKey$.value ?? 'en';",
  "const language = this.currentLanguageKey$.value ?? 'tr';"
);
if (!entitySrc.includes("const language = this.currentLanguageKey$.value ?? 'tr';")) {
  throw new Error('Turkce global ayar patch uygulanamadi');
}
fs.writeFileSync(entityPath, entitySrc);
NODE

echo "==> AFFiNE mobile web build"
BUILD_TYPE=stable PUBLIC_PATH=/ yarn affine @affine/mobile build

cd ..
mkdir -p "$OUT_DIR"
cp -a "$SRC_DIR/packages/frontend/apps/mobile/dist/." "$OUT_DIR/"

echo "==> Build tamamlandi: $OUT_DIR"
