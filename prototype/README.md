# Pulsar — прототип

Канон NASA Space Apps: сервер телеметрії, панель екіпажу, годинник, USB-міст.

---

## Що всередині

| Папка | Навіщо | Порт |
|-------|--------|------|
| [`server/`](server/) | Ingest, тренди, MySQL async, WS/API, `/panel` | HTTP **4100**, UDP **4101** |
| [`site/`](site/) | Фронт екіпажу | **4200** |
| [`bridge/`](bridge/) | USB/BT Serial → ingest + outbound | COM |
| [`hardware/`](hardware/) | Прошивка ESP32, BOM, wiring, CAD, схеми | — |
| [`pitch/`](pitch/) | Pitch deck | — |
| [`3d-models/`](3d-models/) | 3D моделі та скріни | — |
| [`archive/scan/`](archive/scan/) | Optional CSI map (не канон демо) | COM |

Презентація / відео: [`../media/`](../media/) (корінь репо).

```
Годинник ESP32  ──USB──►  bridge  ──POST /ingest──►  server :4100
                                                    │
                                                    ├── WS/REST ──► site :4200
                                                    └── /panel
```

Прошивка: [`hardware/watch/pulsar_watch/`](hardware/watch/pulsar_watch/).

---

## Швидкий старт

Node.js ≥ 18. Docker — лише для MySQL (без нього RAM).

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

Скрипт ставить `npm install` у `server/`, `site/`, `bridge/` і піднімає процеси.

| Що | URL |
|----|-----|
| Сайт екіпажу | http://127.0.0.1:4200 |
| Панель сервера | http://127.0.0.1:4100/panel |
| Health | http://127.0.0.1:4100/health |

На `/panel`: sim профілі, **Emulate** метрик сайту, Medical card, rename/role/SOS.

Сервер шле на годинник `CREW|n|o:Name|w:Name|c:Name` (вкладка CREW + WARN на Home).

---

## Реальний годинник

1. Закрити Serial Monitor / зупинити bridge перед Upload.
2. Flash: див. [`hardware/watch/FLASH.md`](hardware/watch/FLASH.md).
3. Міст:

```powershell
cd prototype/bridge
npm install
npm run bt -- COM11
```

Або `.\start.ps1 -Com COM11`.

Без заліза: `/panel` sim або `cd server && npm run demo`.

---

## Телеметрія

```json
{"device_id":"dev001","hr":78,"spo2":97,"temp":21.5,"battery":80}
```

Пристрої seed: `dev001`…`dev004`. Архітектура: [`../ARCHITECTURE.md`](../ARCHITECTURE.md).
