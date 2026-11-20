#!/bin/sh
# Builds the signed Android release: App Bundle (.aab, for Google Play) and APK
# (for direct installation). Signing: see apps/client/android/app/build.gradle.
set -e
cd "$(dirname "$0")/.."
SDK="${ANDROID_HOME:-/opt/android-sdk}"
VERSION=$(node -p "require('./package.json').version")
[ -d apps/client/public/bibles ] || pnpm bibles
pnpm --filter @biblez/client build
(cd apps/client && npx cap sync android)
cd apps/client/android
[ -f local.properties ] || echo "sdk.dir=$SDK" > local.properties
# one worker: the cloud session's proxy rejects many parallel downloads (HTTP 429)
ANDROID_HOME="$SDK" ./gradlew bundleRelease assembleRelease --max-workers=1 -q -Dorg.gradle.internal.repository.max.retries=8 -Dorg.gradle.internal.repository.initial.backoff=3000
cd ../../..
OUT=dist-android
mkdir -p "$OUT"
cp apps/client/android/app/build/outputs/bundle/release/app-release.aab "$OUT/BibleZ-$VERSION.aab"
APK=$(ls apps/client/android/app/build/outputs/apk/release/app-release*.apk | head -1)
cp "$APK" "$OUT/BibleZ-$VERSION.apk"
BT=$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)
echo
if "$BT/apksigner" verify "$OUT/BibleZ-$VERSION.apk" >/dev/null 2>&1; then
  echo "Signed with:"
  "$BT/apksigner" verify --print-certs "$OUT/BibleZ-$VERSION.apk" | grep -E "certificate DN|SHA-256"
else
  echo "WARNING: release is UNSIGNED – create a key with: sh tools/create-keystore.sh"
fi
ls -la "$OUT"
