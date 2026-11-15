/**
 * USB → compute /ingest
 * FILO + авто-перепідключення COM (цикл), kick-файл з сайту.
 *
 * Usage:  npm run bt -- COM11
 */

const fs = require("fs");
const path = require("path");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const COMPUTE =
  process.env.COMPUTE_URL ||
  process.env.PULSAR_INGEST ||
  "http://127.0.0.1:4100/ingest";
const OUTBOUND =
  process.env.PULSAR_OUTBOUND ||
  COMPUTE.replace(/\/ingest\/?$/, "") + "/api/bridge/outbound";
const BAUD = Number(process.env.BT_BAUD || 115200);
const DEFAULT_ID = process.env.DEVICE_ID || "dev001";
const RETRY_MS = Number(process.env.BT_RETRY_MS || 2000);
const KICK_FILE = path.join(__dirname, "..", ".data", "kick-bt");

async function postIngest(obj) {
  const res = await fetch(COMPUTE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return text;
}

/** Забрати з сервера команди для годинника і записати в Serial. */
async function pullOutbound(port, deviceId) {
  const id = deviceId || DEFAULT_ID;
  try {
    const res = await fetch(
      `${OUTBOUND}?device_id=${encodeURIComponent(id)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return;
    const data = await res.json();
    const cmds = data.commands || [];
    for (const c of cmds) {
      const line = String(c.line || "").trim();
      if (!line) continue;
      port.write(line.endsWith("\n") ? line : line + "\n");
      console.log(`[bt] → device ${id}: ${line.slice(0, 80)}`);
    }
  } catch (e) {
    // тихо — сервер може бути ще не піднятий
  }
}

function parsePayload(raw) {
  const line = String(raw).trim();
  if (!line) return null;
  if (line.startsWith("{")) {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }
  const m = line.match(
    /SpO2=([\d.]+)\s+HR=(\d+)\s+AIR=([\d.]+)\s+roomT=([\d.]+)/i
  );
  if (!m) return null;
  return {
    device_id: DEFAULT_ID,
    spo2: Number(m[1]),
    hr: Number(m[2]),
    temp: Number(m[4]),
    battery: 80,
  };
}

async function listHint() {
  const ports = await SerialPort.list();
  console.log("[bt] available ports:");
  for (const p of ports) {
    console.log(`  ${p.path}  ${p.friendlyName || p.manufacturer || ""}`.trim());
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function kickMtime() {
  try {
    return fs.statSync(KICK_FILE).mtimeMs;
  } catch {
    return 0;
  }
}

async function openSession(portPath) {
  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path: portPath, baudRate: BAUD }, (err) => {
      if (err) reject(err);
    });
    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

    let tip = null;
    let tipSeq = 0;
    let sentSeq = 0;
    let pumping = false;
    let lastLog = 0;
    let closed = false;
    let lastDeviceId = DEFAULT_ID;

    async function pump() {
      if (pumping || closed) return;
      pumping = true;
      try {
        while (tip && tipSeq !== sentSeq && !closed) {
          const seq = tipSeq;
          const obj = tip;
          try {
            await postIngest(obj);
            sentSeq = seq;
            const now = Date.now();
            if (now - lastLog >= 900) {
              lastLog = now;
              console.log(
                `[bt] FILO → ${obj.device_id} hr=${obj.hr} spo2=${obj.spo2} temp=${obj.temp}`
              );
            }
          } catch (e) {
            console.warn("[bt] ingest fail:", e.message);
            break;
          }
        }
      } finally {
        pumping = false;
        if (!closed && tip && tipSeq !== sentSeq) setImmediate(pump);
      }
    }

    parser.on("data", (line) => {
      const obj = parsePayload(line);
      if (!obj) return;
      tip = obj;
      if (obj.device_id) lastDeviceId = obj.device_id;
      tipSeq++;
      pump();
    });

    port.on("open", () => {
      console.log(
        `[bt] linked ${portPath} — FILO + LINK + outbound REC → ESP`
      );
      try {
        port.write("LINK\n");
      } catch (_) {}
      resolve({
        port,
        getDeviceId: () => lastDeviceId,
        close: () =>
          new Promise((res) => {
            if (closed) return res();
            closed = true;
            try {
              port.close(() => res());
            } catch (_) {
              res();
            }
          }),
      });
    });

    port.on("error", (e) => {
      console.warn("[bt] port error:", e.message);
      if (!closed) {
        closed = true;
        try {
          port.close(() => {});
        } catch (_) {}
      }
    });

    port.on("close", () => {
      if (!closed) {
        closed = true;
        console.warn("[bt] port closed");
      }
    });
  });
}

async function main() {
  const portPath =
    process.argv[2] || process.env.BT_PORT || process.env.COM_PORT;
  if (!portPath) {
    console.error("[bt] pass COM port:  npm run bt -- COM11");
    await listHint();
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(KICK_FILE), { recursive: true });
  console.log(`[bt] watch ${portPath} → ${COMPUTE} (retry ${RETRY_MS}ms, kick file)`);

  let lastKick = kickMtime();
  let session = null;

  // цикл: відкрити → тримати → при обриві/kick перевідкрити
  for (;;) {
    try {
      if (session) {
        await session.close();
        session = null;
      }
      session = await openSession(portPath);
      let lastLink = 0;

      while (session) {
        await sleep(500);
        const now = Date.now();
        // ESP: без LINK → offline → SD; з LINK → live + flush SD
        if (session.port.isOpen && now - lastLink >= 2000) {
          lastLink = now;
          try {
            session.port.write("LINK\n");
          } catch (_) {}
          // команди з сервера (глибокий аналіз тощо)
          await pullOutbound(
            session.port,
            session.getDeviceId ? session.getDeviceId() : DEFAULT_ID
          );
        }
        const k = kickMtime();
        if (k > lastKick) {
          lastKick = k;
          console.log("[bt] kick від сайту — перепідключення COM…");
          break;
        }
        if (!session.port.isOpen) {
          console.warn("[bt] COM втрачено — перепідключення…");
          break;
        }
      }
    } catch (e) {
      console.warn(`[bt] open fail: ${e.message} — retry ${RETRY_MS}ms`);
      await listHint().catch(() => {});
      await sleep(RETRY_MS);
      continue;
    }
    await sleep(RETRY_MS);
  }
}

main().catch((e) => {
  console.error("[bt] fatal", e.message);
  process.exit(1);
});
