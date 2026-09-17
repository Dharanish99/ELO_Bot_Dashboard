# ELO Core — Raspberry Pi

This package is the Pi-side integration layer for the ELO demo.

## What `run_core.sh` starts

One Python process starts:

- Existing `elo_follow` camera + SSD-MobileNet detector
- Existing lightweight people tracker
- Existing tested FollowController + SearchController
- Existing MotionArbiter
- Existing TB6612 motor driver code
- Existing ultrasonic array
- Parent Dashboard API bridge (`:8090`)
- ELO Face V3 animation engine + ESP32 UART streamer
- Push-to-talk audio bridge to the existing AI backend WebSocket

The AI backend and Parent Dashboard remain separate applications. Core connects to them; it does not copy their servers into the Pi.

## Install

```bash
cd ~/elo_phase1_build
python3 -m pip install -r requirements.txt
```

Install your existing Pi camera / libcamera / GPIO prerequisites as already required by Phase 1.

Copy `.env.example` to `.env` or export the variables in the shell. The Core reads environment variables; it does not automatically load `.env`.

## Start

```bash
cd ~/elo_phase1_build
export BACKEND_WS_URL='ws://YOUR-BACKEND:8000/ws/robot'
export ROBOT_DEVICE_TOKEN='YOUR_TOKEN'
./run_core.sh
```

Core API:

```text
http://PI_IP:8090
```

## Parent Dashboard contract

- `GET /status`
- `GET /targets`
- `POST /target` body `{"target_id": 1}`
- `POST /mode` body `{"mode":"FOLLOW"}`
- `POST /mode` body `{"mode":"INTERACT"}`
- `POST /stop`
- `POST /interaction/start`
- `POST /audio/start`
- `POST /audio/stop`
- `GET /audio/status`

## Safety

- Startup = STOPPED.
- INTERACTING = motors OFF.
- STOP = motors OFF.
- Only MOVING/FOLLOW allows the existing MotionArbiter to request motion.
- Obstacle constraints remain inside the existing arbiter.
- AI/network/display failures never command motors.
- Display failure is non-fatal to movement.

## Emotion

The existing ELO Face V3 animation source is bundled under `elo_core/face`.
Semantic emotion is mapped to existing segments such as:

`happy -> happy_bounce`, `curious -> curious`, `thinking -> thinking`, `surprised -> surprise`, `sad -> sad`, `sleepy -> drowsy`.

The Pi streams the same `FRAME <seq> <JSON>` protocol at 460800 baud to `/dev/ttyAMA0`.

## Audio

The Pi uses the proven ALSA devices:

- Capture: `plughw:ELOAUDIO,0`
- Playback: `plughw:ELOAUDIO,1`

Push-to-talk is exposed through the Core API. The dashboard can call `/audio/start`, then `/audio/stop`.

## Important

This package intentionally does not contain your remote AI backend or remote Parent Dashboard source. Those remain their own repositories/services. Core is the Pi-side bridge between them and the tested local robot systems.
