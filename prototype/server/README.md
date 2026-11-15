# Pulsar server

Низька затримка для сайту + збереження дня в MySQL + нічний архів.

Crew-сайт — у `../site/`. Тут лише сервер + **панель керування**.

## Модель даних

| Де | Що лежить | Скільки |
|----|-----------|---------|
| **RAM** | live для сайту (тренд/графік) | останні ~120 точок **сьогодні** на пристрій |
| **MySQL `telemetry`** | сирі семпли **поточного UTC-дня** | усі точки за сьогодні |
| **MySQL `telemetry_daily`** | постійний архів | **4 середні / день / пристрій** (по 6 год UTC) |

Опівночі UTC (або `POST /api/admin/rollup`):
1. з сирих точок дня рахуються 4 середні (HR / SpO₂ / temp);
2. пишуться в `telemetry_daily`;
3. сирі рядки того дня з `telemetry` видаляються.

Слоти: `0`=00–06, `1`=06–12, `2`=12–18, `3`=18–24 (UTC).

## Запуск

```bash
cd prototype/server
npm install
npm run db:up          # MySQL 8 у Docker (потрібен для архіву)
npm start              # :4100 + UDP :4101
npm run demo           # UDP тестові пакети
npm run bridge -- COM11
```

Панель: **http://127.0.0.1:4100/panel**  
Сайт екіпажу: `cd ../site && npm start` → http://localhost:4200

## API (архів / день)

| Метод | Шлях | Що |
|-------|------|----|
| GET | `/api/devices/:id/telemetry` | live RAM-буфер для сайту |
| GET | `/api/devices/:id/daily?days=14` | постійні 4-середні з БД |
| POST | `/api/admin/rollup` | `{ "day":"YYYY-MM-DD" }` або вчора за замовч. |
| POST | `/api/admin/prune-raw` | прибрати сирі старші за сьогодні |

## Панель керування (`/panel`)

| Дія | Що робить |
|-----|-----------|
| **Rename / Role** | Ім'я і роль на сайті |
| **Start / Stop sim** | Симуляція пристрою |
| **Profile / Hz** | Зберігаються до Reset |
| **Clear ring** | Чистить лише live RAM (не архів БД) |
| **Reset sim** | Скидання налаштувань симуляції |

Поки симуляція увімкнена — реальні USB/UDP пакети цього `device_id` ігноруються.

## Канали

| Канал | Адреса | Навіщо |
|-------|--------|--------|
| **UDP ingest** | `:4101` | швидкий прийом |
| HTTP ingest | `POST :4100/ingest` | запас / міст |
| WebSocket | `ws://host:4100/ws` | push у site |
| API | `GET :4100/api/dashboard` | snapshot з RAM |

JSON пакет:

```json
{"device_id":"dev001","hr":78,"spo2":97,"temp":21.5,"battery":80}
```
