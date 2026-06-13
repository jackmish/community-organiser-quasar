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

PACKAGE="community.organiser"
ACTIVITY="${PACKAGE}/.MainActivity"

if [[ "$RELEASE" -eq 1 ]]; then
  APK="$ROOT/src-capacitor/android/app/build/outputs/apk/release/app-release-unsigned.apk"
  BUILD_SCRIPT="android-build"
else
  APK="$ROOT/src-capacitor/android/app/build/outputs/apk/debug/app-debug.apk"
  BUILD_SCRIPT="android"
fi

adb_devices() {
  "$ADB" devices | awk 'NR>1 && $2=="device" { print $1 }'
}

adb_reconnect() {
  "$ADB" kill-server 2>/dev/null || true
  sleep 1
  "$ADB" start-server
  sleep 1
}

mapfile -t DEVICES < <(adb_devices)
if [[ ${#DEVICES[@]} -eq 0 ]]; then
  echo "No Android device detected."
  echo "  Enable USB debugging, connect USB, accept RSA prompt,"
  echo "  or pair wirelessly: adb pair <ip>:<port>"
  exit 1
fi

DEVICE="${ANDROID_SERIAL:-${DEVICES[0]}}"
if [[ ${#DEVICES[@]} -gt 1 ]]; then
  echo "Multiple devices — using ${DEVICE}. Set ANDROID_SERIAL to pick another."
fi

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

APK_SIZE="$(du -h "$APK" | awk '{print $1}')"
REMOTE_APK="/data/local/tmp/co21-deploy.apk"

# Streamed `adb install` breaks on some tablets (Lenovo Tab 30) and can reset adb.
install_via_pm() {
  local attempt
  for attempt in 1 2; do
    if [[ "$attempt" -gt 1 ]]; then
      echo "Retrying install (attempt $attempt) ..."
      adb_reconnect
    fi
    echo "Installing $(basename "$APK") (${APK_SIZE}) via push + pm install ..."
    if ! "$ADB" -s "$DEVICE" push "$APK" "$REMOTE_APK"; then
      continue
    fi
    local out
    out=$("$ADB" -s "$DEVICE" shell pm install -r -t -d -g "$REMOTE_APK" 2>&1) || true
    "$ADB" -s "$DEVICE" shell rm -f "$REMOTE_APK" 2>/dev/null || true
    echo "$out"
    if echo "$out" | grep -qi 'Success'; then
      return 0
    fi
    if echo "$out" | grep -qi 'INSTALL_FAILED_UPDATE_INCOMPATIBLE\|signatures do not match'; then
      echo "Signature mismatch — uninstalling old $PACKAGE ..."
      "$ADB" -s "$DEVICE" uninstall "$PACKAGE" >/dev/null 2>&1 || true
      continue
    fi
  done
  return 1
}

echo
if ! install_via_pm; then
  echo
  echo "Install failed." >&2
  echo "Try manually:" >&2
  echo "  adb -s $DEVICE uninstall $PACKAGE" >&2
  echo "  adb -s $DEVICE push \"$APK\" $REMOTE_APK" >&2
  echo "  adb -s $DEVICE shell pm install -r -t -g $REMOTE_APK" >&2
  exit 1
fi

echo
echo "Installed on ${MODEL:-device}."

echo "Launching $PACKAGE ..."
"$ADB" -s "$DEVICE" shell am start -n "$ACTIVITY" -a android.intent.action.MAIN -c android.intent.category.LAUNCHER \
  >/dev/null 2>&1 || true
echo "Done."
