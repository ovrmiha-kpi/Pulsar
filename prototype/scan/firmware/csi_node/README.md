# CSI node — ESP32 DevKit V1

Окрема прошивка для карти станції по **Wi‑Fi CSI** (не годинник).

## Прошивка (Arduino IDE)

1. Board: **ESP32 Dev Module** (Arduino-ESP32 core 2.x / 3.x).
2. Скопіюй `secrets.h.example` → `secrets.h`, впиши SSID/пароль **свого** Wi‑Fi AP.
3. Відкрий `csi_node.ino`, Upload.
4. Serial Monitor 115200: мають з’явитись `wifi/ok`, `csi/on`, далі рядки з `"amp":[...]`.

Після цього на ПК: `python scan.py --port COMx` (див. `../../README.md`).

## Обмеження

Один DevKit = один RF-лінк (AP ↔ ESP). Presence / motion / груба позиція вздовж зони відчуття — не скелет і не точна трилатерація.
