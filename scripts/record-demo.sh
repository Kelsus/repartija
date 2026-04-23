#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT_DIR="docs/assets/demo-videos"
RAW_DIR="test-results/demo-raw"
FINAL="docs/assets/demo.mp4"

echo "→ Cleaning previous raw videos"
rm -rf "$RAW_DIR" "$OUT_DIR"
mkdir -p "$OUT_DIR" "$RAW_DIR"

echo "→ Running Playwright demo spec"
npx playwright test tests/demo-video.spec.ts --reporter=line

echo "→ Stitching with ffmpeg (hstack, plus labels if drawtext is available)"

FONT="/System/Library/Fonts/Supplemental/Arial.ttf"
if [[ ! -f "$FONT" ]]; then
  FONT="/System/Library/Fonts/Helvetica.ttc"
fi

HAS_DRAWTEXT=0
if ffmpeg -hide_banner -filters 2>/dev/null | grep -qw drawtext; then
  HAS_DRAWTEXT=1
fi

if [[ "$HAS_DRAWTEXT" == "1" ]]; then
  ffmpeg -y \
    -i "$OUT_DIR/host.webm" \
    -i "$OUT_DIR/ana.webm" \
    -i "$OUT_DIR/beto.webm" \
    -filter_complex "\
      [0:v]pad=iw:ih+64:0:64:color=0x0f172a,drawtext=fontfile=$FONT:text='Juan (host)':fontcolor=white:fontsize=26:x=(w-text_w)/2:y=18[v0]; \
      [1:v]pad=iw:ih+64:0:64:color=0x0f172a,drawtext=fontfile=$FONT:text='Ana':fontcolor=white:fontsize=26:x=(w-text_w)/2:y=18[v1]; \
      [2:v]pad=iw:ih+64:0:64:color=0x0f172a,drawtext=fontfile=$FONT:text='Beto':fontcolor=white:fontsize=26:x=(w-text_w)/2:y=18[v2]; \
      [v0][v1][v2]hstack=inputs=3" \
    -c:v libx264 -pix_fmt yuv420p -preset medium -crf 22 -movflags +faststart \
    "$FINAL"
else
  echo "  (drawtext no disponible en este ffmpeg — stitch sin labels)"
  ffmpeg -y \
    -i "$OUT_DIR/host.webm" \
    -i "$OUT_DIR/ana.webm" \
    -i "$OUT_DIR/beto.webm" \
    -filter_complex "[0:v][1:v][2:v]hstack=inputs=3" \
    -c:v libx264 -pix_fmt yuv420p -preset medium -crf 22 -movflags +faststart \
    "$FINAL"
fi

DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$FINAL" 2>/dev/null || echo "?")
echo "✓ Demo video listo: $FINAL (duración: ${DUR}s)"
