# PULSAR — Astro Health Monitor

NASA Space Apps Hackathon 2026.

**Канон проєкту:** папка [`prototype/`](prototype/).

| Що | Де |
|----|-----|
| Швидкий старт | [`prototype/README.md`](prototype/README.md) · `.\start.ps1` |
| Архітектура | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Годинник (ESP32) | [`prototype/hardware/watch/`](prototype/hardware/watch/) |
| BOM / піни / розводка | [`prototype/hardware/docs/`](prototype/hardware/docs/) |
| Схеми | [`prototype/hardware/schemes/`](prototype/hardware/schemes/) |
| USB/BT міст | [`prototype/bridge/`](prototype/bridge/) |
| Сервер + UI | [`prototype/server/`](prototype/server/) · [`prototype/site/`](prototype/site/) |
| Pitch | [`prototype/pitch/`](prototype/pitch/) |
| Presentation / video | [`media/`](media/) |
| 3D models / screens | [`prototype/3d-models/`](prototype/3d-models/) |

```powershell
cd prototype
.\start.ps1 -Com COM11
```

Сайт: http://127.0.0.1:4200 · Panel: http://127.0.0.1:4100/panel
