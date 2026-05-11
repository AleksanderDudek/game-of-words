#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load and validate secrets
source "$SCRIPT_DIR/load-env.sh"

cd "$PROJECT_ROOT"

echo "==> Building AAB..."
bash "$SCRIPT_DIR/android-build.sh"

echo ""
echo "==> Deploying to Play Store (internal track) via Fastlane..."
bundle exec fastlane android beta

echo ""
echo "==> Done! Check Play Console → Internal testing for the new build."
