#!/usr/bin/env bash
# Build Capacitor Android debug APK and install on a connected device (Linux).
# Usage: ./deploy-android.sh [--skip-build] [--release]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

SKIP_BUILD=0
RELEASE=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    --release) RELEASE=1 ;;
  esac
done

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^[A-Z_]+=' "$ROOT/.env" | sed 's/\r$//')
  set +a
fi

if [[ -n "${ADB_PATH:-}" && -x "$ADB_PATH" ]]; then
  ADB="$ADB_PATH"
elif command -v adb >/dev/null 2>&1; then
  ADB="$(command -v adb)"
else
  echo "adb not found. Install android-tools or set ADB_PATH in .env" >&2
  exit 1
fi

if [[ "$RELEASE" -eq 1 ]]; then
  APK="$ROOT/src-capacitor/android/app/build/outputs/apk/release/app-release-unsigned.apk"
  BUILD_SCRIPT="android-build"
else
  APK="$ROOT/src-capacitor/android/app/build/outputs/apk/debug/app-debug.apk"
  BUILD_SCRIPT="android"
fi

mapfile -t DEVICES < <("$ADB" devices | awk 'NR>1 && $2=="device" { print $1 }')
if [[ ${#DEVICES[@]} -eq 0 ]]; then
  echo "No Android device detected."
  echo "  Enable USB debugging, connect USB, accept RSA prompt,"
  echo "  or pair wirelessly: adb pair <ip>:<port>"
  exit 1
fi

DEVICE="${DEVICES[0]}"
MODEL="$("$ADB" -s "$DEVICE" shell getprop ro.product.model 2>/dev/null | tr -d '\r')"
echo "Device: ${MODEL:-unknown} ($DEVICE)"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo
  echo "Building Android APK..."
  export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk}"
  npm run "$BUILD_SCRIPT"
fi

if [[ ! -f "$APK" ]]; then
  echo "APK not found: $APK" >&2
  echo "Run without --skip-build, or fix JDK/SDK (scripts/setup-android-linux.sh)." >&2
  exit 1
fi

echo "Installing $APK ..."
"$ADB" -s "$DEVICE" install -r "$APK"
echo "Done."
