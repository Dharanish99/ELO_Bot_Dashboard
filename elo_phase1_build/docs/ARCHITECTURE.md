# ELO Phase 1 architecture

## Runtime components

1. **Camera thread** — Picamera2/CSI capture at 640x480, 15 fps camera stream.
2. **Vision thread** — quantized SSD-MobileNet V1 TFLite at a target of ~10–15 inference/s. Only `person` detections are kept.
3. **Tracker** — lean ByteTrack-inspired tracker with high/low score association, constant-velocity prediction, IoU, center-distance and HSV appearance histogram cues.
4. **Dashboard** — tiny standard-library HTTP server on the Pi. Shows the current tracked persons and lets the operator select a target ID, toggle Follow, and toggle Moving/Interacting.
5. **Ultrasonic thread** — sequential front/left/right HC-SR04 timing via lgpio GPIO edge callbacks and hardware timestamps. No busy polling for Echo pulse timing.
6. **Motion arbiter** — the only component allowed to command motors. It combines selected-person following, ultrasonic safety constraints, and the Moving/Interacting gate.
7. **Motor controller** — one TB6612FNG, two logical channels (left pair and right pair).

## Safety precedence

`Interacting/unknown state > emergency obstacle > obstacle avoidance > human following`

Vision produces a desired left/right command. It never writes GPIO directly. The arbiter can replace the desired command with a safety-safe maneuver.

## Target identity

The dashboard selects a tracker ID. The selected target is never replaced merely because another person becomes larger, closer, or more central.

When a selected track disappears, the tracker can remap the logical selection to a newly created track only when the candidate matches the stored target anchor using:

- predicted position / motion
- bounding-box size
- IoU / center gating
- HSV appearance histogram
- runner-up separation

If a confident rematch does not exist, the robot searches rather than switching to another person.

## Target loss

1. Selected person temporarily missing → search toward the last known exit side.
2. One search = one slow ~360-degree rotation.
3. Up to two searches.
4. If not reacquired → stop.
5. Ultrasonic safety stays active during search.

## Obstacle avoidance with N/E/W sensor layout

The sensors do not provide diagonal-forward depth. Therefore the arbiter treats them as:

- front = frontal collision constraint
- left = side clearance / left-turn feasibility
- right = side clearance / right-turn feasibility

When the front is blocked, the chosen turn direction blends:

- side clearance
- the selected person's last known side in the frame

This keeps the detour biased toward reacquisition instead of randomly choosing a turn.
