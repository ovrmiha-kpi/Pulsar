/**
 * MySQL = джерело правди для дня + постійний архів (telemetry_daily).
 * Ingest лишається неблокуючим: черга + setImmediate.
 *
 * RAM тримає лише короткий live-буфер для сайту (див. memory.js).
 */

import mysql from "mysql2/promise";
import { siteRingSize } from "./memory.js";

const SEED = [
  { id: "dev001", device_no: "DEV-001", role_label: "Зап'ястна станція" },
  { id: "dev002", device_no: "DEV-002", role_label: "Зап'ястна станція" },
  { id: "dev003", device_no: "DEV-003", role_label: "Зап'ястна станція" },
  { id: "dev004", device_no: "DEV-004", role_label: "Зап'ястна станція" },
];

let pool = null;
let queue = [];
let flushing = false;
let ready = false;

export function mysqlReady() {
  return ready;
}

export function getPool() {
  return pool;
}

export function getSeed() {
  return SEED;
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telemetry_daily (
      id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      device_id    VARCHAR(32) NOT NULL,
      day_date     DATE NOT NULL,
      period_slot  TINYINT UNSIGNED NOT NULL COMMENT '0=00-06 1=06-12 2=12-18 3=18-24 UTC',
      avg_hr       FLOAT NOT NULL,
      avg_spo2     FLOAT NOT NULL,
      avg_temp_c   FLOAT NOT NULL,
      samples      INT UNSIGNED NOT NULL DEFAULT 0,
      created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_daily (device_id, day_date, period_slot),
      INDEX idx_daily_day (day_date),
      CONSTRAINT fk_daily_dev FOREIGN KEY (device_id) REFERENCES devices(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  // На випадок старої схеми без source
  try {
    await pool.query(
      `ALTER TABLE telemetry ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'udp'`
    );
  } catch (_) {
    /* already exists */
  }
}

export async function initMysql() {
  const cfg = {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "pulsar",
    password: process.env.MYSQL_PASSWORD || "pulsar",
    database: process.env.MYSQL_DATABASE || "pulsar",
    waitForConnections: true,
    connectionLimit: 8,
    queueLimit: 0,
  };

  pool = mysql.createPool(cfg);
  await pool.query("SELECT 1");
  await ensureSchema();

  for (const d of SEED) {
    await pool.query(
      `INSERT INTO devices (id, device_no, role_label, battery_pct)
       VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE device_no=VALUES(device_no), role_label=VALUES(role_label)`,
      [d.id, d.device_no, d.role_label]
    );
  }

  ready = true;
  console.log(
    `[mysql] OK ${cfg.host}:${cfg.port}/${cfg.database} (day raw → daily×4 archive)`
  );
  return pool;
}

/** Останні N точок за сьогодні — для hydrate RAM під сайт. */
export async function loadTodayRecent(deviceId, limit = siteRingSize()) {
  if (!pool || !ready) return [];
  const today = new Date().toISOString().slice(0, 10);
  const [rows] = await pool.query(
    `SELECT hr, spo2, temp_c, recorded_at
     FROM telemetry
     WHERE device_id=? AND recorded_at >= ?
     ORDER BY recorded_at DESC
     LIMIT ?`,
    [deviceId, `${today} 00:00:00.000`, limit]
  );
  return rows
    .reverse()
    .map((r) => ({
      t: new Date(r.recorded_at).toISOString(),
      hr: r.hr,
      spo2: r.spo2,
      temp: r.temp_c,
    }));
}

export async function listDailyAverages(deviceId, days = 14) {
  if (!pool || !ready) return [];
  const [rows] = await pool.query(
    `SELECT day_date, period_slot, avg_hr, avg_spo2, avg_temp_c, samples
     FROM telemetry_daily
     WHERE device_id=?
     ORDER BY day_date DESC, period_slot ASC
     LIMIT ?`,
    [deviceId, Math.max(4, days * 4)]
  );
  return rows;
}

/** Покласти в чергу — повертає одразу (0 блокування hot path). */
export function enqueuePersist(job) {
  queue.push({ kind: "sample", ...job });
  if (queue.length > 5000) queue.splice(0, queue.length - 4000);
  if (!flushing) setImmediate(flush);
}

export function enqueueMeta(job) {
  queue.push({ kind: "meta", ...job });
  if (!flushing) setImmediate(flush);
}

async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    while (queue.length && pool && ready) {
      const batch = queue.splice(0, 64);
      for (const job of batch) {
        try {
          await writeJob(job);
        } catch (e) {
          console.warn("[mysql] write:", e.message);
        }
      }
    }
  } finally {
    flushing = false;
    if (queue.length) setImmediate(flush);
  }
}

async function writeJob(job) {
  if (job.kind === "meta") {
    try {
      await pool.query(
        `UPDATE devices
         SET display_name=COALESCE(?, display_name),
             role_label=COALESCE(?, role_label)
         WHERE id=?`,
        [job.label ?? null, job.role ?? null, job.deviceId]
      );
    } catch (e) {
      await pool.query(
        `UPDATE devices SET role_label=COALESCE(?, role_label) WHERE id=?`,
        [job.role ?? null, job.deviceId]
      );
    }
    return;
  }

  const { deviceId, hr, spo2, temp, battery, recorded_at, source, analysis } =
    job;

  await pool.query(
    `UPDATE devices SET last_seen_at=?, battery_pct=COALESCE(?, battery_pct) WHERE id=?`,
    [recorded_at, battery ?? null, deviceId]
  );

  // Сирі точки дня — у БД (постійне сховище до нічного rollup)
  await pool.query(
    `INSERT INTO telemetry (device_id, hr, spo2, temp_c, recorded_at, source)
     VALUES (?,?,?,?,?,?)`,
    [deviceId, hr, spo2, temp, recorded_at, source || "udp"]
  );

  if (analysis) {
    await pool.query(
      `INSERT INTO analyses
        (device_id, status, alert_text, trends_json, recommendations_json, hr, spo2, temp_c)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        deviceId,
        analysis.status,
        analysis.alert,
        JSON.stringify(analysis.trends),
        JSON.stringify(analysis.recommendations),
        analysis.hr,
        analysis.spo2,
        analysis.temp,
      ]
    );
  }
}
