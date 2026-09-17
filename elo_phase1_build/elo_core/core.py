from __future__ import annotations
import cv2
import threading
import time

from elo_follow.config import load_config
from elo_follow.camera import CameraSource
from elo_follow.models import PersonDetector
from elo_follow.tracker import LightweightPeopleTracker
from elo_follow.state import SharedState
from elo_follow.motor import MotorController
from elo_follow.ultrasonic import UltrasonicArray
from elo_follow.follow import FollowController, SearchController
from elo_follow.arbiter import MotionArbiter

from .config import CORE_CONFIG
from .display import DisplayController
from .audio import AudioInteraction
from .api import CoreAPI


class ELOCore:
    """Single Pi process that orchestrates the already-tested Phase-1 subsystems."""
    def __init__(self):
        self.cfg = load_config()
        self.state = SharedState()
        # Explicit public mode is the top-level safety gate.
        self.state.mode = "STOPPED"
        self.state.audio_status = "OFF"
        self.state.backend_connected = False
        self.state.started_at = time.time()
        self.camera = CameraSource(self.cfg)
        self.detector = PersonDetector(str(self.cfg.model_path), self.cfg.input_width, self.cfg.input_height,
                                       self.cfg.person_class_id, self.cfg.confidence_high, self.cfg.confidence_low)
        self.tracker = LightweightPeopleTracker(self.cfg)
        self.motors = MotorController(self.cfg)
        self.ultra = UltrasonicArray(self.cfg)
        self.follow = FollowController(self.cfg)
        self.search = SearchController(self.cfg)
        self.arbiter = MotionArbiter(self.cfg, self.state, self.motors, self.follow, self.search)
        self.display = DisplayController(CORE_CONFIG.esp32_serial_port, CORE_CONFIG.esp32_baudrate, CORE_CONFIG.display_fps)
        self.audio = AudioInteraction(CORE_CONFIG, self.state, self.display)
        self.api = CoreAPI(CORE_CONFIG, self)
        self.stop_evt = threading.Event()
        self.vision_thread = threading.Thread(target=self._vision_loop, name="vision", daemon=True)
        self.control_thread = threading.Thread(target=self._control_loop, name="control", daemon=True)

    def _draw(self, frame, tracks):
        out = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        with self.state.lock:
            selected = self.state.selected_id
        for t in tracks:
            x1,y1,x2,y2 = map(int,t['bbox'])
            chosen = t['id'] == selected
            cv2.rectangle(out,(x1,y1),(x2,y2),(0,220,80) if chosen else (80,160,255),2)
            label=f"Person {t['id']} {'[FOLLOW]' if chosen else ''} {t['score']:.2f}".strip()
            cv2.putText(out,label,(x1,max(16,y1-6)),cv2.FONT_HERSHEY_SIMPLEX,0.48,(0,255,80) if chosen else (255,255,255),1,cv2.LINE_AA)
        ok, enc=cv2.imencode('.jpg',out,[cv2.IMWRITE_JPEG_QUALITY,70])
        return enc.tobytes() if ok else None

    def _vision_loop(self):
        period = 1.0 / self.cfg.inference_hz
        next_t = time.monotonic(); frames = 0; fps_t = time.monotonic()
        while not self.stop_evt.is_set():
            try:
                frame = self.camera.capture()
                t0 = time.perf_counter()
                detections = self.detector.infer(frame, include_low=True)
                infer_ms = (time.perf_counter()-t0)*1000.0
                tracks = self.tracker.update(detections, frame)
                with self.state.lock:
                    requested = self.state.requested_selected_id
                if requested is not None and requested != self.tracker.selected_id:
                    self.tracker.select(requested)
                with self.state.lock:
                    self.state.tracks = tracks
                    self.state.selected_id = self.tracker.selected_id
                    sel = self.tracker.selected_snapshot()
                    if sel:
                        self.state.target_last_seen = time.monotonic()
                        self.state.target_last_side = sel.last_side
                self.state.preview_jpeg = self._draw(frame, tracks)
                frames += 1; now = time.monotonic()
                if now-fps_t >= 1.0:
                    with self.state.lock:
                        self.state.vision_fps = frames/(now-fps_t)
                        self.state.tflite_ms = infer_ms
                    frames=0; fps_t=now
            except Exception as exc:
                with self.state.lock: self.state.last_error = f"vision: {exc}"
                time.sleep(0.2)
            next_t += period
            time.sleep(max(0.0, next_t-time.monotonic()))

    def _control_loop(self):
        period = 0.02; next_t = time.monotonic()
        while not self.stop_evt.is_set():
            try:
                obs = self.ultra.snapshot()
                with self.state.lock:
                    self.state.obstacles = obs
                    mode = self.state.mode
                    # Safety boundary: only FOLLOW is ever allowed to request motion.
                    self.state.moving = mode == "MOVING"
                    self.state.follow_enabled = mode == "MOVING"
                self.arbiter.tick(None, self.cfg.camera_width, self.cfg.camera_height)
            except Exception as exc:
                with self.state.lock: self.state.last_error = f"control: {exc}"
                try: self.motors.stop()
                except Exception: pass
            next_t += period
            time.sleep(max(0.0, next_t-time.monotonic()))

    def targets(self):
        with self.state.lock:
            return [
                {"id": t["id"], "label": f"Person {t['id']}", "score": round(t["score"],3),
                 "misses": t["misses"], "age_s": round(t["age_s"],2), "last_side": t["last_side"]}
                for t in self.state.tracks if t.get("misses",0) == 0
            ]

    def select_target(self, target_id):
        try: tid = int(target_id)
        except Exception: return False, "invalid target_id"
        with self.state.lock:
            valid = any(t["id"] == tid and t.get("misses",0) == 0 for t in self.state.tracks)
        if not valid:
            return False, "target not currently available"
        with self.state.lock:
            self.state.requested_selected_id = tid
            self.state.selected_id = tid
            self.state.reason = "target-selected"
        return True, f"target {tid} selected"

    def set_mode(self, mode):
        mode = mode.upper()
        if mode in {"FOLLOW", "MOVING"}:
            with self.state.lock:
                if self.state.selected_id is None:
                    return False, "select a target before FOLLOW"
                self.state.mode = "MOVING"
                self.state.reason = "dashboard-follow"
                self.state.audio_status = "OFF"
            self.audio.end_session()
            self.display.set_segment("settle")
            return True, "FOLLOW requested"
        if mode in {"INTERACT", "INTERACTING"}:
            return self.start_interaction()
        if mode in {"STOP", "STOPPED"}:
            self.stop_robot(); return True, "STOPPED"
        return False, "mode must be FOLLOW, INTERACT, or STOP"

    def start_interaction(self):
        # Stop before changing any interaction state. Arbiter sees INTERACTING on next tick.
        with self.state.lock:
            self.state.mode = "INTERACTING"
            self.state.moving = False
            self.state.follow_enabled = False
            self.state.reason = "dashboard-interact"
        try: self.motors.stop()
        except Exception: pass
        self.audio.start_session()
        return True, "INTERACTING"

    def end_interaction(self):
        self.audio.end_session()
        self.display.set_segment("settle")
        with self.state.lock:
            self.state.mode = "STOPPED"
            self.state.moving = False
            self.state.follow_enabled = False
            self.state.reason = "interaction-ended"
        try: self.motors.stop()
        except Exception: pass

    def stop_robot(self):
        with self.state.lock:
            self.state.mode = "STOPPED"
            self.state.moving = False
            self.state.follow_enabled = False
            self.state.reason = "dashboard-stop"
        self.audio.end_session()
        self.display.set_segment("settle")
        try: self.motors.stop()
        except Exception: pass

    def start_recording(self):
        with self.state.lock:
            if self.state.mode != "INTERACTING":
                return False, "enter INTERACTING first"
        try:
            self.audio.start_recording(); return True, "recording"
        except Exception as exc:
            return False, str(exc)

    def stop_recording(self):
        with self.state.lock:
            if self.state.mode != "INTERACTING":
                return {"ok": False, "error": "not_interacting"}
        return self.audio.stop_recording()

    def snapshot(self):
        with self.state.lock:
            s = self.state.snapshot()
            mode = self.state.mode
            audio_status = self.state.audio_status
            backend = self.state.backend_connected
        s.update({
            "mode": mode,
            "online": True,
            "audio_status": audio_status,
            "backend_connected": backend,
            "display": self.display.snapshot(),
            "audio": self.audio.snapshot(),
            "targets": self.targets(),
        })
        return s

    def start(self):
        self.stop_robot()
        self.ultra.start()
        self.display.start()
        self.vision_thread.start()
        self.control_thread.start()
        self.api.start()
        print(f"[ELO] Core API: http://<PI-IP>:{CORE_CONFIG.api_port}")
        print("[ELO] State: STOPPED. Select a target from Parent Dashboard, then FOLLOW.")

    def stop(self):
        self.stop_evt.set()
        try: self.stop_robot()
        except Exception: pass
        try: self.api.stop()
        except Exception: pass
        try: self.display.stop()
        except Exception: pass
        try: self.ultra.stop()
        except Exception: pass
        try: self.camera.close()
        except Exception: pass
        try: self.motors.close()
        except Exception: pass
