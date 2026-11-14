/** Спільне сховище: MySQL або один JSON-файл між api/compute. */

const fs = require("fs");
const path = require("path");

let mysql = null;
try {
  mysql = require("mysql2/promise");
} catch (_) {}

const MEM_FILE = path.join(__dirname, "..", ".data", "store.json");

const DEVICE_SEED = [
  { id: "dev001", device_no: "DEV-001", role_label: "Зап’ястна станція" },
  { id: "dev002", device_no: "DEV-002", role_label: "Зап’ястна станція" },
  { id: "dev003", device_no: "DEV-003", role_label: "Зап’ястна станція" },
  { id: "dev004", device_no: "DEV-004", role_label: "Зап’ястна станція" },
];

/** FILO: на пристрій лише N свіжих точок, решта викидається */
const KEEP_PER_DEVICE = 12;
const TEL_CAP = 48; // 4 пристрої × 12
const AN_CAP = 8;
const RADIO_CAP = 8;

function pruneTelemetry(mem, deviceId) {
  const keep = KEEP_PER_DEVICE;
  const others = [];
  const mine = [];
  for (const row of mem.telemetry || []) {
    if (row.device_id === deviceId) mine.push(row);
    else others.push(row);
  }
  mem.telemetry = others.concat(mine.slice(-keep));
  // analyses: лишаємо лише останній по цьому device
  const anOther = [];
  let anMine = null;
  for (const a of mem.analyses || []) {
    if (a.device_id === deviceId) anMine = a;
    else anOther.push(a);
  }
  mem.analyses = anMine ? anOther.concat([anMine]) : anOther;
}

function emptyMem() {
  return {
    devices: DEVICE_SEED.map((d) => ({
      ...d,
      connected: 0,
      battery_pct: 0,
      last_seen_at: null,
    })),
    telemetry: [],
    analyses: [],
    radio_log: [],
    _telId: 1,
    _anId: 1,
    _radId: 1,
  };
}

function loadMem() {
  try {
    return JSON.parse(fs.readFileSync(MEM_FILE, "utf8"));
  } catch (_) {
    return emptyMem();
  }
}

/** Швидкий запис без busy-wait (раніше саме він давав «хвилини» лагу). */
function saveMem(mem) {
  fs.mkdirSync(path.dirname(MEM_FILE), { recursive: true });
  if (mem.telemetry?.length > TEL_CAP) mem.telemetry = mem.telemetry.slice(-TEL_CAP);
  if (mem.analyses?.length > AN_CAP) mem.analyses = mem.analyses.slice(-AN_CAP);
  if (mem.radio_log?.length > RADIO_CAP) mem.radio_log = mem.radio_log.slice(-RADIO_CAP);
  const payload = JSON.stringify(mem);
  const tmp = `${MEM_FILE}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, payload);
    fs.copyFileSync(tmp, MEM_FILE);
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
  } catch (_) {
    try {
      fs.writeFileSync(MEM_FILE, payload);
    } catch (e2) {
      console.warn("[БД] save skip:", e2.message);
    }
  }
}

function seriesFromMem(mem, deviceId, limit) {
  return mem.telemetry
    .filter((x) => x.device_id === deviceId)
    .slice(-limit)
    .map((r) => ({ t: r.recorded_at, hr: r.hr, spo2: r.spo2, temp: r.temp_c }));
}

class Store {
  constructor() {
    this.mode = "memory";
    this.pool = null;
  }

  _m() {
    return loadMem();
  }

  _save(mem) {
    saveMem(mem);
  }

  async init() {
    const cfg = {
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "pulsar",
      password: process.env.MYSQL_PASSWORD || "pulsar",
      database: process.env.MYSQL_DATABASE || "pulsar",
      connectionLimit: 6,
    };
    if (!mysql) {
      this.mode = "memory";
      if (!fs.existsSync(MEM_FILE)) this._save(emptyMem());
      console.warn("[БД] файл:", MEM_FILE);
      return this.mode;
    }
    try {
      this.pool = mysql.createPool(cfg);
      await this.pool.query("SELECT 1");
      for (const d of DEVICE_SEED) {
        await this.pool.query(
          `INSERT INTO devices (id, device_no, role_label, connected, battery_pct)
           VALUES (?, ?, ?, 0, 0)
           ON DUPLICATE KEY UPDATE device_no=VALUES(device_no)`,
          [d.id, d.device_no, d.role_label]
        );
      }
      this.mode = "mysql";
      console.log("[БД] MySQL OK");
    } catch (e) {
      this.mode = "memory";
      this.pool = null;
      if (!fs.existsSync(MEM_FILE)) this._save(emptyMem());
      console.warn("[БД] MySQL недоступна → файл:", e.message);
    }
    return this.mode;
  }

  async listDevices() {
    if (this.mode === "mysql") {
      const [rows] = await this.pool.query(
        "SELECT id, device_no, role_label, connected, battery_pct, last_seen_at FROM devices ORDER BY device_no"
      );
      return rows;
    }
    return this._m().devices.slice().sort((a, b) => a.device_no.localeCompare(b.device_no));
  }

  async getDevice(id) {
    if (this.mode === "mysql") {
      const [rows] = await this.pool.query("SELECT * FROM devices WHERE id=? OR device_no=?", [id, id]);
      return rows[0] || null;
    }
    return this._m().devices.find((d) => d.id === id || d.device_no === id) || null;
  }

  async markSeen(deviceId, battery) {
    const now = new Date();
    if (this.mode === "mysql") {
      await this.pool.query(
        `UPDATE devices SET connected=1, last_seen_at=?, battery_pct=COALESCE(?, battery_pct) WHERE id=?`,
        [now, battery ?? null, deviceId]
      );
      return;
    }
    const mem = this._m();
    const d = mem.devices.find((x) => x.id === deviceId);
    if (!d) return;
    d.connected = 1;
    d.last_seen_at = now.toISOString();
    if (battery != null) d.battery_pct = battery;
    this._save(mem);
  }

  async markStaleOffline(timeoutMs = 15000) {
    const cutoff = Date.now() - timeoutMs;
    if (this.mode === "mysql") {
      await this.pool.query(
        `UPDATE devices SET connected=0
         WHERE last_seen_at IS NULL OR last_seen_at < FROM_UNIXTIME(?/1000)`,
        [cutoff]
      );
      return;
    }
    const mem = this._m();
    let changed = false;
    for (const d of mem.devices) {
      const stale = !d.last_seen_at || new Date(d.last_seen_at).getTime() < cutoff;
      if (stale && d.connected) {
        d.connected = 0;
        changed = true;
      }
    }
    if (changed) this._save(mem);
  }

  /**
   * Один пакет → один запис файлу (було 4 write + busy-wait = хвилини лагу).
   * Повертає recent series для analyze.
   */
  async ingestLive(deviceId, { hr, spo2, temp, battery, recorded_at, source, analysis }) {
    const t = recorded_at ? new Date(recorded_at) : new Date();
    const nowIso = new Date().toISOString();

    if (this.mode === "mysql") {
      await this.pool.query(
        `UPDATE devices SET connected=1, last_seen_at=?, battery_pct=COALESCE(?, battery_pct) WHERE id=?`,
        [t, battery ?? null, deviceId]
      );
      await this.pool.query(
        `INSERT INTO telemetry (device_id, hr, spo2, temp_c, recorded_at) VALUES (?,?,?,?,?)`,
        [deviceId, hr, spo2, temp, t]
      );
      // FILO: лишаємо лише KEEP_PER_DEVICE свіжих рядків
      await this.pool.query(
        `DELETE FROM telemetry WHERE device_id=? AND id NOT IN (
           SELECT id FROM (
             SELECT id FROM telemetry WHERE device_id=? ORDER BY recorded_at DESC LIMIT ?
           ) keep_ids
         )`,
        [deviceId, deviceId, KEEP_PER_DEVICE]
      );
      if (analysis) {
        await this.pool.query(`DELETE FROM analyses WHERE device_id=?`, [deviceId]);
        await this.pool.query(
          `INSERT INTO analyses (device_id, status, alert_text, recommendations_json, trends_json)
           VALUES (?,?,?,?,?)`,
          [
            deviceId,
            analysis.status,
            analysis.alert,
            JSON.stringify(analysis.recommendations),
            JSON.stringify(analysis.trends),
          ]
        );
      }
      const [rows] = await this.pool.query(
        `SELECT hr, spo2, temp_c, recorded_at FROM telemetry WHERE device_id=? ORDER BY recorded_at DESC LIMIT ?`,
        [deviceId, KEEP_PER_DEVICE]
      );
      return rows.reverse().map((r) => ({ t: r.recorded_at, hr: r.hr, spo2: r.spo2, temp: r.temp_c }));
    }

    const mem = this._m();
    const d = mem.devices.find((x) => x.id === deviceId);
    if (!d) throw new Error("Невідомий пристрій: " + deviceId);
    d.connected = 1;
    d.last_seen_at = nowIso;
    if (battery != null && Number.isFinite(battery)) d.battery_pct = battery;

    mem.telemetry.push({
      id: mem._telId++,
      device_id: deviceId,
      hr,
      spo2,
      temp_c: temp,
      recorded_at: t.toISOString(),
    });
    pruneTelemetry(mem, deviceId);

    if (analysis) {
      // замінюємо старий аналіз цього device (не копимо чергу)
      mem.analyses = (mem.analyses || []).filter((a) => a.device_id !== deviceId);
      mem.analyses.push({
        id: mem._anId++,
        device_id: deviceId,
        status: analysis.status,
        alert_text: analysis.alert,
        recommendations_json: JSON.stringify(analysis.recommendations),
        trends_json: JSON.stringify(analysis.trends),
        created_at: nowIso,
      });
    }

    // без radio_log на кожен пакет — лише live
    mem.radio_log = [];

    const series = seriesFromMem(mem, deviceId, KEEP_PER_DEVICE);
    this._save(mem);
    return series;
  }

  async insertTelemetry(deviceId, { hr, spo2, temp, recorded_at }) {
    const t = recorded_at ? new Date(recorded_at) : new Date();
    if (this.mode === "mysql") {
      const [r] = await this.pool.query(
        `INSERT INTO telemetry (device_id, hr, spo2, temp_c, recorded_at) VALUES (?,?,?,?,?)`,
        [deviceId, hr, spo2, temp, t]
      );
      return r.insertId;
    }
    const mem = this._m();
    const id = mem._telId++;
    mem.telemetry.push({
      id,
      device_id: deviceId,
      hr,
      spo2,
      temp_c: temp,
      recorded_at: t.toISOString(),
    });
    this._save(mem);
    return id;
  }

  async recentTelemetry(deviceId, limit = 40) {
    if (this.mode === "mysql") {
      const [rows] = await this.pool.query(
        `SELECT hr, spo2, temp_c, recorded_at FROM telemetry WHERE device_id=? ORDER BY recorded_at DESC LIMIT ?`,
        [deviceId, limit]
      );
      return rows.reverse().map((r) => ({ t: r.recorded_at, hr: r.hr, spo2: r.spo2, temp: r.temp_c }));
    }
    return seriesFromMem(this._m(), deviceId, limit);
  }

  async saveAnalysis(deviceId, analysis) {
    const recJson = JSON.stringify(analysis.recommendations);
    const trJson = JSON.stringify(analysis.trends);
    if (this.mode === "mysql") {
      const [r] = await this.pool.query(
        `INSERT INTO analyses (device_id, status, alert_text, recommendations_json, trends_json)
         VALUES (?,?,?,?,?)`,
        [deviceId, analysis.status, analysis.alert, recJson, trJson]
      );
      return r.insertId;
    }
    const mem = this._m();
    const id = mem._anId++;
    mem.analyses.push({
      id,
      device_id: deviceId,
      status: analysis.status,
      alert_text: analysis.alert,
      recommendations_json: recJson,
      trends_json: trJson,
      created_at: new Date().toISOString(),
    });
    this._save(mem);
    return id;
  }

  async logRadio(source, payload, ok = true) {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload);
    if (this.mode === "mysql") {
      await this.pool.query(`INSERT INTO radio_log (source, payload, ok) VALUES (?,?,?)`, [
        source,
        text,
        ok ? 1 : 0,
      ]);
      return;
    }
    const mem = this._m();
    mem.radio_log.push({
      id: mem._radId++,
      source,
      payload: text,
      ok: ok ? 1 : 0,
      created_at: new Date().toISOString(),
    });
    this._save(mem);
  }
}

module.exports = { Store, DEVICE_SEED };
