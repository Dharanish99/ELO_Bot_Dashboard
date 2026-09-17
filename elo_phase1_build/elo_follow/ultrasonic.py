from __future__ import annotations

import threading
import time

import lgpio

from .gpio import open_pi_header_chip


class UltrasonicArray:
    """Sequential HC-SR04 reader using lgpio edge callbacks with kernel timestamps."""

    def __init__(self, cfg):
        self.cfg = cfg
        self.h = open_pi_header_chip()
        self.sensors = {
            "front": (cfg.front_trigger, cfg.front_echo),
            "left": (cfg.left_trigger, cfg.left_echo),
            "right": (cfg.right_trigger, cfg.right_echo),
        }
        self.events = {}
        self.callbacks = {}
        self.edge_state = {}
        self.lock = threading.Lock()
        self.dist = {k: None for k in self.sensors}
        self.ts = {k: 0.0 for k in self.sensors}
        for name, (trig, echo) in self.sensors.items():
            lgpio.gpio_claim_output(self.h, trig, 0)
            lgpio.gpio_claim_alert(self.h, echo, lgpio.BOTH_EDGES, lgpio.SET_PULL_DOWN)
            self.events[name] = threading.Event()
            self.edge_state[name] = {"rise": None, "fall": None}
            self.callbacks[name] = lgpio.callback(self.h, echo, lgpio.BOTH_EDGES, self._edge_callback)
        self.running = False
        self.thread = None

    def _edge_callback(self, chip, gpio, level, timestamp):
        name = None
        for n, (_, echo) in self.sensors.items():
            if echo == gpio:
                name = n
                break
        if name is None:
            return
        with self.lock:
            if level == 1:
                self.edge_state[name]["rise"] = timestamp
            elif level == 0 and self.edge_state[name]["rise"] is not None:
                self.edge_state[name]["fall"] = timestamp
                self.events[name].set()

    def _read_one(self, name):
        trig, _ = self.sensors[name]
        evt = self.events[name]
        with self.lock:
            self.edge_state[name]["rise"] = None
            self.edge_state[name]["fall"] = None
            evt.clear()
        lgpio.gpio_write(self.h, trig, 0)
        time.sleep(0.000002)
        lgpio.gpio_write(self.h, trig, 1)
        time.sleep(0.000012)
        lgpio.gpio_write(self.h, trig, 0)
        if not evt.wait(self.cfg.sensor_timeout_ms / 1000.0):
            return None
        with self.lock:
            rise = self.edge_state[name]["rise"]
            fall = self.edge_state[name]["fall"]
        if rise is None or fall is None or fall <= rise:
            return None
        width_s = (fall-rise) / 1e9
        distance = width_s * self.cfg.speed_of_sound_cm_s / 2.0
        if 2.0 <= distance <= 500.0:
            return distance
        return None

    def measure_once(self):
        for name in self.sensors:
            d = self._read_one(name)
            if d is not None:
                with self.lock:
                    self.dist[name] = d
                    self.ts[name] = time.monotonic()

    def run(self):
        period = self.cfg.ultrasonic_cycle_ms / 1000.0
        next_t = time.monotonic()
        while self.running:
            self.measure_once()
            next_t += period
            time.sleep(max(0.0, next_t-time.monotonic()))

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self.run, name="ultrasonic", daemon=True)
        self.thread.start()

    def snapshot(self):
        now = time.monotonic()
        with self.lock:
            return {
                k: (v if v is not None and now-self.ts[k] < 0.30 else None)
                for k, v in self.dist.items()
            }

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
        for cb in self.callbacks.values():
            try:
                cb.cancel()
            except Exception:
                pass
        for trig, echo in self.sensors.values():
            try:
                lgpio.gpio_free(self.h, echo)
                lgpio.gpio_free(self.h, trig)
            except Exception:
                pass
        lgpio.gpiochip_close(self.h)
