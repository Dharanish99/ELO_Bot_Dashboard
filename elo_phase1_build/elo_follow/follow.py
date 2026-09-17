from __future__ import annotations

import math
import time


class FollowController:
    def __init__(self, cfg):
        self.cfg = cfg

    def compute(self, target, frame_w, frame_h):
        if not target:
            return (0.0, 0.0, "no-target")
        x1, y1, x2, y2 = target["bbox"]
        cx = (x1+x2)/2.0
        err = (cx - frame_w/2.0) / (frame_w/2.0)
        area = max(0.0, x2-x1) * max(0.0, y2-y1) / (frame_w*frame_h)

        # Close enough but off-center: rotate in place, never drive toward the person.
        if area >= self.cfg.stop_area_fraction:
            if abs(err) <= self.cfg.steering_deadband:
                return (0.0, 0.0, "hold-close")
            turn = min(self.cfg.turn_speed_percent, self.cfg.base_speed_percent) * min(1.0, abs(err)*1.5)
            return ((-turn, turn) if err < 0 else (turn, -turn)) + ("center-close",)

        # Farther than the hold zone: steer while driving.
        forward = self.cfg.base_speed_percent
        if area >= self.cfg.hold_area_fraction:
            forward *= 0.35
        steering = min(self.cfg.max_steering, self.cfg.steering_gain*err)
        left = forward * (1.0 - steering)
        right = forward * (1.0 + steering)
        left = max(-self.cfg.max_forward_percent, min(self.cfg.max_forward_percent, left))
        right = max(-self.cfg.max_forward_percent, min(self.cfg.max_forward_percent, right))
        return left, right, "follow"


class SearchController:
    def __init__(self, cfg):
        self.cfg = cfg
        self.active = False
        self.turns = 0
        self.direction = "left"
        self.started = 0.0
        self.last_target_seen = 0.0

    def begin(self, direction):
        if not self.active:
            self.active = True
            self.turns = 0
            self.direction = direction if direction in ("left", "right") else "left"
            self.started = time.monotonic()

    def update(self, reacquired):
        if reacquired:
            self.active = False
            self.turns = 0
            return (0.0, 0.0, False, "reacquired")
        if not self.active:
            return (0.0, 0.0, False, "inactive")
        elapsed = time.monotonic() - self.started
        turn_period = self.cfg.search_full_turn_s
        if elapsed >= turn_period:
            self.turns += 1
            self.started = time.monotonic()
            if self.turns >= self.cfg.search_max_turns:
                self.active = False
                return (0.0, 0.0, False, "search-exhausted")
        s = self.cfg.search_speed_percent
        return ((-s, s) if self.direction == "left" else (s, -s)) + (True, "search")
