# CSI node — ESP32 DevKit V1

Separate firmware for the station map via **Wi‑Fi CSI** (not the watch).

## Firmware (Arduino IDE)

1. Board: **ESP32 Dev Module** (Arduino-ESP32 core 2.x / 3.x).
2. Copy `secrets.h.example` → `secrets.h`, fill in SSID/password of **your** Wi‑Fi AP.
3. Open `csi_node.ino`, Upload.
4. Serial Monitor 115200: you should see `wifi/ok`, `csi/on`, then lines with `"amp":[...]`.

Then on the PC: `python scan.py --port COMx` (see `../../README.md`).

## Limits

One DevKit = one RF link (AP ↔ ESP). Presence / motion / coarse position along the sensing zone — not a skeleton and not precise trilateration.
