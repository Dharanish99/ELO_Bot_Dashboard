#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
checks = []
checks.append(((ROOT / 'config/config.toml').exists(), 'config/config.toml'))
checks.append(((ROOT / 'models/labels.txt').exists(), 'models/labels.txt'))
checks.append(((ROOT / 'models/detect.tflite').exists(), 'models/detect.tflite (run download_model.sh if missing)'))

try:
    import lgpio
    checks.append((True, 'lgpio import'))
except Exception as e:
    checks.append((False, f'lgpio import: {e}'))

try:
    from picamera2 import Picamera2
    checks.append((True, 'Picamera2 import'))
except Exception as e:
    checks.append((False, f'Picamera2 import: {e}'))

try:
    import cv2
    checks.append((True, f'OpenCV {cv2.__version__}'))
except Exception as e:
    checks.append((False, f'OpenCV import: {e}'))

try:
    from ai_edge_litert import interpreter
    checks.append((True, 'ai-edge-litert import'))
except Exception:
    try:
        import tflite_runtime.interpreter as tflite
        checks.append((True, 'tflite-runtime import'))
    except Exception as e:
        checks.append((False, f'LiteRT/TFLite runtime: {e}'))

print('\nELO Phase 1 Setup Verification')
print('=' * 40)
for ok, name in checks:
    print(('OK  ' if ok else 'FAIL'), name)
print('=' * 40)

failed = [name for ok, name in checks if not ok]
if failed:
    print(f'\n{len(failed)} check(s) failed.')
    sys.exit(1)

print('\nAll checks passed.')
sys.exit(0)
