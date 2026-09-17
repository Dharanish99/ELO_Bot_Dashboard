# ELO Phase 1 Handoff — Final Locked Architecture / Current Bring-up State

## 1. Purpose

This document is the continuation handoff for ELO's final Phase 1 human-following + obstacle-avoidance subsystem on the Raspberry Pi 5 (1 GB RAM).

The package in this ZIP is the current code baseline. Hardware decisions below are locked unless a real bench result forces a change.

---

## 2. Locked hardware architecture

### Compute

- Raspberry Pi 5, confirmed 1 GB RAM.
- This Pi is the only compute/controller for the locomotion subsystem.
- The separate ESP32-S3 remains dedicated to the 800x480 display and is OFF-LIMITS to this subsystem.
- Display UART is reserved:
  - Pi GPIO14 TX
  - Pi GPIO15 RX
  - `/dev/ttyAMA0`
  - 460800 baud, 8N1

### Camera

- Arducam OV5647 5 MP motorized autofocus camera, CSI connected.
- Current strategy: single autofocus at startup, then focus lock.
- Camera capture baseline verified through Picamera2/libcamera.
- Actual camera stream observed by libcamera at 640x480 in the benchmark.

### Motors / driver

- 4 x 12 V geared BO DC motors.
- 2 logical drive channels:
  - left pair in parallel
  - right pair in parallel
- One TB6612FNG is the current physical constraint.
- TB6612 logical mapping:
  - channel A -> left motor pair
  - channel B -> right motor pair
- This is not the electrically ideal final power stage; sustained current and driver temperature still require measurement.

### Power

- 3S Li-ion pack (12.6 V nominal full-charge maximum class; the previously stated 12.7 V figure corresponds to a 3S pack, not 2S).
- Motor VM is taken from the 3S battery.
- TB6612 logic VCC is 5 V from the existing buck converter.
- Ultrasonic modules use 5 V as already wired.
- Display power uses the existing 5 V path.
- Raspberry Pi 5 is powered separately by a suitable USB-C power bank.
- Grounds must remain common where GPIO signals cross subsystem boundaries.

### Ultrasonic sensors

Three classic HC-SR04-style modules.

Physical layout is fixed and must not be redesigned:

- front-facing sensor
- left-facing sensor at roughly 90 degrees to front
- right-facing sensor at roughly 90 degrees to front

This is NOT a forward-left-forward-right angled array. The sensors are effectively North / West / East.

Every HC-SR04 Echo line must be reduced to a Pi-safe 3.3 V level before entering GPIO.

### Final Pi GPIO map

| Function | BCM GPIO | Physical pin |
|---|---:|---:|
| TB6612 STBY | GPIO21 | 40 |
| Left IN1 | GPIO17 | 11 |
| Left IN2 | GPIO27 | 13 |
| Left PWM | GPIO22 | 15 |
| Right IN1 | GPIO23 | 16 |
| Right IN2 | GPIO24 | 18 |
| Right PWM | GPIO25 | 22 |
| Front TRIG | GPIO5 | 29 |
| Front ECHO | GPIO6 | 31 |
| Left TRIG | GPIO12 | 32 |
| Left ECHO | GPIO13 | 33 |
| Right TRIG | GPIO16 | 36 |
| Right ECHO | GPIO26 | 37 |
| Display TX | GPIO14 | 8 |
| Display RX | GPIO15 | 10 |

GPIO4 is deliberately NOT used for motor standby because the Pi currently owns it through a `onewire@0` overlay.

---

## 3. Software architecture

The motor GPIO is owned only by the motion/safety layer.

Vision does NOT directly write motor GPIO.

The architecture is:

Camera -> SSD-MobileNet V1 -> lightweight multi-person tracker -> selected logical target -> follow controller -> Motion Arbiter -> TB6612

Ultrasonics -> safety constraints -> Motion Arbiter

State gate -> Motion Arbiter

The Motion Arbiter produces the only final left/right motor command.

Priority order:

1. Emergency/safety constraint
2. Moving/Interacting state gate
3. Obstacle restriction
4. Human-following objective

If state becomes unknown/stale, the safe behaviour is motor stop.

---

## 4. Target selection architecture

The final system is Select-to-Follow from the start.

There is NO largest-person fallback in the intended Phase 1 behaviour.

The local Pi dashboard is the controller UI. There is no parent/cloud dashboard in this subsystem.

Flow:

1. Detector finds all people.
2. Tracker gives each live track a persistent ID.
3. Dashboard shows the current track IDs.
4. Operator clicks Select on a specific track.
5. That logical track becomes the selected target.
6. Following is enabled separately.
7. MOVING is enabled separately.
8. The follower follows only the selected identity.
9. It must not silently switch to a larger/nearer person.

Dashboard already contains target cards and `/api/select`; the cards were not visible during the first evaluation because the detector returned zero person detections.

---

## 5. Tracking / ID logic

The tracker is intentionally lightweight for the 1 GB Pi.

It combines:

- bounding-box IoU
- predicted motion / constant velocity
- center-distance gating
- box-size consistency
- compact HSV appearance histogram
- high-confidence association first
- lower-confidence recovery
- conservative gates
- selected-target reacquisition with runner-up separation

No neural Re-ID model is used.

Selected ID is conceptually separate from raw tracker IDs. A temporary track disappearance may be remapped only when the candidate is sufficiently consistent with the selected target's motion, position, size and appearance. Otherwise the system continues searching rather than switching.

Long complete occlusions between visually similar people cannot be mathematically guaranteed without a real Re-ID model; this is an engineering limitation, not a code defect.

---

## 6. Target-loss behaviour

When the selected target is temporarily lost:

- remember last target side / direction of exit
- search in that direction first
- perform a slow 360-degree search
- allow at most 2 search turns
- ultrasonic safety remains active during search
- if still not reacquired after the allowed searches, stop

No endless roaming.

Another detected person does NOT automatically become the target.

---

## 7. Following behaviour

Person horizontal offset and bounding-box area are treated separately.

Examples:

- target centered + too far -> move forward
- target centered + correct distance -> hold
- target off-center + distance acceptable -> rotate in place
- target off-center + too far -> forward motion with steering differential
- target close + off-center -> rotate without advancing

Initial speed is fixed/capped for Phase 1. More sophisticated dynamic speed control is deferred.

Vision target rate is intentionally 10–15 FPS, NOT 30 FPS.

The raw TFLite benchmark on this Pi measured:

- average invoke: 44.3 ms
- equivalent inference FPS: 22.6
- P50: 44.1 ms
- P95: 44.2 ms

The system should cap/use roughly 10–15 inference updates so the Pi retains headroom for camera I/O, dashboard, tracking, GPIO and other ELO jobs.

---

## 8. Ultrasonic behaviour

The three sensors are cycled sequentially rather than fired simultaneously.

Raw readings must not be fed directly into a decision without filtering.

Required production behaviour:

- sanity-check readings
- tolerate timeout/invalid samples
- use short temporal filtering / stable consecutive samples
- use hysteresis between obstacle-stop and obstacle-clear thresholds

The Phase 1 configuration currently starts with:

- front stop ~42 cm
- front caution ~62 cm
- side stop ~24 cm
- side caution ~38 cm

These are tuning starting points, not mathematically final values.

Because the side sensors point left/right rather than diagonally forward, they describe side clearance. They do not provide complete forward trajectory sensing after a turn.

---

## 9. Motor arbitration principle

The human follower produces a desired L/R command.

The obstacle subsystem produces restrictions.

The arbiter decides the final command.

This prevents two independent threads/processes from fighting over the TB6612 pins.

During INTERACTING:

- motors forced off
- following is irrelevant

During MOVING:

- following active
- ultrasonic safety active
- microphone/tutor pipeline is outside this subsystem and remains inactive according to ELO's overall state machine

---

## 10. Bring-up/debugging already completed

### Environment

- Project runs inside `.venv`.
- Pi is using Remote SSH in VS Code for editing.
- Required runtime imports verified on the working Pi:
  - `lgpio`
  - `Picamera2`
  - `OpenCV 4.10.0`
  - `ai-edge-litert`

### Initial verifier bug fixed

Original `verify_setup.py` had invalid `list.append(a, b)` calls.

It was corrected to append tuples and now reports each check cleanly.

### Python module path issue

Running `python tools/test_motors.py` / `test_ultrasonic.py` directly initially produced `ModuleNotFoundError: elo_follow`.

For direct tool execution, the tested workaround is:

```bash
PYTHONPATH=. python tools/test_motors.py
PYTHONPATH=. python tools/test_ultrasonic.py
```

The diagnostic tool `test_detection.py` now inserts the project root itself.

### GPIO4 conflict found

`gpioinfo` showed:

```text
line 4: GPIO4 output drive=open-drain consumer="onewire@0"
```

Therefore motor STBY was moved from GPIO4 to GPIO21.

### lgpio PWM stop bug found

Original motor stop code called:

```python
lgpio.tx_pwm(..., 0, 0)
```

which produced:

```text
lgpio.error: 'bad PWM micros'
```

The corrected code uses a valid PWM frequency with zero duty cycle.

### Motor polarity found

Bench test showed the left wheel pair was electrically reversed.

Logical fix:

```text
invert_left = true
invert_right = false
```

Equal positive L/R now means forward.

### Motor speed tuning

A modest 1.25 PWM multiplier was added to the low-level driver because initial motor speed was too low on the bench.

This is deliberately modest; current/temperature validation is still required because the project is using one TB6612 with two motors in parallel per channel.

### Ultrasonic test passed

All three sensors returned real distance measurements.

Observed example ranges during testing:

- front around 21–22 cm and around 116 cm depending on the object
- left around 21–22 cm
- right around 8.7 cm when an object was physically close

This proved all three GPIO channels and Echo timing are functioning.

A filter/hysteresis layer is still required for production behaviour.

### Detector benchmark passed

Camera + LiteRT inference are working.

Measured:

```text
Average TFLite invoke: 44.3 ms
Equivalent inference FPS: 22.6
P50: 44.1 ms
P95: 44.2 ms
```

### Detection failure discovered

The integrated detector initially returned zero people despite a human being visible.

Raw model inspection showed standard SSD output tensors:

```text
boxes  = output 0
classes = output 1
scores = output 2
count  = output 3
```

The raw class tensor contained values including `0`, while the original config used `person_class_id = 1` because the local labels file begins with a dummy `???` line.

Current code/config in this handoff intentionally sets:

```toml
person_class_id = 0
```

This is the next item that MUST be re-run on the physical Pi to confirm that class-0 is indeed the person class for the exact downloaded model. Do not treat the detector as acceptance-tested until `test_detection.py` reports real person boxes.

A previous attempt to change quantized preprocessing was reverted in this package. For the tested model, the current uint8 path feeds the camera RGB uint8 tensor directly, matching the model's reported input signature:

```text
uint8
scale 0.0078125
zero_point 128
```

---

## 11. Current package changes included in this handoff

This ZIP contains the code state intended to replace the current Pi project files:

- `config/config.toml`
  - person class ID = 0 (pending physical confirmation)
  - STBY = GPIO21
  - left motor inversion enabled
- `elo_follow/motor.py`
  - valid lgpio stop PWM call
  - left direction inversion through config
  - modest 1.25 PWM boost
- `elo_follow/models.py`
  - explicit standard SSD output mapping
  - uint8 preprocessing path restored to raw uint8 camera tensor
  - prints model/output mapping at startup
  - person filtering uses configured class ID
- `tools/verify_setup.py`
  - fixed verifier implementation
- `tools/test_detection.py`
  - included diagnostic that was created during debugging

The model binary itself is not embedded in this ZIP because the working Pi already has `models/detect.tflite`. `download_model.sh` remains available for a clean install.

---

## 12. Immediate next tasks — in exact order

### Gate 1: confirm detector

Run:

```bash
cd ~/elo_phase1_build
source .venv/bin/activate
PYTHONPATH=. python tools/test_detection.py
```

Pass condition:

- at least one real human in frame produces `person detection(s) > 0`
- scores are sensible
- bounding boxes visually correspond to people
- multiple people produce multiple detections

If zero continues:

1. dump raw classes/scores again
2. inspect exact model metadata/label semantics
3. do not touch tracker/dashboard yet

### Gate 2: test tracker IDs

After detections work, test:

- one person standing still
- two people moving independently
- two people crossing
- one person leaving/re-entering

Acceptance:

- IDs don't randomly swap during ordinary crossings
- selected ID remains the same person
- unselected person can become larger without stealing selection

### Gate 3: dashboard Select-to-Follow

Start the app:

```bash
PYTHONPATH=. python -m elo_follow.main
```

Open:

```text
http://<PI-IP>:8080/
```

Expected:

- live camera preview
- detected track cards
- `Select` button per track
- selected track highlighted
- selected ID appears in status

### Gate 4: stationary command evaluation

Before putting the robot on the ground:

- select a person
- FOLLOW OFF/ON behaviour
- MOVING OFF/ON behaviour
- verify logical L/R commands
- verify INTERACTING forces motor stop

### Gate 5: slow real-world following

Start at low fixed speed.

Test:

- target centered
- target shifts left/right
- target gets too close
- target gets too far
- target exits frame on left
- target exits frame on right

### Gate 6: obstacle override

Test obstacles with the robot moving slowly.

Acceptance:

- obstacle can veto a forward command
- only arbiter controls the motors
- safety response does not wait for a fresh TFLite frame
- clear path allows a safe detour when possible
- if no safe path is known, STOP wins

### Gate 7: target recovery

Test selected target loss:

- target leaves left edge -> search left first
- target leaves right edge -> search right first
- target is reacquired -> resume following selected ID
- target not found after two searches -> STOP
- another person stays visible during search -> NEVER switch target

### Gate 8: 1 GB RAM / stability

During all tests monitor:

```bash
free -h
htop
```

The runtime must remain stable for repeated operation without memory growth.

### Gate 9: motor power-stage validation

Measure actual current per TB6612 channel with two motors connected in parallel and measure driver temperature under the intended fixed speed. This remains the biggest hardware risk of the current one-driver constraint.

---

## 13. Known limitations / deliberately deferred

- No neural Re-ID model.
- No SLAM.
- No rear obstacle sensing.
- No full navigation map.
- No reverse manoeuvre that assumes the rear is clear.
- No autonomous Moving/Interacting transition.
- No parent cloud dashboard.
- No heavy CV framework.
- No 30 FPS target; 10–15 FPS is the deliberate vision target.

---

## 14. Safety rule for all future work

Never make the detector, tracker, dashboard, or target-selection UI directly write motor GPIO.

Only the Motion Arbiter may call the motor controller with a final command.

Interacting/unknown state and emergency obstacle conditions must be able to force a stop independently of the vision pipeline.
