from __future__ import annotations

from typing import Any

import cv2
import numpy as np

try:
    from ai_edge_litert import interpreter as tflite
except ImportError:
    import tflite_runtime.interpreter as tflite


class PersonDetector:
    """Standard TensorFlow Lite SSD-MobileNet V1 detector."""

    def __init__(
        self,
        model_path: str,
        input_w: int,
        input_h: int,
        person_class_id: int,
        conf_high: float,
        conf_low: float,
    ):
        self.input_w = int(input_w)
        self.input_h = int(input_h)
        self.person_class_id = int(person_class_id)
        self.conf_high = float(conf_high)
        self.conf_low = float(conf_low)

        self.interpreter = tflite.Interpreter(model_path=model_path, num_threads=2)
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()[0]
        self.output_details = self.interpreter.get_output_details()
        self.input_dtype = self.input_details["dtype"]
        q = self.input_details.get("quantization", (0.0, 0))
        self.scale = float(q[0]) if q and q[0] else 0.0
        self.zero_point = int(q[1]) if q and len(q) > 1 else 0

        if len(self.output_details) < 4:
            raise RuntimeError(f"Unexpected SSD output layout: {len(self.output_details)} outputs")

        # This exact model reports the standard order:
        # boxes, classes, scores, count.
        self.boxes_output = self.output_details[0]
        self.classes_output = self.output_details[1]
        self.scores_output = self.output_details[2]
        self.count_output = self.output_details[3]

        print("Detector output mapping:")
        print(f"     boxes: index={self.boxes_output['index']} name={self.boxes_output['name']} shape={self.boxes_output['shape']}")
        print(f"   classes: index={self.classes_output['index']} name={self.classes_output['name']} shape={self.classes_output['shape']}")
        print(f"    scores: index={self.scores_output['index']} name={self.scores_output['name']} shape={self.scores_output['shape']}")
        print(f"     count: index={self.count_output['index']} name={self.count_output['name']} shape={self.count_output['shape']}")
        print(f"Detector input: dtype={self.input_dtype}, scale={self.scale}, zero_point={self.zero_point}")
        print(f"Person class ID: {self.person_class_id}")

    @property
    def shape(self):
        return tuple(self.input_details["shape"])

    def _preprocess(self, rgb_frame: np.ndarray) -> np.ndarray:
        image = cv2.resize(
            rgb_frame,
            (self.input_w, self.input_h),
            interpolation=cv2.INTER_LINEAR,
        )

        if self.input_dtype == np.uint8:
            # This ELO model has uint8 input with scale 1/128, zero point 128.
            # The SSD-MobileNet export expects the camera RGB uint8 tensor directly.
            return image.astype(np.uint8, copy=False)[None, ...]

        if self.input_dtype == np.float32:
            return (image.astype(np.float32) / 127.5 - 1.0)[None, ...]

        if self.input_dtype == np.int8:
            real = image.astype(np.float32) / 127.5 - 1.0
            q = np.round(real / self.scale + self.zero_point)
            return np.clip(q, -128, 127).astype(np.int8)[None, ...]

        raise RuntimeError(f"Unsupported model input dtype: {self.input_dtype}")

    def infer(self, rgb_frame: np.ndarray, include_low: bool = True) -> list[dict[str, Any]]:
        tensor = self._preprocess(rgb_frame)
        self.interpreter.set_tensor(self.input_details["index"], tensor)
        self.interpreter.invoke()

        boxes = np.squeeze(self.interpreter.get_tensor(self.boxes_output["index"]))
        classes = np.squeeze(self.interpreter.get_tensor(self.classes_output["index"]))
        scores = np.squeeze(self.interpreter.get_tensor(self.scores_output["index"]))
        count = np.squeeze(self.interpreter.get_tensor(self.count_output["index"]))

        boxes = np.asarray(boxes)
        classes = np.asarray(classes).reshape(-1)
        scores = np.asarray(scores).reshape(-1)
        try:
            n = int(round(float(count)))
        except (TypeError, ValueError):
            n = len(boxes)
        n = max(0, min(n, len(boxes), len(classes), len(scores)))

        threshold = self.conf_low if include_low else self.conf_high
        detections = []

        for i in range(n):
            try:
                cls = int(round(float(classes[i])))
                score = float(scores[i])
            except (TypeError, ValueError):
                continue
            if cls != self.person_class_id or not np.isfinite(score) or score < threshold:
                continue

            y1, x1, y2, x2 = map(float, boxes[i])
            x1 = max(0.0, min(1.0, x1)); y1 = max(0.0, min(1.0, y1))
            x2 = max(0.0, min(1.0, x2)); y2 = max(0.0, min(1.0, y2))
            if x2 <= x1 or y2 <= y1:
                continue

            detections.append({
                "bbox_norm": [x1, y1, x2, y2],
                "score": score,
            })

        return detections
