/*
 * Astro Health — DEBUG (без SD)
 *
 * Бібліотеки:
 *   Adafruit GFX + ST7735
 *   Adafruit BMP280 (+ Unified Sensor)
 *   SparkFun MAX3010x
 *   HX711 (Bogde)
 *
 * MPU-6500 читаємо напряму по I²C (Adafruit_MPU6050 його часто відкидає).
 * Адреса MPU у тебе: 0x69
 *
 * HX711: DT→RX2(GPIO16)  SCK→TX2(GPIO17)  VCC→VIN/5V  GND→GND
 */

#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <Adafruit_BMP280.h>
#include <MAX30105.h>
#include "heartRate.h"
#include <HX711.h>

static const int PIN_TFT_CS  = 5;
static const int PIN_TFT_DC  = 15;
static const int PIN_TFT_RST = 4;
static const int PIN_SDA     = 21;
static const int PIN_SCL     = 22;
static const int PIN_MQ_A0   = 2;
static const int PIN_HX_DT   = 16;  // RX2
static const int PIN_HX_SCK  = 17;  // TX2

Adafruit_ST7735 tft(PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_RST);
Adafruit_BMP280 bmp;
MAX30105 particle;
HX711 scale;

static bool bmpOk = false;
static bool mpuOk = false;
static bool maxOk = false;
static bool hxOk  = false;
static bool finger = false;
static uint8_t mpuAddr = 0;

static int mqRaw = 0;
static float tC = 0, pHpa = 0;
static float ax = 0, ay = 0, az = 0;
static long ir = 0;
static int bpm = 0;
static long hxRaw = 0;

static const byte RATE_SIZE = 4;
static byte rates[RATE_SIZE];
static byte rateSpot = 0;
static long lastBeat = 0;

static int readAvg(int pin) {
  long s = 0;
  for (int i = 0; i < 8; i++) s += analogRead(pin);
  return (int)(s / 8);
}

static uint8_t i2cRead8(uint8_t addr, uint8_t reg) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return 0xFF;
  if (Wire.requestFrom((int)addr, 1) != 1) return 0xFF;
  return Wire.read();
}

static void i2cWrite8(uint8_t addr, uint8_t reg, uint8_t val) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

static bool mpuBegin() {
  // шукаємо 0x68 або 0x69; WHO_AM_I: MPU6500=0x70, MPU6050=0x68
  for (uint8_t a : { (uint8_t)0x68, (uint8_t)0x69 }) {
    uint8_t who = i2cRead8(a, 0x75);
    Serial.printf("MPU probe 0x%02X WHO=0x%02X\n", a, who);
    if (who == 0x70 || who == 0x68 || who == 0x71) {
      mpuAddr = a;
      delay(10);
      i2cWrite8(a, 0x6B, 0x00);  // wake PWR_MGMT_1
      delay(10);
      i2cWrite8(a, 0x1C, 0x08);  // accel ±4g
      Serial.printf("MPU OK @ 0x%02X (MPU-6500/6050)\n", a);
      return true;
    }
  }
  Serial.println(F("MPU FAIL (not on bus or wrong chip)"));
  return false;
}

static void mpuReadAccel() {
  if (!mpuOk) return;
  Wire.beginTransmission(mpuAddr);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return;
  if (Wire.requestFrom((int)mpuAddr, 6) != 6) return;
  int16_t rawX = (Wire.read() << 8) | Wire.read();
  int16_t rawY = (Wire.read() << 8) | Wire.read();
  int16_t rawZ = (Wire.read() << 8) | Wire.read();
  // ±4g → 8192 LSB/g
  ax = rawX / 8192.0f;
  ay = rawY / 8192.0f;
  az = rawZ / 8192.0f;
}

static bool hxTry(int dt, int sck, const char *tag) {
  scale.begin(dt, sck);
  delay(400);
  for (int i = 0; i < 8; i++) {
    if (scale.is_ready()) {
      scale.set_scale();
      scale.tare();
      Serial.printf("HX711 OK (%s) DT=%d SCK=%d\n", tag, dt, sck);
      return true;
    }
    delay(100);
  }
  Serial.printf("HX711 no ready (%s) DT=%d SCK=%d\n", tag, dt, sck);
  return false;
}

static void i2cScan() {
  Serial.println(F("--- I2C SDA=21 SCL=22 ---"));
  uint8_t n = 0;
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      Serial.printf("  0x%02X", a);
      if (a == 0x76 || a == 0x77) Serial.print(F(" BMP"));
      if (a == 0x68 || a == 0x69) Serial.print(F(" MPU"));
      if (a == 0x57) Serial.print(F(" MAX"));
      Serial.println();
      n++;
    }
  }
  if (!n) Serial.println(F("  (empty)"));
  Serial.println(F("-------------------------"));
}

static void line(int y, const char *a, const char *b, uint16_t col) {
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setCursor(0, y);
  tft.print(a);
  tft.setTextColor(col, ST77XX_BLACK);
  tft.setCursor(40, y);
  tft.print(b);
}

static void drawUi() {
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_CYAN, ST77XX_BLACK);
  tft.setCursor(0, 0);
  tft.print(F("DEBUG no-SD"));

  char buf[28];
  int y = 12;
  line(y, "TFT", "OK", ST77XX_GREEN); y += 11;

  snprintf(buf, sizeof(buf), "%d", mqRaw);
  line(y, "MQ", buf, mqRaw > 50 ? ST77XX_GREEN : ST77XX_RED); y += 11;

  if (!bmpOk) {
    line(y, "BMP", "NO", ST77XX_RED); y += 11;
  } else {
    snprintf(buf, sizeof(buf), "%.1fC", tC);
    line(y, "T", buf, ST77XX_GREEN); y += 11;
    snprintf(buf, sizeof(buf), "%.0fh", pHpa);
    line(y, "P", buf, ST77XX_GREEN); y += 11;
  }

  if (!mpuOk) {
    line(y, "MPU", "NO", ST77XX_RED); y += 11;
  } else {
    snprintf(buf, sizeof(buf), "%.2f", az);
    line(y, "az", buf, ST77XX_GREEN); y += 11;
  }

  if (!maxOk) {
    line(y, "MAX", "NO", ST77XX_RED); y += 11;
  } else if (!finger) {
    line(y, "MAX", "finger?", ST77XX_YELLOW); y += 11;
  } else {
    snprintf(buf, sizeof(buf), "HR%d", bpm);
    line(y, "MAX", buf, ST77XX_GREEN); y += 11;
  }

  if (!hxOk) {
    line(y, "HX", "NO", ST77XX_RED); y += 11;
  } else {
    snprintf(buf, sizeof(buf), "%ld", hxRaw);
    line(y, "HX", buf, ST77XX_GREEN); y += 11;
  }

  tft.setTextColor(tft.color565(140, 140, 140), ST77XX_BLACK);
  tft.setCursor(0, 150);
  tft.print(F("HX: RX2+TX2+5V"));
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== station_debug (no SD) ==="));
  Serial.println(F("MPU-6500 raw I2C | HX711 on RX2/TX2"));

  tft.initR(INITR_BLACKTAB);
  tft.setRotation(0);
  tft.fillScreen(ST77XX_BLACK);

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_MQ_A0, ADC_11db);

  Wire.begin(PIN_SDA, PIN_SCL);
  delay(100);
  i2cScan();

  bmpOk = bmp.begin(0x76) || bmp.begin(0x77);
  Serial.println(bmpOk ? F("BMP280 OK") : F("BMP280 FAIL"));

  mpuOk = mpuBegin();

  maxOk = particle.begin(Wire, I2C_SPEED_STANDARD);
  if (maxOk) {
    particle.setup(0x2F, 4, 2, 100, 411, 4096);
    particle.setPulseAmplitudeRed(0x2F);
    particle.setPulseAmplitudeIR(0x2F);
    particle.setPulseAmplitudeGreen(0);
    Serial.println(F("MAX30102 OK"));
  } else {
    Serial.println(F("MAX30102 FAIL"));
  }

  // HX711: спочатку норма DT=16 SCK=17, потім навпаки
  hxOk = hxTry(PIN_HX_DT, PIN_HX_SCK, "RX2=DT TX2=SCK");
  if (!hxOk) {
    hxOk = hxTry(PIN_HX_SCK, PIN_HX_DT, "swapped");
  }
  if (!hxOk) {
    Serial.println(F("HX711 FAIL — check:"));
    Serial.println(F("  VCC -> VIN (5V)"));
    Serial.println(F("  GND -> GND"));
    Serial.println(F("  DT  -> RX2"));
    Serial.println(F("  SCK -> TX2"));
    Serial.println(F("  + load cell wired to HX711"));
  }

  drawUi();
}

void loop() {
  mqRaw = readAvg(PIN_MQ_A0);

  if (bmpOk) {
    tC = bmp.readTemperature();
    pHpa = bmp.readPressure() / 100.0f;
  }

  if (mpuOk) mpuReadAccel();

  if (maxOk) {
    ir = particle.getIR();
    finger = (ir > 20000);
    if (finger && checkForBeat(ir)) {
      long delta = millis() - lastBeat;
      lastBeat = millis();
      int b = (int)(60000.0 / delta);
      if (b > 40 && b < 180) {
        rates[rateSpot++] = (byte)b;
        rateSpot %= RATE_SIZE;
        int sum = 0;
        for (byte i = 0; i < RATE_SIZE; i++) sum += rates[i];
        bpm = sum / RATE_SIZE;
      }
    }
    if (!finger) bpm = 0;
  }

  if (hxOk && scale.is_ready()) {
    hxRaw = scale.read();
  }

  static uint32_t lastUi = 0;
  static uint32_t lastLog = 0;
  uint32_t now = millis();

  if (now - lastUi >= 600) {
    lastUi = now;
    drawUi();
  }

  if (now - lastLog >= 1000) {
    lastLog = now;
    Serial.printf(
      "MQ=%d | BMP %s T=%.1f P=%.0f | MPU %s az=%.2f | MAX %s ir=%ld HR=%d | HX %s raw=%ld\n",
      mqRaw,
      bmpOk ? "OK" : "NO", tC, pHpa,
      mpuOk ? "OK" : "NO", az,
      maxOk ? (finger ? "OK" : "wait") : "NO", ir, bpm,
      hxOk ? "OK" : "NO", hxRaw
    );
  }
}
