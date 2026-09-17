from __future__ import annotations

import threading
import time


class SharedState:
    def __init__(self):
        self.lock = threading.RLock()
        self.moving = False
        self.mode = "STOPPED"
        self.audio_status = "OFF"
        self.backend_connected = False
        self.started_at = time.time()
        self.follow_enabled = False
        self.selected_id = None
        self.requested_selected_id = None
        self.tracks = []
        self.last_target = None
        self.target_last_seen = 0.0
        self.target_last_side = "center"
        self.search_count = 0
        self.search_active = False
        self.avoid_active = False
        self.obstacles = {"front": None, "left": None, "right": None}
        self.command = (0.0, 0.0)
        self.reason = "startup"
        self.preview_jpeg = None
        self.vision_fps = 0.0
        self.tflite_ms = 0.0
        self.last_error = ""

    def snapshot(self):
        with self.lock:
            return {
                "moving": self.moving,
                "mode": self.mode,
                "audio_status": self.audio_status,
                "backend_connected": self.backend_connected,
                "follow_enabled": self.follow_enabled,
                "selected_id": self.selected_id,
                "requested_selected_id": self.requested_selected_id,
                "tracks": list(self.tracks),
                "target_last_seen": self.target_last_seen,
                "target_last_side": self.target_last_side,
                "search_count": self.search_count,
                "search_active": self.search_active,
                "avoid_active": self.avoid_active,
                "obstacles": dict(self.obstacles),
                "command": self.command,
                "reason": self.reason,
                "vision_fps": self.vision_fps,
                "tflite_ms": self.tflite_ms,
                "last_error": self.last_error,
                "selected_track_alive": any(t["id"] == self.selected_id and t.get("misses", 0) == 0 for t in self.tracks) if self.selected_id else False,
            }
