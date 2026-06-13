#!/usr/bin/env bash
# Write src-capacitor/android/local.properties for this machine (gitignored).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROP="$ROOT/src-capacitor/android/local.properties"

pick_sdk_dir() {
  if [[ -n "${ANDROID_SDK_ROOT:-}" && -d "$ANDROID_SDK_ROOT" ]]; then
    echo "$ANDROID_SDK_ROOT"
    return
  fi
  if [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME" ]]; then
    echo "$ANDROID_HOME"
    return
  fi
  for candidate in \
    "$HOME/Android/Sdk" \
    /opt/android-sdk \
    /usr/lib/android-sdk; do
    if [[ -d "$candidate" ]]; then
      echo "$candidate"
      return
    fi
  done
  return 1
}

if ! SDK="$(pick_sdk_dir)"; then
  echo "No Android SDK found. Set ANDROID_SDK_ROOT or run scripts/setup-android-linux.sh" >&2
  exit 1
fi

# Gradle properties file: escape backslashes on Windows paths; Linux paths are plain.
ESCAPED="${SDK//\\/\\\\}"
mkdir -p "$(dirname "$PROP")"
printf 'sdk.dir=%s\n' "$ESCAPED" > "$PROP"
echo "Wrote $PROP -> $SDK"
