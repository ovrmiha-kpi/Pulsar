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

## Канали

| Канал | Адреса | Навіщо |
|-------|--------|--------|
| **UDP ingest** | `:4101` | основний швидкий прийом |
| HTTP ingest | `POST :4100/ingest` | запас / міст |
| WebSocket | `ws://host:4100/ws` | push у site |
| API | `GET :4100/api/dashboard` | snapshot з RAM |
| Admin | `GET/POST :4100/api/admin/*` | панель |

JSON пакет:

```json
{"device_id":"dev001","hr":78,"spo2":97,"temp":21.5,"battery":80}
```
