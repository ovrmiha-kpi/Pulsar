# Pulsar server

Низька затримка: **UDP → RAM → WS**, MySQL пишеться **асинхронно** (не в hot path).

Crew-сайт — у `../site/`. Тут лише сервер + **панель керування**.

## Запуск

```bash
cd prototype/server
npm install
npm run db:up          # MySQL 8 у Docker (опційно)
npm start              # :4100 + UDP :4101
npm run demo           # UDP тестові пакети на всі симуляції — краще панель
npm run bridge -- COM11
```

Панель: **http://127.0.0.1:4100/panel**

Сайт екіпажу: `cd ../site && npm start` → http://localhost:4200

## Панель керування (`/panel`)

| Дія | Що робить |
|-----|-----------|
| **Rename** | Змінює відображуване ім'я (на сайті замість DEV-00x) |
| **Role** | Підпис ролі на плитці |
| **Start / Stop sim** | Симуляція **конкретного** пристрою (`normal` / `rest` / `warning` / `critical`, Hz) |
| **Profile / Hz** | Зберігаються на сервері; **не скидаються** після Stop чи автооновлення панелі |
| **Reset sim** | Явне скидання профілю/Hz цього пристрою |
| **Clear ring** | Очищає RAM-історію телеметрії |
| **Clear SOS** | Скидає SOS-прапор |
| **Stop all sims** | Вимикає таймери; **налаштування лишаються** |
| **Reset sim settings** | Stop усіх + повне очищення збережених profile/Hz |

Поки симуляція увімкнена для пристрою — реальні USB/UDP пакети цього `device_id` ігноруються.

## Здоров'я: тренди, догадки, команди на годинник

Сервер по кожному семплу:
1. рахує **ризик** і короткі тренди (пульс / SpO₂ / температура);
2. оновлює **денні зведення** (до 14 днів у RAM);
3. якщо **день-за-днем гірше** (≥2 дні зростання ризику) — ставить рекомендацію `DEEP_CHECK`;
4. USB-міст (`npm run bt`) забирає команди з `GET /api/bridge/outbound` і пише на ESP рядок `REC|CODE|text`;
5. прошивка показує текст на екрані ~2 хв.

Тест без очікування тижня (адмін API):

```bash
POST /api/admin/devices/dev001/seed-days
{"days":[
  {"day":"2026-11-12","riskAvg":1.0,"n":20},
  {"day":"2026-11-13","riskAvg":2.5,"n":20},
  {"day":"2026-11-14","riskAvg":4.0,"n":20},
  {"day":"2026-11-15","riskAvg":5.5,"n":20}
]}
```

## Канали

| Канал | Адреса | Навіщо |
|-------|--------|--------|
| **UDP ingest** | `:4101` | основний швидкий прийом |
| HTTP ingest | `POST :4100/ingest` | запас / міст |
| WebSocket | `ws://host:4100/ws` | push у site |
| API | `GET :4100/api/dashboard` | snapshot з RAM |
| Device | `GET :4100/api/devices/:id` | vitals + env/wellbeing/analytics |
| Analytics | `GET :4100/api/devices/:id/analytics` | baseline, histories, series |
| Check-in | `POST :4100/api/devices/:id/checkin` | `{ mood, symptoms }` |
| Admin | `GET/POST :4100/api/admin/*` | панель |

JSON пакет:

```json
{"device_id":"dev001","hr":78,"spo2":97,"temp":21.5,"battery":80}
```

**Extended (детальна сторінка site):** на кожному ingest сервер додає cabin env (pressure, air O₂/CO₂, radiation), mass/grip/activity, sleep/stress (вивід із HR/SpO₂ + sim profile), baseline і measurement/wellbeing/alert history. Симуляція з `/panel` крутить і ці поля.
