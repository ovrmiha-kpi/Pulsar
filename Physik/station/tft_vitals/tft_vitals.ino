/*
 * Astro Health — SpO2 (MAX30102) + якість повітря (MQ-135) на TFT 1.8″
 * UI: два кільця «як у смарт-годиннику», портрет 128×160
 *
 * Бібліотеки:
 *   Adafruit GFX, Adafruit ST7735 and ST7789
 *   SparkFun MAX3010x Pulse and Proximity Sensor Library
 *
 * Плата: ESP32 Dev Module · Serial 115200
 *
 * HAS_MQ135: постав 1 після підключення MQ-135 на GPIO34
 */

#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <MAX30105.h>
#include "heartRate.h"

// ----- TFT (правий ряд) -----
static const int PIN_TFT_CS  = 5;
static const int PIN_TFT_DC  = 15;
static const int PIN_TFT_RST = 4;

// ----- MQ-135 -----
#define HAS_MQ135 0          // 0 = повітря ще не підключене; 1 після MQ-135
static const int PIN_MQ_A0 = 2;  // правий ряд (WIRING_NOW)

Adafruit_ST7735 tft = Adafruit_ST7735(PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_RST);
MAX30105 particle;

// ----- виміри -----
static float spo2Smooth = 0;
static float airSmooth  = 50;
static int   bpmSmooth  = 0;
static bool  fingerOn   = false;
static bool  maxOk      = false;

static const byte RATE_SIZE = 4;
static byte rates[RATE_SIZE];
static byte rateSpot = 0;
static long lastBeat = 0;

// буфер для оцінки SpO2 (R-ratio)
static const int SPO2_N = 50;
static uint32_t redBuf[SPO2_N];
static uint32_t irBuf[SPO2_N];
static int spo2Idx = 0;
static bool spo2Filled = false;

static float clampf(float v, float lo, float hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

static uint16_t lerpColor(uint16_t c1, uint16_t c2, float t) {
  t = clampf(t, 0, 1);
  uint8_t r1 = (c1 >> 11) & 0x1F, g1 = (c1 >> 5) & 0x3F, b1 = c1 & 0x1F;
  uint8_t r2 = (c2 >> 11) & 0x1F, g2 = (c2 >> 5) & 0x3F, b2 = c2 & 0x1F;
  uint8_t r = r1 + (r2 - r1) * t;
  uint8_t g = g1 + (g2 - g1) * t;
  uint8_t b = b1 + (b2 - b1) * t;
  return (r << 11) | (g << 5) | b;
}

// Дуга: start/end у градусах, 0° = вправо, за годинником вниз (+)
static void drawArc(int16_t cx, int16_t cy, int16_t r, int16_t thick,
                    float startDeg, float endDeg, uint16_t color) {
  if (endDeg < startDeg) {
    float tmp = startDeg;
    startDeg = endDeg;
    endDeg = tmp;
  }
  const float step = 1.2f;
  for (float a = startDeg; a <= endDeg; a += step) {
    float rad = a * 0.01745329252f;
    float ca = cosf(rad);
    float sa = sinf(rad);
    for (int16_t t = 0; t < thick; t++) {
      int16_t rr = r - t;
      tft.drawPixel(cx + (int16_t)(rr * ca), cy + (int16_t)(rr * sa), color);
    }
  }
}

static void drawWatchRing(int16_t cx, int16_t cy, int16_t r, int16_t thick,
                          float value01, uint16_t track, uint16_t fill,
                          const char *label, const char *valueStr, uint16_t valColor) {
  // трек ~270° (як у багатьох watch faces), старт знизу-зліва
  const float a0 = 135.0f;
  const float a1 = 135.0f + 270.0f;
  drawArc(cx, cy, r, thick, a0, a1, track);

  float v = clampf(value01, 0, 1);
  if (v > 0.002f) {
    drawArc(cx, cy, r, thick, a0, a0 + 270.0f * v, fill);
  }

  // підпис зверху всередині кільця
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  int16_t x1, y1;
  uint16_t w, h;
  tft.getTextBounds(label, 0, 0, &x1, &y1, &w, &h);
  tft.setCursor(cx - (int16_t)w / 2, cy - 18);
  tft.print(label);

  // велике число
  tft.setTextSize(2);
  tft.setTextColor(valColor, ST77XX_BLACK);
  tft.getTextBounds(valueStr, 0, 0, &x1, &y1, &w, &h);
  tft.setCursor(cx - (int16_t)w / 2, cy - 4);
  tft.print(valueStr);
}

static float estimateSpO2() {
  if (!spo2Filled && spo2Idx < 10) return 0;

  int n = spo2Filled ? SPO2_N : spo2Idx;
  double sumR = 0, sumI = 0;
  for (int i = 0; i < n; i++) {
    sumR += redBuf[i];
    sumI += irBuf[i];
  }
  double meanR = sumR / n;
  double meanI = sumI / n;
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
  // типова лінійна апроксимація для DIY
  float spo2 = (float)(110.0 - 25.0 * R);
  return clampf(spo2, 70.0f, 100.0f);
}

static float readAirQuality() {
#if HAS_MQ135
  // сиріше ADC → більше газу; «чистота» 100 = чисте
  int raw = 0;
  for (int i = 0; i < 8; i++) raw += analogRead(PIN_MQ_A0);
  raw /= 8;
  // 0..4095 → чистота 100..0 (піджени пороги під свій модуль)
  float dirty = clampf((raw - 400) / 2800.0f, 0, 1);
  return 100.0f * (1.0f - dirty);
#else
  // SIM: повільна «дихаюча» крива, поки немає MQ-135
  float t = millis() / 1000.0f;
  return clampf(72.0f + 18.0f * sinf(t * 0.35f), 0, 100);
#endif
}

static void readPulseOximeter() {
  if (!maxOk) {
    fingerOn = false;
    return;
  }

  long ir = particle.getIR();
  fingerOn = (ir > 20000);

  if (!fingerOn) {
    spo2Idx = 0;
    spo2Filled = false;
    spo2Smooth *= 0.9f;
    return;
  }

  long red = particle.getRed();
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
    int bpm = (int)(60000.0 / delta);
    if (bpm > 40 && bpm < 180) {
      rates[rateSpot++] = (byte)bpm;
      rateSpot %= RATE_SIZE;
      int sum = 0;
      for (byte i = 0; i < RATE_SIZE; i++) sum += rates[i];
      bpmSmooth = sum / RATE_SIZE;
    }
  }

  float spo2 = estimateSpO2();
  if (spo2 > 1) {
    if (spo2Smooth < 1) spo2Smooth = spo2;
    else spo2Smooth = spo2Smooth * 0.85f + spo2 * 0.15f;
  }
}

static void drawUi(float animPhase) {
  // легкий «пульс» товщини через фазу
  int16_t pulse = (int16_t)(1.5f * sinf(animPhase));

  // --- SpO2 зверху ---
  char spo2Str[8];
  float spo2Show = fingerOn ? spo2Smooth : 0;
  if (!fingerOn || spo2Show < 1) snprintf(spo2Str, sizeof(spo2Str), "--");
  else snprintf(spo2Str, sizeof(spo2Str), "%d", (int)(spo2Show + 0.5f));

  float spo2Norm = fingerOn ? clampf((spo2Show - 85.0f) / 15.0f, 0, 1) : 0;
  uint16_t spo2Col = lerpColor(tft.color565(255, 60, 60), tft.color565(0, 220, 140), spo2Norm);

  drawWatchRing(64, 48, 40 + pulse, 6,
                fingerOn ? clampf(spo2Show / 100.0f, 0, 1) : 0,
                tft.color565(40, 40, 48), spo2Col,
                "SpO2 %", spo2Str, spo2Col);

  // --- AIR знизу ---
  char airStr[8];
  snprintf(airStr, sizeof(airStr), "%d", (int)(airSmooth + 0.5f));
  float airNorm = airSmooth / 100.0f;
  uint16_t airCol = lerpColor(tft.color565(255, 120, 40), tft.color565(80, 180, 255), airNorm);

  drawWatchRing(64, 118, 36 + pulse, 6,
                airNorm,
                tft.color565(40, 40, 48), airCol,
#if HAS_MQ135
                "AIR",
#else
                "AIR~",
#endif
                airStr, airCol);

  // HR рядок
  tft.fillRect(0, 150, 128, 10, ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setCursor(4, 151);
  if (!maxOk) tft.print(F("MAX30102?"));
  else if (!fingerOn) tft.print(F("Put finger"));
  else {
    tft.print(F("HR "));
    if (bpmSmooth > 0) tft.print(bpmSmooth);
    else tft.print(F("--"));
    tft.print(F(" bpm"));
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println(F("=== tft_vitals SpO2 + AIR ==="));

  tft.initR(INITR_BLACKTAB);
  // tft.initR(INITR_GREENTAB);
  tft.setRotation(0);  // портрет 128×160 — кільця стовпчиком
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(false);

  Wire.begin(21, 22);  // SDA, SCL

  maxOk = particle.begin(Wire, I2C_SPEED_STANDARD);
  if (!maxOk) {
    Serial.println(F("MAX30102 not found"));
  } else {
    // Яскравіші Red+IR — інакше SpO2 лишається "--"
    particle.setup(0x2F, 4, 2, 100, 411, 4096);
    particle.setPulseAmplitudeRed(0x2F);
    particle.setPulseAmplitudeIR(0x2F);
    particle.setPulseAmplitudeGreen(0);
    Serial.println(F("MAX30102 OK — put finger on sensor"));
  }

#if HAS_MQ135
  analogReadResolution(12);
  Serial.println(F("MQ-135 on GPIO34"));
#else
  Serial.println(F("MQ-135 SIM (set HAS_MQ135 1 when wired)"));
#endif

  tft.setTextSize(1);
  tft.setTextColor(ST77XX_CYAN, ST77XX_BLACK);
  tft.setCursor(8, 8);
  tft.print(F("Astro Health"));
  delay(600);
  tft.fillScreen(ST77XX_BLACK);
}

void loop() {
  readPulseOximeter();

  float air = readAirQuality();
  airSmooth = airSmooth * 0.9f + air * 0.1f;

  static uint32_t lastDraw = 0;
  uint32_t now = millis();
  if (now - lastDraw >= 50) {
    lastDraw = now;
    // часткове очищення зон кілець (щоб не мигало все)
    tft.fillRect(20, 4, 88, 90, ST77XX_BLACK);
    tft.fillRect(24, 78, 80, 72, ST77XX_BLACK);
    drawUi(now / 180.0f);
  }

  static uint32_t lastLog = 0;
  if (now - lastLog >= 1000) {
    lastLog = now;
    Serial.printf("SpO2=%.1f HR=%d finger=%d AIR=%.1f\n",
                  spo2Smooth, bpmSmooth, fingerOn ? 1 : 0, airSmooth);
  }
}
