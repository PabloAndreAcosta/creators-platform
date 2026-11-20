#!/bin/zsh
# Bygger en signerad Android App Bundle (AAB) för Google Play.
# Kräver uppladdningsnyckeln i ~/.usha-android/usha-upload.jks och lösenordet
# i macOS-nyckelringen (tjänst usha-android-upload). Lösenordet visas aldrig.
set -e
cd "$(dirname "$0")/.."
JKS="$HOME/.usha-android/usha-upload.jks"
[[ -f "$JKS" ]] || { echo "Uppladdningsnyckeln saknas: $JKS"; exit 1; }
export USHA_UPLOAD_STORE_FILE="$JKS"
export USHA_UPLOAD_PASSWORD="$(security find-generic-password -a usha-upload -s usha-android-upload -w)"
npx cap sync android
(cd android && ./gradlew bundleRelease)
unset USHA_UPLOAD_PASSWORD
AAB=android/app/build/outputs/bundle/release/app-release.aab
echo "Klart: $AAB ($(du -h "$AAB" | cut -f1))"
