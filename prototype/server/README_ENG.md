# Pulsar server

Low latency for the site + same-day MySQL storage + nightly archive.

Crew site lives in `../site/`. This folder is the server + **control panel** only.

## Data model

| Where | What | How much |
|-------|------|----------|
| **RAM** | live for the site (trend/chart) | last ~120 points **today** per device |
| **MySQL `telemetry`** | raw samples for the **current UTC day** | all points today |
| **MySQL `telemetry_daily`** | permanent archive | **4 averages / day / device** (6 h UTC each) |

At UTC midnight (or `POST /api/admin/rollup`):
1. four averages (HR / SpO₂ / temp) are computed from the day’s raw points;
2. written to `telemetry_daily`;
3. that day’s raw rows are deleted from `telemetry`.

Slots: `0`=00–06, `1`=06–12, `2`=12–18, `3`=18–24 (UTC).

## Launch

```bash
cd prototype/server
npm install
npm run db:up          # MySQL 8 in Docker (needed for archive)
npm start              # :4100 + UDP :4101
npm run demo           # UDP test packets
npm run bridge -- COM11
```

Panel: **http://127.0.0.1:4100/panel**  
Crew site: `cd ../site && npm start` → http://localhost:4200

## API (archive / day)

| Method | Path | What |
|--------|------|------|
| GET | `/api/devices/:id/telemetry` | live RAM buffer for the site |
| GET | `/api/devices/:id/daily?days=14` | permanent 4-average rows from DB |
| POST | `/api/admin/rollup` | `{ "day":"YYYY-MM-DD" }` or yesterday by default |
| POST | `/api/admin/prune-raw` | remove raw older than today |

## Control panel (`/panel`)

| Action | Effect |
|--------|--------|
| **Rename / Role** | Name and role on the site |
| **Start / Stop sim** | Device simulation |
| **Profile / Hz** | Kept until Reset |
| **Clear ring** | Clears live RAM only (not DB archive) |
| **Reset sim** | Reset simulation settings |

While simulation is on — real USB/UDP packets for that `device_id` are ignored.

## Health: trends, guesses, watch commands

On each sample the server:
1. computes **risk** and short trends (pulse / SpO₂ / temperature);
2. updates **daily summaries** (up to 14 days in RAM);
3. if **day-over-day worse** (≥2 days of rising risk) — sets recommendation `DEEP_CHECK`;
4. USB bridge (`npm run bt`) pulls commands from `GET /api/bridge/outbound` and writes `REC|CODE|text` to the ESP;
5. firmware shows the text on screen for ~2 min.

Test without waiting a week (admin API):

```bash
POST /api/admin/devices/dev001/seed-days
{"days":[
  {"day":"2026-11-12","riskAvg":1.0,"n":20},
  {"day":"2026-11-13","riskAvg":2.5,"n":20},
  {"day":"2026-11-14","riskAvg":4.0,"n":20},
  {"day":"2026-11-15","riskAvg":5.5,"n":20}
]}
```

## Channels

| Channel | Address | Purpose |
|---------|---------|---------|
| **UDP ingest** | `:4101` | fast receive |
| HTTP ingest | `POST :4100/ingest` | fallback / bridge |
| WebSocket | `ws://host:4100/ws` | push to site |
| API | `GET :4100/api/dashboard` | RAM snapshot |
| Device | `GET :4100/api/devices/:id` | vitals + env/wellbeing/analytics |
| Analytics | `GET :4100/api/devices/:id/analytics` | baseline, histories, series |
| Check-in | `POST :4100/api/devices/:id/checkin` | `{ mood, symptoms }` |
| Admin | `GET/POST :4100/api/admin/*` | panel |

JSON packet:

```json
{"device_id":"dev001","hr":78,"spo2":97,"temp":21.5,"battery":80}
```

**Extended (site detail page):** on every ingest the server adds cabin env (pressure, air O₂/CO₂, radiation), mass/grip/activity, sleep/stress (derived from HR/SpO₂ + sim profile), baseline and measurement/wellbeing/alert history. `/panel` simulation drives these fields too.
