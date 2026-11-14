# Розпіновка ESP32 — Astro Health Station

Плата: **ESP32 DevKit V1**. Редакція: 2026-11-13.  
Обидва ряди пінів — **можна**.  
**Повна збірка:** [`station/WIRING_ALL.md`](station/WIRING_ALL.md)

## Швидка карта

| GPIO | Куди |
|------|------|
| 3V3 / GND | живлення логіки |
| VIN (5V) | MQ-135, HX711 |
| D2 | MQ A0 |
| D4 | TFT RESET |
| D5 | TFT CS |
| D13 | SD CS |
| D15 | TFT DC/A0 |
| RX2 (GPIO16) | HX711 DT |
| TX2 (GPIO17) | HX711 SCK |
| D18 | SPI SCK (TFT+SD) |
| D19 | SPI MISO (SD) |
| D21 | I²C SDA (BMP+MAX+MPU) |
| D22 | I²C SCL |
| D23 | SPI MOSI (TFT+SD) |
| D34 | аналог. пульс (опц.) |

## Модулі

| Модуль | Шини / піни |
|--------|-------------|
| TFT 1.8″ | SPI CS5 DC15 RST4 SCK18 MOSI23 |
| microSD | SPI CS13 + спільні 18/23/19 |
| BMP280 | I²C 21/22 |
| MAX30102 | I²C 21/22 |
| MPU-6500 | I²C 21/22 |
| MQ-135 | A0→D2, 5V |
| HX711 | DT16 SCK17, 5V |
| Pulse analog | →D34 (опц.) |

DEBUG (без SD): [`station/station_debug/station_debug.ino`](station/station_debug/station_debug.ino)
