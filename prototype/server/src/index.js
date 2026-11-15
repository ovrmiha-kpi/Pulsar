/**
 * Pulsar SERVER (low-latency)
 *
 * Hot path:  UDP/HTTP JSON → короткий RAM ring (для сайту) → trends → WS
 * Day store: кожна точка → MySQL `telemetry` (сирі дані поточного дня)
 * Archive:   опівночі UTC → 4 середні/день у `telemetry_daily`, сирі за день чистяться
 *
 * Admin:     /panel — керування пристроями / симуляція
 *
 * Порти:
 *   UDP  4101  — ingest з пристрою/шлюзу
 *   HTTP 4100  — /ingest, /api/*, /panel
 *   WS   4100  — /ws
 */

import http from "http";
import dgram from "dgram";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { analyzeSeries } from "./trends.js";
import {
  seedDevices,
  getDevice,
  listDevices,
  pushSample,
  seriesOf,
  isConnected,
  renameDevice,
  setDeviceRole,
  clearRing,
  hydrateRing,
  rolloverRamDay,
  utcDayKey,
} from "./memory.js";
import {
  initMysql,
  enqueuePersist,
  getSeed,
  mysqlReady,
  enqueueMeta,
  getPool,
  loadTodayRecent,
  listDailyAverages,
} from "./mysql.js";
import { rollupDay, pruneRawBeforeToday } from "./rollup.js";
import {
  startSim,
  stopSim,
  stopAll,
  isSimulating,
  getSimState,
  listSims,
  listProfiles,
  setSimConfig,
  resetSimConfig,
  resetAllConfigs,
} from "./sim.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "..", "public");

const HTTP_PORT = Number(process.env.PORT || 4100);
const UDP_PORT = Number(process.env.UDP_PORT || 4101);
const OFFLINE_MS = Number(process.env.OFFLINE_MS || 12000);

const wsClients = new Set();
/** @type {Map<string, { active: boolean, timestamp: string }>} */
const sosState = new Map();
let ingestCount = 0;
let lastLogMs = 0;
/** Який UTC-день зараз обслуговуємо в RAM / raw telemetry */
let currentUtcDay = utcDayKey();

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

/** Якщо настав новий UTC-день — rollup вчорашнього + очистка RAM. */
async function ensureDayBoundary() {
  const today = utcDayKey();
  if (today === currentUtcDay) return;
  const yesterday = currentUtcDay;
  currentUtcDay = today;
  rolloverRamDay(today);
  console.log(`[day] UTC rollover ${yesterday} → ${today}`);
  if (!mysqlReady()) return;
  try {
    const result = await rollupDay(getPool(), yesterday);
    console.log(
      `[day] archived ${yesterday}: devices=${result.devices.length} (4 averages each when data existed)`
    );
  } catch (e) {
    console.warn(`[day] rollup failed for ${yesterday}:`, e.message);
  }
}

/** Критичний шлях — без await MySQL. */
function ingestFast(raw, source) {
  const t0 = process.hrtime.bigint();
  const { key, hr, spo2, temp, battery, recorded_at } = parseSample(raw);
  const device = getDevice(key);
  if (!device) throw new Error("unknown device: " + key);

  // Поки симуляція увімкнена — реальні USB/UDP пакети цього id ігноруємо
  if (isSimulating(device.id) && !String(source).startsWith("sim:")) {
    return { ok: true, skipped: "simulating", device_id: device.id, us: 0 };
  }

  // Неблокуюча перевірка межі дня (rollup у фоні)
  const dayNow = utcDayKey();
  if (dayNow !== currentUtcDay) {
    setImmediate(() => {
      ensureDayBoundary().catch((e) => console.warn("[day]", e.message));
    });
  }

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
    label: device.label,
    role: device.role,
    battery: device.battery,
    recorded_at,
    analysis,
    connected: true,
    simulating: isSimulating(device.id),
    sos: sosState.get(device.id)?.active === true,
  });

  ingestCount++;
  const dtUs = Number(process.hrtime.bigint() - t0) / 1000;
  const now = Date.now();
  if (now - lastLogMs >= 500) {
    lastLogMs = now;
    console.log(
      `[${source}] ${device.label || device.device_no} hr=${analysis.hr} spo2=${analysis.spo2} temp=${analysis.temp} ${analysis.statusLabel}  ${dtUs.toFixed(0)}µs  n=${ingestCount}`
    );
  }
  return { ok: true, device_id: device.id, us: dtUs, analysis };
}

function devicePayload(d) {
  const connected = isConnected(d, OFFLINE_MS);
  const a = d.analysis || analyzeSeries(d.ring);
  const sos = sosState.get(d.id)?.active === true;
  const sim = getSimState(d.id);
  return {
    id: d.id,
    device_no: d.device_no,
    label: d.label || d.device_no,
    role: d.role,
    battery: d.battery,
    connected,
    last_seen_at: d.last_seen_at,
    sos,
    simulating: isSimulating(d.id),
    sim,
    ...(connected
      ? a
      : {
          ...a,
          status: d.ring.length ? a.status : "pending",
          statusLabel: d.ring.length ? a.statusLabel : "очікування",
          alert: d.ring.length ? "Офлайн — останні live-дані." : "Немає пакетів.",
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
    sims: listSims(),
    summary: {
      total: devices.length,
      online: devices.filter((x) => x.connected).length,
      simulating: devices.filter((x) => x.simulating).length,
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

function broadcastMeta(device) {
  broadcastWs({
    type: "device_meta",
    device_id: device.id,
    device_no: device.device_no,
    label: device.label,
    role: device.role,
    simulating: isSimulating(device.id),
    sim: getSimState(device.id),
  });
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

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function servePublic(urlPath, res) {
  const rel = urlPath === "/panel" || urlPath === "/panel/"
    ? "panel.html"
    : urlPath.replace(/^\/panel\//, "");
  const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const file = path.join(PUBLIC, safe);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return false;
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

async function handleAdmin(url, req, res) {
  const parts = url.pathname.split("/").filter(Boolean);
  // /api/admin/...
  if (parts[0] !== "api" || parts[1] !== "admin") return false;

  if (url.pathname === "/api/admin/status" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      mysql: mysqlReady(),
      udp: UDP_PORT,
      http: HTTP_PORT,
      ingestCount,
      profiles: listProfiles(),
      sims: listSims(),
      dashboard: dashboard(),
    });
    return true;
  }

  if (url.pathname === "/api/admin/sim/stop-all" && req.method === "POST") {
    // Stop timers only — keep last profile/hz until explicit reset
    stopAll();
    console.log("[admin] stop all sims (config kept)");
    broadcastWs({ type: "admin", action: "sim_stop_all", dashboard: dashboard() });
    sendJson(res, 200, { ok: true, sims: [], configsKept: true });
    return true;
  }

  if (url.pathname === "/api/admin/sim/reset-all" && req.method === "POST") {
    resetAllConfigs();
    console.log("[admin] reset all sim configs");
    broadcastWs({ type: "admin", action: "sim_reset_all", dashboard: dashboard() });
    sendJson(res, 200, { ok: true, sims: [] });
    return true;
  }

  // Примусовий денний rollup: сирі → 4 середні, потім delete raw
  if (url.pathname === "/api/admin/rollup" && req.method === "POST") {
    if (!mysqlReady()) {
      sendJson(res, 503, { error: "mysql offline" });
      return true;
    }
    const body = JSON.parse((await readBody(req)) || "{}");
    const day =
      body.day ||
      utcDayKey(new Date(Date.now() - (body.yesterday === false ? 0 : 86400000)));
    const result = await rollupDay(getPool(), day);
    console.log(`[admin] rollup day=${day}`);
    sendJson(res, 200, { ok: true, ...result });
    return true;
  }

  if (url.pathname === "/api/admin/prune-raw" && req.method === "POST") {
    if (!mysqlReady()) {
      sendJson(res, 503, { error: "mysql offline" });
      return true;
    }
    const result = await pruneRawBeforeToday(getPool());
    sendJson(res, 200, { ok: true, ...result });
    return true;
  }

  // /api/admin/devices/:id/...
  if (parts[2] === "devices" && parts[3]) {
    const id = decodeURIComponent(parts[3]);
    const d = getDevice(id);
    if (!d) {
      sendJson(res, 404, { error: "device not found" });
      return true;
    }
    const action = parts[4];
    const body =
      req.method === "POST" || req.method === "PATCH"
        ? JSON.parse((await readBody(req)) || "{}")
        : {};

    if (action === "rename" && req.method === "POST") {
      renameDevice(d.id, body.label ?? body.name);
      enqueueMeta({ deviceId: d.id, label: d.label, role: d.role });
      console.log(`[admin] rename ${d.device_no} → ${d.label}`);
      broadcastMeta(d);
      sendJson(res, 200, { ok: true, device: devicePayload(d) });
      return true;
    }

    if (action === "role" && req.method === "POST") {
      setDeviceRole(d.id, body.role);
      enqueueMeta({ deviceId: d.id, label: d.label, role: d.role });
      console.log(`[admin] role ${d.device_no} → ${d.role}`);
      broadcastMeta(d);
      sendJson(res, 200, { ok: true, device: devicePayload(d) });
      return true;
    }

    if (action === "sim" && req.method === "POST") {
      const emit = (sample) => {
        try {
          ingestFast(sample, `sim:${d.id}`);
        } catch (e) {
          console.warn("[sim]", e.message);
        }
      };

      // Лише зберегти профіль/Hz (без старту/стопу) — стан форми не губиться
      if (body.saveOnly) {
        setSimConfig(d.id, { hz: body.hz, profile: body.profile }, emit);
        console.log(
          `[admin] sim CONFIG ${d.device_no} profile=${body.profile || "normal"} hz=${body.hz || 1}`
        );
        broadcastMeta(d);
        sendJson(res, 200, { ok: true, device: devicePayload(d) });
        return true;
      }

      const on = body.on !== false && body.on !== 0 && body.on !== "0";
      if (!on) {
        // Stop timer, keep last profile/hz in memory
        setSimConfig(d.id, { hz: body.hz, profile: body.profile });
        stopSim(d.id);
        console.log(`[admin] sim OFF ${d.device_no} (config kept)`);
      } else {
        startSim(d.id, {
          hz: body.hz,
          profile: body.profile || "normal",
          emit,
        });
        console.log(
          `[admin] sim ON ${d.device_no} profile=${body.profile || "normal"} hz=${body.hz || 1}`
        );
      }
      broadcastMeta(d);
      sendJson(res, 200, { ok: true, device: devicePayload(d) });
      return true;
    }

    if (action === "sim-reset" && req.method === "POST") {
      resetSimConfig(d.id);
      console.log(`[admin] sim RESET ${d.device_no}`);
      broadcastMeta(d);
      sendJson(res, 200, { ok: true, device: devicePayload(d) });
      return true;
    }

    if (action === "clear" && req.method === "POST") {
      clearRing(d.id);
      console.log(`[admin] clear ring ${d.device_no}`);
      broadcastWs({ type: "admin", action: "clear", device_id: d.id, dashboard: dashboard() });
      sendJson(res, 200, { ok: true, device: devicePayload(d) });
      return true;
    }

    if (action === "sos" && req.method === "POST") {
      const active = body.active !== false && body.active !== 0;
      if (active) {
        const rec = { active: true, timestamp: nowIso() };
        sosState.set(d.id, rec);
        broadcastWs({ type: "sos", device_id: d.id, device_no: d.device_no, ...rec });
      } else {
        sosState.delete(d.id);
        broadcastWs({
          type: "sos",
          device_id: d.id,
          device_no: d.device_no,
          active: false,
          timestamp: nowIso(),
        });
      }
      console.log(`[admin] sos ${active ? "ON" : "OFF"} ${d.device_no}`);
      sendJson(res, 200, { ok: true, device: devicePayload(d) });
      return true;
    }

    sendJson(res, 404, { error: "unknown admin action" });
    return true;
  }

  sendJson(res, 404, { error: "not found" });
  return true;
}

async function hydrateFromDb() {
  if (!mysqlReady()) return;
  for (const d of listDevices()) {
    try {
      const points = await loadTodayRecent(d.id);
      if (points.length) {
        const analysis = analyzeSeries(points);
        hydrateRing(d.id, points, analysis);
        console.log(`[mysql] hydrate ${d.device_no}: ${points.length} today points → RAM`);
      }
    } catch (e) {
      console.warn(`[mysql] hydrate ${d.id}:`, e.message);
    }
  }
  try {
    const pruned = await pruneRawBeforeToday(getPool());
    if (pruned.deleted) {
      console.log(`[mysql] pruned stale raw rows: ${pruned.deleted}`);
    }
  } catch (e) {
    console.warn("[mysql] prune:", e.message);
  }
}

async function main() {
  seedDevices(getSeed());
  currentUtcDay = utcDayKey();

  try {
    await initMysql();
    await hydrateFromDb();
  } catch (e) {
    console.warn(`[mysql] OFFLINE — live лише в RAM, архів дня недоступний: ${e.message}`);
    console.warn("[mysql] підніми: npm run db:up   (docker compose)");
  }

  // Підстраховка межі доби (навіть без трафіку)
  setInterval(() => {
    ensureDayBoundary().catch((e) => console.warn("[day]", e.message));
  }, 60_000);

  const udp = dgram.createSocket("udp4");
  udp.on("message", (msg, rinfo) => {
    try {
      const raw = JSON.parse(msg.toString("utf8"));
      ingestFast(raw, `udp:${rinfo.address}`);
    } catch (e) {
      if (Date.now() - lastLogMs > 2000) {
        console.warn(`[udp] bad packet from ${rinfo.address}: ${e.message}`);
      }
    }
  });
  udp.bind(UDP_PORT, () => {
    console.log(`[udp] ingest 0.0.0.0:${UDP_PORT}`);
  });

  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
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
          sims: listSims().length,
        });
      }

      if (url.pathname === "/ingest" && req.method === "POST") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const result = ingestFast(body, "http");
        return sendJson(res, 200, {
          ok: true,
          us: result.us,
          device_id: result.device_id,
          skipped: result.skipped,
          status: result.analysis?.status,
        });
      }

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

      if (await handleAdmin(url, req, res)) return;

      if (url.pathname.startsWith("/api/devices/") && req.method === "GET") {
        const parts = url.pathname.split("/").filter(Boolean);
        const id = decodeURIComponent(parts[2]);
        const d = getDevice(id);
        if (!d) return sendJson(res, 404, { error: "not found" });
        if (parts[3] === "telemetry") {
          // Live: короткий RAM-буфер для сайту (не вся історія дня)
          return sendJson(res, 200, {
            device_id: d.id,
            scope: "live_ram",
            day: utcDayKey(),
            points: d.ring.slice(),
          });
        }
        if (parts[3] === "daily" || parts[3] === "averages") {
          if (!mysqlReady()) return sendJson(res, 503, { error: "mysql offline" });
          const days = Number(url.searchParams.get("days") || 14);
          const rows = await listDailyAverages(d.id, days);
          return sendJson(res, 200, {
            device_id: d.id,
            note: "4 averages per UTC day (period_slot 0..3 = 6h each)",
            rows,
          });
        }
        if (parts[3] === "trends") {
          return sendJson(res, 200, {
            device_id: d.id,
            analysis: d.analysis || analyzeSeries(d.ring),
          });
        }
        return sendJson(res, 200, devicePayload(d));
      }

      // Панель керування (не crew-сайт)
      if (url.pathname === "/panel" || url.pathname.startsWith("/panel/")) {
        if (servePublic(url.pathname, res)) return;
        return sendJson(res, 404, { error: "not found" });
      }

      if (url.pathname === "/" || url.pathname === "/debug") {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end(
          `pulsar-server\nUDP :${UDP_PORT}  HTTP :${HTTP_PORT}\nWS /ws  API /api/dashboard\nADMIN /panel\nwatch the TERMINAL\n`
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
    console.log(`  UDP ingest     :${UDP_PORT}`);
    console.log(`  HTTP ingest    :${HTTP_PORT}/ingest`);
    console.log(`  WS push        :${HTTP_PORT}/ws`);
    console.log(`  API (site)     :${HTTP_PORT}/api/dashboard`);
    console.log(`  ADMIN PANEL    :${HTTP_PORT}/panel`);
    console.log("════════════════════════════════════════");
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
