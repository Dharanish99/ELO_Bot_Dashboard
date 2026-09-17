#!/usr/bin/env python3
from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from elo_follow.config import load_config
from elo_follow.camera import CameraSource
from elo_follow.models import PersonDetector


def main():
    cfg = load_config()
    camera = CameraSource(cfg)
    detector = PersonDetector(
        str(cfg.model_path),
        cfg.input_width,
        cfg.input_height,
        cfg.person_class_id,
        cfg.confidence_high,
        cfg.confidence_low,
    )

    print('\nELO Detection Diagnostic')
    print('=' * 50)
    print('Model:', cfg.model_path)
    print('Person class:', cfg.person_class_id)
    print('High threshold:', cfg.confidence_high)
    print('Low threshold:', cfg.confidence_low)
    print('=' * 50)

    try:
        for i in range(30):
            frame = camera.capture()
            t0 = time.perf_counter()
            detections = detector.infer(frame, include_low=True)
            elapsed = (time.perf_counter() - t0) * 1000.0
            print(f'Frame {i+1:02d}: {len(detections)} person detection(s), inference={elapsed:.1f} ms')
            for j, d in enumerate(detections):
                print(f"    #{j+1}: score={d['score']:.3f}, bbox={d['bbox_norm']}")
            time.sleep(0.05)
    finally:
        camera.close()


if __name__ == '__main__':
    main()
