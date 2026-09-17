# ELO Phase 1 — Final Human Following + Obstacle Avoidance

This package is the Phase 1 implementation for ELO's locked Pi-5 architecture.

## What is included

- Pi 5 / 1 GB friendly Python runtime
- Picamera2/CSI camera capture
- Arducam OV5647 B0176 single-shot AF → focus-lock
- Quantized SSD-MobileNet V1 TFLite person detector
- Lightweight ByteTrack-inspired multi-person tracker
- IoU + motion + HSV appearance identity association
- Explicit Select-to-Follow target locking
- Local Pi web dashboard on port 8080
- Follow ON/OFF control
- Moving / Interacting control
- 360° target-loss recovery, up to 2 searches
- Three HC-SR04 sequential ultrasonic readers
- lgpio edge-timestamp Echo capture
- Single motion arbiter for following + obstacle avoidance
- TB6612FNG motor control using your locked GPIO map
- Bench-test scripts
- systemd service installer
- Model downloader
- Hardware wiring and research notes

## Final runtime behaviour

The robot starts with:

- Moving = OFF
- Follow = OFF
- Motors = OFF

Open the dashboard:

`http://<PI-IP>:8080/`

Then:

1. Wait for person tracks to appear.
2. Click **Select** on the person you want.
3. Click **FOLLOW**.
4. Click **MOVING**.

The selected ID is persistent. The system never falls back to largest-person following.

## ID stability

The tracker uses more than raw centroid matching. It combines:

- predicted motion
- bounding-box overlap
- center distance
- bounding-box size consistency
- a compact HSV appearance histogram
- conservative gating
- runner-up separation

This is intentionally lightweight. It reduces ID switches but cannot mathematically guarantee identity through a long, complete occlusion between visually similar people without a dedicated Re-ID model.

## Target loss

The selected target can disappear briefly. ELO searches in the direction where the target last exited the frame. It performs a maximum of two slow 360-degree scans. During both scans, ultrasonic safety remains active. If the target cannot be reacquired, motors stop.

## Performance target

Vision target: **10–15 inference FPS**, not 30 FPS.

The ultrasonic/safety controller is independent of the detector rate. The motor command is produced by the motion arbiter, so camera inference is never allowed to directly block safety logic.

## Install on Pi 5

Recommended platform: Raspberry Pi OS 64-bit, current supported release, with the Picamera2/libcamera stack.

```bash
cd ~/elo-phase1
chmod +x setup_pi.sh download_model.sh
./setup_pi.sh
```

Then verify:

```bash
source .venv/bin/activate
python tools/verify_setup.py
```

Camera check:

```bash
rpicam-hello -t 3000
```

Motor test (robot wheels raised):

```bash
sudo -E .venv/bin/python tools/test_motors.py
```

Ultrasonic test:

```bash
sudo -E .venv/bin/python tools/test_ultrasonic.py
```

Detector benchmark:

```bash
sudo -E .venv/bin/python tools/benchmark.py
```

Run manually:

```bash
sudo -E .venv/bin/python -m elo_follow.main
```

Optional systemd service:

```bash
./install_service.sh
```

## Camera focus setup

For the Arducam B0176 on Pi 5, use the Arducam OV5647 VCM overlay if the camera is not already recognized by your existing benchmark setup. Do not blindly modify a working camera configuration.

Arducam's current Pi 5 guidance uses `/boot/firmware/config.txt`, `camera_auto_detect=0`, and `dtoverlay=ov5647,vcm` for this motorized-focus OV5647 camera.

https://docs.arducam.com/Raspberry-Pi-Camera/Motorized-Focus-Camera/Quick-Start-Guide/OV5647-Motorized-Focus-Camera/

This application itself does one-shot autofocus at startup and then locks the lens position.

## Important hardware safety

### TB6612

You currently have only one TB6612FNG. The software supports the locked topology:

- Channel A = left motor pair in parallel
- Channel B = right motor pair in parallel

This is the project's current physical constraint, not the electrically ideal final driver configuration. Measure motor current and driver temperature before sustained autonomous operation.

### Ultrasonic Echo

Every HC-SR04-style Echo line must be reduced to a safe 3.3 V GPIO level. Do not connect a 5 V Echo signal directly to the Pi.

### Power

Pi 5:

- supplied separately through the suitable USB-C power bank.

Motor/sensor/display electronics:

- 3S battery for motor VM.
- 5 V buck for TB6612 logic VCC, ultrasonic modules, and display power as already designed.
- common ground between systems.

## What is NOT in this package

- Parent/cloud dashboard
- LLM / STT / TTS
- display firmware
- ESP32-S3 firmware
- face recognition
- heavy Re-ID model
- SLAM/navigation

This package is only the locked Phase 1 locomotion subsystem.


## Current handoff / tested hardware state

See `docs/HANDOFF_PHASE1.md` for the exact architecture, debugging history, known issues, and remaining acceptance gates.

Current verified on the working Pi:

- Picamera2 camera capture works.
- `lgpio`, Picamera2, OpenCV 4.10.0 and LiteRT import successfully.
- 3 ultrasonic sensors return real distance readings.
- Motor GPIO works after moving STBY to GPIO21 and inverting the left motor pair.
- Raw SSD-MobileNet inference benchmark: 44.3 ms average / 22.6 FPS equivalent.

The immediate remaining gate is **person-detection correctness**. The model currently exposes standard SSD outputs, and this package sets `person_class_id = 0` based on the observed raw output. Re-run `tools/test_detection.py` and confirm real person boxes before testing the tracker or driving the robot.
