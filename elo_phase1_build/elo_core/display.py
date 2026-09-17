from __future__ import annotations
import json
import sys
import threading
import time
from pathlib import Path

FACE_DIR = Path(__file__).resolve().parent / "face"
if str(FACE_DIR) not in sys.path:
    sys.path.insert(0, str(FACE_DIR))

try:
    import serial
    from serial import SerialException
except Exception:
    serial = None
    SerialException = Exception

from animation import FaceController
from timeline import TimelineController
from eye import EyePair

EMOTION_TO_SEGMENT = {
    "neutral": "settle",
    "happy": "happy_bounce",
    "excited": "excited",
    "curious": "curious",
    "thinking": "thinking",
    "confused": "confused",
    "surprised": "surprise",
    "sad": "sad",
    "caring": "sad",
    "playful": "playful_double_wink",
    "sleepy": "drowsy",
    "angry": "angry",
    "scared": "scared_nervous",
}

VALID_SEGMENTS = set(EMOTION_TO_SEGMENT.values())


def _round(v, digits=3):
    return round(float(v), digits)


def build_frame(controller: FaceController) -> dict:
    l = controller.eye_pair.left_eye
    r = controller.eye_pair.right_eye
    frame = {
        "v": 3,
        "seg": controller.timeline.current_name,
        "p": _round(controller.timeline.progress, 4),
        "l": [_round(l.open_amount), _round(l.look_x), _round(l.look_y), _round(l.scale)],
        "r": [_round(r.open_amount), _round(r.look_x), _round(r.look_y), _round(r.scale)],
        "fa": _round(controller.face_alpha),
        "b": int(max(0, min(255, round(controller.blush_state.alpha)))),
    }
    if controller.timeline.current_name == "intro":
        i = controller.intro_state
        frame["i"] = {"t": i.text_to_show, "a": _round(i.text_alpha), "c": 1 if i.show_cursor else 0}
    elif controller.intro_state.text_to_show:
        frame["i"] = {"t": controller.intro_state.text_to_show, "a": _round(controller.intro_state.text_alpha), "c": 0}
    particles = []
    for p in controller.sleep_particles.particles[:8]:
        particles.append([_round(p.x), _round(p.y), int(p.size), int(p.alpha)])
    if particles:
        frame["z"] = particles
    return frame


class DisplayController:
    """Runs the existing ELO Face V3 animation engine and streams its states to ESP32."""
    def __init__(self, port: str, baudrate: int, fps: float = 25.0):
        self.port = port
        self.baudrate = baudrate
        self.fps = max(5.0, fps)
        self.controller = FaceController(eye_pair=EyePair(), timeline=TimelineController())
        self.controller.timeline_driven = False
        self.lock = threading.RLock()
        self.running = False
        self.thread = None
        self.ser = None
        self.connected = False
        self.last_error = ""
        self.seq = 0
        self._requested_segment = "settle"
        self._requested_at = 0.0

    def set_emotion(self, emotion: str):
        segment = EMOTION_TO_SEGMENT.get(str(emotion).strip().lower(), "settle")
        self.set_segment(segment)

    def set_segment(self, segment: str):
        if segment not in VALID_SEGMENTS:
            segment = "settle"
        with self.lock:
            self._requested_segment = segment
            self._requested_at = time.monotonic()

    def _open(self):
        if serial is None:
            raise RuntimeError("pyserial is not installed")
        self.ser = serial.Serial(self.port, self.baudrate, timeout=0.15, write_timeout=0.5)
        time.sleep(0.2)
        self.ser.reset_input_buffer()
        self.ser.reset_output_buffer()
        self.connected = True

    def _close(self):
        if self.ser is not None:
            try:
                self.ser.close()
            except Exception:
                pass
        self.ser = None
        self.connected = False

    def _send(self, frame: dict):
        if not self.connected or self.ser is None:
            return
        payload = json.dumps(frame, separators=(",", ":"), ensure_ascii=True)
        line = f"FRAME {self.seq} {payload}\n".encode("utf-8")
        self.ser.write(line)
        self.ser.flush()
        # The firmware provides ACK back-pressure. We do not make display failure
        # fatal to the movement/audio systems.
        deadline = time.monotonic() + 0.25
        expected = f"ACK {self.seq}"
        while time.monotonic() < deadline:
            raw = self.ser.readline()
            if not raw:
                continue
            text = raw.decode("utf-8", errors="ignore").strip()
            if text.startswith(expected):
                break
            if text.startswith(f"NACK {self.seq}"):
                break
        self.seq = (self.seq + 1) & 0xFFFFFFFF

    def _loop(self):
        period = 1.0 / self.fps
        last = time.monotonic()
        while self.running:
            try:
                with self.lock:
                    requested = self._requested_segment
                if requested != self.controller.timeline.current_name:
                    self.controller.timeline.jump_to(requested)
                    self.controller.snap_to_targets()
                now = time.monotonic()
                dt = min(0.10, max(0.0, now - last))
                last = now
                # Timeline is paused in core; emotion segments are held rather than
                # running through the 103-second showcase automatically.
                self.controller.update(dt)
                self._send(build_frame(self.controller))
            except (SerialException, OSError) as exc:
                self.last_error = f"display: {exc}"
                self._close()
                time.sleep(1.0)
                if self.running:
                    try:
                        self._open()
                    except Exception as retry_exc:
                        self.last_error = f"display reconnect: {retry_exc}"
                        time.sleep(1.0)
            except Exception as exc:
                self.last_error = f"display: {exc}"
                time.sleep(0.2)
            time.sleep(max(0.0, period - (time.monotonic() - now)))

    def start(self):
        if self.running:
            return
        self.running = True
        try:
            self._open()
        except Exception as exc:
            self.last_error = str(exc)
            self.connected = False
        self.thread = threading.Thread(target=self._loop, name="elo-display", daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
        self._close()

    def snapshot(self):
        with self.lock:
            return {
                "connected": self.connected,
                "segment": self._requested_segment,
                "last_error": self.last_error,
            }
