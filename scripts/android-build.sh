#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load and validate secrets
source "$SCRIPT_DIR/load-env.sh"

echo "==> Syncing Capacitor..."
cd "$PROJECT_ROOT"
npm run cap:sync

echo "==> Building signed AAB..."
cd "$PROJECT_ROOT/android"
./gradlew bundleRelease \
  "-Pandroid.injected.signing.store.file=$ANDROID_KEYSTORE_PATH" \
  "-Pandroid.injected.signing.store.password=$ANDROID_KEYSTORE_PASSWORD" \
  "-Pandroid.injected.signing.key.alias=$ANDROID_KEY_ALIAS" \
  "-Pandroid.injected.signing.key.password=$ANDROID_KEY_PASSWORD"

AAB="$PROJECT_ROOT/android/app/build/outputs/bundle/release/app-release.aab"
echo ""
echo "==> Build successful!"
echo "    AAB: $AAB"
echo "    Size: $(du -sh "$AAB" | cut -f1)"
