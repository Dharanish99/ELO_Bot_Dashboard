# ELO Core Integration Map

```text
Parent Dashboard
      |
      | HTTP
      v
+-------------+
|   ELO Core  |  Raspberry Pi 5
+------+------+ 
       |  |  \
       |  |   +--> ESP32 Face V3 over /dev/ttyAMA0
       |  +------> Mic -> AI backend -> TTS -> Speaker
       |
       +------> Existing Phase-1 Follow / Tracker / Arbiter
                       ^
                       |
                 Camera + Ultrasonic
                       |
                    Motors
```

The Core does not replace the tested movement stack. It instantiates the same `CameraSource`, `PersonDetector`, `LightweightPeopleTracker`, `FollowController`, `SearchController`, `MotionArbiter`, `MotorController`, and `UltrasonicArray` used by Phase 1.
