#!/bin/sh
# Creates the Android *upload* key – once, on your own computer, never in the repo.
# With Google Play App Signing, Google holds the real app signing key; this upload
# key only proves that an upload comes from you and can be reset via Play Console.
#
# Usage: sh tools/create-keystore.sh [directory]   (default: ~/.biblez)
# Then:  pnpm android:release
set -e
cd "$(dirname "$0")/.."
DIR="${1:-$HOME/.biblez}"
KS="$DIR/biblez-upload.jks"
PROPS="apps/client/android/keystore.properties"
if [ -e "$KS" ]; then echo "Keystore exists already: $KS"; exit 1; fi
command -v keytool >/dev/null || { echo "keytool not found (install JDK 21)"; exit 1; }

printf "Password for the keystore (min. 8 characters): "; stty -echo 2>/dev/null || true; read -r BIBLEZ_KS_PW; stty echo 2>/dev/null || true; echo
printf "Repeat password: "; stty -echo 2>/dev/null || true; read -r PW2; stty echo 2>/dev/null || true; echo
[ "$BIBLEZ_KS_PW" = "$PW2" ] || { echo "Passwords differ."; exit 1; }
[ ${#BIBLEZ_KS_PW} -ge 8 ] || { echo "Password too short."; exit 1; }
export BIBLEZ_KS_PW

mkdir -p "$DIR" && chmod 700 "$DIR"
keytool -genkeypair -keystore "$KS" -storetype PKCS12 -alias biblez-upload \
  -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=BibleZ, O=BibleZ" \
  -storepass:env BIBLEZ_KS_PW -keypass:env BIBLEZ_KS_PW
chmod 600 "$KS"

umask 077
cat > "$PROPS" <<PROPS_EOF
storeFile=$KS
storePassword=$BIBLEZ_KS_PW
keyAlias=biblez-upload
keyPassword=$BIBLEZ_KS_PW
PROPS_EOF
echo
echo "Upload key: $KS"
echo "Settings:   $PROPS (git-ignored)"
echo "Back up the .jks file and the password (e.g. in a password manager)."
