#!/usr/bin/env python3
"""
PULSAR SCAN — desktop CSI map (не браузер, не камера).

Читає Wi‑Fi CSI з ESP32 DevKit V1 по USB Serial і малює позицію
вздовж лінка AP → ESP на карті станції.

  pip install -r requirements.txt
  python scan.py --port COM11
  Q = вихід
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import deque

import cv2
import numpy as np

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    print("Потрібен pyserial: pip install pyserial", file=sys.stderr)
    raise SystemExit(1)

MODULES = [
    ("HAB", 2, 2, 10, 7),
    ("LAB", 13, 2, 8, 7),
    ("GALLEY", 2, 10, 6, 5),
    ("AIRLOCK", 9, 10.5, 5, 4),
    ("STORAGE", 15, 10, 6, 5),
]
WORLD = (0.5, 0.5, 22.0, 16.0)

# Default AP / ESP anchors on station floor (meters)
DEFAULT_AP = (4.0, 4.0)
DEFAULT_ESP = (18.0, 12.0)


def module_at(x: float, y: float) -> str:
    for name, mx, my, w, h in MODULES:
        if mx <= x <= mx + w and my <= y <= my + h:
            return name
    return "DECK"


def list_serial_ports() -> list[str]:
    return [p.device for p in list_ports.comports()]


def open_serial(port: str, baud: int) -> serial.Serial:
    try:
        ser = serial.Serial(port, baud, timeout=0.05)
    except serial.SerialException as e:
        ports = ", ".join(list_serial_ports()) or "(none)"
        raise RuntimeError(f"Не відкрити {port}: {e}. Доступні: {ports}") from e
    time.sleep(0.3)
    ser.reset_input_buffer()
    return ser


def parse_csi_line(line: str) -> dict | None:
    line = line.strip()
    if not line.startswith("{") or "amp" not in line:
        return None
    try:
        obj = json.loads(line)
    except json.JSONDecodeError:
        return None
    amp = obj.get("amp")
    if not isinstance(amp, list) or len(amp) < 4:
        return None
    return obj


class CsiTracker:
    """Baseline + motion energy → presence + position along AP–ESP."""

    def __init__(
        self,
        ap: tuple[float, float],
        esp: tuple[float, float],
        baseline_s: float = 5.0,
        presence_k: float = 3.0,
    ) -> None:
        self.ap = np.array(ap, dtype=np.float64)
        self.esp = np.array(esp, dtype=np.float64)
        self.baseline_s = baseline_s
        self.presence_k = presence_k
        self.t0: float | None = None
        self.baseline_sum: np.ndarray | None = None
        self.baseline_sq: np.ndarray | None = None
        self.baseline_n = 0
        self.mean: np.ndarray | None = None
        self.std: np.ndarray | None = None
        self.ready = False
        self.energy = 0.0
        self.energy_hist: deque[float] = deque(maxlen=120)
        self.noise_floor = 0.05
        self.pos_t = 0.5  # 0=AP … 1=ESP
        self.presence = False
        self.amp_len = 0

    def update(self, amp: list[float], now: float) -> None:
        a = np.asarray(amp, dtype=np.float64)
        self.amp_len = int(a.size)
        if self.t0 is None:
            self.t0 = now

        if not self.ready:
            if self.baseline_sum is None or self.baseline_sum.shape != a.shape:
                self.baseline_sum = np.zeros_like(a)
                self.baseline_sq = np.zeros_like(a)
                self.baseline_n = 0
            self.baseline_sum += a
            self.baseline_sq += a * a
            self.baseline_n += 1
            if now - self.t0 >= self.baseline_s and self.baseline_n >= 20:
                mean = self.baseline_sum / self.baseline_n
                var = self.baseline_sq / self.baseline_n - mean * mean
                std = np.sqrt(np.maximum(var, 1e-6))
                self.mean = mean
                self.std = np.maximum(std, 0.5)
                self.ready = True
                # noise from late baseline window proxy
                self.noise_floor = max(0.05, float(np.mean(std) * 0.5))
            return

        assert self.mean is not None and self.std is not None
        if a.shape != self.mean.shape:
            return

        z = np.abs(a - self.mean) / self.std
        energy = float(np.mean(z))
        self.energy = 0.85 * self.energy + 0.15 * energy if self.energy else energy
        self.energy_hist.append(self.energy)

        thr = max(self.noise_floor * self.presence_k, 0.35)
        self.presence = self.energy > thr

        if self.presence:
            # Stronger disturbance → closer to midpoint of Fresnel zone (link center)
            # Weak → nearer endpoints; map energy to t in [0.15, 0.85]
            strength = np.clip((self.energy - thr) / max(thr, 1e-3), 0.0, 3.0) / 3.0
            # Use spectral tilt: low-sc vs high-sc imbalance as coarse range cue
            mid = a.size // 2
            low = float(np.mean(z[:mid])) if mid else energy
            high = float(np.mean(z[mid:])) if mid else energy
            tilt = (high - low) / max(low + high, 1e-3)  # -1..1
            target = 0.5 + 0.35 * tilt
            target = float(np.clip(0.15 + 0.7 * strength * 0.3 + target * 0.7, 0.1, 0.9))
            self.pos_t = 0.88 * self.pos_t + 0.12 * target

    def xy(self) -> tuple[float, float] | None:
        if not self.presence or not self.ready:
            return None
        p = self.ap + self.pos_t * (self.esp - self.ap)
        return float(p[0]), float(p[1])


def draw_map(
    tracker: CsiTracker,
    status: str,
    fps: float,
    port: str,
    size: tuple[int, int] = (1100, 720),
) -> np.ndarray:
    w, h = size
    img = np.full((h, w, 3), 12, np.uint8)
    minx, miny, maxx, maxy = WORLD
    pad = 36

    def proj(wx: float, wy: float) -> tuple[int, int]:
        sx = (w - 2 * pad) / (maxx - minx)
        sy = (h - 2 * pad) / (maxy - miny)
        s = min(sx, sy)
        ox = pad + (w - 2 * pad - s * (maxx - minx)) / 2
        oy = pad + (h - 2 * pad - s * (maxy - miny)) / 2
        return int(ox + (wx - minx) * s), int(oy + (wy - miny) * s)

    for gx in range(1, 23):
        cv2.line(img, proj(gx, miny), proj(gx, maxy), (28, 28, 32), 1)
    for gy in range(1, 17):
        cv2.line(img, proj(minx, gy), proj(maxx, gy), (28, 28, 32), 1)

    for name, mx, my, mw, mh in MODULES:
        a, b = proj(mx, my), proj(mx + mw, my + mh)
        cv2.rectangle(img, a, b, (55, 55, 60), 1)
        cv2.putText(
            img, name, (a[0] + 8, a[1] + 22),
            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 185), 1, cv2.LINE_AA,
        )

    ap_p = proj(*tracker.ap)
    esp_p = proj(*tracker.esp)
    cv2.line(img, ap_p, esp_p, (70, 90, 120), 2, cv2.LINE_AA)
    cv2.circle(img, ap_p, 8, (80, 160, 255), -1, cv2.LINE_AA)
    cv2.putText(img, "AP", (ap_p[0] + 10, ap_p[1] - 6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (80, 160, 255), 1, cv2.LINE_AA)
    cv2.circle(img, esp_p, 8, (255, 180, 60), -1, cv2.LINE_AA)
    cv2.putText(img, "ESP", (esp_p[0] + 10, esp_p[1] - 6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 180, 60), 1, cv2.LINE_AA)

    xy = tracker.xy()
    if xy is not None:
        p = proj(*xy)
        color = (100, 220, 100)
        cv2.circle(img, p, 12, color, -1, cv2.LINE_AA)
        cv2.circle(img, p, 22, color, 1, cv2.LINE_AA)
        mod = module_at(*xy)
        cv2.putText(
            img,
            f"RF  {mod}  ({xy[0]:.1f},{xy[1]:.1f})m  E={tracker.energy:.2f}",
            (p[0] + 16, p[1] - 8),
            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (240, 240, 245), 1, cv2.LINE_AA,
        )

    # Energy strip (right)
    strip_x0, strip_y0 = w - 160, 60
    strip_h, strip_w = 200, 120
    cv2.rectangle(img, (strip_x0, strip_y0), (strip_x0 + strip_w, strip_y0 + strip_h), (30, 30, 34), -1)
    cv2.putText(img, "CSI energy", (strip_x0 + 8, strip_y0 - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (160, 160, 165), 1, cv2.LINE_AA)
    hist = list(tracker.energy_hist)
    if len(hist) >= 2:
        mx = max(max(hist), 0.5)
        pts = []
        for i, e in enumerate(hist):
            x = strip_x0 + 4 + int(i * (strip_w - 8) / max(len(hist) - 1, 1))
            y = strip_y0 + strip_h - 4 - int((e / mx) * (strip_h - 12))
            pts.append((x, y))
        for i in range(1, len(pts)):
            cv2.line(img, pts[i - 1], pts[i], (100, 200, 255), 1, cv2.LINE_AA)

    cv2.putText(
        img, "PULSAR SCAN  |  Wi-Fi CSI  |  Q=quit",
        (16, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (100, 200, 255), 1, cv2.LINE_AA,
    )
    cv2.putText(
        img, f"{status}  |  {fps:.0f} FPS  |  {port}  |  sc={tracker.amp_len}",
        (16, h - 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (160, 160, 165), 1, cv2.LINE_AA,
    )
    return img


def main() -> int:
    ap = argparse.ArgumentParser(description="PULSAR SCAN — CSI map")
    ap.add_argument("--port", default="", help="Serial COM port (e.g. COM11)")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--baseline", type=float, default=5.0, help="Empty-room seconds")
    ap.add_argument("--ap-x", type=float, default=DEFAULT_AP[0])
    ap.add_argument("--ap-y", type=float, default=DEFAULT_AP[1])
    ap.add_argument("--esp-x", type=float, default=DEFAULT_ESP[0])
    ap.add_argument("--esp-y", type=float, default=DEFAULT_ESP[1])
    ap.add_argument("--list-ports", action="store_true")
    args = ap.parse_args()

    if args.list_ports:
        ports = list_serial_ports()
        print("\n".join(ports) if ports else "(no serial ports)")
        return 0

    if not args.port:
        ports = list_serial_ports()
        print("[scan] вкажи --port COMx. Доступні:", ", ".join(ports) or "(none)", file=sys.stderr)
        return 1

    print("[scan] CSI desktop — не камера / не браузер", flush=True)
    try:
        ser = open_serial(args.port, args.baud)
    except RuntimeError as e:
        print("[scan] ERROR:", e, file=sys.stderr, flush=True)
        return 1

    tracker = CsiTracker(
        ap=(args.ap_x, args.ap_y),
        esp=(args.esp_x, args.esp_y),
        baseline_s=args.baseline,
    )

    cv2.namedWindow("PULSAR SCAN · CSI Map", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("PULSAR SCAN · CSI Map", 1100, 720)

    buf = ""
    frames = 0
    t_prev = time.perf_counter()
    fps = 0.0
    last_csi = 0.0
    print(f"[scan] {args.port} open — {args.baseline:.0f}s порожня кімната (нікого в зоні AP↔ESP)", flush=True)
    print("[scan] потім ходи між AP і ESP. Q = вихід", flush=True)

    while True:
        chunk = ser.read(4096)
        if chunk:
            buf += chunk.decode("utf-8", errors="ignore")
            while "\n" in buf:
                line, buf = buf.split("\n", 1)
                obj = parse_csi_line(line)
                if obj is None:
                    continue
                amp = obj["amp"]
                tracker.update([float(x) for x in amp], time.time())
                frames += 1
                last_csi = time.time()

        now = time.perf_counter()
        dt = now - t_prev
        if dt > 0:
            fps = 0.9 * fps + 0.1 / max(dt, 1e-3) if fps else 1.0 / max(dt, 1e-3)
        t_prev = now

        if not tracker.ready:
            left = max(0.0, tracker.baseline_s - (0 if tracker.t0 is None else time.time() - tracker.t0))
            status = f"BASELINE {left:.1f}s — room empty"
        elif time.time() - last_csi > 2.0 and last_csi > 0:
            status = "NO CSI — check WiFi/firmware"
        elif tracker.presence:
            xy = tracker.xy()
            mod = module_at(*xy) if xy else "?"
            status = f"PRESENCE  {mod}  E={tracker.energy:.2f}"
        else:
            status = f"IDLE  E={tracker.energy:.2f}"

        cv2.imshow("PULSAR SCAN · CSI Map", draw_map(tracker, status, fps, args.port))
        if cv2.waitKey(1) & 0xFF in (ord("q"), ord("Q"), 27):
            break

    ser.close()
    cv2.destroyAllWindows()
    print("[scan] stopped", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
