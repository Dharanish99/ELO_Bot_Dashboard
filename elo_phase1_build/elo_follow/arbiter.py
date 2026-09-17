from __future__ import annotations

import time


class MotionArbiter:
    def __init__(self, cfg, state, motors, follow, search):
        self.cfg = cfg
        self.state = state
        self.motors = motors
        self.follow = follow
        self.search = search
        self.last_tick = time.monotonic()
        self.avoid_steps = 0
        self.avoid_until = 0.0
        self.avoid_direction = None

    def _choose_avoid_direction(self, obs, target_side):
        left = obs.get("left")
        right = obs.get("right")
        left_clear = left is not None and left > self.cfg.side_caution_cm
        right_clear = right is not None and right > self.cfg.side_caution_cm
        if not left_clear and not right_clear:
            return None
        if left_clear and not right_clear:
            return "left"
        if right_clear and not left_clear:
            return "right"
        # Both are open: blend target-side preference and clearance.
        lf = min(left or 0, 200.0) / 200.0
        rf = min(right or 0, 200.0) / 200.0
        target_bonus_left = 1.0 if target_side == "left" else 0.0
        target_bonus_right = 1.0 if target_side == "right" else 0.0
        score_l = self.cfg.prefer_clearance_weight*lf + self.cfg.prefer_target_direction_weight*target_bonus_left
        score_r = self.cfg.prefer_clearance_weight*rf + self.cfg.prefer_target_direction_weight*target_bonus_right
        return "left" if score_l >= score_r else "right"

    def _obstacle_override(self, obs, target_side):
        now = time.monotonic()
        front = obs.get("front")
        left = obs.get("left")
        right = obs.get("right")

        if self.avoid_until > now and self.avoid_direction:
            s = self.cfg.avoid_turn_speed_percent
            return ((-s, s) if self.avoid_direction == "left" else (s, -s), "avoid-turn")

        front_blocked = front is not None and front < self.cfg.front_stop_cm
        left_blocked = left is not None and left < self.cfg.side_stop_cm
        right_blocked = right is not None and right < self.cfg.side_stop_cm

        if front_blocked:
            direction = self._choose_avoid_direction(obs, target_side)
            if direction is None:
                self.avoid_direction = None
                return ((0.0, 0.0), "obstacle-stop")
            self.avoid_direction = direction
            self.avoid_steps += 1
            if self.avoid_steps > self.cfg.max_consecutive_avoid_steps:
                self.avoid_direction = None
                self.avoid_steps = 0
                return ((0.0, 0.0), "avoid-limit-stop")
            self.avoid_until = now + self.cfg.avoid_min_turn_s
            s = self.cfg.avoid_turn_speed_percent
            return (((-s, s) if direction == "left" else (s, -s)), "avoid-start")

        # Side sensors act as soft walls while moving forward.
        if left_blocked and not right_blocked:
            self.avoid_steps = 0
            return ((self.cfg.base_speed_percent, self.cfg.base_speed_percent*0.55), "side-left")
        if right_blocked and not left_blocked:
            self.avoid_steps = 0
            return ((self.cfg.base_speed_percent*0.55, self.cfg.base_speed_percent), "side-right")
        self.avoid_steps = 0
        return (None, None)

    def tick(self, target, frame_w, frame_h):
        with self.state.lock:
            moving = self.state.moving
            follow_enabled = self.state.follow_enabled
            selected_id = self.state.selected_id
            tracks = list(self.state.tracks)
            target_side = self.state.target_last_side

        if not moving:
            self.search.active = False
            self.motors.stop()
            return

        if not follow_enabled or selected_id is None:
            self.motors.stop()
            with self.state.lock:
                self.state.reason = "follow-off-or-no-selection"
                self.state.command = (0.0, 0.0)
            return

        target = next((t for t in tracks if t["id"] == selected_id and t.get("misses", 0) == 0), None)
        if target:
            with self.state.lock:
                self.state.target_last_seen = time.monotonic()
                self.state.target_last_side = target.get("last_side", target_side)
            self.search.active = False
            desired = self.follow.compute(target, frame_w, frame_h)
            desired_lr = desired[:2]
            reason = desired[2]
        else:
            now = time.monotonic()
            with self.state.lock:
                last_seen = self.state.target_last_seen
                last_side = self.state.target_last_side
            if last_seen <= 0 or now-last_seen > self.cfg.reacquire_max_age_s:
                self.motors.stop()
                with self.state.lock:
                    self.state.reason = "target-timeout"
                    self.state.command = (0.0, 0.0)
                return
            self.search.begin(last_side)
            desired_lr = self.search.update(False)[:2]
            reason = "search"

        obs = self.state.obstacles
        override, override_reason = self._obstacle_override(obs, target_side)
        if override is not None:
            final = override
            reason = override_reason
        else:
            final = desired_lr

        self.motors.set(*final)
        with self.state.lock:
            self.state.command = tuple(round(x, 2) for x in final)
            self.state.reason = reason
            self.state.search_active = self.search.active
            self.state.avoid_active = self.avoid_until > time.monotonic()
            self.state.search_count = self.search.turns
