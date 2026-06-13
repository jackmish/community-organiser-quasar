#!/usr/bin/env bash
# One-time Linux setup for CO21 Android builds (CachyOS / Arch-based).
# Re-run is safe. Requires sudo for pacman/AUR packages.
set -euo pipefail

echo "CO21 Android toolchain setup (Linux)"
echo "==================================="
echo

if ! command -v java >/dev/null 2>&1; then
  echo "Installing OpenJDK 21 (Capacitor 8 / Android Gradle requires Java 21)..."
  sudo pacman -S --needed jdk21-openjdk
else
  echo "Java already installed: $(java -version 2>&1 | head -1)"
  if ! java -version 2>&1 | grep -qE 'version "21|version "22|version "23|version "24|version "25|version "26'; then
    echo "Warning: Capacitor 8 needs Java 21+. Install: sudo pacman -S jdk21-openjdk" >&2
    echo "  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk" >&2
  fi
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "Installing android-tools (adb)..."
  sudo pacman -S --needed android-tools
fi

if [[ -d /opt/android-sdk ]]; then
  echo "Android SDK already at /opt/android-sdk"
elif command -v yay >/dev/null 2>&1; then
  echo "Installing Android SDK from AUR (yay)..."
  yay -S --needed android-sdk android-sdk-platform-tools android-sdk-build-tools
  echo "Install platform 36 if needed:"
  echo "  sdkmanager 'platforms;android-36' 'build-tools;36.0.0'"
elif command -v paru >/dev/null 2>&1; then
  echo "Installing Android SDK from AUR (paru)..."
  paru -S --needed android-sdk android-sdk-platform-tools android-sdk-build-tools
else
  echo "No AUR helper found. Either:"
  echo "  1) Install Android Studio and SDK to ~/Android/Sdk"
  echo "  2) Install yay/paru and re-run this script"
  exit 1
fi

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/opt/android-sdk}}"
if [[ -d "$HOME/Android/Sdk" ]]; then
  SDK="$HOME/Android/Sdk"
fi

export ANDROID_SDK_ROOT="$SDK"
export ANDROID_HOME="$SDK"

SHELL_RC="$HOME/.bashrc"
if [[ -n "${ZSH_VERSION:-}" ]] || [[ "$SHELL" == *zsh* ]]; then
  SHELL_RC="$HOME/.zshrc"
fi

MARKER="# CO21 Android SDK"
if ! grep -qF "$MARKER" "$SHELL_RC" 2>/dev/null; then
  JAVA_HOME_PATH="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk}"
  cat >> "$SHELL_RC" <<EOF

$MARKER
export JAVA_HOME="$JAVA_HOME_PATH"
export ANDROID_SDK_ROOT="$SDK"
export ANDROID_HOME="$SDK"
export PATH="\$PATH:\$ANDROID_SDK_ROOT/platform-tools"
EOF
  echo "Added ANDROID_SDK_ROOT and JAVA_HOME to $SHELL_RC — open a new shell or: source $SHELL_RC"
fi

if [[ ! -x /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager ]] && command -v yay >/dev/null 2>&1; then
  echo "Installing modern sdkmanager (Java 17 compatible)..."
  yay -S --needed --noconfirm android-sdk-cmdline-tools-latest || \
    yay -S --needed android-sdk-cmdline-tools-latest
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/android-local-properties.sh"
"$ROOT/scripts/android-sdk-licenses.sh" || {
  echo "Run manually when ready: $ROOT/scripts/android-sdk-licenses.sh" >&2
}

echo
echo "Next:"
echo "  cd $ROOT"
echo "  ./scripts/android-prepare.sh"
echo "  npm run android          # debug APK"
echo "  ./deploy-android.sh      # build + adb install"
