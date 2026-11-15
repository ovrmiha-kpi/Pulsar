# ESP32 pinout — Astro Health Station

Board: **ESP32 DevKit V1**. Revision: 2026-11-13.  
Both pin rows — **allowed**.  
**Full assembly:** [`WIRING.md`](WIRING.md)

## Quick map

| GPIO | Goes to |
|------|---------|
| 3V3 / GND | logic power |
| VIN (5V) | MQ-135, HX711 |
| D2 | MQ A0 |
| D4 | TFT RESET |
| D5 | TFT CS |
| D13 | SD MOSI (side 2) |
| D14 | SD SCK (side 2) |
| D15 | TFT DC/A0 |
| RX2 (GPIO16) | HX711 DT |
| TX2 (GPIO17) | HX711 SCK |
| D18 | TFT SCK |
| D21 | I²C SDA (BMP+MAX+MPU) |
| D22 | I²C SCL |
| D23 | TFT MOSI |
| D32 | SD MISO (side 2) |
| D33 | SD CS (side 2) |
| D34 | analog pulse (opt.) |

## Modules

| Module | Buses / pins |
|--------|--------------|
| TFT 1.8″ | SPI CS5 DC15 RST4 SCK18 MOSI23 (side 1) |
| microSD | separate SPI: CS33 SCK14 MOSI13 MISO32 (side 2 / VIN) |
| BMP280 | I²C 21/22 |
| MAX30102 | I²C 21/22 |
| MPU-6500 | I²C 21/22 |
| MQ-135 | A0→D2, 5V |
| HX711 | DT16 SCK17, 5V |
| Pulse analog | →D34 (opt.) |

DEBUG (without SD): see archived station debug sketch if needed; production firmware is [`../watch/pulsar_watch/`](../watch/pulsar_watch/).
