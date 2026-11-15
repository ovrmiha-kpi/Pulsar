/**
 * Розширені метрики станції/екіпажу для деталей UI.
 * Частина — симуляція середовища; частина — вивід із HR/SpO₂/temp.
 */

const EXT_RING = 96;

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function round(n, d = 1) {
  const p = 10 ** d;
  return Math.round(Number(n) * p) / p;
}

function hrStats(ring) {
  const hrs = (ring || [])
    .map((p) => Number(p.hr))
    .filter((n) => Number.isFinite(n) && n >= 30);
  if (!hrs.length) return { mean: null, min: null, max: null, std: null };
  const mean = hrs.reduce((s, x) => s + x, 0) / hrs.length;
  const variance =
    hrs.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, hrs.length - 1);
  return {
    mean,
    min: Math.min(...hrs),
    max: Math.max(...hrs),
    std: Math.sqrt(variance),
  };
}

/** Стабільний псевдорандом від id (щоб маса/база не стрибали між рестартами сесії). */
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

export function ensureExtended(device) {
  if (!device.ext) {
    const r = hash01(device.id || "x");
    device.ext = {
      mass: round(68 + r * 18, 1),
      gripBase: round(380 + r * 120, 0),
      radiationDose: round(0.05 + r * 0.08, 3),
      sleepHoursLast: round(6.2 + r * 1.8, 1),
      checkins: [],
      alertHistory: [],
      wellbeingHistory: [],
      ring: [],
      baseline: null,
    };
  }
  if (!Array.isArray(device.ext.ring)) device.ext.ring = [];
  if (!Array.isArray(device.ext.checkins)) device.ext.checkins = [];
  if (!Array.isArray(device.ext.alertHistory)) device.ext.alertHistory = [];
  if (!Array.isArray(device.ext.wellbeingHistory)) device.ext.wellbeingHistory = [];
  if (!device.ext.overrides || typeof device.ext.overrides !== "object") {
    device.ext.overrides = {};
  }
  return device.ext;
}

/** All site-facing metrics that /panel can force */
export const EMULATE_KEYS = [
  "hr",
  "spo2",
  "temp",
  "battery",
  "mass",
  "gripStrength",
  "acceleration",
  "movement",
  "activity",
  "pressure",
  "airTemperature",
  "airOxygen",
  "airQuality",
  "co2",
  "radiation",
  "radiationDose",
  "sleepDuration",
  "sleepQuality",
  "stressLevel",
];

const NUMERIC_KEYS = new Set([
  "hr",
  "spo2",
  "temp",
  "battery",
  "mass",
  "gripStrength",
  "acceleration",
  "pressure",
  "airTemperature",
  "airOxygen",
  "co2",
  "radiation",
  "radiationDose",
  "sleepDuration",
  "stressLevel",
]);

export function getOverrides(device) {
  return { ...ensureExtended(device).overrides };
}

export function setOverrides(device, patch = {}, { replace = false } = {}) {
  const ext = ensureExtended(device);
  const next = replace ? {} : { ...ext.overrides };
  for (const key of EMULATE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    const raw = patch[key];
    if (raw === "" || raw == null) {
      delete next[key];
      continue;
    }
    if (NUMERIC_KEYS.has(key)) {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      next[key] = n;
    } else {
      next[key] = String(raw).slice(0, 48);
    }
  }
  // Keep mass base in sync when forced
  if (next.mass != null) ext.mass = Number(next.mass);
  if (next.radiationDose != null) ext.radiationDose = Number(next.radiationDose);
  if (next.sleepDuration != null) ext.sleepHoursLast = Number(next.sleepDuration);
  if (next.gripStrength != null) ext.gripBase = Number(next.gripStrength);
  ext.overrides = next;
  return getOverrides(device);
}

export function clearOverrides(device) {
  const ext = ensureExtended(device);
  ext.overrides = {};
  return {};
}

export function applyOverridesToSample(device, sample) {
  const o = ensureExtended(device).overrides;
  const out = { ...sample };
  if (o.hr != null) out.hr = Number(o.hr);
  if (o.spo2 != null) out.spo2 = Number(o.spo2);
  if (o.temp != null) out.temp = Number(o.temp);
  if (o.battery != null) out.battery = Number(o.battery);
  return out;
}

export function applyOverridesToSnap(device, snap) {
  const o = ensureExtended(device).overrides;
  if (!o || !Object.keys(o).length) return snap;
  const out = { ...snap };
  const map = {
    hr: "pulse",
    spo2: "oxygen",
    temp: "temperature",
  };
  for (const [src, dst] of Object.entries(map)) {
    if (o[src] != null) {
      const n = Number(o[src]);
      if (Number.isFinite(n)) {
        out[dst] = src === "temp" ? round(n, 1) : Math.round(n);
        if (src === "hr") out.pulse = Math.round(n);
        if (src === "spo2") out.oxygen = Math.round(n);
        if (src === "temp") out.temperature = round(n, 1);
      }
    }
  }
  for (const key of EMULATE_KEYS) {
    if (key === "hr" || key === "spo2" || key === "temp" || key === "battery") continue;
    if (o[key] == null) continue;
    if (NUMERIC_KEYS.has(key)) {
      const n = Number(o[key]);
      if (Number.isFinite(n)) out[key] = n;
    } else {
      out[key] = o[key];
    }
  }
  return out;
}

/**
 * Побудувати snapshot розширених полів для одного sample.
 * @param {object} device
 * @param {{ hr:number, spo2:number, temp:number, t?:string }} latest
 * @param {object|null} analysis
 * @param {string|null} simProfile
 */
export function buildExtendedSnapshot(device, latest, analysis, simProfile) {
  const ext = ensureExtended(device);
  const ring = device.ring || [];
  const stats = hrStats(ring);
  const hr = Number(latest?.hr);
  const spo2 = Number(latest?.spo2);
  const temp = Number(latest?.temp);
  const t = latest?.t || new Date().toISOString();
  const profile = simProfile || "live";
  const r = hash01(device.id + daySeed(t));

  // --- Environment (cabin / station sim; modulated by vitals) ---
  const envStress =
    (Number.isFinite(spo2) && spo2 < 94 ? 1.2 : 1) *
    (analysis?.status === "critical" ? 1.15 : 1);
  const pressure = round(101.0 + Math.sin(Date.now() / 9e5) * 0.35 + (r - 0.5) * 0.2, 2);
  const airTemperature = round(
    293.0 + (Number.isFinite(temp) ? (temp - 22) * 0.15 : 0) + (r - 0.5) * 0.8,
    1
  ); // Kelvin-ish cabin
  const airOxygen = round(
    clamp(20.8 - (Number.isFinite(spo2) && spo2 < 95 ? (95 - spo2) * 0.05 : 0) + (r - 0.5) * 0.15, 19.5, 21.2),
    2
  );
  const co2 = round(
    clamp(
      650 +
        (Number.isFinite(hr) && hr > 100 ? (hr - 100) * 4 : 0) +
        (profile === "critical" ? 220 : profile === "warning" ? 120 : 0) +
        Math.sin(Date.now() / 2e5) * 40,
      400,
      2500
    ),
    0
  );
  const radiation = round(
    clamp(0.12 + (profile === "critical" ? 0.08 : 0) + Math.abs(Math.sin(Date.now() / 1e6)) * 0.04, 0.08, 0.45),
    3
  );
  ext.radiationDose = round(ext.radiationDose + radiation / 3600, 4); // rough per-sample add when 1Hz

  // --- Activity / motion from HR dynamics ---
  const hrDelta = stats.mean != null && Number.isFinite(hr) ? hr - stats.mean : 0;
  const activityScore = clamp(
    (Number.isFinite(hr) ? (hr - 55) / 70 : 0.2) + (stats.std || 0) / 40,
    0,
    1
  );
  const acceleration = round(0.15 + activityScore * 2.4 + Math.abs(hrDelta) / 80, 2);
  const movement =
    activityScore > 0.55 ? "Active" : activityScore > 0.28 ? "Light" : "Still";
  const activity =
    activityScore > 0.65 ? "High" : activityScore > 0.35 ? "Moderate" : "Low";

  // --- Stress / sleep from cardiac signals ---
  let stressLevel = 3;
  if (Number.isFinite(hr)) {
    if (hr < 58) stressLevel = 1.5 + (stats.std || 2) / 12;
    else if (hr < 75) stressLevel = 2.5 + (stats.std || 3) / 10;
    else if (hr < 100) stressLevel = 4 + (hr - 75) / 20;
    else if (hr < 120) stressLevel = 6.5 + (hr - 100) / 25;
    else stressLevel = 8.5 + Math.min(1.5, (hr - 120) / 30);
  }
  if (Number.isFinite(spo2) && spo2 < 94) stressLevel += 1;
  if (profile === "rest") stressLevel = Math.min(stressLevel, 2.5);
  if (profile === "critical") stressLevel = Math.max(stressLevel, 8);
  stressLevel = round(clamp(stressLevel, 0, 10), 1);

  // Sleep estimate: bradycardia / rest → longer recovered sleep; tachycardia → worse
  let sleepDuration = ext.sleepHoursLast;
  if (profile === "rest" || (Number.isFinite(hr) && hr < 60)) {
    sleepDuration = round(clamp(7.2 + (60 - (hr || 60)) / 40, 5.5, 9.0), 1);
  } else if (Number.isFinite(hr) && hr > 105) {
    sleepDuration = round(clamp(5.0 - (hr - 105) / 80, 3.5, 6.5), 1);
  } else {
    sleepDuration = round(clamp(6.0 + (r - 0.5) * 1.2 - stressLevel * 0.12, 4.0, 8.5), 1);
  }
  ext.sleepHoursLast = sleepDuration;
  const sleepQuality =
    sleepDuration >= 7 && stressLevel <= 3.5
      ? "Good"
      : sleepDuration >= 5.5 && stressLevel <= 6
        ? "Fair"
        : "Poor";

  // Mass / grip — slow drift; grip softer when stressed / high HR
  ext.mass = round(ext.mass + (r - 0.5) * 0.002, 1);
  const gripStrength = round(
    clamp(ext.gripBase - stressLevel * 8 - (Number.isFinite(hr) && hr > 110 ? 25 : 0), 250, 650),
    0
  );

  let airQuality =
    co2 <= 800 && airOxygen >= 20.5
      ? "Good"
      : co2 <= 1200
        ? "Fair"
        : "Poor";

  let snap = {
    t,
    // vitals aliases for analytics keys used by UI
    pulse: Number.isFinite(hr) ? Math.round(hr) : null,
    oxygen: Number.isFinite(spo2) ? Math.round(spo2) : null,
    temperature: Number.isFinite(temp) ? round(temp, 1) : null,
    mass: ext.mass,
    gripStrength,
    acceleration,
    movement,
    activity,
    pressure,
    airTemperature,
    airOxygen,
    airQuality,
    co2,
    radiation,
    radiationDose: ext.radiationDose,
    sleepDuration,
    sleepQuality,
    stressLevel,
    source: profile === "live" ? "derived+cabin" : `sim:${profile}`,
  };

  snap = applyOverridesToSnap(device, snap);
  // Keep derived bases aligned with forced values
  if (snap.mass != null) ext.mass = Number(snap.mass);
  if (snap.radiationDose != null) ext.radiationDose = Number(snap.radiationDose);
  if (snap.sleepDuration != null) ext.sleepHoursLast = Number(snap.sleepDuration);

  ext.ring.push(snap);
  if (ext.ring.length > EXT_RING) ext.ring.splice(0, ext.ring.length - EXT_RING);

  // Baseline: EMA while status normal / rest
  const baseKeys = {
    pulse: 0,
    oxygen: 0,
    temperature: 1,
    mass: 1,
    gripStrength: 0,
    pressure: 2,
    airOxygen: 2,
    co2: 0,
    radiation: 3,
    sleepDuration: 1,
    stressLevel: 1,
  };
  if (!ext.baseline) {
    ext.baseline = {};
    for (const k of Object.keys(baseKeys)) {
      const v = Number(snap[k]);
      ext.baseline[k] = Number.isFinite(v) ? round(v, baseKeys[k]) : null;
    }
  } else if (
    analysis?.status === "normal" ||
    profile === "normal" ||
    profile === "rest"
  ) {
    const a = 0.08;
    for (const [k, digits] of Object.entries(baseKeys)) {
      const next = Number(snap[k]);
      const prev = Number(ext.baseline[k]);
      if (!Number.isFinite(next)) continue;
      if (!Number.isFinite(prev)) {
        ext.baseline[k] = round(next, digits);
        continue;
      }
      // pulse/oxygen sanity
      if (k === "pulse" && (next < 30 || next > 220)) continue;
      if (k === "oxygen" && (next < 50 || next > 100)) continue;
      ext.baseline[k] = round((1 - a) * prev + a * next, digits);
    }
  }

  // Wellbeing history (sparse: every ~5 samples or stress jump)
  const lastWb = ext.wellbeingHistory[ext.wellbeingHistory.length - 1];
  if (
    !lastWb ||
    ext.ring.length % 5 === 0 ||
    Math.abs(Number(lastWb.stressLevel) - stressLevel) >= 1.5
  ) {
    ext.wellbeingHistory.push({
      timestamp: t,
      sleepDuration,
      sleepQuality,
      stressLevel,
      mood: stressLevel <= 3 ? "calm" : stressLevel <= 6 ? "ok" : "strained",
    });
    if (ext.wellbeingHistory.length > 40) {
      ext.wellbeingHistory.splice(0, ext.wellbeingHistory.length - 40);
    }
  }

  // Alert history when status worsens
  if (analysis?.status === "warning" || analysis?.status === "critical") {
    const msg = analysis.alert || analysis.statusLabel;
    const prev = ext.alertHistory[ext.alertHistory.length - 1];
    if (!prev || prev.message !== msg) {
      ext.alertHistory.push({
        timestamp: t,
        level: analysis.status,
        message: msg,
      });
      if (ext.alertHistory.length > 30) {
        ext.alertHistory.splice(0, ext.alertHistory.length - 30);
      }
    }
  }

  return snap;
}

function daySeed(iso) {
  return String(iso || "").slice(0, 10);
}

export function extendedPayload(device) {
  const ext = ensureExtended(device);
  const last = ext.ring[ext.ring.length - 1] || null;
  const checkins = ext.checkins.slice();
  const checkin = checkins.length ? checkins[checkins.length - 1] : null;

  return {
    ...(last || {}),
    checkin,
    checkinHistory: checkins.slice(-20),
    baseline: ext.baseline,
    overrides: { ...ext.overrides },
    measurementHistory: ext.ring.slice(-48).map((s) => ({
      timestamp: s.t,
      pulse: s.pulse,
      oxygen: s.oxygen,
      temperature: s.temperature,
      mass: s.mass,
      gripStrength: s.gripStrength,
      acceleration: s.acceleration,
      movement: s.movement,
      activity: s.activity,
      pressure: s.pressure,
      airTemperature: s.airTemperature,
      airOxygen: s.airOxygen,
      airQuality: s.airQuality,
      co2: s.co2,
      radiation: s.radiation,
      radiationDose: s.radiationDose,
      sleepDuration: s.sleepDuration,
      sleepQuality: s.sleepQuality,
      stressLevel: s.stressLevel,
    })),
    wellbeingHistory: ext.wellbeingHistory.slice(-30),
    alertHistory: ext.alertHistory.slice(-30),
    analyticsSeries: buildSeriesMap(ext.ring),
  };
}

function buildSeriesMap(ring) {
  const keys = [
    "pulse",
    "oxygen",
    "temperature",
    "mass",
    "gripStrength",
    "acceleration",
    "pressure",
    "airTemperature",
    "airOxygen",
    "co2",
    "radiation",
    "radiationDose",
    "sleepDuration",
    "stressLevel",
  ];
  // string series skipped — UI charts are numeric
  const out = {};
  for (const k of keys) {
    out[k] = (ring || [])
      .filter((s) => s[k] != null && Number.isFinite(Number(s[k])))
      .slice(-40)
      .map((s) => ({ t: s.t, v: Number(s[k]) }));
  }
  return out;
}

export function addCheckin(device, body) {
  const ext = ensureExtended(device);
  const row = {
    mood: String(body?.mood || "").slice(0, 32),
    symptoms: String(body?.symptoms || "").slice(0, 500),
    structuredSymptoms: Array.isArray(body?.structuredSymptoms)
      ? body.structuredSymptoms.slice(0, 40)
      : body?.structuredSymptoms ?? null,
    date: new Date().toISOString(),
    source: "live",
  };
  if (!row.mood) throw new Error("mood required");
  ext.checkins.push(row);
  if (ext.checkins.length > 40) ext.checkins.splice(0, ext.checkins.length - 40);
  ext.wellbeingHistory.push({
    timestamp: row.date,
    sleepDuration: ext.sleepHoursLast,
    sleepQuality: null,
    stressLevel: null,
    mood: row.mood,
    symptoms: row.symptoms,
    source: "checkin",
  });
  return row;
}
