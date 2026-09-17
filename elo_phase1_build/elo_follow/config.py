from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import tomllib

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config" / "config.toml"


def _env(name: str, default):
    raw = os.getenv(name)
    if raw is None:
        return default
    if isinstance(default, bool):
        return raw.strip().lower() in {"1", "true", "yes", "on"}
    if isinstance(default, int):
        return int(raw)
    if isinstance(default, float):
        return float(raw)
    return raw


@dataclass(frozen=True)
class Config:
    root: Path
    model_path: Path
    input_width: int
    input_height: int
    confidence_high: float
    confidence_low: float
    person_class_id: int
    inference_hz: float
    camera_width: int
    camera_height: int
    camera_fps: int
    jpeg_preview_hz: float
    focus_mode: str
    focus_wait_s: float
    max_tracks: int
    track_buffer_frames: int
    min_hits: int
    iou_gate: float
    center_gate_px: float
    size_ratio_gate: float
    appearance_gate: float
    appearance_weight: float
    motion_weight: float
    iou_weight: float
    hist_h_bins: int
    hist_s_bins: int
    hist_update_alpha: float
    selected_target_timeout_s: float
    reacquire_max_age_s: float
    search_speed_percent: float
    search_max_turns: int
    search_direction_hold_s: float
    search_full_turn_s: float
    base_speed_percent: float
    max_forward_percent: float
    turn_speed_percent: float
    stop_area_fraction: float
    hold_area_fraction: float
    steering_deadband: float
    steering_gain: float
    max_steering: float
    center_hold_timeout_s: float
    front_stop_cm: float
    front_caution_cm: float
    side_stop_cm: float
    side_caution_cm: float
    ultrasonic_cycle_ms: int
    sensor_timeout_ms: int
    avoid_turn_speed_percent: float
    avoid_min_turn_s: float
    avoid_max_turn_s: float
    avoid_recheck_s: float
    max_consecutive_avoid_steps: int
    prefer_target_direction_weight: float
    prefer_clearance_weight: float
    stby_gpio: int
    left_in1: int
    left_in2: int
    left_pwm: int
    right_in1: int
    right_in2: int
    right_pwm: int
    pwm_hz: int
    invert_left: bool
    invert_right: bool
    front_trigger: int
    front_echo: int
    left_trigger: int
    left_echo: int
    right_trigger: int
    right_echo: int
    speed_of_sound_cm_s: float
    dashboard_host: str
    dashboard_port: int
    follow_default_on: bool



def load_config(path: Path | None = None) -> Config:
    path = path or DEFAULT_CONFIG
    data = tomllib.loads(path.read_text())
    v = data["vision"]
    f = data["focus"]
    t = data["tracking"]
    tar = data["target"]
    fol = data["following"]
    o = data["obstacle"]
    m = data["motors"]
    u = data["ultrasonic"]
    d = data["dashboard"]
    model = Path(v["model_path"])
    if not model.is_absolute():
        model = path.parent.parent / model
    return Config(
        root=path.parent.parent,
        model_path=model,
        input_width=v["input_width"], input_height=v["input_height"],
        confidence_high=v["confidence_high"], confidence_low=v["confidence_low"],
        person_class_id=v["person_class_id"], inference_hz=v["inference_hz"],
        camera_width=v["camera_width"], camera_height=v["camera_height"], camera_fps=v["camera_fps"],
        jpeg_preview_hz=v["jpeg_preview_hz"], focus_mode=f["mode"], focus_wait_s=f["initial_wait_s"],
        max_tracks=t["max_tracks"], track_buffer_frames=t["track_buffer_frames"], min_hits=t["min_hits"],
        iou_gate=t["iou_gate"], center_gate_px=t["center_gate_px"], size_ratio_gate=t["size_ratio_gate"],
        appearance_gate=t["appearance_gate"], appearance_weight=t["appearance_weight"],
        motion_weight=t["motion_weight"], iou_weight=t["iou_weight"],
        hist_h_bins=t["hist_h_bins"], hist_s_bins=t["hist_s_bins"], hist_update_alpha=t["hist_update_alpha"],
        selected_target_timeout_s=tar["selected_target_timeout_s"], reacquire_max_age_s=tar["reacquire_max_age_s"],
        search_speed_percent=tar["search_speed_percent"], search_max_turns=tar["search_max_turns"],
        search_direction_hold_s=tar["search_direction_hold_s"], search_full_turn_s=tar["search_full_turn_s"],
        base_speed_percent=fol["base_speed_percent"], max_forward_percent=fol["max_forward_percent"],
        turn_speed_percent=fol["turn_speed_percent"], stop_area_fraction=fol["stop_area_fraction"],
        hold_area_fraction=fol["hold_area_fraction"], steering_deadband=fol["steering_deadband"],
        steering_gain=fol["steering_gain"], max_steering=fol["max_steering"], center_hold_timeout_s=fol["center_hold_timeout_s"],
        front_stop_cm=o["front_stop_cm"], front_caution_cm=o["front_caution_cm"],
        side_stop_cm=o["side_stop_cm"], side_caution_cm=o["side_caution_cm"],
        ultrasonic_cycle_ms=o["ultrasonic_cycle_ms"], sensor_timeout_ms=o["sensor_timeout_ms"],
        avoid_turn_speed_percent=o["avoid_turn_speed_percent"], avoid_min_turn_s=o["avoid_min_turn_s"],
        avoid_max_turn_s=o["avoid_max_turn_s"], avoid_recheck_s=o["avoid_recheck_s"],
        max_consecutive_avoid_steps=o["max_consecutive_avoid_steps"],
        prefer_target_direction_weight=o["prefer_target_direction_weight"],
        prefer_clearance_weight=o["prefer_clearance_weight"],
        stby_gpio=m["stby_gpio"], left_in1=m["left_in1"], left_in2=m["left_in2"], left_pwm=m["left_pwm"],
        right_in1=m["right_in1"], right_in2=m["right_in2"], right_pwm=m["right_pwm"], pwm_hz=m["pwm_hz"],
        invert_left=m["invert_left"], invert_right=m["invert_right"],
        front_trigger=u["front_trigger"], front_echo=u["front_echo"],
        left_trigger=u["left_trigger"], left_echo=u["left_echo"],
        right_trigger=u["right_trigger"], right_echo=u["right_echo"],
        speed_of_sound_cm_s=u["speed_of_sound_cm_s"],
        dashboard_host=d["host"], dashboard_port=d["port"], follow_default_on=d["follow_default_on"],
    )
