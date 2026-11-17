#!/usr/bin/env bash
# Build & install Paisa without Gradle or Android Studio.
# Requires: JDK 11+ (javac, jar) and an Android SDK (build-tools + platform).
# Works on Linux, macOS, and Windows (WSL or Git Bash).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── 0. Locate the Android SDK ─────────────────────────────────────────
# Resolution order:
#   1. ANDROID_HOME / ANDROID_SDK_ROOT environment variables
#   2. local.properties in this folder  (sdk.dir=/absolute/path/to/sdk)
#   3. Well-known default SDK locations
# Optional overrides: BUILD_TOOLS_VERSION (e.g. 33.0.2), PLATFORM_VERSION (e.g. android-33)

echo "==> 0. Locating Android SDK..."
SDK=""

if [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME" ]]; then
    SDK="$ANDROID_HOME"
elif [[ -n "${ANDROID_SDK_ROOT:-}" && -d "$ANDROID_SDK_ROOT" ]]; then
    SDK="$ANDROID_SDK_ROOT"
else
    if [[ -f "$SCRIPT_DIR/local.properties" ]]; then
        PROP_SDK="$(grep -E '^sdk\.dir=' "$SCRIPT_DIR/local.properties" 2>/dev/null | cut -d'=' -f2- | tr -d '\r' | tr -d '\n' || true)"
        if [[ -n "$PROP_SDK" && -d "$PROP_SDK" ]]; then
            SDK="$PROP_SDK"
        fi
    fi
fi

if [[ -z "$SDK" ]]; then
    for CANDIDATE in "$HOME/Android/Sdk" "$HOME/Library/Android/sdk" /opt/android-sdk /usr/lib/android-sdk; do
        if [[ -d "$CANDIDATE" ]]; then
            SDK="$CANDIDATE"
            break
        fi
    done
fi

if [[ -z "$SDK" ]]; then
    echo "ERROR: Android SDK not found."
    echo "Fix it with ONE of the following, then re-run this script:"
    echo "  1. export ANDROID_HOME=/path/to/android-sdk"
    echo "  2. create local.properties here containing:  sdk.dir=/path/to/android-sdk"
    echo "  3. install the SDK to ~/Android/Sdk (Linux) or ~/Library/Android/sdk (macOS)"
    exit 1
fi

command -v javac >/dev/null 2>&1 || { echo "ERROR: JDK not found (javac). Install JDK 11 or newer."; exit 1; }
command -v jar   >/dev/null 2>&1 || { echo "ERROR: 'jar' not found. Install a full JDK (not just JRE)."; exit 1; }

# Pick build-tools: prefer 33.0.2, else the newest version installed
if [[ -n "${BUILD_TOOLS_VERSION:-}" && -d "$SDK/build-tools/$BUILD_TOOLS_VERSION" ]]; then
    BUILD_TOOLS="$SDK/build-tools/$BUILD_TOOLS_VERSION"
elif [[ -d "$SDK/build-tools/33.0.2" ]]; then
    BUILD_TOOLS="$SDK/build-tools/33.0.2"
else
    BT_VER="$(ls -1 "$SDK/build-tools" 2>/dev/null | grep -E '^[0-9]' | sort -rV | head -n 1 || true)"
    if [[ -z "$BT_VER" ]]; then
        echo "ERROR: No build-tools found in $SDK/build-tools."
        echo "Install them with: sdkmanager \"build-tools;33.0.2\""
        exit 1
    fi
    BUILD_TOOLS="$SDK/build-tools/$BT_VER"
fi

# Pick platform: prefer android-33, else the newest installed
if [[ -n "${PLATFORM_VERSION:-}" && -d "$SDK/platforms/$PLATFORM_VERSION" ]]; then
    PLATFORM="$SDK/platforms/$PLATFORM_VERSION"
elif [[ -d "$SDK/platforms/android-33" ]]; then
    PLATFORM="$SDK/platforms/android-33"
else
    PLAT_VER="$(ls -1 "$SDK/platforms" 2>/dev/null | grep -E '^android-' | sort -rV | head -n 1 || true)"
    if [[ -z "$PLAT_VER" ]]; then
        echo "ERROR: No Android platform found in $SDK/platforms."
        echo "Install one with: sdkmanager \"platforms;android-33\""
        exit 1
    fi
    PLATFORM="$SDK/platforms/$PLAT_VER"
fi

AAPT2="$BUILD_TOOLS/aapt2"
D8="$BUILD_TOOLS/d8"
ZIPALIGN="$BUILD_TOOLS/zipalign"
APKSIGNER="$BUILD_TOOLS/apksigner"
ANDROID_JAR="$PLATFORM/android.jar"

echo "    SDK         : $SDK"
echo "    Build-tools : $BUILD_TOOLS"
echo "    Platform    : $PLATFORM"

BUILD_DIR="$SCRIPT_DIR/build"
GEN_DIR="$BUILD_DIR/gen"
CLASSES_DIR="$BUILD_DIR/classes"
DEX_DIR="$BUILD_DIR/dex"
APK_DIR="$BUILD_DIR/apk"

rm -rf "$BUILD_DIR"
mkdir -p "$GEN_DIR" "$CLASSES_DIR" "$DEX_DIR" "$APK_DIR"

echo "==> 1. Compiling resources with aapt2..."
"$AAPT2" compile --dir app/src/main/res -o "$BUILD_DIR/compiled_res.zip"

echo "==> 2. Linking APK & generating R.java..."
"$AAPT2" link \
    -I "$ANDROID_JAR" \
    --manifest app/src/main/AndroidManifest.xml \
    --java "$GEN_DIR" \
    -A app/src/main/assets \
    -o "$APK_DIR/unaligned.apk" \
    --auto-add-overlay \
    "$BUILD_DIR/compiled_res.zip"

echo "==> 3. Compiling Java sources..."
JAVA_SOURCES=$(find app/src/main/java "$GEN_DIR" -name "*.java")
javac --release 11 \
    -cp "$ANDROID_JAR" \
    -d "$CLASSES_DIR" \
    $JAVA_SOURCES

echo "==> 4. Converting bytecode to DEX..."
CLASS_FILES=$(find "$CLASSES_DIR" -name "*.class")
"$D8" --output "$DEX_DIR" --min-api 24 --lib "$ANDROID_JAR" $CLASS_FILES

echo "==> 5. Adding classes.dex to APK..."
(cd "$DEX_DIR" && jar uf "$APK_DIR/unaligned.apk" classes.dex)

echo "==> 6. Aligning APK..."
"$ZIPALIGN" -f -p 4 "$APK_DIR/unaligned.apk" "$APK_DIR/aligned.apk"

echo "==> 7. Creating debug keystore (if needed)..."
KEYSTORE="$SCRIPT_DIR/debug.keystore"
if [[ ! -f "$KEYSTORE" ]]; then
    keytool -genkeypair -v \
        -keystore "$KEYSTORE" \
        -storepass android \
        -alias androiddebugkey \
        -keypass android \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -dname "CN=Android Debug,O=Android,C=US" 2>/dev/null
fi

echo "==> 8. Signing APK..."
FINAL_APK="$SCRIPT_DIR/Paisa-debug.apk"
"$APKSIGNER" sign \
    --ks "$KEYSTORE" \
    --ks-pass pass:android \
    --key-pass pass:android \
    --out "$FINAL_APK" \
    "$APK_DIR/aligned.apk"

echo "=================================================="
echo " BUILD SUCCESSFUL! APK: $FINAL_APK"
echo "=================================================="

if command -v adb &>/dev/null; then
    DEVICE=$(adb devices | grep -w "device" | awk '{print $1}' | head -n 1)
    if [[ -n "$DEVICE" ]]; then
        echo "==> Installing to device $DEVICE..."
        adb -s "$DEVICE" install -r "$FINAL_APK"
        echo "==> Launching app..."
        adb -s "$DEVICE" shell am start -n com.bespoke.paisa/.MainActivity
        echo "==> App running on device!"
    else
        echo "==> No device attached. Install manually with:  adb install -r Paisa-debug.apk"
    fi
else
    echo "==> adb not found. Install the APK manually on your phone."
fi
