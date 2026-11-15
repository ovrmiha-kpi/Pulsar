# Pulsar — compact case (watch)

Files: `PulsarWatch.FCStd`, `PulsarWatch.stl`  
Case size: **60 × 46 × 24 mm** (+ straps).

## Orientation

| Side | What | Why |
|------|------|-----|
| **Bottom (−Z)** → wrist | **MAX30102** in a window | LED/photodiode faces the skin |
| **Top (+Z)** | **TFT 1.8″** | display |
| **+Y** (far edge) | **MQ-135** + vents | hot sensor, away from climate |
| **−Y** (opposite) | **BMP280** | temperature/pressure far from MQ |
| between them | **ThermalBarrier** | reduces BMP heating from MQ |
| inside | ESP32, MPU-6500, HX711, battery, HW-373, microSD | stack under the screen |
| **+X** | BTN1–3 | side buttons |
| ±X lugs | strap | |

## Heat rule

MQ-135 gets hot → **do not place next to BMP280**. In the model they sit on **opposite** short sides of the case.
