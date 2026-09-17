# Model assets

Default model: **SSD MobileNet V1, quantized uint8, 300x300, COCO**.

Official source package:
https://storage.googleapis.com/download.tensorflow.org/models/tflite/coco_ssd_mobilenet_v1_1.0_quant_2018_06_29.zip

The runtime expects the extracted file at:

`models/detect.tflite`

The package also includes `labels.txt`. The `download_model.sh` script downloads and verifies the archive contains `detect.tflite`.

Why this model:
- It matches ELO's locked/benchmarked SSD-MobileNet-V1 + TFLite architecture.
- 300x300 input keeps memory and CPU load appropriate for the 1 GB Pi.
- The TensorFlow model zoo lists the quantized SSD-MobileNet-V1 COCO family as one of its lightweight mobile detectors.¹

¹ TensorFlow Object Detection Model Zoo: https://github.com/tensorflow/models/blob/master/research/object_detection/g3doc/tf1_detection_zoo.md
