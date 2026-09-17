from __future__ import annotations

from pathlib import Path
import lgpio


def open_pi_header_chip() -> int:
    """Open the GPIO chip backing the Pi 5 40-pin header; fallback for older boards."""
    candidates = []
    if Path('/dev/gpiochip4').exists():
        candidates.append(4)
    candidates.append(0)
    last = None
    for n in candidates:
        try:
            h = lgpio.gpiochip_open(n)
            if h >= 0:
                return h
        except Exception as exc:
            last = exc
    raise RuntimeError(f"Unable to open Pi GPIO chip (tried {candidates}): {last}")
