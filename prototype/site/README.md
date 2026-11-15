# PULSAR site

UI з `Хакатон (2).zip` + live міст до [`../server`](../server) (`js/live.js`).

```bash
npm start   # http://localhost:4200
```

Config: `window.PULSAR_API = "http://127.0.0.1:4100"`.

Симуляція екіпажу — **тільки** через server `/panel` або `POST /api/admin/devices/:id/sim`. Сайт сам демо-екіпаж більше не генерує.
