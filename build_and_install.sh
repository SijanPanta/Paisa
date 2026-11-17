#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ANDROID_SDK="/home/admin1/android-sdk-auto"
BUILD_TOOLS="$ANDROID_SDK/build-tools/33.0.2"
PLATFORM="$ANDROID_SDK/platforms/android-33"

AAPT2="$BUILD_TOOLS/aapt2"
D8="$BUILD_TOOLS/d8"
ZIPALIGN="$BUILD_TOOLS/zipalign"
APKSIGNER="$BUILD_TOOLS/apksigner"
ANDROID_JAR="$PLATFORM/android.jar"

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
javac -source 11 -target 11 \
    -cp "$ANDROID_JAR" \
    -d "$CLASSES_DIR" \
    $JAVA_SOURCES

echo "==> 4. Converting bytecode to DEX..."
CLASS_FILES=$(find "$CLASSES_DIR" -name "*.class")
"$D8" --output "$DEX_DIR" --min-api 24 --lib "$ANDROID_JAR" $CLASS_FILES

echo "==> 5. Adding classes.dex to APK..."
cd "$DEX_DIR"
jar uf "$APK_DIR/unaligned.apk" classes.dex
cd "$SCRIPT_DIR"

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
    fi
fi
