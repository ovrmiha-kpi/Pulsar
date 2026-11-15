# BOM + real prices (Ukraine)

Prices captured **~31.10.2026** from public storefronts. May change / show “coming soon”.  
ESP32 is **already owned** → **not** in the total. Laptop server is **not** included.

Legend: **★** = recommended purchase option.

---

## 0. Controller

| # | Option | Price | Link |
|---|--------|-------|------|
| ★ | ESP32 DevKit / WROOM (already owned) | **0 UAH** | — |
| 2 | ESP32-DevKitC new (spare) | ~200–280 UAH | Rozetka / arduino.ua search `ESP32 DevKit` |
| 3 | ESP32-S3-DevKitC-1 N8R2 | ~300–450 UAH | Rozetka / Ali `ESP32-S3-DevKitC-1 N8R2` |

---

## 1. Display TFT ILI9341 2.8″ 240×320

| # | Option | Price | Link |
|---|--------|-------|------|
| ★ | 2.8″ SPI **without** touch (often has SD slot) | **389 UAH** | https://arduino.ua/prod4582-2-8quot-240x320-tft-lcd-spi-modyl |
| 2 | 2.8″ SPI **with** touch + SD | **490 UAH** | https://arduino.ua/prod1539-2-8-240x320-tft-lcd-spi-modyl |
| 3 | 2.8″ SPI with touch (Rozetka) | **501 UAH** | https://rozetka.com.ua/583544539/p583544539/ |

---

## 2. Radiation — NOT BUYING YET

Deferred (expensive ~1900 UAH). Links for later:

| Option | Price | Link |
|--------|-------|------|
| CAJOE RadiationD-v1.1 + J305 | ~1900 UAH | https://www.mini-tech.com.ua/ua/geiger-module |
| Ali CAJOE / M4011 | ~800–1400 UAH | Ali `CAJOE Geiger M4011` |
| RadSens I2C | rare in UA | https://github.com/climateguard/RadSens |

---

## 3. Cabin climate — BME280 (+ MQ-135 for air)

BME280 alone: **temperature, humidity, pressure** (not “pollution”). For air quality add MQ-135.

### 3a. BME280

| # | Option | Price | Link |
|---|--------|-------|------|
| ★ | BME280 3.3V I2C | **199 UAH** | https://arduino.ua/prod3930-barometr-bme280-3-3v-i2cspi-datchik-temperatyri-vlajnosti-davleniya |
| 2 | BME280 | **181 UAH** | https://1wire.com.ua/bme280-cifrovoj-datchik-davlenija-vlazhnosti.html |
| 3 | BME680 (all-in-one, pricier, no MQ) | **514 UAH** | https://bigl.ua/ua/p2396428617-datchik-temperatury-vlazhnosti |

### 3b. MQ-135 (air quality / gases)

| # | Option | Price | Link |
|---|--------|-------|------|
| ★ | MQ-135 module | **69 UAH** | https://arduino.ua/prod1201-modyl-datchika-kachestva-vozdyha-mq135 |
| 2 | MQ-135 | **58–59 UAH** | https://arduinokit.com.ua/ua/g71152865-arduino-datchiki-moduli · https://www.radiostore.ua/datchiki-gazovykh-primesey-mq |
| 3 | Keyestudio MQ-135 | **168 UAH** | https://arduino.ua/prod7246-keyestudio-easy-plug-mq-135-air-quality-sensor-gas-detection-module-for-arduino-steam |

> MQ-135 usually needs **5V** power, analog output → ESP32 ADC (divider or carefully 0–3.3 V). Warm-up 1–3 min. Coarse sensor — fine for an `air_bad` flag.

**★ BME280 + ★ MQ-135 pair ≈ 268 UAH** (vs one BME680 at 514).

---

## 4. Pulse / SpO2 — MAX30102

| # | Option | Price | Link |
|---|--------|-------|------|
| ★ | MAX30102 V2 | **89 UAH** | https://arduino.ua/prod2036-datchik-pylsy-max30102-v2 |
| 2 | MAX30102 on Rozetka / Prom | ~90–150 UAH | search `MAX30102` |
| 3 | SparkFun-compatible module (Ali) | ~100–180 UAH | Ali `MAX30102 pulse oximeter` |

---

## 5. ECG — AD8232

| # | Option | Price | Link |
|---|--------|-------|------|
| ★ | AD8232 module (Kosmodrom) | **422 UAH** | http://www.kosmodrom.com.ua/prodlist.php?name=ODU&page=3 (AD8232-Modul) |
| 2 | AD8232 + electrodes often included | **240 UAH** | https://robostore.com.ua/modul-dlya-snyatiya-ekg-ad-8232-modul-lead-heart-rate-monitor/ |
| 3 | AD8232 (VsePlus) | **696–798 UAH** | https://vseplus.com/product/ekg-datcik-na-baze-ad8232-193336 |

---

## 6. Contactless temperature — MLX90614

| # | Option | Price | Link |
|---|--------|-------|------|
| ★ | MLX90614 module | **354 UAH** | https://arduino.ua/prod1431-modyl-beskontaktnogo-termmetra-mlx90614 |
| 2 | MLX90614 on Prom/Bigl | ~300–450 UAH | search `MLX90614` |
| 3 | MLX90614 Ali | ~250–400 UAH | Ali `MLX90614` |

---

## 7. Motion — MPU6050

| # | Option | Price | Link |
|---|--------|-------|------|
| ★ | MPU-6050 (Ref) | **79 UAH** | https://arduino.ua/prod1872-akselerometr-i-giroskop-mpu-6050 |
| 2 | MPU-6050 GY-521 | **149 UAH** | https://arduino.ua/prod512-akselerometr-i-giroskop-mpu-6050-modyl-6dof |
| 3 | GY-521 Ali / Prom | ~50–100 UAH | search `MPU6050 GY-521` |

---

## 8. Grip / weight — HX711 + load cell

| # | Option | Price | Link |
|---|--------|-------|------|
| ★ | HX711 module | **32 UAH** | https://arduino.ua/prod1147-hx711-dual-channel-weighing-sensor-module |
| ★ | **5 kg** load cell | **95 UAH** | https://arduino.ua/prod2454-datchik-vesa-tenzodatchik-5-kg-visokotochnii |
| 2 | HX711 “large” | **35 UAH** | https://arduino.ua/prod1815-hx711-dvyhkanalnii-modyl-datchikov-vesa-tenzodatchikov-bolshoi |
| 3 | 20 kg bar (if body mass needed) | ~120–200 UAH | search `тензодатчик 20кг` |

**★+★ pair together ≈ 127 UAH.**

FSR / sole sensors were **removed from BOM** (not worth mounting).

---

## 9. microSD

| # | Option | Price | Link |
|---|--------|-------|------|
| ★ | SD SPI module | **26 UAH** | https://arduino.ua/ru/prod589-modyl-sd-card-dlya-arduino-spi |
| 2 | if TFT already has SD slot — module not needed | **0 UAH** | display §1 |
| 3 | microSD card 16 GB | **~80–150 UAH** | Rozetka / any shop |

---

## 10. Small parts: buttons, buzzer, LED, wires, case, power

| # | Option | Price | Link |
|---|--------|-------|------|
| ★ | kit: 6–8 tactile buttons + active buzzer + LED + Dupont + proto/case | **~200–350 UAH** | arduino.ua / radio market |
| 2 | TP4056 + Li-ion 18650 (instead of powerbank) | **~50–150 UAH** | https://arduino-geek.pp.ua/product-category/moduli/ |
| 3 | ready powerbank 5000 mAh | **~150–300 UAH** | Rozetka |

---

## Budget totals (ESP32 = 0)

### A) Current ★ set (no radiation)

| Item | ★ pick | UAH |
|------|--------|-----|
| TFT 2.8″ no touch | arduino.ua | 389 |
| BME280 + MQ-135 | arduino.ua | 199 + 69 |
| MAX30102 | arduino.ua | 89 |
| AD8232 | robostore / kosmodrom | 240–422 |
| MLX90614 | arduino.ua | 354 |
| MPU6050 | arduino.ua | 79 |
| HX711 + 5 kg | arduino.ua | 127 |
| SD module + 16 GB card | | 26 + 100 |
| small parts / case / powerbank | | 300 |
| **Total** | | **≈ 1970–2150** |

Comfortable headroom under 4500. Radiation can return later (~800–1900).

---

## What to buy now

1. TFT + MAX30102 + MPU6050 + HX711/bar + SD  
2. AD8232 + MLX90614 + BME280 + MQ-135  
3. Case / power  

Device plan: [`PLAN.md`](PLAN.md) (if present in docs).
