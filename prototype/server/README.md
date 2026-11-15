# Pulsar server

Низька затримка: **UDP → RAM → WS**, MySQL пишеться **асинхронно** (не в hot path).

Сайту тут немає — лише термінал. Фронт пізніше в `../site/`.

## Запуск

```bash
cd prototype/server
npm install
npm run db:up          # MySQL 8 у Docker (опційно)
npm start              # термінал-лог
npm run demo           # UDP тестові пакети

# сайт (окремий термінал)
cd ../site && npm start   # http://localhost:4200
```

## Канали

| Канал | Адреса | Навіщо |
|-------|--------|--------|
| **UDP ingest** | `:4101` | основний швидкий прийом з пристрою/шлюзу |
| HTTP ingest | `POST :4100/ingest` | запас / міст |
| WebSocket | `ws://host:4100/ws` | push у майбутній site (мс) |
| API | `GET :4100/api/dashboard` | snapshot з **RAM** |

JSON пакет:

```json
{"device_id":"dev001","hr":78,"spo2":97,"temp":21.5,"battery":80}
```
