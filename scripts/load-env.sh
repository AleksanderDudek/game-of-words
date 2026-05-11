#!/usr/bin/env bash
# Sourced by other scripts — do not run directly.
# Loads .env.local and validates required variables are set.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.local not found at $PROJECT_ROOT"
  echo "       Copy .env.local.example to .env.local and fill in your values."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

check_var() {
  local var_name="$1"
  local value="${!var_name}"
  if [[ -z "$value" ]]; then
    echo "ERROR: $var_name is not set in .env.local"
    exit 1
  fi
}

check_var ANDROID_KEYSTORE_PATH
check_var ANDROID_KEYSTORE_PASSWORD
check_var ANDROID_KEY_ALIAS
check_var ANDROID_KEY_PASSWORD

# Resolve relative path against project root
if [[ "$ANDROID_KEYSTORE_PATH" != /* ]]; then
  ANDROID_KEYSTORE_PATH="$PROJECT_ROOT/$ANDROID_KEYSTORE_PATH"
fi

if [[ ! -f "$ANDROID_KEYSTORE_PATH" ]]; then
  echo "ERROR: Keystore not found at $ANDROID_KEYSTORE_PATH"
  echo "       Run: keytool -genkey -v -keystore android/app/signal-decay.jks -alias signal-decay -keyalg RSA -keysize 2048 -validity 10000"
  exit 1
fi
