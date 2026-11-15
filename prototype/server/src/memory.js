/**
 * Hot path у RAM — лише те, що потрібно сайту зараз:
 * метадані пристрою + короткий кільцевий буфер сьогоднішніх точок для графіків/трендів.
 *
 * Повна історія дня і архів — у MySQL (див. mysql.js + rollup).
 */

/** Скільки останніх точок тримаємо в RAM для сайту (графік / trends). */
const SITE_RING = Math.max(16, Number(process.env.SITE_RING || 120));

const devices = new Map();

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function ensure(id, meta = {}) {
  let d = devices.get(id);
  if (!d) {
    d = {
      id,
      device_no: meta.device_no || id.toUpperCase(),
      /** Відображуване ім'я (перейменування з панелі) */
      label: meta.label || meta.device_no || id.toUpperCase(),
      role: meta.role || "Пристрій",
      battery: 0,
      last_seen_at: null,
      ring: [],
      analysis: null,
      /** YYYY-MM-DD UTC — який день зараз у ring */
      ringDay: utcDayKey(),
    };
    devices.set(id, d);
  }
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
  d.ringDay = utcDayKey();
  return d;
}

/** Підвантажити точки з БД у RAM (старт сервера). */
export function hydrateRing(id, points, analysis = null) {
  const d = ensure(id);
  const today = utcDayKey();
  d.ringDay = today;
  d.ring = (points || [])
    .filter((p) => {
      const t = p.t || p.recorded_at;
      return t && String(t).slice(0, 10) === today;
    })
    .map((p) => ({
      t: p.t || p.recorded_at,
      hr: p.hr,
      spo2: p.spo2,
      temp: p.temp ?? p.temp_c,
    }))
    .slice(-SITE_RING);
  if (analysis) d.analysis = analysis;
  if (d.ring.length) {
    const last = d.ring[d.ring.length - 1];
    d.last_seen_at = last.t;
  }
  return d;
}

/**
 * Новий семпл для live UI.
 * Тримаємо лише сьогодні + не більше SITE_RING точок.
 */
export function pushSample(id, sample, analysis, battery) {
  const d = ensure(id);
  const t = sample.t || new Date().toISOString();
  const day = String(t).slice(0, 10);
  const today = utcDayKey();

  // Новий UTC-день → порожній ring (вчорашнє вже має піти в daily rollup у БД)
  if (d.ringDay !== today || day !== today) {
    d.ring = [];
    d.ringDay = today;
  }

  d.last_seen_at = t;
  if (battery != null && Number.isFinite(battery)) d.battery = Math.round(battery);

  if (day === today) {
    d.ring.push({
      t,
      hr: sample.hr,
      spo2: sample.spo2,
      temp: sample.temp,
    });
    if (d.ring.length > SITE_RING) d.ring.splice(0, d.ring.length - SITE_RING);
  }

  d.analysis = analysis;
  return d;
}

/** При зміні дня — очистити всі ring у RAM. */
export function rolloverRamDay(dayKey = utcDayKey()) {
  for (const d of devices.values()) {
    if (d.ringDay !== dayKey) {
      d.ring = [];
      d.ringDay = dayKey;
      d.analysis = null;
    }
  }
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

export function siteRingSize() {
  return SITE_RING;
}

export { utcDayKey };
