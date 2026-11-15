# PULSAR site

UI from `Хакатон (2).zip` + live bridge to [`../server`](../server) (`js/live.js`).

```bash
npm start   # http://localhost:4200
```

Config: `window.PULSAR_API = "http://127.0.0.1:4100"`.

Crew simulation is **only** via server `/panel` or `POST /api/admin/devices/:id/sim`. The site no longer generates its own demo crew.
