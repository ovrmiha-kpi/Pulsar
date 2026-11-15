# Архітектура Pulsar (3 шари)

## Хто є хто

| Шар | Де | Роль |
|-----|-----|------|
| **1. Device** | ESP32 [`prototype/hardware/watch/`](prototype/hardware/watch/) | сенсори + TFT; JSON телеметрія; офлайн → SD |
| **2. Server** | [`prototype/server/`](prototype/server/) | UDP/HTTP ingest, RAM + тренди, MySQL async, WS/API |
| **3. Site** | [`prototype/site/`](prototype/site/) | панель PULSAR, live з server |
| **Bridge** | [`prototype/bridge/`](prototype/bridge/) | USB/BT Serial → `/ingest` + outbound `CREW`/`REC` |

**ESP — не станція.** Станція = ПК (server + site).

```
┌──────────────────────────────────────────────┐
│  ПК                                          │
│  ┌─────────────────┐     ┌────────────────┐  │
│  │ prototype/site  │ WS  │ prototype/     │  │
│  │ :4200 static    │◄────│ server :4100   │  │
│  │ PULSAR UI       │ REST│ UDP :4101      │  │
│  └─────────────────┘     │ MySQL async    │  │
│                          └────────▲───────┘  │
└───────────────────────────────────┼──────────┘
                                    │ USB bridge
                         ┌──────────┴──────────┐
                         │ ESP32 = годинник    │
                         │ hardware/watch/…    │
                         └─────────────────────┘
```

## Запуск

```powershell
cd prototype
.\start.ps1              # Windows: install + server + site
.\start.ps1 -Com COM11   # + USB-міст
.\start.ps1 -Demo        # + UDP без годинника
```

```bash
cd prototype
./start.sh
./start.sh --com /dev/ttyUSB0
./start.sh --demo
```

Вручну:

```bash
cd prototype/server && npm install && npm start
cd ../site && npm start
cd ../bridge && npm install && npm run bt -- COM11
```

## Канали

| Канал | Адреса |
|-------|--------|
| UDP ingest | `:4101` |
| HTTP ingest | `POST :4100/ingest` |
| API dashboard | `GET :4100/api/dashboard` |
| SOS | `POST :4100/api/sos` `{ "id": "dev001" }` |
| Bridge outbound | `GET :4100/api/bridge/outbound` (`CREW|…`, `REC|…`) |
| WebSocket | `ws://host:4100/ws` |
| Site | `http://localhost:4200` |
| Admin panel | `http://localhost:4100/panel` |

Hardware docs: [`prototype/hardware/`](prototype/hardware/). CSI scan (optional): [`prototype/archive/scan/`](prototype/archive/scan/).
