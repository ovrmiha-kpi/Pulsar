/**
 * Pulsar SERVER (low-latency)
 *
 * Hot path:  UDP JSON → RAM ring → trends → WS push  (MySQL async, не в критичному шляху)
 * Cold path: MySQL архів
 * Debug:     ТІЛЬКИ термінал (ніякого сайту тут)
 *
 * Порти:
 *   UDP  4101  — ingest з пристрою/шлюзу (основний)
 *   HTTP 4100  — /ingest (запас), /api/* для майбутнього site/
 *   WS   4100  — /ws     — push стану сайту (мс)
 */

import http from "http";
import dgram from "dgram";
import { WebSocketServer } from "ws";
import { analyzeSeries } from "./trends.js";
import {
  seedDevices,
  getDevice,
  listDevices,
  pushSample,
  seriesOf,
  isConnected,
} from "./memory.js";
import { initMysql, enqueuePersist, getSeed, mysqlReady } from "./mysql.js";

const HTTP_PORT = Number(process.env.PORT || 4100);
const UDP_PORT = Number(process.env.UDP_PORT || 4101);
const OFFLINE_MS = Number(process.env.OFFLINE_MS || 12000);

const wsClients = new Set();
/** @type {Map<string, { active: boolean, timestamp: string }>} */
const sosState = new Map();
let ingestCount = 0;
let lastLogMs = 0;

function nowIso() {
  return new Date().toISOString();
}

function parseSample(raw) {
  const key = raw.device_id || raw.id;
  if (!key) throw new Error("device_id required");
  const hr = Number(raw.hr);
  const spo2 = Number(raw.spo2);
  const temp = Number(raw.temp ?? raw.temp_c);
  if (![hr, spo2, temp].every((n) => Number.isFinite(n))) {
    throw new Error("bad hr/spo2/temp");
  }
  const battery = raw.battery != null ? Number(raw.battery) : undefined;
  const recorded_at = raw.t || raw.recorded_at || nowIso();
  return { key, hr, spo2, temp, battery, recorded_at };
}

/** Критичний шлях — без await MySQL. */
function ingestFast(raw, source) {
  const t0 = process.hrtime.bigint();
  const { key, hr, spo2, temp, battery, recorded_at } = parseSample(raw);
  const device = getDevice(key);
  if (!device) throw new Error("unknown device: " + key);

  const prev = seriesOf(device.id, 39);
  const series = [...prev, { t: recorded_at, hr, spo2, temp }];
  const analysis = analyzeSeries(series);
  pushSample(device.id, { t: recorded_at, hr, spo2, temp }, analysis, battery);

  enqueuePersist({
    deviceId: device.id,
    hr,
    spo2,
    temp,
    battery: Number.isFinite(battery) ? battery : undefined,
    recorded_at,
    source,
    analysis,
  });

  broadcastWs({
    type: "sample",
    device_id: device.id,
    device_no: device.device_no,
    role: device.role,
    battery: device.battery,
    recorded_at,
    analysis,
    connected: true,
    sos: sosState.get(device.id)?.active === true,
  });

  ingestCount++;
  const dtUs = Number(process.hrtime.bigint() - t0) / 1000;
  const now = Date.now();
  if (now - lastLogMs >= 500) {
    lastLogMs = now;
    console.log(
      `[${source}] ${device.device_no} hr=${analysis.hr} spo2=${analysis.spo2} temp=${analysis.temp} ${analysis.statusLabel}  ${dtUs.toFixed(0)}µs  n=${ingestCount}`
    );
  }
  return { ok: true, device_id: device.id, us: dtUs, analysis };
}

function devicePayload(d) {
  const connected = isConnected(d, OFFLINE_MS);
  const a = d.analysis || analyzeSeries(d.ring);
  const sos = sosState.get(d.id)?.active === true;
  return {
    id: d.id,
    device_no: d.device_no,
    role: d.role,
    battery: d.battery,
    connected,
    last_seen_at: d.last_seen_at,
    sos,
    ...(connected
      ? a
      : {
          ...a,
          status: d.ring.length ? a.status : "pending",
          statusLabel: d.ring.length ? a.statusLabel : "очікування",
          alert: d.ring.length ? "Офлайн — останні дані з RAM." : "Немає пакетів.",
          alarm: false,
        }),
  };
}

function dashboard() {
  const devices = listDevices().map(devicePayload);
  return {
    service: "pulsar-server",
    updatedAt: nowIso(),
    mysql: mysqlReady(),
    ingestCount,
    summary: {
      total: devices.length,
      online: devices.filter((x) => x.connected).length,
      critical: devices.filter((x) => x.connected && x.status === "critical").length,
      warning: devices.filter((x) => x.connected && x.status === "warning").length,
      normal: devices.filter((x) => x.connected && x.status === "normal").length,
      pending: devices.filter((x) => !x.connected).length,
    },
    devices,
  };
}

function broadcastWs(msg) {
  if (!wsClients.size) return;
  const data = JSON.stringify(msg);
  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(data);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => {
      chunks.push(c);
      if (chunks.reduce((n, x) => n + x.length, 0) > 65536) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

async function main() {
  seedDevices(getSeed());

  try {
    await initMysql();
  } catch (e) {
    console.warn(`[mysql] OFFLINE — працюємо лише в RAM: ${e.message}`);
    console.warn("[mysql] підніми: npm run db:up   (docker compose)");
  }

  // --- UDP ingest (основний швидкий канал) ---
  const udp = dgram.createSocket("udp4");
  udp.on("message", (msg, rinfo) => {
    try {
      const raw = JSON.parse(msg.toString("utf8"));
      ingestFast(raw, `udp:${rinfo.address}`);
    } catch (e) {
      // мовчки дропаємо сміття — без спаму в hot path
      if (Date.now() - lastLogMs > 2000) {
        console.warn(`[udp] bad packet from ${rinfo.address}: ${e.message}`);
      }
    }
  });
  udp.bind(UDP_PORT, () => {
    console.log(`[udp] ingest 0.0.0.0:${UDP_PORT}`);
  });

  // --- HTTP + WS (API для site/, запасний ingest) ---
  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      return res.end();
    }

    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    try {
      if (url.pathname === "/health") {
        return sendJson(res, 200, {
          ok: true,
          mysql: mysqlReady(),
          udp: UDP_PORT,
          http: HTTP_PORT,
          ingestCount,
        });
      }

      // запасний HTTP ingest (міст/тест) — відповідь мінімальна
      if (url.pathname === "/ingest" && req.method === "POST") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const result = ingestFast(body, "http");
        return sendJson(res, 200, {
          ok: true,
          us: result.us,
          device_id: result.device_id,
          status: result.analysis.status,
        });
      }

      // для майбутнього prototype/site — дані з RAM
      if (url.pathname === "/api/dashboard" && req.method === "GET") {
        return sendJson(res, 200, dashboard());
      }
      if (url.pathname === "/api/devices" && req.method === "GET") {
        return sendJson(res, 200, { devices: listDevices().map(devicePayload) });
      }

      if (url.pathname === "/api/sos" && req.method === "POST") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const id = body.id || body.device_id;
        const d = getDevice(id);
        if (!d) return sendJson(res, 404, { error: "device not found" });
        if (!isConnected(d, OFFLINE_MS)) {
          return sendJson(res, 409, { error: "device offline" });
        }
        const rec = { active: true, timestamp: nowIso() };
        sosState.set(d.id, rec);
        console.log(`[SOS] ${d.device_no}`);
        broadcastWs({ type: "sos", device_id: d.id, device_no: d.device_no, ...rec });
        return sendJson(res, 200, {
          ok: true,
          message: `SOS for ${d.device_no} accepted.`,
          ...rec,
        });
      }

      if (url.pathname.startsWith("/api/devices/") && req.method === "GET") {
        const parts = url.pathname.split("/").filter(Boolean);
        const id = decodeURIComponent(parts[2]);
        const d = getDevice(id);
        if (!d) return sendJson(res, 404, { error: "not found" });
        if (parts[3] === "telemetry") {
          return sendJson(res, 200, { device_id: d.id, points: d.ring.slice() });
        }
        if (parts[3] === "trends") {
          return sendJson(res, 200, {
            device_id: d.id,
            analysis: d.analysis || analyzeSeries(d.ring),
          });
        }
        return sendJson(res, 200, devicePayload(d));
      }

      // НЕ сайт — лише підказка в plain text
      if (url.pathname === "/" || url.pathname === "/debug") {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end(
          `pulsar-server\nUDP :${UDP_PORT}  HTTP :${HTTP_PORT}\nWS /ws  API /api/dashboard\nwatch the TERMINAL\n`
        );
      }

      sendJson(res, 404, { error: "not found" });
    } catch (e) {
      sendJson(res, 400, { error: e.message });
    }
  });

  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    wsClients.add(ws);
    ws.send(JSON.stringify({ type: "hello", dashboard: dashboard() }));
    ws.on("close", () => wsClients.delete(ws));
  });

  server.listen(HTTP_PORT, () => {
    console.log("════════════════════════════════════════");
    console.log("  PULSAR SERVER  (RAM + MySQL async)");
    console.log(`  UDP ingest     :${UDP_PORT}   ← пристрій сюди`);
    console.log(`  HTTP ingest    :${HTTP_PORT}/ingest`);
    console.log(`  WS push        :${HTTP_PORT}/ws`);
    console.log(`  API (site)     :${HTTP_PORT}/api/dashboard`);
    console.log("  debug          TERMINAL ONLY");
    console.log("════════════════════════════════════════");
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
