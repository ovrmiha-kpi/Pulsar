# Архітектура Pulsar (3 шари)

## Хто є хто

| Шар | Де | Роль |
|-----|-----|------|
| **1. Device** | ESP32 [`Physik/watch/`](Physik/watch/) | сенсори + TFT; JSON телеметрія; офлайн → SD |
| **2. Server** | [`prototype/server/`](prototype/server/) | UDP/HTTP ingest, RAM + тренди, MySQL async, WS/API |
| **3. Site** | [`prototype/site/`](prototype/site/) | панель PULSAR (з Хакатон.zip), live з server |

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
                                    │ USB bridge або UDP
                         ┌──────────┴──────────┐
                         │ ESP32 = годинник    │
                         │ Physik/watch/…      │
                         └─────────────────────┘
```

## Запуск

Найпростіше для колег — скрипт у [`prototype/`](prototype/) (див. [`prototype/README.md`](prototype/README.md)):

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
# 1) MySQL (опційно; без нього server працює в RAM)
cd prototype/server
npm install
npm run db:up
npm start

# 2) Сайт
cd ../site
npm start          # http://localhost:4200

# 3) Тест без заліза
cd ../server
npm run demo       # UDP → :4101

# 4) Реальний годинник (USB)
cd ../../site/prototype
npm run bt -- COM11   # → POST http://127.0.0.1:4100/ingest
```

## Канали

| Канал | Адреса |
|-------|--------|
| UDP ingest | `:4101` |
| HTTP ingest | `POST :4100/ingest` |
| API dashboard | `GET :4100/api/dashboard` |
| SOS | `POST :4100/api/sos` `{ "id": "dev001" }` |
| WebSocket | `ws://host:4100/ws` |
| Site | `http://localhost:4200` |

## Legacy

Старий split `site/prototype` (web:3847 / api:3848 / compute:3850) — архів/референс. Новий канон: `prototype/server` + `prototype/site`.  
`bt-bridge` тепер за замовчуванням шле на `:4100/ingest`.
