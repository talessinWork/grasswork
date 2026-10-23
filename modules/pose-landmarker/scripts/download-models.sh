#!/usr/bin/env bash
# Downloads the MediaPipe Pose Landmarker models into <repo>/assets/models/.
# app.plugin.js copies them into the native projects at `expo prebuild`.
#
# Usage (from anywhere):  bash modules/pose-landmarker/scripts/download-models.sh [--force]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DEST="$REPO_ROOT/assets/models"
BASE="https://storage.googleapis.com/mediapipe-models/pose_landmarker"
FORCE="${1:-}"

mkdir -p "$DEST"

for variant in lite full; do
  file="pose_landmarker_${variant}.task"
  url="$BASE/pose_landmarker_${variant}/float16/latest/$file"
  if [[ -s "$DEST/$file" && "$FORCE" != "--force" ]]; then
    echo "ok: $file already present (use --force to re-download)"
    continue
  fi
  echo "downloading: $file"
  curl -fL --retry 3 -o "$DEST/$file.part" "$url"
  mv "$DEST/$file.part" "$DEST/$file"
done

ls -lh "$DEST"/*.task
echo "Done. Now run: npx expo prebuild --clean (or expo run:ios / run:android)."
