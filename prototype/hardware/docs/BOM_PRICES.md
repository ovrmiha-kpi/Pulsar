# BOM + реальні ціни (Україна)

Ціни зняті **~31.10.2026** з публічних вітрин. Можуть змінюватись / «очікується».  
ESP32 **уже є** → у суму **не входить**. Ноутбук-сервер **не входить**.

Легенда: **★** = рекомендований варіант для покупки.

---

## 0. Контролер

| # | Варіант | Ціна | Посилання |
|---|---------|------|-----------|
| ★ | ESP32 DevKit / WROOM (уже є) | **0 грн** | — |
| 2 | ESP32-DevKitC новий (якщо запасний) | ~200–280 грн | Rozetka / arduino.ua пошук `ESP32 DevKit` |
| 3 | ESP32-S3-DevKitC-1 N8R2 | ~300–450 грн | Rozetka / Ali `ESP32-S3-DevKitC-1 N8R2` |

---

## 1. Дисплей TFT ILI9341 2.8″ 240×320

| # | Варіант | Ціна | Посилання |
|---|---------|------|-----------|
| ★ | 2.8″ SPI **без** touch (часто є слот SD) | **389 грн** | https://arduino.ua/prod4582-2-8quot-240x320-tft-lcd-spi-modyl |
| 2 | 2.8″ SPI **з** touch + SD | **490 грн** | https://arduino.ua/prod1539-2-8-240x320-tft-lcd-spi-modyl |
| 3 | 2.8″ SPI з touch (Rozetka) | **501 грн** | https://rozetka.com.ua/583544539/p583544539/ |

---

## 2. Радіація — ПОКИ НЕ КУПУЄМО

Відкладено (дорого ~1900 грн). Посилання на потім:

| Варіант | Ціна | Посилання |
|---------|------|-----------|
| CAJOE RadiationD-v1.1 + J305 | ~1900 грн | https://www.mini-tech.com.ua/ua/geiger-module |
| Ali CAJOE / M4011 | ~800–1400 грн | Ali `CAJOE Geiger M4011` |
| RadSens I2C | рідко в UA | https://github.com/climateguard/RadSens |

---

## 3. Клімат кабіни — BME280 (+ MQ-135 на повітря)

BME280 сам по собі: **температура, вологість, тиск** (не «забруднення»). Для повітря додаємо MQ-135.

### 3a. BME280

| # | Варіант | Ціна | Посилання |
|---|---------|------|-----------|
| ★ | BME280 3.3V I2C | **199 грн** | https://arduino.ua/prod3930-barometr-bme280-3-3v-i2cspi-datchik-temperatyri-vlajnosti-davleniya |
| 2 | BME280 | **181 грн** | https://1wire.com.ua/bme280-cifrovoj-datchik-davlenija-vlazhnosti.html |
| 3 | BME680 (усе-в-одному, дорожче, без MQ) | **514 грн** | https://bigl.ua/ua/p2396428617-datchik-temperatury-vlazhnosti |

### 3b. MQ-135 (якість повітря / гази)

| # | Варіант | Ціна | Посилання |
|---|---------|------|-----------|
| ★ | модуль MQ-135 | **69 грн** | https://arduino.ua/prod1201-modyl-datchika-kachestva-vozdyha-mq135 |
| 2 | MQ-135 | **58–59 грн** | https://arduinokit.com.ua/ua/g71152865-arduino-datchiki-moduli · https://www.radiostore.ua/datchiki-gazovykh-primesey-mq |
| 3 | Keyestudio MQ-135 | **168 грн** | https://arduino.ua/prod7246-keyestudio-easy-plug-mq-135-air-quality-sensor-gas-detection-module-for-arduino-steam |

> Живлення MQ-135 зазвичай **5V**, вихід аналоговий → ADC ESP32 (подільник або обережно 0–3.3 В). Прогрів 1–3 хв. Грубий сенсор, для прапорця `air_bad` ок.

**Пара ★ BME280 + ★ MQ-135 ≈ 268 грн** (замість одного BME680 за 514).

---

## 4. Пульс / SpO2 — MAX30102

| # | Варіант | Ціна | Посилання |
|---|---------|------|-----------|
| ★ | MAX30102 V2 | **89 грн** | https://arduino.ua/prod2036-datchik-pylsy-max30102-v2 |
| 2 | MAX30102 на Rozetka / Prom | ~90–150 грн | пошук `MAX30102` |
| 3 | SparkFun-сумісний модуль (Ali) | ~100–180 грн | Ali `MAX30102 pulse oximeter` |

---

## 5. ЕКГ — AD8232

| # | Варіант | Ціна | Посилання |
|---|---------|------|-----------|
| ★ | модуль AD8232 (Космодром) | **422 грн** | http://www.kosmodrom.com.ua/prodlist.php?name=ODU&page=3 (AD8232-Modul) |
| 2 | AD8232 + часто електроди в комплекті | **240 грн** | https://robostore.com.ua/modul-dlya-snyatiya-ekg-ad-8232-modul-lead-heart-rate-monitor/ |
| 3 | AD8232 (VsePlus) | **696–798 грн** | https://vseplus.com/product/ekg-datcik-na-baze-ad8232-193336 |

---

## 6. Температура безконтактна — MLX90614

| # | Варіант | Ціна | Посилання |
|---|---------|------|-----------|
| ★ | модуль MLX90614 | **354 грн** | https://arduino.ua/prod1431-modyl-beskontaktnogo-termmetra-mlx90614 |
| 2 | MLX90614 на Prom/Bigl | ~300–450 грн | пошук `MLX90614` |
| 3 | MLX90614 Ali | ~250–400 грн | Ali `MLX90614` |

---

## 7. Рух — MPU6050

| # | Варіант | Ціна | Посилання |
|---|---------|------|-----------|
| ★ | MPU-6050 (Ref) | **79 грн** | https://arduino.ua/prod1872-akselerometr-i-giroskop-mpu-6050 |
| 2 | MPU-6050 GY-521 | **149 грн** | https://arduino.ua/prod512-akselerometr-i-giroskop-mpu-6050-modyl-6dof |
| 3 | GY-521 Ali / Prom | ~50–100 грн | пошук `MPU6050 GY-521` |

---

## 8. Хват / вага — HX711 + тензодатчик

| # | Варіант | Ціна | Посилання |
|---|---------|------|-----------|
| ★ | модуль HX711 | **32 грн** | https://arduino.ua/prod1147-hx711-dual-channel-weighing-sensor-module |
| ★ | тензодатчик **5 кг** | **95 грн** | https://arduino.ua/prod2454-datchik-vesa-tenzodatchik-5-kg-visokotochnii |
| 2 | HX711 «великий» | **35 грн** | https://arduino.ua/prod1815-hx711-dvyhkanalnii-modyl-datchikov-vesa-tenzodatchikov-bolshoi |
| 3 | балка 20 кг (якщо потрібна маса тіла) | ~120–200 грн | пошук `тензодатчик 20кг` |

**Пара ★+★ разом ≈ 127 грн.**

FSR / датчики підошви **зняті з BOM** (нерентабельно кріпити).

---

## 9. microSD

| # | Варіант | Ціна | Посилання |
|---|---------|------|-----------|
| ★ | модуль SD SPI | **26 грн** | https://arduino.ua/ru/prod589-modyl-sd-card-dlya-arduino-spi |
| 2 | якщо на TFT уже є слот SD — модуль не потрібен | **0 грн** | дисплей п.1 |
| 3 | карта microSD 16 ГБ | **~80–150 грн** | Rozetka / будь-який магазин |

---

## 10. Дрібниці: кнопки, buzzer, LED, дроти, корпус, живлення

| # | Варіант | Ціна | Посилання |
|---|---------|------|-----------|
| ★ | набір: 6–8 тактових кнопок + active buzzer + LED + Dupont + макет/корпус | **~200–350 грн** | arduino.ua / радіоринок |
| 2 | TP4056 + Li-ion 18650 (замість powerbank) | **~50–150 грн** | https://arduino-geek.pp.ua/product-category/moduli/ |
| 3 | готовий powerbank 5000 mAh | **~150–300 грн** | Rozetka |

---

## Підсумкові кошториси (ESP32 = 0)

### A) Актуальний ★ набір (без радіації)

| Позиція | ★ вибір | грн |
|---------|---------|-----|
| TFT 2.8″ без touch | arduino.ua | 389 |
| BME280 + MQ-135 | arduino.ua | 199 + 69 |
| MAX30102 | arduino.ua | 89 |
| AD8232 | robostore / kosmodrom | 240–422 |
| MLX90614 | arduino.ua | 354 |
| MPU6050 | arduino.ua | 79 |
| HX711 + 5 кг | arduino.ua | 127 |
| модуль SD + карта 16 ГБ | | 26 + 100 |
| дрібниці / корпус / powerbank | | 300 |
| **Сума** | | **≈ 1970–2150** |

Великий запас до 4500. Радіацію можна повернути пізніше (~800–1900).

---

## Що купувати зараз

1. TFT + MAX30102 + MPU6050 + HX711/балка + SD  
2. AD8232 + MLX90614 + BME280 + MQ-135  
3. Корпус / живлення  

План пристрою: [`PLAN.md`](PLAN.md).
