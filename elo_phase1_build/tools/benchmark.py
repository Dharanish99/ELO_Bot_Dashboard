#!/usr/bin/env python3
"""Measure actual detector loop performance on the Pi with real camera frames."""
import time
from elo_follow.config import load_config
from elo_follow.camera import CameraSource
from elo_follow.models import PersonDetector
cfg=load_config(); cam=CameraSource(cfg); det=PersonDetector(str(cfg.model_path),cfg.input_width,cfg.input_height,cfg.person_class_id,cfg.confidence_high,cfg.confidence_low)
try:
  times=[]
  end=time.monotonic()+10
  n=0
  while time.monotonic()<end:
    f=cam.capture(); t=time.perf_counter(); det.infer(f); times.append((time.perf_counter()-t)*1000); n+=1
  avg=sum(times)/len(times); fps=1000/avg
  print(f'Inference calls: {n}'); print(f'Average TFLite invoke: {avg:.1f} ms'); print(f'Equivalent inference FPS: {fps:.1f}'); print(f'P50: {sorted(times)[len(times)//2]:.1f} ms; P95: {sorted(times)[int(len(times)*.95)-1]:.1f} ms')
finally: cam.close()
