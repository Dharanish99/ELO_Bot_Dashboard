#!/usr/bin/env python3
"""ELO Face V3 -> ESP32-S3 streamer.

Keeps the original Experiment-3 animation/controller logic intact and changes
only the transport: the Raspberry Pi computes the same eye state and effects,
then sends compact state frames to the ESP32 over UART. The ESP32 rasterizes
those states locally, so no pygame framebuffer is streamed.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

try:
    import serial
    from serial import SerialException
except ImportError as exc:  # pragma: no cover
    raise SystemExit("pyserial is required. Run: python3 -m pip install -r requirements.txt") from exc

from animation import FaceController
from timeline import TimelineController
from eye import EyePair
from config import TARGET_FPS, WINDOW_WIDTH, WINDOW_HEIGHT

DEFAULT_PORT = "/dev/ttyAMA0"
DEFAULT_BAUD = 460800
DEFAULT_FPS = 30.0
ACK_TIMEOUT = 1.0


def _round(v: float, digits: int = 3) -> float:
    return round(float(v), digits)


def _particle_payload(controller: FaceController) -> list[list[float]]:
    # Preserve the original Pi-generated sleep particle motion. Only a very
    # small active pool is expected at any given time.
    out: list[list[float]] = []
    for p in controller.sleep_particles.particles[:8]:
        out.append([_round(p.x), _round(p.y), int(p.size), int(p.alpha)])
    return out


def build_frame(controller: FaceController) -> dict[str, Any]:
    l = controller.eye_pair.left_eye
    r = controller.eye_pair.right_eye
    intro = controller.intro_state
    timeline = controller.timeline

    frame: dict[str, Any] = {
        "v": 3,
        "seg": timeline.current_name,
        "p": _round(timeline.progress, 4),
        # [open, look_x_px, look_y_px, scale]
        "l": [_round(l.open_amount), _round(l.look_x), _round(l.look_y), _round(l.scale)],
        "r": [_round(r.open_amount), _round(r.look_x), _round(r.look_y), _round(r.scale)],
        "fa": _round(controller.face_alpha, 3),
        "b": int(max(0, min(255, round(controller.blush_state.alpha)))),
    }

    if timeline.current_name == "intro":
        frame["i"] = {
            "t": intro.text_to_show,
            "a": _round(intro.text_alpha, 3),
            "c": 1 if intro.show_cursor else 0,
        }
    elif intro.text_to_show:
        frame["i"] = {"t": intro.text_to_show, "a": _round(intro.text_alpha, 3), "c": 0}

    particles = _particle_payload(controller)
    if particles:
        frame["z"] = particles

    return frame


def open_serial(port: str, baud: int) -> serial.Serial:
    try:
        ser = serial.Serial(port=port, baudrate=baud, timeout=ACK_TIMEOUT, write_timeout=ACK_TIMEOUT)
    except SerialException as exc:
        raise SystemExit(f"Could not open {port}: {exc}") from exc
    # Give USB/UART stacks a moment to settle without resetting the ESP on
    # every frame. The existing ESP firmware uses the same UART and baud.
    time.sleep(0.20)
    ser.reset_input_buffer()
    ser.reset_output_buffer()
    return ser


def wait_ack(ser: serial.Serial, seq: int) -> bool:
    deadline = time.monotonic() + ACK_TIMEOUT
    expected = f"ACK {seq}"
    while time.monotonic() < deadline:
        line = ser.readline().decode("utf-8", errors="ignore").strip()
        if not line:
            continue
        if line.startswith(expected):
            return True
        if line.startswith(f"NACK {seq}"):
            print(f"[ESP] {line}", file=sys.stderr)
            return False
        # Ignore startup/status chatter so reconnecting does not break stream.
    return False


def main() -> int:
    ap = argparse.ArgumentParser(description="Stream ELO Experiment-3 animation state to ESP32-S3")
    ap.add_argument("--port", default=DEFAULT_PORT)
    ap.add_argument("--baud", type=int, default=DEFAULT_BAUD)
    ap.add_argument("--fps", type=float, default=DEFAULT_FPS)
    ap.add_argument("--duration", type=float, default=None, help="Stop after N seconds")
    ap.add_argument("--start-at", default=None, help="Start at a timeline segment")
    ap.add_argument("--dry-run", action="store_true", help="Run animation logic without opening UART")
    args = ap.parse_args()

    eye_pair = EyePair()
    controller = FaceController(eye_pair=eye_pair, timeline=TimelineController())

    if args.start_at:
        controller.timeline.jump_to(args.start_at)
        print(f"[ELO] starting at {args.start_at}")

    ser = None
    if not args.dry_run:
        ser = open_serial(args.port, args.baud)
        print(f"[ELO] UART {args.port} @ {args.baud}")

    frame_period = 1.0 / max(1.0, args.fps)
    seq = 0
    start = time.monotonic()
    last = start
    next_tick = start
    last_seg = None

    print(f"[ELO] {WINDOW_WIDTH}x{WINDOW_HEIGHT} | target {args.fps:.1f} FPS | loop {controller.timeline.total_duration:.1f}s")
    print("[ELO] Press Ctrl+C to stop")

    try:
        while True:
            now = time.monotonic()
            if args.duration is not None and now - start >= args.duration:
                break

            # Real elapsed time keeps animation pacing correct even if an ACK
            # takes longer than the nominal frame period.
            dt = min(now - last, 0.10)
            last = now
            if dt <= 0:
                dt = frame_period

            controller.update(dt)
            frame = build_frame(controller)

            if frame["seg"] != last_seg:
                last_seg = frame["seg"]
                print(f"[ELO] -> {last_seg}")

            if args.dry_run:
                if seq % max(1, int(args.fps)) == 0:
                    print(json.dumps(frame, separators=(",", ":")))
            else:
                payload = json.dumps(frame, separators=(",", ":"), ensure_ascii=True)
                line = f"FRAME {seq} {payload}\n".encode("utf-8")
                assert ser is not None
                try:
                    ser.write(line)
                    ser.flush()
                except SerialException as exc:
                    raise SystemExit(f"UART write failed at frame {seq}: {exc}") from exc
                if not wait_ack(ser, seq):
                    print(f"[WARN] no ACK for frame {seq}; continuing", file=sys.stderr)

            seq = (seq + 1) & 0xFFFFFFFF
            next_tick += frame_period
            sleep_for = next_tick - time.monotonic()
            if sleep_for > 0:
                time.sleep(sleep_for)
            else:
                # If the ESP is busy, re-anchor to avoid accumulating delay.
                next_tick = time.monotonic()

    except KeyboardInterrupt:
        print("\n[ELO] stopped")
    finally:
        if ser is not None:
            ser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
