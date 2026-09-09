#!/usr/bin/env bash
set -euo pipefail

APK_PATH="${1:-android/app/build/outputs/apk/debug/app-debug.apk}"

if [[ ! -f "$APK_PATH" ]]; then
  echo "APK not found: $APK_PATH" >&2
  exit 1
fi

if ! command -v readelf >/dev/null 2>&1; then
  echo "readelf is required for 16 KB ELF alignment checks." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
unzip -qq "$APK_PATH" -d "$TMP_DIR"

checked=0
failed=0
while IFS= read -r -d '' so_file; do
  case "$so_file" in
    */lib/arm64-v8a/*.so|*/lib/x86_64/*.so) ;;
    *) continue ;;
  esac

  checked=$((checked + 1))
  relative="${so_file#"$TMP_DIR"/}"
  mapfile -t load_alignments < <(readelf -lW "$so_file" | awk '$1 == "LOAD" { print $NF }')

  if [[ ${#load_alignments[@]} -eq 0 ]]; then
    echo "UNALIGNED: $relative has no readable LOAD segments" >&2
    failed=1
    continue
  fi

  for alignment in "${load_alignments[@]}"; do
    if (( alignment < 16384 )); then
      echo "UNALIGNED: $relative LOAD alignment $alignment is below 16384" >&2
      failed=1
      break
    fi
  done

done < <(find "$TMP_DIR/lib" -type f -name '*.so' -print0 2>/dev/null || true)

if (( checked == 0 )); then
  echo "No 64-bit native libraries found; refusing to claim 16 KB native compatibility." >&2
  exit 1
fi

if (( failed != 0 )); then
  exit 1
fi

echo "ELF alignment OK for $checked 64-bit shared libraries."

SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$SDK_ROOT" || ! -d "$SDK_ROOT/build-tools" ]]; then
  echo "Android SDK build-tools directory not found." >&2
  exit 1
fi

ZIPALIGN="$(find "$SDK_ROOT/build-tools" -type f -name zipalign -perm -u+x | sort -V | tail -n 1)"
if [[ -z "$ZIPALIGN" ]]; then
  echo "zipalign not found in Android SDK build-tools." >&2
  exit 1
fi

"$ZIPALIGN" -c -P 16 -v 4 "$APK_PATH"
echo "APK zip alignment OK for 16 KB native-library pages."
