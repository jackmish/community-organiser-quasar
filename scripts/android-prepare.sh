#!/usr/bin/env bash
# Install JS deps, build co21-lan-server, regenerate Capacitor www + android plugin data.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> npm install (app-quasar)"
npm install

echo "==> npm install + build (co21-lan-server)"
npm --prefix co21-lan-server install
npm --prefix co21-lan-server run build

echo "==> npm install (src-capacitor)"
npm --prefix src-capacitor install

echo "==> quasar prepare"
npx quasar prepare

echo "==> Capacitor UI build + android sync"
npm run android:sync

echo "==> local.properties"
if "$ROOT/scripts/android-local-properties.sh"; then
  :
else
  echo "Warning: could not write local.properties (install Android SDK first)." >&2
fi

echo "Done. JS/Capacitor android data is fresh."
echo "For APK: install JDK + Android SDK (see scripts/setup-android-linux.sh), then: npm run android"
