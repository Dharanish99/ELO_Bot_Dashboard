# ELO Phase 1 research notes / source record

## Model choice

The project architecture already locks the detector family to a quantized SSD-MobileNet V1 TFLite model. TensorFlow's object detection model zoo lists `ssd_mobilenet_v1_quantized_300x300_coco14_sync_2018_07_18` as a quantized mobile detector and reports 300x300 input with a lightweight profile. Source: TensorFlow Models, Object Detection Model Zoo.

https://github.com/tensorflow/models/blob/master/research/object_detection/g3doc/tf1_detection_zoo.md

The concrete TFLite asset used by this package is the official TensorFlow Lite MobileNet-SSD COCO package:

https://storage.googleapis.com/download.tensorflow.org/models/tflite/coco_ssd_mobilenet_v1_1.0_quant_2018_06_29.zip

## Runtime choice

The package prefers `ai-edge-litert`, the current lightweight LiteRT runtime, and falls back to legacy `tflite-runtime`. PyPI currently provides `tflite-runtime` 2.14.0 wheels for CPython 3.11/aarch64, while it is an older package line. This project therefore prefers LiteRT on newly provisioned systems.

https://pypi.org/project/tflite-runtime/

## Camera

Arducam's B0176 documentation confirms that the OV5647 motorized-focus camera supports Raspberry Pi 5 and provides single-shot autofocus and manual lens-position control. ELO therefore performs one autofocus cycle at startup and then locks the resulting lens position instead of continuously hunting during motion.

https://docs.arducam.com/Raspberry-Pi-Camera/Motorized-Focus-Camera/Quick-Start-Guide/OV5647-Motorized-Focus-Camera/

## Tracking

ByteTrack is used as the algorithmic basis for lightweight multi-object tracking: high-confidence matching first, low-confidence recovery second, track buffering, and geometry-based association. For ELO, this is augmented with a small HSV appearance histogram because the requested feature is explicit person selection and the system must avoid jumping to a different person when multiple people are visible.

https://github.com/ifzhang/ByteTrack
https://github.com/ultralytics/ultralytics/blob/main/ultralytics/trackers/byte_tracker.py

## GPIO / ultrasonic timing

`lgpio` is used for GPIO access on Pi 5. Its callbacks provide GPIO edge timestamps, which is appropriate for measuring the Echo pulse without Python busy-polling. `rpi-lgpio` documentation also records Raspberry Pi 5 compatibility and GPIO chip handling.

https://libgpiod.readthedocs.io/en/master/python_edge_event.html
https://rpi-lgpio.readthedocs.io/en/latest/changelog.html
https://rpi-lgpio.readthedocs.io/en/latest/api.html

## PWM

The locked motor PWM pins are GPIO22 and GPIO25, so this implementation uses lgpio software-timed PWM. The chosen PWM rate is 800 Hz. This is intentionally kept out of the camera/TFLite process as a direct vision-to-GPIO operation; the motion arbiter owns final output.

https://rpi-lgpio.readthedocs.io/en/latest/_modules/RPi/GPIO.html

## TB6612FNG limitation

The TB6612FNG datasheet rates the device at about 1.2 A average per channel. Because the current ELO build has one driver and two motors paralleled on each channel, actual motor current and driver temperature must be measured before extended autonomous operation.

https://toshiba.semicon-storage.com/info/TB6612FNG_datasheet_en_20141001.pdf

## Known engineering limitation

Three HC-SR04 sensors arranged front/left/right at approximately 90-degree spacing cannot provide diagonal-forward depth. This Phase 1 implementation therefore uses them as frontal collision and side-clearance constraints rather than pretending they are a complete local occupancy map.
