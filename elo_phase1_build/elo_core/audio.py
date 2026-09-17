from __future__ import annotations
import asyncio
import json
import os
import subprocess
import tempfile
import threading
import time
import uuid
from pathlib import Path

try:
    import websockets
except Exception:
    websockets = None


class AudioInteraction:
    """Push-to-talk audio bridge: ALSA WAV -> existing /ws/robot -> ALSA playback."""
    def __init__(self, cfg, state, display):
        self.cfg = cfg
        self.state = state
        self.display = display
        self.record_proc = None
        self.record_path = None
        self.lock = threading.RLock()
        self.session_id = None
        self.request_id = None
        self.last_error = ""
        self.last_user_text = ""
        self.last_reply = ""
        self.last_emotion = "neutral"
        self.processing = False

    def start_session(self):
        with self.lock:
            if not self.session_id:
                self.session_id = str(uuid.uuid4())
            self.last_error = ""
            self.last_user_text = ""
            self.last_reply = ""
            self.last_emotion = "neutral"
            self.state.audio_status = "LISTENING"
            self.display.set_segment("settle")
            return self.session_id

    def end_session(self):
        with self.lock:
            self.session_id = None
            self.request_id = None
            if self.record_proc:
                self._stop_record_locked()
            self.state.audio_status = "OFF"
            self.processing = False

    def _start_record_locked(self):
        if self.record_proc:
            return
        fd, path = tempfile.mkstemp(prefix="elo_input_", suffix=".wav")
        os.close(fd)
        self.record_path = Path(path)
        cmd = [
            "arecord", "-q", "-D", self.cfg.audio_capture_device,
            "-f", "S16_LE", "-c", str(self.cfg.audio_channels),
            "-r", str(self.cfg.audio_sample_rate), "-t", "wav", str(self.record_path),
        ]
        self.record_proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        self.state.audio_status = "LISTENING"
        self.display.set_segment("settle")

    def start_recording(self):
        with self.lock:
            if not self.session_id:
                self.start_session()
            self._start_record_locked()
            return True

    def _stop_record_locked(self):
        proc = self.record_proc
        self.record_proc = None
        if not proc:
            return
        try:
            proc.terminate()
            proc.wait(timeout=1.5)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
        self.state.audio_status = "THINKING"
        self.display.set_segment("thinking")

    def stop_recording(self):
        with self.lock:
            if not self.record_proc:
                return {"ok": False, "error": "not_recording"}
            self._stop_record_locked()
            path = self.record_path
            self.record_path = None
            if not path or not path.exists() or path.stat().st_size < 100:
                self.last_error = "recording empty"
                self.state.audio_status = "LISTENING"
                return {"ok": False, "error": self.last_error}
            self.processing = True
        threading.Thread(target=self._process_file, args=(path,), name="elo-audio-request", daemon=True).start()
        return {"ok": True, "status": "processing"}

    def _process_file(self, path: Path):
        try:
            result = asyncio.run(self._send_to_backend(path))
            with self.lock:
                self.last_user_text = result.get("user_text", "")
                self.last_reply = result.get("text", "")
                self.last_emotion = result.get("emotion", "neutral")
                self.last_error = result.get("error", "")
                if result.get("emotion"):
                    self.display.set_emotion(result["emotion"])
                audio = result.get("audio")
                self.state.audio_status = "SPEAKING" if audio else "LISTENING"
            if audio:
                self._play(audio)
                with self.lock:
                    self.state.audio_status = "LISTENING"
        except Exception as exc:
            with self.lock:
                self.last_error = f"audio: {exc}"
                self.state.audio_status = "LISTENING"
        finally:
            try:
                path.unlink(missing_ok=True)
            except Exception:
                pass
            with self.lock:
                self.processing = False

    async def _send_to_backend(self, path: Path):
        if websockets is None:
            raise RuntimeError("websockets package is required")
        if not self.cfg.robot_device_token:
            raise RuntimeError("ROBOT_DEVICE_TOKEN is not configured")
        if not self.session_id:
            self.session_id = str(uuid.uuid4())
        self.request_id = str(uuid.uuid4())
        uri = self.cfg.backend_ws_url
        sep = "&" if "?" in uri else "?"
        uri = f"{uri}{sep}token={self.cfg.robot_device_token}"
        async with websockets.connect(uri, open_timeout=self.cfg.backend_timeout_s, close_timeout=2, max_size=None) as ws:
            await ws.send(json.dumps({
                "type": "audio_start",
                "session_id": self.session_id,
                "request_id": self.request_id,
            }))
            data = path.read_bytes()
            chunk = 32 * 1024
            for i in range(0, len(data), chunk):
                await ws.send(data[i:i+chunk])
            await ws.send(json.dumps({
                "type": "audio_end",
                "session_id": self.session_id,
                "request_id": self.request_id,
            }))
            text = ""
            emotion = "neutral"
            audio_parts = []
            while True:
                msg = await asyncio.wait_for(ws.recv(), timeout=self.cfg.backend_timeout_s)
                if isinstance(msg, bytes):
                    audio_parts.append(msg)
                    continue
                obj = json.loads(msg)
                typ = obj.get("type")
                if typ == "response_start":
                    text = obj.get("text", "")
                    emotion = obj.get("emotion", "neutral")
                elif typ == "response_end":
                    break
            return {"user_text": "", "text": text, "emotion": emotion, "audio": b"".join(audio_parts)}

    def _play(self, audio: bytes):
        fd, path = tempfile.mkstemp(prefix="elo_response_", suffix=".wav")
        os.close(fd)
        p = Path(path)
        try:
            p.write_bytes(audio)
            subprocess.run(["aplay", "-q", "-D", self.cfg.audio_playback_device, str(p)], check=True, timeout=self.cfg.backend_timeout_s)
        finally:
            p.unlink(missing_ok=True)

    def snapshot(self):
        with self.lock:
            return {
                "status": self.state.audio_status,
                "processing": self.processing,
                "session_id": self.session_id,
                "last_user_text": self.last_user_text,
                "last_reply": self.last_reply,
                "last_emotion": self.last_emotion,
                "last_error": self.last_error,
            }
