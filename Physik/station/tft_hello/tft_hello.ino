/*
 * Astro Health — текст з Serial Monitor на TFT 1.8″ ST7735 (SPI 128×160 V1.1)
 *
 * Бібліотеки: Adafruit GFX + Adafruit ST7735 and ST7789
 * Плата: ESP32 Dev Module · 115200 baud
 *
 * Як користуватись:
 *   1) Upload скетч
 *   2) Tools → Serial Monitor, baud 115200, "Newline" або "Both NL & CR"
 *   3) Пиши рядок → Enter → текст з’явиться на екрані (перелив кольору)
 */

#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>

// ----- тільки правий ряд (USB DevKit знизу) -----
// TFT: VCC→3V3 GND→GND CS→D5 RESET→D4 A0→D15 SDA→D23 SCK→D18 LED→3V3
static const int PIN_TFT_CS  = 5;
static const int PIN_TFT_DC  = 15;  // A0 на модулі
static const int PIN_TFT_RST = 4;
// SCK=18  MOSI(SDA на TFT)=23

Adafruit_ST7735 tft = Adafruit_ST7735(PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_RST);

static char message[96] = "Type in Serial";
static uint16_t hue = 0;

static uint16_t hsv565(uint16_t h, uint8_t s, uint8_t v) {
  h %= 360;
  uint8_t region = h / 60;
  uint16_t rem = (h % 60) * 255 / 60;
  uint8_t p = (uint16_t)v * (255 - s) / 255;
  uint8_t q = (uint16_t)v * (255 - (uint16_t)s * rem / 255) / 255;
  uint8_t t = (uint16_t)v * (255 - (uint16_t)s * (255 - rem) / 255) / 255;
  uint8_t r, g, b;
  switch (region) {
    case 0:  r = v; g = t; b = p; break;
    case 1:  r = q; g = v; b = p; break;
    case 2:  r = p; g = v; b = t; break;
    case 3:  r = p; g = q; b = v; break;
    case 4:  r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return tft.color565(r, g, b);
}

static void showMessage(const char *text, uint16_t color) {
  tft.fillScreen(ST77XX_BLACK);

  tft.setTextSize(1);
  tft.setTextColor(tft.color565(160, 160, 160), ST77XX_BLACK);
  tft.setCursor(4, 4);
  tft.print(F("Serial -> TFT"));

  tft.setTextSize(2);
  tft.setTextColor(color, ST77XX_BLACK);
  tft.setTextWrap(true);
  tft.setCursor(4, 28);
  tft.print(text);

  tft.setTextSize(1);
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setCursor(4, tft.height() - 12);
  tft.print(F("Enter text in Monitor"));
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println(F("=== TFT Serial echo ==="));
  Serial.println(F("Type a line and press Enter."));
  Serial.println(F("Wiring: CS=D5 DC/A0=D15 RST=D4 SCK=D18 SDA=D23 VCC/LED=3V3 GND=GND"));

  tft.initR(INITR_BLACKTAB);
  // якщо білий/сміття — спробуй:
  // tft.initR(INITR_GREENTAB);
  // tft.initR(INITR_18BLACKTAB);

  tft.setRotation(1);  // 160×128 альбом
  showMessage(message, hsv565(hue, 255, 255));
  Serial.printf("Display %dx%d ready\n", tft.width(), tft.height());
}

void loop() {
  // Читаємо рядок з Serial Monitor
  if (Serial.available()) {
    size_t n = Serial.readBytesUntil('\n', message, sizeof(message) - 1);
    message[n] = '\0';
    // прибрати \r (Windows)
    while (n > 0 && (message[n - 1] == '\r' || message[n - 1] == ' ')) {
      message[--n] = '\0';
    }
    if (n == 0) {
      strncpy(message, "(empty)", sizeof(message) - 1);
    }
    Serial.print(F("OK -> screen: "));
    Serial.println(message);
    showMessage(message, hsv565(hue, 255, 255));
  }

  // Легкий перелив кольору вже показаного тексту (~кожні 80 мс)
  static uint32_t last = 0;
  uint32_t now = millis();
  if (now - last >= 80) {
    last = now;
    hue = (hue + 4) % 360;
    // перемальовуємо лише текст (швидше)
    tft.fillRect(0, 24, tft.width(), tft.height() - 40, ST77XX_BLACK);
    tft.setTextSize(2);
    tft.setTextColor(hsv565(hue, 255, 255), ST77XX_BLACK);
    tft.setTextWrap(true);
    tft.setCursor(4, 28);
    tft.print(message);
  }
}
