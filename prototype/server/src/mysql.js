/**
 * MySQL = cold store. Ніколи не блокує ingest.
 * Пишемо з черги в setImmediate / batch.
 */

import mysql from "mysql2/promise";

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

export function getSeed() {
  return SEED;
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
    `[mysql] OK ${cfg.host}:${cfg.port}/${cfg.database} (async persist)`
  );
  return pool;
}

/** Покласти в чергу — повертає одразу (0 блокування hot path). */
export function enqueuePersist(job) {
  queue.push({ kind: "sample", ...job });
  if (queue.length > 5000) queue.splice(0, queue.length - 4000); // drop oldest under flood
  if (!flushing) setImmediate(flush);
}

/** Оновити label/role у MySQL (якщо БД жива). */
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
      // стара схема без display_name — лише role
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
