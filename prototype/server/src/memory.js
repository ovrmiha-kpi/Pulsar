/**
 * Hot path у RAM — ingest/trends/API читають звідси, не з диска.
 * MySQL лише асинхронний архів.
 */

const RING = 64;

const devices = new Map();

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
  return d;
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
