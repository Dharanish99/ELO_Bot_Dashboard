#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
if [[ "$(uname -m)" != "aarch64" ]]; then
  echo "WARNING: This build is intended for 64-bit Raspberry Pi OS (aarch64). Current: $(uname -m)"
fi
if [[ ! -r /etc/os-release ]]; then echo "Cannot identify OS"; exit 1; fi
source /etc/os-release

echo "== ELO Phase 1 Pi setup =="
sudo apt update
sudo apt install -y python3-venv python3-picamera2 python3-opencv python3-lgpio curl unzip
python3 -m venv --system-site-packages "$ROOT/.venv"
source "$ROOT/.venv/bin/activate"
python -m pip install --upgrade pip
python -m pip install --upgrade 'ai-edge-litert>=1.0.0'
"$ROOT/download_model.sh"

# Ensure the current user can access the GPIO character device when the distro exposes gpio/dialout groups.
for grp in gpio dialout; do
  if getent group "$grp" >/dev/null 2>&1; then sudo usermod -aG "$grp" "$USER" || true; fi
done

python -m compileall -q "$ROOT/elo_follow"
python - <<'PY'
import sys
print('Python:', sys.version)
try:
    import cv2; print('OpenCV:', cv2.__version__)
except Exception as e: print('OpenCV import failed:', e)
try:
    import lgpio; print('lgpio: OK')
except Exception as e: print('lgpio import failed:', e)
try:
    from picamera2 import Picamera2; print('Picamera2: OK')
except Exception as e: print('Picamera2 import failed:', e)
try:
    from ai_edge_litert import interpreter; print('LiteRT: OK')
except Exception as e: print('LiteRT import failed:', e)
PY

echo
cat <<MSG
Setup complete.

Next:
  1) Verify camera:      source .venv/bin/activate && rpicam-hello -t 3000
  2) Run setup checks:   python tools/verify_setup.py
  3) Test ultrasonics:   sudo -E .venv/bin/python tools/test_ultrasonic.py
  4) Test motors:        sudo -E .venv/bin/python tools/test_motors.py
  5) Run ELO Phase 1:    sudo -E .venv/bin/python -m elo_follow.main

The service starts with MOVING=OFF and FOLLOW=OFF. Select a person in the Pi dashboard first.
MSG
