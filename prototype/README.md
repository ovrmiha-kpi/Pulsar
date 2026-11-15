# Pulsar — прототип (server + site)

Це **канонічна** частина проєкту для NASA Space Apps: сервер телеметрії й панель екіпажу.

Старий стек у `site/prototype/` (порти 3847–3850) — лише архів. Новий канон — **ця папка**.

---

## Що всередині

| Папка | Навіщо | Порт |
|-------|--------|------|
| [`server/`](server/) | Прийом даних з годинника, тренди здоров’я в RAM, опційно MySQL, WebSocket | HTTP **4100**, UDP **4101** |
| [`site/`](site/) | Фронт екіпажу (плитки, SOS, детальна сторінка) | **4200** |
| [`scan/`](scan/) | Окрема карта станції + демо RF-скелетів (**не** підключено до server) | **4300** |

```
Годинник ESP32  ──USB/BT──►  bt-bridge  ──POST /ingest──►  server :4100
                                                          │
                                                          ├── WS/REST ──► site :4200
                                                          └── /panel      (адмін)
```

Годинник (прошивка) лежить окремо: `Physik/watch/pulsar_watch/`.

---

## Швидкий старт

Потрібно: **Node.js ≥ 18**. Docker — лише якщо хочете MySQL (без нього сервер працює в RAM).

### Windows

```powershell
cd prototype
.\start.ps1
```

### macOS / Linux

```bash
cd prototype
chmod +x start.sh
./start.sh
```

Скрипт:
1. ставить `npm install` у `server/` і в `../site/prototype/` (міст USB);
2. піднімає **server** і **site** у окремих вікнах/процесах;
3. пише посилання в термінал.

Опції:

```powershell
.\start.ps1 -Db          # ще й MySQL через docker compose
.\start.ps1 -Demo        # UDP-симуляція без годинника
.\start.ps1 -Com COM11   # одразу USB-міст з годинником
.\start.ps1 -InstallOnly # лише npm install, без запуску
```

```bash
./start.sh --db
./start.sh --demo
./start.sh --com COM11   # або /dev/ttyUSB0
./start.sh --install-only
```

---

## Посилання після запуску

| Що | URL |
|----|-----|
| Сайт екіпажу | http://127.0.0.1:4200 |
| Панель керування сервером | http://127.0.0.1:4100/panel |
| Health | http://127.0.0.1:4100/health |
| Dashboard API | http://127.0.0.1:4100/api/dashboard |

На панелі `:4100/panel` можна:
- увімкнути **симуляцію** на конкретному пристрої (`normal` / `rest` / `warning` / `critical`);
- **перейменувати** пристрій (ім’я на сайті);
- змінити роль, очистити історію, скинути SOS.

Поки симуляція увімкнена для `device_id` — реальні пакети цього id ігноруються.

---

## Реальний годинник (USB)

1. Закрийте Serial Monitor в Arduino IDE (інакше COM зайнятий).
2. Дізнайтесь порт (Windows: Диспетчер пристроїв → Silicon Labs CP210x, часто `COM11`).
3. Запустіть міст:

```powershell
# з кореня репо або через start.ps1 -Com COM11
cd site/prototype
npm install
npm run bt -- COM11
```

Міст шле JSON на `http://127.0.0.1:4100/ingest` і раз на 2 с пише `LINK\n` на ESP (для офлайн-режиму SD).

Без годинника — або панель симуляції, або:

```bash
cd prototype/server
npm run demo
```

---

## Формат телеметрії

```json
{"device_id":"dev001","hr":78,"spo2":97,"temp":21.5,"battery":80}
```

Канали:
- **UDP** `:4101` — основний швидкий шлях;
- **HTTP** `POST :4100/ingest` — міст / запас;
- **WebSocket** `ws://host:4100/ws` — push на сайт (`hello`, `sample`, `sos`).

Сервер тримає кільце ~64 точок у RAM, рахує тренди (пульс / SpO₂ / температура) і шле стан на сайт. MySQL — асинхронний архів, не блокує ingest.

---

## Пристрої в сиді

За замовчуванням заведені `dev001`…`dev004` (`DEV-001` …). Годинник у прошивці шле `device_id` з `DEVICE_ID` (зазвичай `dev001`).

---

## Типові проблеми

| Симптом | Що перевірити |
|---------|----------------|
| Сайт Offline / немає даних | Чи крутиться `server` на :4100? Чи є міст / demo / sim? |
| COM «Access denied» | Закрити Serial Monitor; лише один процес на порт |
| MySQL ECONNREFUSED | Нормально без Docker — RAM-режим. Або `npm run db:up` у `server/` |
| Плитка «скаче» / симуляція | На панелі вимкнути sim; зупинити `npm run demo` |
| Старий сайт на 3847 | Це legacy `site/prototype` — не чіпайте для демо |

---

## Структура для колег

```
prototype/
  README.md          ← ви тут
  start.ps1          ← Windows: install + run
  start.sh           ← macOS/Linux: install + run
  server/            ← бек (Node, UDP/HTTP/WS, /panel)
  site/              ← фронт екіпажу (static + serve.js)
  scan/              ← карта станції / RF skeleton demo (:4300)
```

Карта станції окремо:

```bash
cd prototype/scan && npm start   # http://127.0.0.1:4300
```

Детальніше по всьому репо: [`ARCHITECTURE.md`](../ARCHITECTURE.md) у корені.
