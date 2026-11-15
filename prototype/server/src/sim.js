/**
 * Per-device simulation — локальний генератор телеметрії для демо/тестів.
 * Кожен пристрій вмикається окремо з панелі керування.
 *
 * Налаштування (profile / hz) зберігаються після Stop і не скидаються,
 * поки адмін явно не зробить resetSimConfig / resetAllConfigs.
 */

/** @typedef {{ hz: number, profile: string, timer: ReturnType<typeof setInterval>|null, tick: number, emit: (sample: object) => void }} SimState */
/** @typedef {{ hz: number, profile: string }} SimConfig */

/** @type {Map<string, SimState>} */
const sims = new Map();

/** Останні вибрані параметри симуляції (живуть і після Stop). */
/** @type {Map<string, SimConfig>} */
const lastConfig = new Map();

const PROFILES = {
  normal: {
    hr: () => 68 + Math.sin(Date.now() / 8000) * 6 + (Math.random() - 0.5) * 3,
    spo2: () => 97 + (Math.random() - 0.5) * 1.2,
    temp: () => 21.5 + (Math.random() - 0.5) * 0.4,
    battery: () => 82,
  },
  rest: {
    hr: () => 52 + Math.sin(Date.now() / 12000) * 3 + (Math.random() - 0.5) * 2,
    spo2: () => 98 + (Math.random() - 0.5) * 0.8,
    temp: () => 20.8 + (Math.random() - 0.5) * 0.3,
    battery: () => 90,
  },
  warning: {
    hr: () => 105 + Math.sin(Date.now() / 5000) * 8 + (Math.random() - 0.5) * 4,
    spo2: () => 93 + (Math.random() - 0.5) * 1.5,
    temp: () => 27.5 + (Math.random() - 0.5) * 0.5,
    battery: () => 55,
  },
  critical: {
    hr: () => 128 + Math.sin(Date.now() / 3000) * 10 + (Math.random() - 0.5) * 5,
    spo2: () => 88 + (Math.random() - 0.5) * 2,
    temp: () => 32 + (Math.random() - 0.5) * 0.8,
    battery: () => 28,
  },
};

function normalizeConfig(opts = {}) {
  const profile = PROFILES[opts.profile] ? opts.profile : "normal";
  const hz = Math.min(5, Math.max(0.2, Number(opts.hz) || 1));
  return { profile, hz };
}

export function listProfiles() {
  return Object.keys(PROFILES);
}

export function isSimulating(id) {
  return sims.has(id);
}

/** Повертає стан симуляції; profile/hz пам'ятаються навіть коли active=false. */
export function getSimState(id) {
  const cfg = lastConfig.get(id) || { profile: "normal", hz: 1 };
  const s = sims.get(id);
  if (!s) {
    return { active: false, hz: cfg.hz, profile: cfg.profile, tick: 0 };
  }
  return { active: true, hz: s.hz, profile: s.profile, tick: s.tick };
}

export function listSims() {
  return [...sims.entries()].map(([id, s]) => ({
    id,
    hz: s.hz,
    profile: s.profile,
    tick: s.tick,
  }));
}

/**
 * Зберегти профіль/Hz без обов'язкового старту таймера.
 * Якщо симуляція вже біжить — перезапускає з новими параметрами (стан «увімкнено» лишається).
 */
export function setSimConfig(id, opts, emit) {
  const cfg = normalizeConfig(opts);
  lastConfig.set(id, cfg);
  if (sims.has(id) && typeof emit === "function") {
    return startSim(id, { ...cfg, emit });
  }
  return getSimState(id);
}

/**
 * @param {string} id
 * @param {{
 *   hz?: number,
 *   profile?: string,
 *   emit: (sample: object) => void
 * }} opts
 */
export function startSim(id, opts) {
  const cfg = normalizeConfig(opts);
  lastConfig.set(id, cfg);

  const prev = sims.get(id);
  const keepTick = prev && prev.profile === cfg.profile && prev.hz === cfg.hz ? prev.tick : 0;
  if (prev?.timer) clearInterval(prev.timer);

  const period = Math.round(1000 / cfg.hz);
  const state = /** @type {SimState} */ ({
    hz: cfg.hz,
    profile: cfg.profile,
    tick: keepTick,
    timer: null,
    emit: opts.emit,
  });

  const gen = PROFILES[cfg.profile];
  state.timer = setInterval(() => {
    state.tick++;
    opts.emit({
      device_id: id,
      hr: Number(gen.hr().toFixed(1)),
      spo2: Number(gen.spo2().toFixed(1)),
      temp: Number(gen.temp().toFixed(2)),
      battery: Math.round(gen.battery()),
      t: new Date().toISOString(),
    });
  }, period);

  sims.set(id, state);
  return getSimState(id);
}

/** Зупиняє таймер, але лишає profile/hz у пам'яті. */
export function stopSim(id) {
  const s = sims.get(id);
  if (!s) return false;
  if (s.timer) clearInterval(s.timer);
  sims.delete(id);
  return true;
}

export function stopAll() {
  for (const id of [...sims.keys()]) stopSim(id);
}

/** Повне скидання налаштувань симуляції (лише за явною командою адміна). */
export function resetSimConfig(id) {
  stopSim(id);
  lastConfig.delete(id);
  return true;
}

export function resetAllConfigs() {
  stopAll();
  lastConfig.clear();
}
