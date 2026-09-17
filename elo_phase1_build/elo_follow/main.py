from __future__ import annotations

import signal
import threading
import time
from pathlib import Path

import cv2

from .config import load_config
from .camera import CameraSource
from .models import PersonDetector
from .tracker import LightweightPeopleTracker
from .state import SharedState
from .motor import MotorController
from .ultrasonic import UltrasonicArray
from .follow import FollowController, SearchController
from .arbiter import MotionArbiter
from .dashboard import Dashboard


class ELOPhase1:
    def __init__(self):
        self.cfg = load_config()
        self.state = SharedState()
        self.camera = CameraSource(self.cfg)
        self.detector = PersonDetector(str(self.cfg.model_path), self.cfg.input_width, self.cfg.input_height,
                                       self.cfg.person_class_id, self.cfg.confidence_high, self.cfg.confidence_low)
        self.tracker = LightweightPeopleTracker(self.cfg)
        self.motors = MotorController(self.cfg)
        self.ultra = UltrasonicArray(self.cfg)
        self.follow = FollowController(self.cfg)
        self.search = SearchController(self.cfg)
        self.arbiter = MotionArbiter(self.cfg, self.state, self.motors, self.follow, self.search)
        self.dashboard = Dashboard(self.cfg, self.state)
        self.stop_evt = threading.Event()
        self.vision_thread = threading.Thread(target=self._vision_loop, name='vision', daemon=True)
        self.control_thread = threading.Thread(target=self._control_loop, name='control', daemon=True)
        self.last_dashboard_selected = None

    def _draw(self, frame, tracks):
        out = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        with self.state.lock:
            selected = self.state.selected_id
        for t in tracks:
            x1,y1,x2,y2 = map(int,t['bbox'])
            chosen = t['id']==selected
            cv2.rectangle(out,(x1,y1),(x2,y2),(0,220,80) if chosen else (80,160,255),2)
            label=f"Person {t['id']} {'[FOLLOW]' if chosen else ''} {t['score']:.2f}".strip()
            cv2.putText(out,label,(x1,max(16,y1-6)),cv2.FONT_HERSHEY_SIMPLEX,0.48,(0,255,80) if chosen else (255,255,255),1,cv2.LINE_AA)
        ok, enc=cv2.imencode('.jpg',out,[cv2.IMWRITE_JPEG_QUALITY,70])
        return enc.tobytes() if ok else None

    def _vision_loop(self):
        period=1.0/self.cfg.inference_hz
        next_t=time.monotonic()
        frames=0; fps_t=time.monotonic()
        while not self.stop_evt.is_set():
            try:
                frame=self.camera.capture()
                t0=time.perf_counter()
                detections=self.detector.infer(frame, include_low=True)
                infer_ms=(time.perf_counter()-t0)*1000.0
                tracks=self.tracker.update(detections, frame)
                with self.state.lock:
                    requested=self.state.requested_selected_id
                if requested is not None and requested != self.tracker.selected_id:
                    self.tracker.select(requested)
                with self.state.lock:
                    self.state.tracks=tracks
                    self.state.selected_id=self.tracker.selected_id
                    sel=self.tracker.selected_snapshot()
                    if sel:
                        self.state.target_last_seen=time.monotonic()
                        self.state.target_last_side=sel.last_side
                self.state.preview_jpeg=self._draw(frame,tracks)
                frames+=1
                now=time.monotonic()
                if now-fps_t>=1.0:
                    with self.state.lock:
                        self.state.vision_fps=frames/(now-fps_t)
                        self.state.tflite_ms=infer_ms
                    frames=0;fps_t=now
            except Exception as exc:
                with self.state.lock: self.state.last_error=f"vision: {exc}"
                time.sleep(0.2)
            next_t+=period
            time.sleep(max(0.0,next_t-time.monotonic()))

    def _control_loop(self):
        period=0.02 # 50 Hz arbiter; vision is intentionally slower.
        next_t=time.monotonic()
        while not self.stop_evt.is_set():
            try:
                obs=self.ultra.snapshot()
                with self.state.lock: self.state.obstacles=obs
                self.arbiter.tick(None,self.cfg.camera_width,self.cfg.camera_height)
            except Exception as exc:
                with self.state.lock: self.state.last_error=f"control: {exc}"
                try:self.motors.stop()
                except Exception:pass
            next_t+=period
            time.sleep(max(0.0,next_t-time.monotonic()))

    def start(self):
        self.ultra.start()
        self.dashboard.start()
        self.vision_thread.start()
        self.control_thread.start()
        print(f"ELO Phase 1 dashboard: http://<PI-IP>:{self.cfg.dashboard_port}/")
        print("Safety: Moving gate is OFF at startup. Select a person and enable FOLLOW, then set MOVING.")

    def stop(self):
        self.stop_evt.set()
        try:self.motors.stop()
        except Exception:pass
        try:self.ultra.stop()
        except Exception:pass
        try:self.dashboard.stop()
        except Exception:pass
        try:self.camera.close()
        except Exception:pass
        try:self.motors.close()
        except Exception:pass


def main():
    app=ELOPhase1()
    def handle(*_):
        app.stop()
    signal.signal(signal.SIGINT,handle); signal.signal(signal.SIGTERM,handle)
    try:
        app.start()
        while not app.stop_evt.is_set(): time.sleep(1)
    finally:
        app.stop()


if __name__=='__main__':
    main()
