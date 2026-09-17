# ELO Phase 1 Release Notes

Release: `phase1-handoff-2026-09-13`

This package is the current software baseline after the Pi 5 hardware bring-up and debugging session.

Important: the detector has **not yet passed the final person-detection acceptance test**. The exact model is installed on the working Pi, and `person_class_id = 0` is now configured based on raw output inspection. Confirm with `tools/test_detection.py` before enabling MOVING.

See `docs/HANDOFF_PHASE1.md` for the full continuation context.
