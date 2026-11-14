/*
 * Astro Health — multi-screen UI (128×160 ST7735)
 *
 * BTN2 (D26) = next screen · BTN3 (D27) = prev · BTN1 (D25) = home / tare on Force
 *
 * Screens: Home · Heart · Air · Climate · Motion · Force
 */

#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <Adafruit_BMP280.h>
#include <MAX30105.h>
#include "heartRate.h"
#include <HX711.h>
#include <math.h>

static const int PIN_TFT_CS  = 5;
static const int PIN_TFT_DC  = 15;
static const int PIN_TFT_RST = 4;
static const int PIN_SDA     = 21;
static const int PIN_SCL     = 22;
static const int PIN_MQ_A0   = 2;
static const int PIN_HX_DT   = 16;
static const int PIN_HX_SCK  = 17;
static const int PIN_BTN1    = 25;
static const int PIN_BTN2    = 26;
static const int PIN_BTN3    = 27;

Adafruit_ST7735 tft(PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_RST);
Adafruit_BMP280 bmp;
MAX30105 particle;
HX711 scale;

enum Screen : uint8_t {
  SCR_HOME = 0,
  SCR_HEART,
  SCR_AIR,
  SCR_CLIMATE,
  SCR_MOTION,
  SCR_FORCE,
  SCR_COUNT
};

static Screen screen = SCR_HOME;
static Screen lastDrawn = (Screen)255;
static bool dirty = true;

static bool bmpOk = false, mpuOk = false, maxOk = false, hxOk = false;
static uint8_t mpuAddr = 0;

static int mqRaw = 0;
static float airQ = 50;
static float tC = 0, pHpa = 1013;
static float ax = 0, ay = 0, az = 1;
static float magG = 1;
static long ir = 0, red = 0;
static bool finger = false;
static int bpm = 0;
static float spo2 = 0;
static long hxRaw = 0;
static float hxUnits = 0;

static const byte RATE_SIZE = 4;
static byte rates[RATE_SIZE];
static byte rateSpot = 0;
static long lastBeat = 0;

static const int SPO2_N = 50;
static uint32_t redBuf[SPO2_N], irBuf[SPO2_N];
static int spo2Idx = 0;
static bool spo2Filled = false;

static bool btn1Prev = true, btn2Prev = true, btn3Prev = true;  // assume pressed until HIGH seen
static bool btn1Arm = false, btn2Arm = false, btn3Arm = false;   // arm only after release (HIGH)
static uint32_t btnLockUntil = 0;
static int rawBtn1 = 1, rawBtn2 = 1, rawBtn3 = 1;  // digitalRead: 1=HIGH idle
static bool btnWiringBad = false;

// ---- colors ----
static uint16_t C(uint8_t r, uint8_t g, uint8_t b) {
  return tft.color565(r, g, b);
}

static float clampf(float v, float lo, float hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

static uint16_t lerpColor(uint16_t c1, uint16_t c2, float t) {
  t = clampf(t, 0, 1);
  uint8_t r1 = (c1 >> 11) & 0x1F, g1 = (c1 >> 5) & 0x3F, b1 = c1 & 0x1F;
  uint8_t r2 = (c2 >> 11) & 0x1F, g2 = (c2 >> 5) & 0x3F, b2 = c2 & 0x1F;
  uint8_t r = r1 + (uint8_t)((r2 - r1) * t);
  uint8_t g = g1 + (uint8_t)((g2 - g1) * t);
  uint8_t b = b1 + (uint8_t)((b2 - b1) * t);
  return (r << 11) | (g << 5) | b;
}

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
  for (uint8_t a : { (uint8_t)0x68, (uint8_t)0x69 }) {
    uint8_t who = i2cRead8(a, 0x75);
    if (who == 0x70 || who == 0x68 || who == 0x71) {
      mpuAddr = a;
      delay(10);
      i2cWrite8(a, 0x6B, 0x00);
      delay(10);
      i2cWrite8(a, 0x1C, 0x08);
      return true;
    }
  }
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
  ax = rawX / 8192.0f;
  ay = rawY / 8192.0f;
  az = rawZ / 8192.0f;
  magG = sqrtf(ax * ax + ay * ay + az * az);
}

static bool hxTry(int dt, int sck) {
  scale.begin(dt, sck);
  delay(300);
  for (int i = 0; i < 8; i++) {
    if (scale.is_ready()) {
      scale.set_scale(420.0f);
      scale.tare();
      return true;
    }
    delay(80);
  }
  return false;
}

static float estimateSpO2() {
  int n = spo2Filled ? SPO2_N : spo2Idx;
  if (n < 10) return 0;
  double sumR = 0, sumI = 0;
  for (int i = 0; i < n; i++) {
    sumR += redBuf[i];
    sumI += irBuf[i];
  }
  double meanR = sumR / n, meanI = sumI / n;
  if (meanR < 1 || meanI < 1) return 0;
  double acR = 0, acI = 0;
  for (int i = 0; i < n; i++) {
    double dR = redBuf[i] - meanR;
    double dI = irBuf[i] - meanI;
    acR += dR * dR;
    acI += dI * dI;
  }
  acR = sqrt(acR / n);
  acI = sqrt(acI / n);
  if (acI < 1) return 0;
  double R = (acR / meanR) / (acI / meanI);
  return clampf((float)(110.0 - 25.0 * R), 70.0f, 100.0f);
}

// ---- drawing helpers ----
static void drawArc(int16_t cx, int16_t cy, int16_t r, int16_t thick,
                    float startDeg, float endDeg, uint16_t color) {
  if (endDeg < startDeg) {
    float t = startDeg;
    startDeg = endDeg;
    endDeg = t;
  }
  for (float a = startDeg; a <= endDeg; a += 1.4f) {
    float rad = a * 0.01745329252f;
    float ca = cosf(rad), sa = sinf(rad);
    for (int16_t t = 0; t < thick; t++) {
      int16_t rr = r - t;
      tft.drawPixel(cx + (int16_t)(rr * ca), cy + (int16_t)(rr * sa), color);
    }
  }
}

static void drawRing(int16_t cx, int16_t cy, int16_t r, int16_t thick,
                     float v01, uint16_t track, uint16_t fill) {
  const float a0 = 135.0f;
  drawArc(cx, cy, r, thick, a0, a0 + 270.0f, track);
  float v = clampf(v01, 0, 1);
  if (v > 0.01f) drawArc(cx, cy, r, thick, a0, a0 + 270.0f * v, fill);
}

static void printCentered(int16_t cx, int16_t y, const char *s, uint8_t size, uint16_t col, uint16_t bg) {
  tft.setTextSize(size);
  tft.setTextColor(col, bg);
  int16_t x1, y1;
  uint16_t w, h;
  tft.getTextBounds(s, 0, 0, &x1, &y1, &w, &h);
  tft.setCursor(cx - (int16_t)w / 2, y);
  tft.print(s);
}

static void drawDots(uint8_t active, uint16_t onCol, uint16_t offCol) {
  int16_t total = (int16_t)SCR_COUNT * 10;
  int16_t x0 = (128 - total) / 2 + 3;
  for (uint8_t i = 0; i < SCR_COUNT; i++) {
    tft.fillCircle(x0 + i * 10, 152, i == active ? 3 : 2, i == active ? onCol : offCol);
  }
}

static void drawHeader(const char *title, uint16_t accent, uint16_t bg) {
  tft.fillRect(0, 0, 128, 18, bg);
  tft.drawFastHLine(0, 17, 128, accent);
  tft.setTextSize(1);
  tft.setTextColor(accent, bg);
  tft.setCursor(4, 5);
  tft.print(title);
}

static void setScreen(Screen s) {
  if (s >= SCR_COUNT) s = SCR_HOME;
  screen = s;
  dirty = true;
}

// ---- screens ----
static void drawHome(uint16_t bg) {
  tft.fillScreen(bg);
  uint16_t accent = C(0, 200, 210);
  uint16_t mute = C(70, 90, 100);

  printCentered(64, 18, "ASTRO", 2, accent, bg);
  printCentered(64, 40, "HEALTH", 2, C(230, 240, 245), bg);
  printCentered(64, 66, "station", 1, mute, bg);

  // status chips
  auto chip = [&](int16_t x, int16_t y, const char *lab, bool ok) {
    uint16_t c = ok ? C(40, 180, 120) : C(180, 70, 70);
    tft.drawRoundRect(x, y, 38, 16, 3, c);
    tft.setTextSize(1);
    tft.setTextColor(c, bg);
    tft.setCursor(x + 4, y + 4);
    tft.print(lab);
  };
  chip(6, 88, "MAX", maxOk);
  chip(48, 88, "BMP", bmpOk);
  chip(90, 88, "MPU", mpuOk);
  chip(27, 110, "HX", hxOk);
  chip(69, 110, "MQ", mqRaw > 20);

  if (btnWiringBad) {
    printCentered(64, 128, "BTN SHORT!", 1, C(255, 80, 80), bg);
    printCentered(64, 140, "use OPPOSITE pins", 1, C(255, 160, 80), bg);
  } else {
    printCentered(64, 132, "BTN2 next  BTN3 back", 1, mute, bg);
  }
  drawDots(SCR_HOME, accent, C(40, 50, 55));
}

static void drawHeart(float phase) {
  uint16_t bg = C(8, 4, 8);
  tft.fillScreen(bg);
  uint16_t accent = C(255, 70, 90);
  drawHeader("HEART", accent, bg);

  float pulse = 1.5f * sinf(phase);
  char spo2Str[8], bpmStr[8];
  if (!finger || spo2 < 1) snprintf(spo2Str, sizeof(spo2Str), "--");
  else snprintf(spo2Str, sizeof(spo2Str), "%d", (int)(spo2 + 0.5f));
  if (!finger || bpm < 1) snprintf(bpmStr, sizeof(bpmStr), "--");
  else snprintf(bpmStr, sizeof(bpmStr), "%d", bpm);

  float n = finger ? clampf((spo2 - 85.0f) / 15.0f, 0, 1) : 0;
  uint16_t col = lerpColor(C(255, 60, 60), C(0, 220, 140), n);
  uint16_t track = C(40, 18, 24);

  drawRing(64, 72, 42 + (int16_t)pulse, 7,
           finger ? clampf(spo2 / 100.0f, 0, 1) : 0, track, col);

  printCentered(64, 52, "SpO2", 1, C(200, 160, 170), bg);
  printCentered(64, 66, spo2Str, 3, col, bg);
  printCentered(64, 96, "%", 1, C(160, 120, 130), bg);

  tft.setTextSize(1);
  tft.setTextColor(accent, bg);
  tft.setCursor(10, 122);
  tft.print(F("HR "));
  tft.setTextSize(2);
  tft.setTextColor(C(255, 200, 210), bg);
  tft.setCursor(36, 118);
  tft.print(bpmStr);
  tft.setTextSize(1);
  tft.setTextColor(C(140, 100, 110), bg);
  tft.setCursor(90, 124);
  tft.print(F("bpm"));

  if (!maxOk) printCentered(64, 138, "sensor offline", 1, C(180, 80, 80), bg);
  else if (!finger) printCentered(64, 138, "place finger", 1, C(200, 160, 80), bg);

  drawDots(SCR_HEART, accent, C(50, 20, 28));
}

static void drawAir(float phase) {
  uint16_t bg = C(4, 10, 18);
  tft.fillScreen(bg);
  uint16_t accent = C(80, 190, 255);
  drawHeader("AIR QUALITY", accent, bg);

  float pulse = 1.2f * sinf(phase * 0.8f);
  char airStr[8];
  snprintf(airStr, sizeof(airStr), "%d", (int)(airQ + 0.5f));
  float n = airQ / 100.0f;
  uint16_t col = lerpColor(C(255, 120, 40), C(60, 200, 255), n);
  uint16_t track = C(20, 36, 50);

  drawRing(64, 78, 44 + (int16_t)pulse, 8, n, track, col);
  printCentered(64, 58, "clean", 1, C(140, 180, 200), bg);
  printCentered(64, 72, airStr, 3, col, bg);
  printCentered(64, 102, "/100", 1, C(100, 140, 160), bg);

  char raw[20];
  snprintf(raw, sizeof(raw), "ADC %d", mqRaw);
  printCentered(64, 128, raw, 1, C(90, 120, 140), bg);
  drawDots(SCR_AIR, accent, C(20, 40, 55));
}

static void drawClimate() {
  uint16_t bg = C(12, 10, 6);
  tft.fillScreen(bg);
  uint16_t accent = C(255, 170, 60);
  drawHeader("CLIMATE", accent, bg);

  if (!bmpOk) {
    printCentered(64, 70, "BMP offline", 1, C(200, 80, 80), bg);
    drawDots(SCR_CLIMATE, accent, C(50, 40, 20));
    return;
  }

  // temp block
  float tNorm = clampf((tC - 10.0f) / 30.0f, 0, 1);
  uint16_t tCol = lerpColor(C(80, 160, 255), C(255, 120, 40), tNorm);
  uint16_t tBg = C(28, 22, 14);
  tft.fillRoundRect(8, 28, 112, 52, 6, tBg);
  tft.drawRoundRect(8, 28, 112, 52, 6, tCol);
  printCentered(64, 34, "TEMPERATURE", 1, C(180, 150, 100), tBg);
  char tStr[12];
  snprintf(tStr, sizeof(tStr), "%.1f", tC);
  printCentered(64, 48, tStr, 3, tCol, tBg);
  tft.setTextSize(1);
  tft.setTextColor(tCol, tBg);
  tft.setCursor(98, 58);
  tft.print('C');

  // pressure block
  uint16_t pCol = C(120, 200, 180);
  uint16_t pBg = C(18, 28, 26);
  tft.fillRoundRect(8, 88, 112, 44, 6, pBg);
  tft.drawRoundRect(8, 88, 112, 44, 6, pCol);
  printCentered(64, 94, "PRESSURE", 1, C(120, 160, 150), pBg);
  char pStr[16];
  snprintf(pStr, sizeof(pStr), "%.0f hPa", pHpa);
  printCentered(64, 110, pStr, 2, pCol, pBg);

  drawDots(SCR_CLIMATE, accent, C(50, 40, 20));
}

static void drawMotion(float phase) {
  uint16_t bg = C(6, 12, 8);
  tft.fillScreen(bg);
  uint16_t accent = C(120, 255, 90);
  drawHeader("MOTION", accent, bg);

  if (!mpuOk) {
    printCentered(64, 70, "MPU offline", 1, C(200, 80, 80), bg);
    drawDots(SCR_MOTION, accent, C(30, 50, 30));
    return;
  }

  float n = clampf(magG / 2.0f, 0, 1);
  uint16_t col = lerpColor(C(80, 140, 80), accent, n);
  drawRing(64, 70, 40 + (int16_t)(sinf(phase) * 1.2f), 6, n, C(24, 40, 28), col);

  char gStr[12];
  snprintf(gStr, sizeof(gStr), "%.2fg", magG);
  printCentered(64, 62, gStr, 2, col, bg);

  char line[28];
  snprintf(line, sizeof(line), "x%.2f y%.2f", ax, ay);
  printCentered(64, 118, line, 1, C(120, 160, 120), bg);
  snprintf(line, sizeof(line), "z%.2f", az);
  printCentered(64, 132, line, 1, C(120, 160, 120), bg);
  drawDots(SCR_MOTION, accent, C(30, 50, 30));
}

static void drawForce() {
  uint16_t bg = C(14, 8, 4);
  tft.fillScreen(bg);
  uint16_t accent = C(255, 140, 40);
  drawHeader("GRIP / FORCE", accent, bg);

  if (!hxOk) {
    printCentered(64, 70, "HX711 offline", 1, C(200, 80, 80), bg);
    printCentered(64, 90, "check 5V RX2 TX2", 1, C(140, 100, 80), bg);
    drawDots(SCR_FORCE, accent, C(50, 30, 15));
    return;
  }

  float absU = fabsf(hxUnits);
  float n = clampf(absU / 5000.0f, 0, 1);
  uint16_t col = lerpColor(C(180, 100, 40), accent, n);

  // bar meter
  tft.drawRoundRect(14, 36, 100, 18, 4, C(60, 36, 18));
  int16_t fillW = (int16_t)(96 * n);
  if (fillW > 0) tft.fillRoundRect(16, 38, fillW, 14, 3, col);

  char uStr[16];
  snprintf(uStr, sizeof(uStr), "%.0f", hxUnits);
  printCentered(64, 70, uStr, 3, col, bg);
  printCentered(64, 100, "units", 1, C(160, 120, 80), bg);

  char raw[24];
  snprintf(raw, sizeof(raw), "raw %ld", hxRaw);
  printCentered(64, 118, raw, 1, C(120, 90, 60), bg);
  printCentered(64, 134, "BTN1 = tare", 1, C(160, 120, 70), bg);
  drawDots(SCR_FORCE, accent, C(50, 30, 15));
}

static void drawCurrent(float phase) {
  switch (screen) {
    case SCR_HOME:    drawHome(C(6, 10, 14)); break;
    case SCR_HEART:   drawHeart(phase); break;
    case SCR_AIR:     drawAir(phase); break;
    case SCR_CLIMATE: drawClimate(); break;
    case SCR_MOTION:  drawMotion(phase); break;
    case SCR_FORCE:   drawForce(); break;
    default: break;
  }
  lastDrawn = screen;
  dirty = false;
}

static void handleButtons() {
  uint32_t now = millis();
  rawBtn1 = digitalRead(PIN_BTN1);
  rawBtn2 = digitalRead(PIN_BTN2);
  rawBtn3 = digitalRead(PIN_BTN3);
  bool b1 = (rawBtn1 == LOW);
  bool b2 = (rawBtn2 == LOW);
  bool b3 = (rawBtn3 == LOW);

  // INPUT_PULLUP: idle MUST be HIGH. If all stuck LOW → wrong 4-pin pair (same side).
  bool wasBad = btnWiringBad;
  btnWiringBad = (rawBtn1 == LOW && rawBtn2 == LOW && rawBtn3 == LOW);
  if (btnWiringBad && !wasBad) {
    Serial.println(F("[BTN] WIRING BAD: D25/26/27 all LOW"));
    Serial.println(F("  -> wires on SAME side of 4-pin switch (always shorted)"));
    Serial.println(F("  -> move one wire to the OPPOSITE side of the button"));
    dirty = true;
  }
  if (!btnWiringBad && wasBad) {
    Serial.println(F("[BTN] wiring OK — pins released to HIGH"));
    dirty = true;
  }

  // arm each button only after we see a real release (HIGH)
  if (!b1) btn1Arm = true;
  if (!b2) btn2Arm = true;
  if (!b3) btn3Arm = true;

  if (b1 != btn1Prev) {
    Serial.printf("[BTN1] D25 raw=%d %s arm=%d\n", rawBtn1, b1 ? "PRESS" : "release", btn1Arm);
  }
  if (b2 != btn2Prev) {
    Serial.printf("[BTN2] D26 raw=%d %s arm=%d\n", rawBtn2, b2 ? "PRESS" : "release", btn2Arm);
  }
  if (b3 != btn3Prev) {
    Serial.printf("[BTN3] D27 raw=%d %s arm=%d\n", rawBtn3, b3 ? "PRESS" : "release", btn3Arm);
  }

  if (now < btnLockUntil || btnWiringBad) {
    btn1Prev = b1;
    btn2Prev = b2;
    btn3Prev = b3;
    return;
  }

  // accept only HIGH->LOW after armed (real click)
  if (b2 && !btn2Prev && btn2Arm) {
    setScreen((Screen)((screen + 1) % SCR_COUNT));
    Serial.printf("[BTN] next -> SCR=%u\n", (unsigned)screen);
    btnLockUntil = now + 220;
  } else if (b3 && !btn3Prev && btn3Arm) {
    setScreen((Screen)((screen + SCR_COUNT - 1) % SCR_COUNT));
    Serial.printf("[BTN] prev -> SCR=%u\n", (unsigned)screen);
    btnLockUntil = now + 220;
  } else if (b1 && !btn1Prev && btn1Arm) {
    if (screen == SCR_FORCE && hxOk) {
      scale.tare();
      dirty = true;
      Serial.println(F("[BTN] tare"));
    } else {
      setScreen(SCR_HOME);
      Serial.println(F("[BTN] home"));
    }
    btnLockUntil = now + 220;
  }

  btn1Prev = b1;
  btn2Prev = b2;
  btn3Prev = b3;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println(F("=== Astro Health UI ==="));

  pinMode(PIN_BTN1, INPUT_PULLUP);
  pinMode(PIN_BTN2, INPUT_PULLUP);
  pinMode(PIN_BTN3, INPUT_PULLUP);
  Serial.println(F("BTN wiring: D25/D26/D27 --[btn]--> GND  (INPUT_PULLUP)"));
  Serial.printf("BTN idle raw: D25=%d D26=%d D27=%d  (expect 1=HIGH)\n",
                digitalRead(PIN_BTN1), digitalRead(PIN_BTN2), digitalRead(PIN_BTN3));

  tft.initR(INITR_BLACKTAB);
  tft.setRotation(0);
  tft.setTextWrap(false);
  tft.fillScreen(C(6, 10, 14));
  printCentered(64, 70, "ASTRO", 2, C(0, 200, 210), C(6, 10, 14));
  printCentered(64, 96, "booting...", 1, C(100, 120, 130), C(6, 10, 14));

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_MQ_A0, ADC_11db);

  Wire.begin(PIN_SDA, PIN_SCL);
  delay(80);

  bmpOk = bmp.begin(0x76) || bmp.begin(0x77);
  mpuOk = mpuBegin();
  maxOk = particle.begin(Wire, I2C_SPEED_STANDARD);
  if (maxOk) {
    particle.setup(0x2F, 4, 2, 100, 411, 4096);
    particle.setPulseAmplitudeRed(0x2F);
    particle.setPulseAmplitudeIR(0x2F);
    particle.setPulseAmplitudeGreen(0);
  }

  hxOk = hxTry(PIN_HX_DT, PIN_HX_SCK);
  if (!hxOk) hxOk = hxTry(PIN_HX_SCK, PIN_HX_DT);

  Serial.printf("BMP=%d MPU=%d MAX=%d HX=%d\n", bmpOk, mpuOk, maxOk, hxOk);
  dirty = true;
}

void loop() {
  handleButtons();

  // sensors
  mqRaw = readAvg(PIN_MQ_A0);
  float dirtyAir = clampf((mqRaw - 400) / 2800.0f, 0, 1);
  float airNow = 100.0f * (1.0f - dirtyAir);
  airQ = airQ * 0.85f + airNow * 0.15f;

  if (bmpOk) {
    tC = bmp.readTemperature();
    pHpa = bmp.readPressure() / 100.0f;
  }
  if (mpuOk) mpuReadAccel();

  if (maxOk) {
    ir = particle.getIR();
    red = particle.getRed();
    finger = (ir > 20000);
    if (!finger) {
      spo2Idx = 0;
      spo2Filled = false;
      spo2 *= 0.9f;
      bpm = 0;
    } else {
      redBuf[spo2Idx] = (uint32_t)red;
      irBuf[spo2Idx] = (uint32_t)ir;
      spo2Idx++;
      if (spo2Idx >= SPO2_N) {
        spo2Idx = 0;
        spo2Filled = true;
      }
      if (checkForBeat(ir)) {
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
      float s = estimateSpO2();
      if (s > 1) spo2 = (spo2 < 1) ? s : spo2 * 0.85f + s * 0.15f;
    }
  }

  if (hxOk && scale.is_ready()) {
    hxRaw = scale.read();
    hxUnits = scale.get_units(1);
  }

  static uint32_t lastUi = 0;
  uint32_t now = millis();
  bool animScreen = (screen == SCR_HEART || screen == SCR_AIR || screen == SCR_MOTION);
  uint32_t period = animScreen ? 80 : 400;
  if (dirty || (now - lastUi >= period)) {
    lastUi = now;
    drawCurrent(now / 180.0f);
  }

  static uint32_t lastLog = 0;
  if (now - lastLog >= 500) {
    lastLog = now;
    // pressed = raw LOW (0). Idle should stay 1 1 1
    Serial.printf(
      "BTN raw D25=%d D26=%d D27=%d | press %d%d%d | SCR=%u | SpO2=%.0f HR=%d AIR=%.0f T=%.1f HX=%.0f\n",
      rawBtn1, rawBtn2, rawBtn3,
      rawBtn1 == LOW ? 1 : 0, rawBtn2 == LOW ? 1 : 0, rawBtn3 == LOW ? 1 : 0,
      (unsigned)screen, spo2, bpm, airQ, tC, hxUnits
    );
  }
}
