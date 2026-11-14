# Прошивка ГОДИННИКА (один ESP32)

Це **годинник**, не сервер. Станція — на ПК (`site/prototype`).

## Є лише два скетчі

| Файл | Навіщо |
|------|--------|
| `Physik/watch/pulsar_watch/pulsar_watch.ino` | основна прошивка |
| `Physik/watch/station_debug/station_debug.ino` | той самий ESP, debug |

## Перед Upload

У скетчі: `DEVICE_ID`, BT-ім’я `Pulsar-DEV001`.  
Board Options: **Bluetooth enabled**.

На ПК:

```bash
cd site/prototype
npm run compute
npm run api
npm run web
# після пари з Pulsar-DEV001:
npm run bt -- COMx
```

## Arduino IDE

1. Board: **ESP32 Dev Module**
2. Open → потрібний `.ino` з таблиці вище
3. Port: **COM11** (USB CP210x) для Upload
4. Serial 115200 — англійський лог, `BT SPP … OK`

Розводка: `Physik/station/WIRING_ALL.md`
