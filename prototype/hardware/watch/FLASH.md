# Flash — Pulsar watch (ESP32)

Це **годинник**, не сервер. Станція — на ПК (`prototype/server` + `prototype/site`).

| Файл | Що |
|------|-----|
| `prototype/hardware/watch/pulsar_watch/pulsar_watch.ino` | основна прошивка |

## Кроки

1. Arduino IDE → board **DOIT ESP32 DEVKIT V1** (або ваш ESP32).
2. Закрийте Serial Monitor і **зупиніть** `prototype/bridge` (інакше COM busy).
3. Upload на COM порту годинника (часто COM11 / CP210x).
4. Знову міст:

```powershell
cd prototype/bridge
npm install
npm run bt -- COM11
```

Міст → `http://127.0.0.1:4100/ingest` + outbound `LINK` / `CREW|…` / `REC|…`.

Розводка: [`../docs/WIRING.md`](../docs/WIRING.md)
