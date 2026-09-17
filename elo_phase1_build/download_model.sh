#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
MODEL_DIR="$ROOT/models"
URL="https://storage.googleapis.com/download.tensorflow.org/models/tflite/coco_ssd_mobilenet_v1_1.0_quant_2018_06_29.zip"
TMP="$MODEL_DIR/model.zip"
mkdir -p "$MODEL_DIR"
if [[ -s "$MODEL_DIR/detect.tflite" ]]; then
  echo "Model already present: $MODEL_DIR/detect.tflite"
  exit 0
fi
command -v curl >/dev/null 2>&1 || { echo "curl is required"; exit 1; }
echo "Downloading official TensorFlow Lite SSD-MobileNet V1 quantized model..."
curl -L --fail --retry 3 -o "$TMP" "$URL"
unzip -j -o "$TMP" 'detect.tflite' -d "$MODEL_DIR"
rm -f "$TMP"
[[ -s "$MODEL_DIR/detect.tflite" ]] || { echo "detect.tflite was not found in the archive"; exit 1; }
echo "Installed: $MODEL_DIR/detect.tflite"
