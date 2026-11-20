#!/bin/sh
# Builds the Android debug APK: web build → Capacitor sync → Gradle.
# Needs JDK 21 and the Android SDK (ANDROID_HOME, default /opt/android-sdk).
set -e
cd "$(dirname "$0")/.."
SDK="${ANDROID_HOME:-/opt/android-sdk}"
[ -d apps/client/public/bibles ] || pnpm bibles
pnpm --filter @biblez/client build
cd apps/client
npx cap sync android
cd android
[ -f local.properties ] || echo "sdk.dir=$SDK" > local.properties
# one worker: the session's network proxy rejects many parallel downloads (HTTP 429)
ANDROID_HOME="$SDK" ./gradlew assembleDebug --max-workers=1 -q -Dorg.gradle.internal.repository.max.retries=8 -Dorg.gradle.internal.repository.initial.backoff=3000
echo "APK: apps/client/android/app/build/outputs/apk/debug/app-debug.apk"
