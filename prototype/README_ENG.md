# Pulsar — prototype

NASA Space Apps canon: telemetry server, crew panel, watch, USB bridge.

---

## What’s inside

| Folder | Purpose | Port |
|--------|---------|------|
| [`server/`](server/) | Ingest, trends, MySQL async, WS/API, `/panel` | HTTP **4100**, UDP **4101** |
| [`site/`](site/) | Crew frontend | **4200** |
| [`bridge/`](bridge/) | USB/BT Serial → ingest + outbound | COM |
| [`hardware/`](hardware/) | ESP32 firmware, BOM, wiring, CAD, schematics | — |
| [`pitch/`](pitch/) | Pitch deck | — |
| [`3d-models/`](3d-models/) | 3D models and screenshots | — |
| [`archive/scan/`](archive/scan/) | Optional CSI map (not demo canon) | COM |

Presentation / video: [`../media/`](../media/) (repo root).

```
ESP32 watch  ──USB──►  bridge  ──POST /ingest──►  server :4100
                                                   │
                                                   ├── WS/REST ──► site :4200
                                                   └── /panel
```

Firmware: [`hardware/watch/pulsar_watch/`](hardware/watch/pulsar_watch/).

---

## Quick start

Node.js ≥ 18. Docker — MySQL only (without it: RAM only).

```powershell
cd prototype
.\start.ps1
.\start.ps1 -Com COM11
.\start.ps1 -Demo
.\start.ps1 -Db
```

```bash
./start.sh
./start.sh --com /dev/ttyUSB0
./start.sh --demo
```

The script runs `npm install` in `server/`, `site/`, `bridge/` and starts the processes.

| What | URL |
|------|-----|
| Crew site | http://127.0.0.1:4200 |
| Server panel | http://127.0.0.1:4100/panel |
| Health | http://127.0.0.1:4100/health |

On `/panel`: sim profiles, **Emulate** site metrics, Medical card, rename/role/SOS.

The server sends `CREW|n|o:Name|w:Name|c:Name` to the watch (CREW tab + WARN on Home).

---

## Real watch

1. Close Serial Monitor / stop the bridge before Upload.
2. Flash: see [`hardware/watch/FLASH.md`](hardware/watch/FLASH.md).
3. Bridge:

```powershell
cd prototype/bridge
npm install
npm run bt -- COM11
```

Or `.\start.ps1 -Com COM11`.

Without hardware: `/panel` sim or `cd server && npm run demo`.

---

## Telemetry

```json
{"device_id":"dev001","hr":78,"spo2":97,"temp":21.5,"battery":80}
```

Seed devices: `dev001`…`dev004`. Architecture: [`../ARCHITECTURE.md`](../ARCHITECTURE.md).
