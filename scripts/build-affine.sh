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

# Appwrite Sites icin yalnizca web uygulamasinin gerektirdigi workspace'leri kur.
yarn workspaces focus @affine/monorepo @affine/web

# AFFiNE Turkceyi zaten destekliyor. Bu kurulumda ilk acilisi Turkce yap,
# eksik cevirilerde Ingilizceyi yedek dil olarak kullan.
node <<'NODE'
const fs = require('fs');
const path = 'packages/frontend/i18n/src/i18next.ts';
let src = fs.readFileSync(path, 'utf8');
src = src.replace("const defaultLng: Language = 'en';", "const defaultLng: Language = 'tr';");
src = src.replace(
  'const fallbacks: string[] = [defaultLng];',
  "const fallbacks: string[] = [defaultLng, 'en'];"
);
fs.writeFileSync(path, src);
NODE

echo "==> AFFiNE web build"
BUILD_TYPE=stable DISTRIBUTION=web PUBLIC_PATH=/ yarn affine @affine/web build

cd ..
mkdir -p "$OUT_DIR"
cp -a "$SRC_DIR/packages/frontend/apps/web/dist/." "$OUT_DIR/"

echo "==> Build tamamlandi: $OUT_DIR"
