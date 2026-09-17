from __future__ import annotations

import time
import threading

import numpy as np
import cv2

from picamera2 import Picamera2
from libcamera import controls


class CameraSource:
    def __init__(self, cfg):
        self.cfg = cfg
        self.camera = Picamera2()
        config = self.camera.create_video_configuration(
            main={"size": (cfg.camera_width, cfg.camera_height), "format": "RGB888"},
            buffer_count=4,
            queue=False,
            controls={"FrameRate": cfg.camera_fps},
        )
        self.camera.configure(config)
        self.camera.start()
        self.lock = threading.Lock()
        self.latest = None
        self._focus_lock()

    def _focus_lock(self):
        if self.cfg.focus_mode != "single_then_lock":
            return
        try:
            self.camera.set_controls({"AfMode": controls.AfModeEnum.Auto})
            job = self.camera.autofocus_cycle(wait=False)
            try:
                self.camera.wait(job)
            except Exception:
                time.sleep(self.cfg.focus_wait_s)
            md = self.camera.capture_metadata()
            lens = md.get("LensPosition")
            if lens is not None:
                self.camera.set_controls({"AfMode": controls.AfModeEnum.Manual, "LensPosition": float(lens)})
                return
        except Exception:
            # Some Arducam/Picamera2 combinations do not expose the AF state identically.
            # Leaving AF auto-triggered is safer than failing camera bring-up.
            try:
                self.camera.set_controls({"AfMode": controls.AfModeEnum.Auto})
            except Exception:
                pass

    def capture(self):
        frame = self.camera.capture_array("main")
        if frame is None:
            raise RuntimeError("Camera returned no frame")
        with self.lock:
            self.latest = frame
        return frame

    def close(self):
        try:
            self.camera.stop()
        finally:
            self.camera.close()
