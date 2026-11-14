# Як прошити TFT Serial → екран

З цього ПК зараз **немає Arduino IDE / arduino-cli**, а чіп **CP2102** (USB ESP32) у системі в статусі Error — тому прошивку треба зробити в Arduino IDE у себе.

## 1. Підключи

1. Збери TFT за `WIRING_TFT.md` (правий ряд).
2. ESP32 → USB у комп’ютер.
3. У **Device Manager → Ports** має з’явитись щось на кшталт `Silicon Labs CP210x (COMx)` або `USB-SERIAL CH340 (COMx)`.
   - Якщо CP2102 з помилкою — встанови драйвер [CP210x](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers) і перепідключи кабель (бажано data-кабель, не «тільки зарядка»).

## 2. Arduino IDE (один раз)

1. Встанови [Arduino IDE 2](https://www.arduino.cc/en/software).
2. **File → Preferences → Additional boards manager URLs:**
   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
3. **Tools → Board → Boards Manager** → шукай `esp32` → Install (Espressif).
4. **Sketch → Include Library → Manage Libraries** → встанови:
   - `Adafruit GFX Library`
   - `Adafruit ST7735 and ST7789 Library`

## 3. Upload

1. **File → Open** →  
   `Physik/station/tft_hello/tft_hello.ino`
2. **Tools:**
   - Board: **ESP32 Dev Module**
   - Port: твій **COMx** (не Bluetooth COM3–8)
   - Upload Speed: 921600 (або 115200, якщо upload падає)
3. Натисни **Upload** (→).  
   Якщо «Failed to connect»: затисни **BOOT** на платі, натисни Upload, відпусти BOOT коли піде «Connecting…».

## 4. Писати текст у «консолі»

1. **Tools → Serial Monitor** (або іконка лупи).
2. Знизу справа: **115200 baud**.
3. Рядок закінчення: **Newline** або **Both NL & CR**.
4. У полі вводу набери текст → **Enter**.
5. На TFT з’явиться цей рядок з переливом кольору; у Monitor буде `OK -> screen: ...`.

Кирилиця на цьому екрані (стандартний шрифт Adafruit) **не відобразиться нормально** — пиши латиницею / цифрами.
