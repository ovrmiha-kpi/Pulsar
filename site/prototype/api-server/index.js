/**
 * API-SERVER (бек для сайту)
 * — читає БД, віддає плитки сайту
 * — НЕ приймає радіо і НЕ симулює дані
 * — connected = реально свіжий last_seen від compute
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { Store } = require("../shared/db");
const { analyzeSeries } = require("../shared/analyze");

const PORT = Number(process.env.API_PORT || 3848);
const OFFLINE_MS = Number(process.env.OFFLINE_MS || 12000);
const KICK_FILE = path.join(__dirname, "..", ".data", "kick-bt");

const store = new Store();

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, code, data) {
  cors(res);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function isConnected(device) {
  if (!device?.last_seen_at) return false;
  return Date.now() - new Date(device.last_seen_at).getTime() < OFFLINE_MS;
}

async function buildTile(device) {
  const connected = isConnected(device);
  const series = await store.recentTelemetry(device.id, 12);
  const analysis = analyzeSeries(series);
  // якщо немає свіжого зв’язку — статус очікування, навіть якщо є стара історія
  if (!connected) {
    return {
      id: device.id,
      device_no: device.device_no,
      role: device.role_label,
      connected: false,
      battery: device.battery_pct || 0,
      status: series.length ? analysis.status : "pending",
      statusLabel: series.length ? analysis.statusLabel : "очікування",
      hr: series.length ? analysis.hr : null,
      spo2: series.length ? analysis.spo2 : null,
      temp: series.length ? analysis.temp : null,
      tones: analysis.tones,
      trends: series.length ? analysis.trends : { hr: "—", spo2: "—", temp: "—", raw: {} },
      history: analysis.history,
      alert: series.length
        ? "Пристрій офлайн. Показано останні збережені дані."
        : "Пристрій не підключено. Немає пакетів з Pulsar.",
      recommendations: series.length
        ? analysis.recommendations
        : [{ level: "normal", text: "Підключіть ESP по USB і запустіть: npm run bt -- COM11" }],
      alarm: false,
      hasData: series.length > 0,
    };
  }
  return {
    id: device.id,
    device_no: device.device_no,
    role: device.role_label,
    connected: true,
    battery: device.battery_pct || 0,
    ...analysis,
  };
}

async function buildDashboard() {
  await store.markStaleOffline(OFFLINE_MS);
  const devices = await store.listDevices();
  const tiles = [];
  for (const d of devices) tiles.push(await buildTile(d));

  return {
    brand: "ASTROVITAL",
    title: "Система моніторингу здоров’я в космосі",
    subtitle: "Панель екіпажу",
    mission: "Місія місячного дослідження",
    updatedAt: new Date().toISOString(),
    dbMode: store.mode,
    summary: {
      total: tiles.length,
      critical: tiles.filter((t) => t.connected && t.status === "critical").length,
      warning: tiles.filter((t) => t.connected && t.status === "warning").length,
      normal: tiles.filter((t) => t.connected && t.status === "normal").length,
      pending: tiles.filter((t) => !t.connected).length,
    },
    tiles,
    labels: {
      totalCrew: "Усього пристроїв",
      critical: "Критичні",
      warnings: "Попередження",
      normal: "Норма",
      search: "Пошук пристрою…",
      filters: {
        all: "Усі",
        critical: "Критичні",
        warning: "Попередження",
        pending: "Очікування",
        normal: "Норма",
      },
      heartRate: "Пульс",
      spo2: "SpO₂",
      skinTemp: "Темп. кімнати",
      recommendations: "Рекомендації",
      connected: "Підключено",
      offline: "Офлайн",
      battery: "Батарея",
      sos: "SOS / Екстрено",
      bpm: "уд/хв",
      expandHint: "Натисніть плитку — вона розсуне сусідні",
      alarm: "Тривога",
      noData: "Немає даних",
    },
  };
}

async function main() {
  await store.init();
  const server = http.createServer(async (req, res) => {
    cors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname === "/api/health") {
        return sendJson(res, 200, { ok: true, service: "api", db: store.mode });
      }
      if (url.pathname === "/api/dashboard" && req.method === "GET") {
        return sendJson(res, 200, await buildDashboard());
      }
      if (url.pathname.startsWith("/api/device/") && req.method === "GET") {
        const id = decodeURIComponent(url.pathname.split("/").pop());
        const d = await store.getDevice(id);
        if (!d) return sendJson(res, 404, { error: "Пристрій не знайдено" });
        return sendJson(res, 200, await buildTile(d));
      }
      if (url.pathname === "/api/link/reconnect" && req.method === "POST") {
        fs.mkdirSync(path.dirname(KICK_FILE), { recursive: true });
        fs.writeFileSync(KICK_FILE, String(Date.now()));
        console.log("[api] USB kick → bt-bridge reconnect");
        return sendJson(res, 200, {
          ok: true,
          message: "USB: запит на перепідключення відправлено. Зачекай 2–3 с.",
        });
      }
      if (url.pathname === "/api/sos" && req.method === "POST") {
        let body = "";
        for await (const c of req) body += c;
        const { id } = JSON.parse(body || "{}");
        const d = await store.getDevice(id);
        if (!d) return sendJson(res, 404, { error: "Пристрій не знайдено" });
        if (!isConnected(d)) {
          return sendJson(res, 409, { error: "Пристрій офлайн — SOS не доставлено" });
        }
        console.log(`[api SOS] ${d.device_no}`);
        return sendJson(res, 200, {
          ok: true,
          message: `SOS для ${d.device_no} прийнято.`,
        });
      }
      if (url.pathname === "/api/stream") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });
        res.write(`event: hello\ndata: {"service":"api"}\n\n`);
        let closed = false;
        const push = async () => {
          if (closed) return;
          try {
            const dash = await buildDashboard();
            res.write(`event: dashboard\ndata: ${JSON.stringify(dash)}\n\n`);
          } catch (e) {
            res.write(`event: error\ndata: ${JSON.stringify({ error: e.message })}\n\n`);
          }
        };
        push();
        const t = setInterval(push, 1000);
        req.on("close", () => {
          closed = true;
          clearInterval(t);
        });
        return;
      }
      sendJson(res, 404, { error: "Не знайдено" });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
  });

  server.listen(PORT, () => {
    console.log(`[api] http://localhost:${PORT}  (бек сайту, без симуляції)`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
