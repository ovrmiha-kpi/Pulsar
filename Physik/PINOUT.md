# Розпіновка ESP32 — Astro Health Station

Позначення спрощені (у стилі ГОСТ 2.710).  
Плата: **ESP32-DevKitC / WROOM-32** (уже є).  
Редакція: 2026-10-31. Радіація та FSR не підключені.

## Перелік елементів

| Поз. | Найменування | Примітка |
|------|--------------|----------|
| DD1 | ESP32-WROOM-32 DevKit | MCU + Wi‑Fi |
| HG1 | TFT 2.8″ ILI9341 SPI | 240×320 |
| D1 | модуль microSD SPI | спільна SPI з HG1 |
| B1 | BME280 | I²C, клімат |
| B2 | MQ-135 | аналог. повітря |
| B3 | MAX30102 | I²C, HR/SpO2 |
| B4 | AD8232 | ЕКГ |
| B5 | MLX90614 | I²C, temp |
| B6 | MPU-6050 | I²C, IMU |
| B7 | HX711 + тензодатчик 5 кг | хват/вага |
| HA1 | активний зумер | сповіщення |
| HL1 | LED + 220 Ω | статус |
| SB1…SB6 | тактові кнопки | на GND |
| G1 | powerbank 5 В USB | живлення DevKit |

## Призначення виводів DD1 (ESP32)

| GPIO | Сигнал | Куди | Примітка |
|------|--------|------|----------|
| 21 | SDA | B1, B3, B5, B6 | шина I²C |
| 22 | SCL | B1, B3, B5, B6 | шина I²C |
| 18 | SPI_SCK | HG1, D1 | спільна SPI |
| 23 | SPI_MOSI | HG1, D1 | |
| 19 | SPI_MISO | HG1, D1 | |
| 5 | TFT_CS | HG1 CS | |
| 15 | TFT_DC | HG1 DC/RS | |
| 4 | TFT_RST | HG1 RESET | |
| 13 | SD_CS | D1 CS | |
| 16 | HX_DT | B7 DT | |
| 17 | HX_SCK | B7 SCK | |
| 34 | MQ_A0 | B2 A0 | лише вхід, АЦП |
| 35 | ECG_OUT | B4 OUTPUT | лише вхід, АЦП |
| 25 | MOOD_BAD | SB1 | INPUT_PULLUP |
| 26 | MOOD_OK | SB2 | INPUT_PULLUP |
| 27 | MOOD_GOOD | SB3 | INPUT_PULLUP |
| 14 | MODE | SB4 | INPUT_PULLUP |
| 32 | CAL | SB5 | INPUT_PULLUP |
| 33 | SYNC | SB6 | INPUT_PULLUP |
| 2 | BUZZ | HA1 + | після boot |
| 12 | LED | HL1 катод (active LOW) | тримати LOW до init |
| 3V3 | +3.3 В | I²C-модулі, B4, логіка HG1 | |
| 5V / VIN | +5 В | B2, B7 (HX711), USB | |
| GND | Загальний | усі модулі | |

## Живлення

- DevKit від USB powerbank (G1) → 5 В на VIN/USB.
- I²C-датчики та AD8232 → **3V3** і **GND**.
- MQ-135 та HX711 → **5V** і **GND**.
- MQ-135 A0: якщо вихід 0…5 В — подільник **10 кΩ + 20 кΩ** на GPIO34, або модуль з рівнем ≤3.3 В.

## AD8232 (B4)

- 3.3V, GND, OUTPUT → GPIO35.
- LO+ / LO− у цій редакції **не використовуються**.
- Електроди: RA, LA, RL за маркуванням модуля.

## Кнопки

Один контакт на GPIO, другий на **GND**. У коді `INPUT_PULLUP`, натискання = LOW.

| SB | Функція |
|----|---------|
| SB1 | Mood Bad |
| SB2 | Mood OK |
| SB3 | Mood Good |
| SB4 | MODE (grip/weight) |
| SB5 | CAL (baseline) |
| SB6 | SYNC (відправка на сервер) |

## Креслення

- **Pin-to-pin (збірка):** [`SCHEME_WIRING.html`](SCHEME_WIRING.html) · [`SCHEME_WIRING.png`](SCHEME_WIRING.png)
- ГОСТ: [`SCHEME_GOST.html`](SCHEME_GOST.html) · [`SCHEME_GOST.png`](SCHEME_GOST.png)
