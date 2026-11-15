/**
 * Hot path у RAM — ingest/trends/API читають звідси, не з диска.
 * MySQL лише асинхронний архів.
 *
 * Додатково: денні зведення (траєкторія здоров'я) + черга команд на пристрій.
 */

const RING = 64;
const DAY_KEEP = 14;

const devices = new Map();

/** @type {Map<string, Array<{ id: string, code: string, text: string, line: string, created_at: string }>>} */
const outbound = new Map();

function dayKey(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function ensure(id, meta = {}) {
  let d = devices.get(id);
  if (!d) {
    d = {
      id,
      device_no: meta.device_no || id.toUpperCase(),
      label: meta.label || meta.device_no || id.toUpperCase(),
      role: meta.role || "Пристрій",
      battery: 0,
      last_seen_at: null,
      ring: [],
      analysis: null,
      /** @type {Map<string, { day: string, riskSum: number, n: number, hrSum: number, spo2Sum: number, tempSum: number, peakRisk: number }>} */
      days: new Map(),
      lastDeviceCmdAt: null,
      lastDeviceCmdCode: null,
    };
    devices.set(id, d);
  }
  if (!d.days) d.days = new Map();
  return d;
}

export function seedDevices(list) {
  for (const row of list) {
    ensure(row.id, {
      device_no: row.device_no,
      label: row.label || row.device_no,
      role: row.role_label || row.role,
    });
  }
}

export function getDevice(id) {
  return devices.get(id) || [...devices.values()].find((d) => d.device_no === id) || null;
}

export function listDevices() {
  return [...devices.values()].sort((a, b) =>
    String(a.device_no).localeCompare(String(b.device_no))
  );
}

export function renameDevice(id, label) {
  const d = getDevice(id);
  if (!d) return null;
  const next = String(label || "").trim().slice(0, 64);
  if (!next) throw new Error("label required");
  d.label = next;
  return d;
}

export function setDeviceRole(id, role) {
  const d = getDevice(id);
  if (!d) return null;
  const next = String(role || "").trim().slice(0, 64);
  if (!next) throw new Error("role required");
  d.role = next;
  return d;
}

export function clearRing(id) {
  const d = getDevice(id);
  if (!d) return null;
  d.ring = [];
  d.analysis = null;
  return d;
}

/** Оновити денне зведення (ризик / середні). */
export function noteDaily(id, sample, risk) {
  const d = ensure(id);
  const day = dayKey(sample.t);
  let bucket = d.days.get(day);
  if (!bucket) {
    bucket = {
      day,
      riskSum: 0,
      n: 0,
      hrSum: 0,
      spo2Sum: 0,
      tempSum: 0,
      peakRisk: 0,
    };
    d.days.set(day, bucket);
  }
  const r = Number(risk) || 0;
  bucket.riskSum += r;
  bucket.n += 1;
  bucket.hrSum += Number(sample.hr) || 0;
  bucket.spo2Sum += Number(sample.spo2) || 0;
  bucket.tempSum += Number(sample.temp) || 0;
  bucket.peakRisk = Math.max(bucket.peakRisk, r);

  // тримати лише останні DAY_KEEP днів
  const keys = [...d.days.keys()].sort();
  while (keys.length > DAY_KEEP) {
    d.days.delete(keys.shift());
  }
  return bucket;
}

export function getDayHistory(id) {
  const d = getDevice(id);
  if (!d?.days) return [];
  return [...d.days.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((b) => ({
      day: b.day,
      n: b.n,
      riskAvg: b.n ? b.riskSum / b.n : 0,
      peakRisk: b.peakRisk,
      hrAvg: b.n ? b.hrSum / b.n : null,
      spo2Avg: b.n ? b.spo2Sum / b.n : null,
      tempAvg: b.n ? b.tempSum / b.n : null,
    }));
}

/**
 * Покласти команду для годинника (міст забере через /api/bridge/outbound).
 * Дедуп: той самий code не частіше ніж раз на 6 годин.
 */
export function enqueueDeviceCommand(id, cmd) {
  if (!cmd?.code || !cmd?.line) return null;
  const d = getDevice(id);
  if (!d) return null;
  const now = Date.now();
  if (
    d.lastDeviceCmdCode === cmd.code &&
    d.lastDeviceCmdAt &&
    now - d.lastDeviceCmdAt < 6 * 3600 * 1000
  ) {
    return null;
  }
  d.lastDeviceCmdCode = cmd.code;
  d.lastDeviceCmdAt = now;
  const row = {
    id: `${id}-${now}`,
    code: cmd.code,
    text: cmd.text || "",
    line: cmd.line,
    created_at: new Date(now).toISOString(),
  };
  const q = outbound.get(id) || [];
  q.push(row);
  if (q.length > 8) q.splice(0, q.length - 8);
  outbound.set(id, q);
  return row;
}

/** Забрати й очистити чергу команд для пристрою (або всі, якщо id порожній). */
export function takeOutbound(id) {
  if (id) {
    const d = getDevice(id);
    const key = d?.id || id;
    const q = outbound.get(key) || [];
    outbound.set(key, []);
    return q;
  }
  const all = [];
  for (const [devId, q] of outbound) {
    all.push(...q.map((x) => ({ ...x, device_id: devId })));
    outbound.set(devId, []);
  }
  return all;
}

export function peekOutbound(id) {
  const d = getDevice(id);
  const key = d?.id || id;
  return [...(outbound.get(key) || [])];
}

/**
 * Сира лінія на годинник (CREW|…, REC|…).
 * dedupeMs — не дублювати той самий line частіше ніж раз на N мс.
 */
export function enqueueRawOutbound(id, line, { code = "RAW", dedupeMs = 2000 } = {}) {
  const text = String(line || "").trim();
  if (!text) return null;
  const d = getDevice(id);
  if (!d) return null;
  const now = Date.now();
  const key = `raw:${code}:${text}`;
  if (
    d.lastRawOutboundKey === key &&
    d.lastRawOutboundAt &&
    now - d.lastRawOutboundAt < dedupeMs
  ) {
    return null;
  }
  d.lastRawOutboundKey = key;
  d.lastRawOutboundAt = now;
  const row = {
    id: `${id}-${now}-raw`,
    code,
    text: text.slice(0, 120),
    line: text.endsWith("\n") ? text : `${text}\n`,
    created_at: new Date(now).toISOString(),
  };
  const q = outbound.get(d.id) || [];
  q.push(row);
  if (q.length > 12) q.splice(0, q.length - 12);
  outbound.set(d.id, q);
  return row;
}

export function pushSample(id, sample, analysis, battery) {
  const d = ensure(id);
  const t = sample.t || new Date().toISOString();
  d.last_seen_at = t;
  if (battery != null && Number.isFinite(battery)) d.battery = Math.round(battery);
  d.ring.push({
    t,
    hr: sample.hr,
    spo2: sample.spo2,
    temp: sample.temp,
  });
  if (d.ring.length > RING) d.ring.splice(0, d.ring.length - RING);
  d.analysis = analysis;
  return d;
}

export function seriesOf(id, limit = 40) {
  const d = getDevice(id);
  if (!d) return [];
  return d.ring.slice(-limit);
}

export function isConnected(d, offlineMs = 15000) {
  if (!d?.last_seen_at) return false;
  return Date.now() - new Date(d.last_seen_at).getTime() < offlineMs;
}

/** Тест/адмін: підсіяти денні ризики (щоб перевірити погіршення без очікування тижня). */
export function seedDayRisks(id, dayRisks) {
  const d = ensure(id);
  for (const row of dayRisks || []) {
    const day = row.day || dayKey();
    d.days.set(day, {
      day,
      riskSum: (Number(row.riskAvg) || 0) * (row.n || 10),
      n: row.n || 10,
      hrSum: (Number(row.hrAvg) || 80) * (row.n || 10),
      spo2Sum: (Number(row.spo2Avg) || 96) * (row.n || 10),
      tempSum: (Number(row.tempAvg) || 22) * (row.n || 10),
      peakRisk: Number(row.peakRisk) || Number(row.riskAvg) || 0,
    });
  }
  return getDayHistory(id);
}
