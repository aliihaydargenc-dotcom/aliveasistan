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
export YARN_ENABLE_IMMUTABLE_INSTALLS=false
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"

corepack enable

# Alive, AFFiNE'in local-first web motorunu kullanir. Appwrite ve Yjs senkron
# katmanini dogrudan web paketine bagla.
node <<'NODE'
const fs = require('fs');
const packagePath = 'packages/frontend/apps/web/package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies.appwrite = '28.1.0';
pkg.dependencies.yjs = '^13.6.27';
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
NODE

yarn workspaces focus @affine/monorepo @affine/web

# Alive tek-kullanici Appwrite sync katmanini web uygulamasina ekle.
cp ../patches/alive-sync.ts packages/frontend/apps/web/src/alive-sync.ts

node <<'NODE'
const fs = require('fs');

const indexPath = 'packages/frontend/apps/web/src/index.tsx';
let indexSrc = fs.readFileSync(indexPath, 'utf8');
if (!indexSrc.includes("import './alive-sync';")) {
  indexSrc = indexSrc.replace(
    "import './setup';",
    "import './setup';\nimport './alive-sync';"
  );
}
if (!indexSrc.includes("import './alive-sync';")) {
  throw new Error('Alive sync import patch uygulanamadi');
}
fs.writeFileSync(indexPath, indexSrc);

// Turkceyi hem i18next hem de AFFiNE global ayar varsayilani yap.
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

// AFFiNE web'in mobil ilk acilis hatasi: ilk resize event'inde yalnizca width
// kaydediliyor ve smallScreenMode hic acilmiyor. Ilk olcumde de responsive
// durumu uygula; sidebar telefonda drawer/floating moda gecsin.
const responsivePath =
  'packages/frontend/core/src/components/hooks/use-responsive-siedebar.ts';
let responsiveSrc = fs.readFileSync(responsivePath, 'utf8');
const oldInitial = `      if (previousWidth === null) {
        previousWidthRef.current = width;
        return;
      }`;
const newInitial = `      if (previousWidth === null) {
        previousWidthRef.current = width;
        if (!BUILD_CONFIG.isElectron) {
          handleFloatSidebar(width <= floatThreshold);
        }
        if (width <= hideThreshold) {
          handleHideSidebar();
        }
        return;
      }`;
responsiveSrc = responsiveSrc.replace(oldInitial, newInitial);
if (!responsiveSrc.includes('handleFloatSidebar(width <= floatThreshold);')) {
  throw new Error('Mobil responsive sidebar patch uygulanamadi');
}
fs.writeFileSync(responsivePath, responsiveSrc);

// Yeni local workspace adini AFFiNE Demo Workspace yerine Alive yap.
const constantPath = 'packages/common/env/src/constant.ts';
let constantSrc = fs.readFileSync(constantPath, 'utf8');
constantSrc = constantSrc.replace(
  "export const DEFAULT_WORKSPACE_NAME = 'Demo Workspace';",
  "export const DEFAULT_WORKSPACE_NAME = 'Alive';"
);
if (!constantSrc.includes("export const DEFAULT_WORKSPACE_NAME = 'Alive';")) {
  throw new Error('Alive workspace adi patch uygulanamadi');
}
fs.writeFileSync(constantPath, constantSrc);
NODE

echo "==> Alive / AFFiNE web build"
BUILD_TYPE=stable PUBLIC_PATH=/ yarn affine @affine/web build

cd ..
mkdir -p "$OUT_DIR"
cp -a "$SRC_DIR/packages/frontend/apps/web/dist/." "$OUT_DIR/"

# Statik shell markalamasi.
node <<'NODE'
const fs = require('fs');
const path = 'dist/index.html';
let html = fs.readFileSync(path, 'utf8');
html = html.replace('<html lang="en"', '<html lang="tr"');
html = html.replace('<title>AFFiNE</title>', '<title>Alive</title>');
html = html.replace(/<meta property="description" content="[^"]*">/, '<meta property="description" content="Alive kişisel çalışma alanı">');
fs.writeFileSync(path, html);
NODE

echo "==> Build tamamlandi: $OUT_DIR"
