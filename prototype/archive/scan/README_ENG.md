# PULSAR SCAN — map from Wi‑Fi CSI

**Not a browser. Not a camera.** Desktop OpenCV: person position from **Wi‑Fi reflection** (CSI) on the home AP ↔ ESP32 DevKit V1 link.

## Hardware

| What | Why |
|------|-----|
| 1× **ESP32 DevKit V1** | CSI RX (separate firmware, not the watch) |
| Wi‑Fi AP (router) | Packet source for CSI |
| PC + USB | Serial → `scan.py` |

With one DevKit: presence / motion / coarse position **along** the AP–ESP sensing zone. No RF skeleton and no precise (x,y) across the whole station.

## 1. ESP firmware

See [`firmware/csi_node/README.md`](firmware/csi_node/README.md):

1. `secrets.h.example` → `secrets.h` (SSID/password).
2. Arduino IDE → ESP32 Dev Module → Upload `csi_node.ino`.
3. Serial 115200: `csi/on` and lines with `"amp":[...]`.

## 2. Run on PC

```powershell
cd prototype/archive/scan
.\run.ps1                  # lists COM ports
.\run.ps1 --port COM11
```

Or:

```powershell
pip install -r requirements.txt
python scan.py --port COM11
python scan.py --port COM11 --ap-x 4 --ap-y 4 --esp-x 18 --esp-y 12
```

1. First **~5 s** — empty room (baseline).
2. Walk between router and ESP — an RF point appears on the map.
3. **Q** — quit.

Tune AP/ESP coordinates on the HAB/LAB floor plan to the real layout (`--ap-x/y`, `--esp-x/y`).

## What it draws

| Element | Data |
|---------|------|
| AP→ESP line | RF link on the station map |
| Green point | Presence + position estimate along the link |
| Energy bar | CSI change vs baseline |

No simulated “walking” people — the point appears only with live CSI and presence.

## Dependencies

```
opencv-python, numpy, pyserial
```
