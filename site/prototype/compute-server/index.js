/**
 * COMPUTE-SERVER
 * — UDP 2.4ГГц + HTTP /ingest
 * — один пакет = один швидкий запис у store
 */

const http = require("http");
const dgram = require("dgram");
const { URL } = require("url");
const { Store } = require("../shared/db");
const { analyzeSeries } = require("../shared/analyze");

const PORT = Number(process.env.COMPUTE_PORT || 3850);
const RADIO_PORT = Number(process.env.RADIO_PORT || 3849);
const OFFLINE_MS = Number(process.env.OFFLINE_MS || 12000);

const store = new Store();

function sendJson(res, code, data) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (c) => {
      b += c;
      if (b.length > 1e6) {
        reject(new Error("too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(b));
    req.on("error", reject);
  });
}

async function processSample(raw, source) {
  const deviceKey = raw.device_id || raw.id;
  const device = await store.getDevice(deviceKey);
  if (!device) throw new Error("Невідомий пристрій: " + deviceKey);

  const hr = Number(raw.hr);
  const spo2 = Number(raw.spo2);
  const temp = Number(raw.temp ?? raw.temp_c);
  if (![hr, spo2, temp].every((n) => Number.isFinite(n))) {
    throw new Error("Некоректні hr/spo2/temp");
  }

  const battery = raw.battery != null ? Number(raw.battery) : undefined;
  const recorded_at = raw.t || new Date().toISOString();

  // FILO: лише короткий хвіст + цей пакет (старі в store уже пруняться)
  const prev = await store.recentTelemetry(device.id, 11);
  const series = [...prev, { t: recorded_at, hr, spo2, temp }];
  const analysis = analyzeSeries(series);

  await store.ingestLive(device.id, {
    hr,
    spo2,
    temp,
    battery: Number.isFinite(battery) ? battery : undefined,
    recorded_at,
    source,
    analysis,
  });

  console.log(
    `[compute] ${device.device_no} hr=${analysis.hr} spo2=${analysis.spo2} → ${analysis.statusLabel}`
  );
  return { device_no: device.device_no, analysis };
}

async function main() {
  await store.init();
  console.log("[compute] симуляцію вимкнено — лише реальні пакети");

  setInterval(() => {
    store.markStaleOffline(OFFLINE_MS).catch(() => {});
  }, 4000);

  const radio = dgram.createSocket("udp4");
  radio.on("message", async (msg, rinfo) => {
    const rawText = msg.toString("utf8").trim();
    const source = `udp-2.4ghz://${rinfo.address}:${rinfo.port}`;
    try {
      const data = JSON.parse(rawText);
      await processSample(data, source);
    } catch (e) {
      console.warn("[radio]", e.message);
    }
  });
  radio.bind(RADIO_PORT, () => {
    console.log(`[compute] радіо-міст UDP :${RADIO_PORT}`);
  });

  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      return res.end();
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname === "/health") {
        return sendJson(res, 200, {
          ok: true,
          service: "compute",
          db: store.mode,
          radioPort: RADIO_PORT,
        });
      }
      if (url.pathname === "/ingest" && req.method === "POST") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const result = await processSample(body, "http-ingest");
        return sendJson(res, 200, { ok: true, ...result });
      }
      sendJson(res, 404, { error: "Не знайдено" });
    } catch (e) {
      sendJson(res, 400, { error: e.message || "Помилка" });
    }
  });

  server.listen(PORT, () => {
    console.log(`[compute] HTTP ingest http://localhost:${PORT}/ingest`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
