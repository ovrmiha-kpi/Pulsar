# Flash — Pulsar watch (ESP32)

This is a **watch**, not a server. The station runs on the PC (`prototype/server` + `prototype/site`).

| File | What |
|------|------|
| `prototype/hardware/watch/pulsar_watch/pulsar_watch.ino` | main firmware |

## Steps

1. Arduino IDE → board **DOIT ESP32 DEVKIT V1** (or your ESP32).
2. Close Serial Monitor and **stop** `prototype/bridge` (otherwise COM is busy).
3. Upload on the watch COM port (often COM11 / CP210x).
4. Start the bridge again:

```powershell
cd prototype/bridge
npm install
npm run bt -- COM11
```

Bridge → `http://127.0.0.1:4100/ingest` + outbound `LINK` / `CREW|…` / `REC|…`.

Wiring: [`../docs/WIRING.md`](../docs/WIRING.md)
