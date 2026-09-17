# ELO Face V3 / Experiment-3 — ESP-compatible build

This directory keeps the original Experiment-3 animation modules intact and
adds a thin Pi→ESP transport plus a matching ESP32-S3 raster renderer.

## Architecture

Raspberry Pi runs the existing `animation.py` + `timeline.py` state machine.
It sends compact state frames over the same UART:

`Pi GPIO14 TX -> ESP32 GPIO48 RX`
`Pi GPIO15 RX <- ESP32 GPIO47 TX`
`460800 baud`

The ESP32 locally rasterizes the two 800x480 eye shapes. It does **not** receive
full Pygame frames. The proven double-PSRAM-framebuffer + 20-line bounce-buffer
panel pipeline is retained.

## Run on Pi

```bash
cd ~/display_connection/experiment-3
python3 -m pip install -r requirements-esp.txt
python3 stream_experiment3.py
```

Useful tests:

```bash
python3 stream_experiment3.py --dry-run --duration 10
python3 stream_experiment3.py --start-at curious --duration 6
python3 stream_experiment3.py --start-at sleep --duration 10
```

## Flash ESP32-S3

Use `elo_face_experiment3.ino` instead of the older emotion firmware for this
experiment directory. The display/pin/UART configuration is retained from the
working firmware; only the face renderer/protocol interpretation is extended.

## Visual behavior preserved

The Pi uses the original Experiment-3 `FaceController`, including:

- 21-segment, ~103 second timeline
- 800x480 two-eye geometry
- circle↔pill morph via `open_amount`
- independent eye asymmetry
- smooth look offsets
- scale/breathing motion
- curious, confused, surprise, excited, happy bounce
- wink + playful double wink
- shy + cute blush
- thinking + suspicious + angry
- scared/nervous jitter
- sad, drowsy, sleep
- intro text state
- Pi-generated sleep Z particles

The only intentional renderer-side difference is font rasterization for intro
text and the RGB565 display's alpha approximation, because those are rendered
by Arduino_GFX on the ESP32 rather than Pygame.
