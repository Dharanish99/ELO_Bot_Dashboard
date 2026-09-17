from __future__ import annotations

import threading

try:
    import lgpio
    from .gpio import open_pi_header_chip
except ImportError as exc:
    raise RuntimeError("lgpio is required") from exc


class MotorController:
    """
    Low-level TB6612FNG motor controller.

    Logical convention:
        left  > 0 -> robot left side moves forward
        right > 0 -> robot right side moves forward

    The physical left motor pair is reversed relative to the right pair,
    so left direction is inverted in software (also reflected in config).
    """

    PWM_SCALE = 1.25

    def __init__(self, cfg):
        self.cfg = cfg
        self.h = open_pi_header_chip()

        for pin in [
            cfg.stby_gpio,
            cfg.left_in1,
            cfg.left_in2,
            cfg.left_pwm,
            cfg.right_in1,
            cfg.right_in2,
            cfg.right_pwm,
        ]:
            lgpio.gpio_claim_output(self.h, pin, 0)

        self._lock = threading.RLock()
        self._last = (0.0, 0.0)
        self.stop()

    def _dir(self, in1, in2, value, invert=False):
        v = -value if invert else value
        if v > 0:
            lgpio.gpio_write(self.h, in1, 1)
            lgpio.gpio_write(self.h, in2, 0)
        elif v < 0:
            lgpio.gpio_write(self.h, in1, 0)
            lgpio.gpio_write(self.h, in2, 1)
        else:
            lgpio.gpio_write(self.h, in1, 0)
            lgpio.gpio_write(self.h, in2, 0)

    def _pwm(self, pin, percent):
        percent = abs(float(percent)) * self.PWM_SCALE
        percent = max(0.0, min(100.0, percent))
        lgpio.tx_pwm(self.h, pin, self.cfg.pwm_hz, percent)
        if percent <= 0.0:
            lgpio.gpio_write(self.h, pin, 0)

    def set(self, left, right):
        with self._lock:
            left = max(-100.0, min(100.0, float(left)))
            right = max(-100.0, min(100.0, float(right)))

            if left == 0.0 and right == 0.0:
                self.stop()
                return

            lgpio.gpio_write(self.h, self.cfg.stby_gpio, 1)
            self._dir(self.cfg.left_in1, self.cfg.left_in2, left, self.cfg.invert_left)
            self._dir(self.cfg.right_in1, self.cfg.right_in2, right, self.cfg.invert_right)
            self._pwm(self.cfg.left_pwm, left)
            self._pwm(self.cfg.right_pwm, right)
            self._last = (left, right)

    def stop(self):
        with self._lock:
            # lgpio requires a valid PWM frequency even when duty is zero.
            lgpio.tx_pwm(self.h, self.cfg.left_pwm, self.cfg.pwm_hz, 0)
            lgpio.tx_pwm(self.h, self.cfg.right_pwm, self.cfg.pwm_hz, 0)

            for p in [
                self.cfg.left_in1,
                self.cfg.left_in2,
                self.cfg.right_in1,
                self.cfg.right_in2,
            ]:
                lgpio.gpio_write(self.h, p, 0)

            lgpio.gpio_write(self.h, self.cfg.stby_gpio, 0)
            self._last = (0.0, 0.0)

    @property
    def last(self):
        with self._lock:
            return self._last

    def close(self):
        with self._lock:
            self.stop()
            lgpio.gpiochip_close(self.h)
