/**
 * Денний rollup: сирі telemetry за добу → 4 середні (по 6 годин) у telemetry_daily.
 * Після успішного архіву сирі точки того дня з telemetry видаляються.
 *
 * Слоти UTC:
 *   0 = 00:00–06:00
 *   1 = 06:00–12:00
 *   2 = 12:00–18:00
 *   3 = 18:00–24:00
 */

import { utcDayKey } from "./memory.js";

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} dayKey YYYY-MM-DD (UTC)
 */
export async function rollupDay(pool, dayKey) {
  if (!pool) throw new Error("mysql pool required");
  const day = dayKey || utcDayKey(new Date(Date.now() - 86400000));

  const start = `${day} 00:00:00.000`;
  const end = `${day} 23:59:59.999`;

  const [devices] = await pool.query(`SELECT id FROM devices`);
  const results = [];

  for (const { id: deviceId } of devices) {
    const [rows] = await pool.query(
      `SELECT hr, spo2, temp_c, recorded_at
       FROM telemetry
       WHERE device_id=? AND recorded_at >= ? AND recorded_at <= ?
       ORDER BY recorded_at ASC`,
      [deviceId, start, end]
    );

    const slots = [
      { sumHr: 0, sumSp: 0, sumT: 0, n: 0 },
      { sumHr: 0, sumSp: 0, sumT: 0, n: 0 },
      { sumHr: 0, sumSp: 0, sumT: 0, n: 0 },
      { sumHr: 0, sumSp: 0, sumT: 0, n: 0 },
    ];

    for (const r of rows) {
      const h = new Date(r.recorded_at).getUTCHours();
      const slot = Math.min(3, Math.floor(h / 6));
      slots[slot].sumHr += Number(r.hr);
      slots[slot].sumSp += Number(r.spo2);
      slots[slot].sumT += Number(r.temp_c);
      slots[slot].n += 1;
    }

    for (let period = 0; period < 4; period++) {
      const s = slots[period];
      if (!s.n) {
        // Немає даних у слоті — все одно фіксуємо порожній рядок? Краще пропустити.
        continue;
      }
      const avgHr = s.sumHr / s.n;
      const avgSp = s.sumSp / s.n;
      const avgT = s.sumT / s.n;
      await pool.query(
        `INSERT INTO telemetry_daily
          (device_id, day_date, period_slot, avg_hr, avg_spo2, avg_temp_c, samples)
         VALUES (?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           avg_hr=VALUES(avg_hr),
           avg_spo2=VALUES(avg_spo2),
           avg_temp_c=VALUES(avg_temp_c),
           samples=VALUES(samples)`,
        [deviceId, day, period, avgHr, avgSp, avgT, s.n]
      );
    }

    const [del] = await pool.query(
      `DELETE FROM telemetry
       WHERE device_id=? AND recorded_at >= ? AND recorded_at <= ?`,
      [deviceId, start, end]
    );

    results.push({
      device_id: deviceId,
      day,
      raw_rows: rows.length,
      deleted: del.affectedRows ?? 0,
      slots: slots.map((s, period) => ({
        period,
        samples: s.n,
        avg_hr: s.n ? Number((s.sumHr / s.n).toFixed(2)) : null,
        avg_spo2: s.n ? Number((s.sumSp / s.n).toFixed(2)) : null,
        avg_temp_c: s.n ? Number((s.sumT / s.n).toFixed(2)) : null,
      })),
    });
  }

  // Прибрати старі аналізи за той день (опційно — щоб не роздувати БД)
  await pool.query(`DELETE FROM analyses WHERE created_at >= ? AND created_at <= ?`, [
    start,
    end,
  ]);

  return { day, devices: results };
}

/** Видалити сирі точки старші за «сьогодні» (якщо rollup уже зробили або сміття). */
export async function pruneRawBeforeToday(pool) {
  if (!pool) return { deleted: 0 };
  const today = utcDayKey();
  const [res] = await pool.query(`DELETE FROM telemetry WHERE recorded_at < ?`, [
    `${today} 00:00:00.000`,
  ]);
  return { deleted: res.affectedRows ?? 0, keep_from: today };
}
