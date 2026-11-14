/*
 * Astro Health — TFT + MQ(D2) + BMP280(I2C)
 *
 * Бібліотеки:
 *   Adafruit GFX, Adafruit ST7735
 *   Adafruit BMP280 Library  (+ Adafruit Unified Sensor, підтягне сам)
 *
 * BMP280:
 *   VCC→3V3  GND→GND  SDA→D21  SCL→D22
 *   (SDO часто на GND → адреса 0x76; на 3V3 → 0x77)
 *
 * MQ: A0→D2  VCC→3V3/VIN  GND→GND
 */

#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <Adafruit_BMP280.h>

static const int PIN_TFT_CS  = 5;
static const int PIN_TFT_DC  = 15;
static const int PIN_TFT_RST = 4;
static const int PIN_MQ_A0   = 2;
static const int PIN_SDA     = 21;
static const int PIN_SCL     = 22;

Adafruit_ST7735 tft = Adafruit_ST7735(PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_RST);
Adafruit_BMP280 bmp;

static bool bmpOk = false;
static int mqRaw = 0;
static float tempC = 0;
static float pressHpa = 0;

static int readMq() {
  long s = 0;
  for (int i = 0; i < 12; i++) s += analogRead(PIN_MQ_A0);
  return (int)(s / 12);
}

static void i2cScan() {
  Serial.println(F("--- I2C scan SDA=21 SCL=22 ---"));
  uint8_t n = 0;
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      Serial.printf("  0x%02X", a);
      if (a == 0x76 || a == 0x77) Serial.print(F(" <- BMP280?"));
      if (a == 0x57) Serial.print(F(" <- MAX30102"));
      Serial.println();
      n++;
    }
  }
  if (!n) Serial.println(F("  empty — check BMP wires"));
  Serial.println(F("------------------------------"));
}

static void line(int y, const char *name, const char *val, uint16_t col) {
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setCursor(2, y);
  tft.print(name);
  tft.setTextColor(col, ST77XX_BLACK);
  tft.setCursor(48, y);
  tft.print(val);
}

static void drawStatus() {
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_CYAN, ST77XX_BLACK);
  tft.setCursor(2, 2);
  tft.print(F("TFT+MQ+BMP"));

  char buf[28];
  line(16, "TFT", "OK", ST77XX_GREEN);
  line(28, "MAX", "skip", tft.color565(120, 120, 120));

  snprintf(buf, sizeof(buf), "%d", mqRaw);
  line(40, "MQ", buf, mqRaw > 50 ? ST77XX_GREEN : ST77XX_RED);

  if (!bmpOk) {
    line(56, "BMP", "NO I2C", ST77XX_RED);
    line(68, "T", "--", ST77XX_YELLOW);
    line(80, "P", "--", ST77XX_YELLOW);
  } else {
    line(56, "BMP", "OK", ST77XX_GREEN);
    snprintf(buf, sizeof(buf), "%.1fC", tempC);
    line(68, "T", buf, ST77XX_GREEN);
    snprintf(buf, sizeof(buf), "%.0fhPa", pressHpa);
    line(80, "P", buf, ST77XX_GREEN);
  }

  tft.setTextColor(tft.color565(150, 150, 150), ST77XX_BLACK);
  tft.setCursor(2, 110);
  tft.print(F("BMP: 3V3 GND"));
  tft.setCursor(2, 122);
  tft.print(F("SDA21 SCL22"));
  tft.setCursor(2, 140);
  tft.print(F("Lib: Adafruit"));
  tft.setCursor(2, 152);
  tft.print(F("BMP280"));
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println(F("=== TFT + MQ + BMP280 ==="));

  tft.initR(INITR_BLACKTAB);
  tft.setRotation(0);
  tft.fillScreen(ST77XX_BLACK);

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_MQ_A0, ADC_11db);

  Wire.begin(PIN_SDA, PIN_SCL);
  delay(100);
  i2cScan();

  // спочатку 0x76, потім 0x77
  bmpOk = bmp.begin(0x76);
  if (!bmpOk) bmpOk = bmp.begin(0x77);

  if (!bmpOk) {
    Serial.println(F("BMP280 NOT FOUND"));
    Serial.println(F("  VCC->3V3 GND->GND SDA->D21 SCL->D22"));
  } else {
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                    Adafruit_BMP280::SAMPLING_X2,
                    Adafruit_BMP280::SAMPLING_X16,
                    Adafruit_BMP280::FILTER_X16,
                    Adafruit_BMP280::STANDBY_MS_500);
    Serial.println(F("BMP280 OK"));
  }

  drawStatus();
}

void loop() {
  mqRaw = readMq();

  if (bmpOk) {
    tempC = bmp.readTemperature();
    pressHpa = bmp.readPressure() / 100.0f;
  }

  static uint32_t lastUi = 0;
  static uint32_t lastLog = 0;
  uint32_t now = millis();

  if (now - lastUi >= 500) {
    lastUi = now;
    drawStatus();
  }

  if (now - lastLog >= 1000) {
    lastLog = now;
    if (bmpOk) {
      Serial.printf("MQ=%d | BMP T=%.2fC P=%.1fhPa\n", mqRaw, tempC, pressHpa);
    } else {
      Serial.printf("MQ=%d | BMP=NO\n", mqRaw);
    }
  }
}
