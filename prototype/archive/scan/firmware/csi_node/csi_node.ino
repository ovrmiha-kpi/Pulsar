/**
 * PULSAR SCAN — CSI node for ESP32 DevKit V1
 *
 * Connects to your Wi‑Fi AP, enables CSI RX, streams amplitude vectors
 * over USB Serial as one JSON line per frame (~25 Hz max).
 *
 * Arduino IDE: board = "ESP32 Dev Module", upload speed 115200.
 * Needs: secrets.h (copy from secrets.h.example).
 *
 * PC: python scan.py --port COMx
 */

#include <Arduino.h>
#include <WiFi.h>
#include <math.h>
#include "esp_wifi.h"

#include "secrets.h"

#ifndef WIFI_SSID
#error "Copy secrets.h.example → secrets.h and set WIFI_SSID / WIFI_PASS"
#endif

static constexpr int kMaxSc = 64;
static constexpr uint32_t kMinEmitMs = 40;  // ~25 Hz ceiling

struct CsiFrame {
  volatile bool ready;
  int8_t rssi;
  uint8_t n;
  float amp[kMaxSc];
  uint32_t t_ms;
};

static CsiFrame g_frame;
static uint8_t g_ap_bssid[6];
static bool g_have_bssid = false;

static bool mac_eq(const uint8_t* a, const uint8_t* b) {
  for (int i = 0; i < 6; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
}

// Wi‑Fi task context — keep short.
static void on_csi(void* /*ctx*/, wifi_csi_info_t* info) {
  if (!info || !info->buf || info->len < 2) return;
  if (g_have_bssid && !mac_eq(info->mac, g_ap_bssid)) return;
  if (g_frame.ready) return;  // drop if PC/loop still busy

  const int8_t* d = (const int8_t*)info->buf;
  int n = info->len / 2;
  if (n > kMaxSc) n = kMaxSc;

  for (int i = 0; i < n; i++) {
    int im = d[i * 2];
    int re = d[i * 2 + 1];
    g_frame.amp[i] = sqrtf((float)(re * re + im * im));
  }
  g_frame.n = (uint8_t)n;
  g_frame.rssi = info->rx_ctrl.rssi;
  g_frame.t_ms = millis();
  g_frame.ready = true;
}

static bool enable_csi() {
  wifi_ap_record_t ap{};
  if (esp_wifi_sta_get_ap_info(&ap) == ESP_OK) {
    memcpy(g_ap_bssid, ap.bssid, 6);
    g_have_bssid = true;
  }

  wifi_csi_config_t cfg = {};
  cfg.lltf_en = true;
  cfg.htltf_en = false;
  cfg.stbc_htltf2_en = false;
  cfg.ltf_merge_en = true;
  cfg.channel_filter_en = false;
  cfg.manu_scale = false;
  cfg.shift = false;

  if (esp_wifi_set_csi_config(&cfg) != ESP_OK) return false;
  if (esp_wifi_set_csi_rx_cb(on_csi, nullptr) != ESP_OK) return false;
  if (esp_wifi_set_csi(true) != ESP_OK) return false;
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println(F("{\"type\":\"boot\",\"fw\":\"pulsar-csi-devkit-v1\"}"));

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print(F("{\"type\":\"wifi\",\"state\":\"connecting\"}\n"));
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - t0 > 30000) {
      Serial.println(F("{\"type\":\"error\",\"msg\":\"wifi_timeout\"}"));
      t0 = millis();
      WiFi.disconnect(true, true);
      delay(200);
      WiFi.begin(WIFI_SSID, WIFI_PASS);
    }
    delay(300);
  }

  Serial.printf(
      "{\"type\":\"wifi\",\"state\":\"ok\",\"ip\":\"%s\",\"rssi\":%d}\n",
      WiFi.localIP().toString().c_str(), WiFi.RSSI());

  if (!enable_csi()) {
    Serial.println(F("{\"type\":\"error\",\"msg\":\"csi_enable_failed\"}"));
  } else {
    Serial.println(F("{\"type\":\"csi\",\"state\":\"on\"}"));
  }
}

void loop() {
  static uint32_t last_emit = 0;

  if (WiFi.status() != WL_CONNECTED) {
    delay(200);
    return;
  }

  if (!g_frame.ready) {
    delay(1);
    return;
  }

  uint32_t now = millis();
  if (now - last_emit < kMinEmitMs) {
    g_frame.ready = false;
    return;
  }
  last_emit = now;

  // Snapshot
  uint8_t n = g_frame.n;
  int8_t rssi = g_frame.rssi;
  uint32_t t = g_frame.t_ms;
  float local[kMaxSc];
  for (uint8_t i = 0; i < n; i++) local[i] = g_frame.amp[i];
  g_frame.ready = false;

  // Compact JSON: {"t":..,"rssi":..,"len":N,"amp":[...]}
  Serial.printf("{\"t\":%lu,\"rssi\":%d,\"len\":%u,\"amp\":[",
                (unsigned long)t, (int)rssi, (unsigned)n);
  for (uint8_t i = 0; i < n; i++) {
    if (i) Serial.print(',');
    Serial.printf("%.1f", local[i]);
  }
  Serial.println("]}");
}
