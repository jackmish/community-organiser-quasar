#!/usr/bin/env bash
# Install Android SDK platform/build-tools on Arch/CachyOS (/opt/android-sdk is root-owned).
set -euo pipefail

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/opt/android-sdk}}"
JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk}"
export JAVA_HOME

if ! java -version 2>&1 | grep -qE 'version "21|version "22|version "23|version "24|version "25|version "26'; then
  cat >&2 <<EOF
Java 21+ required (Capacitor 8). Current: $(java -version 2>&1 | head -1)

  sudo pacman -S jdk21-openjdk
  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk

EOF
  exit 1
fi

if [[ ! -d "$SDK" ]]; then
  echo "Android SDK not found at $SDK" >&2
  exit 1
fi

pick_sdkmanager() {
  if [[ -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]]; then
    echo "$SDK/cmdline-tools/latest/bin/sdkmanager"
    return 0
  fi
  if command -v sdkmanager >/dev/null 2>&1; then
    command -v sdkmanager
    return 0
  fi
  return 1
}

if ! SM="$(pick_sdkmanager)"; then
  cat >&2 <<'EOF'
sdkmanager not found.

Install the Java-17-compatible command-line tools first:
  yay -S android-sdk-cmdline-tools-latest

Then re-run:
  npm run android:sdk
EOF
  exit 1
fi

if ! "$SM" --version >/dev/null 2>&1; then
  cat >&2 <<'EOF'
The old sdkmanager in /opt/android-sdk/tools does not work on Java 17.

Install:
  yay -S android-sdk-cmdline-tools-latest

Then re-run:
  npm run android:sdk
EOF
  exit 1
fi

if [[ ! -w "$SDK" ]]; then
  echo "==> $SDK is read-only for your user — installing as root (sudo)."
  echo "    This is normal on Arch when the SDK lives under /opt."
  sudo env JAVA_HOME="$JAVA_HOME" ANDROID_SDK_ROOT="$SDK" ANDROID_HOME="$SDK" \
    bash -c "yes | '$SM' --licenses"
  sudo env JAVA_HOME="$JAVA_HOME" ANDROID_SDK_ROOT="$SDK" ANDROID_HOME="$SDK" \
    "$SM" "platforms;android-36" "build-tools;35.0.0"
else
  export ANDROID_SDK_ROOT="$SDK" ANDROID_HOME="$SDK"
  yes | "$SM" --licenses
  "$SM" "platforms;android-36" "build-tools;35.0.0"
fi

echo
echo "Installed. Verify:"
echo "  ls $SDK/platforms"
echo "  ls $SDK/build-tools"
echo
echo "Then build:"
echo "  export JAVA_HOME=$JAVA_HOME"
echo "  npm run android"
