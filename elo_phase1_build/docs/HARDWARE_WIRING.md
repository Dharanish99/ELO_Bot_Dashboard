# ELO Phase 1 hardware wiring

## Raspberry Pi 5 GPIO map

| Function | BCM | Physical pin |
|---|---:|---:|
| TB6612 STBY | 4 | 7 |
| Left IN1 | 17 | 11 |
| Left IN2 | 27 | 13 |
| Left PWM | 22 | 15 |
| Right IN1 | 23 | 16 |
| Right IN2 | 24 | 18 |
| Right PWM | 25 | 22 |
| Front ultrasonic TRIG | 5 | 29 |
| Front ultrasonic ECHO | 6 | 31 |
| Left ultrasonic TRIG | 12 | 32 |
| Left ultrasonic ECHO | 13 | 33 |
| Right ultrasonic TRIG | 16 | 36 |
| Right ultrasonic ECHO | 26 | 37 |
| Display UART TX | 14 | 8 |
| Display UART RX | 15 | 10 |

GPIO14/15 are permanently reserved for the ESP32-S3 display link and must not be reused.

## TB6612FNG

- `VM`: 3S battery motor supply (~11.1 V nominal, 12.6–12.7 V full).
- `VCC`: regulated 5 V logic supply.
- `GND`: common robot ground with Pi GPIO ground.
- `STBY`: GPIO4.
- Channel A: left motor pair; IN1=17, IN2=27, PWM=22.
- Channel B: right motor pair; IN1=23, IN2=24, PWM=25.

**Current caveat:** the single TB6612FNG is being used because only one driver is currently available. Two motors are paralleled on each channel. Measure each motor's stall/current draw and the driver's temperature before sustained autonomous operation. The TB6612FNG's published continuous per-channel capability is limited, so this is the main electrical risk in Phase 1.

## Ultrasonic sensors

Three classic HC-SR04-style modules are used in the fixed physical layout:

- Front: GPIO5 trigger, GPIO6 echo
- Left: GPIO12 trigger, GPIO13 echo
- Right: GPIO16 trigger, GPIO26 echo

**ECHO MUST NOT be connected directly to the Pi if the module outputs 5 V.** Use a resistor divider or a proper 5 V→3.3 V level shifter on every Echo line.

Recommended divider example:

- Echo → 1 kΩ → Pi GPIO
- Pi GPIO → 2 kΩ → GND

This gives approximately 3.33 V from a 5 V Echo signal.

Sensors are triggered one at a time to reduce ultrasonic cross-talk.

## Power

- 3S Li-ion pack + appropriate BMS → motor rail / TB6612 `VM`.
- 5 V buck → TB6612 `VCC`, ultrasonic sensors, and the display as already planned.
- Separate suitable USB-C power bank → Raspberry Pi 5.
- All logic grounds must be common, including Pi, motor driver, ultrasonic modules, and display/UART ground.

The Pi does **not** require the motor-battery buck if it is powered by an adequate USB-C power bank.
