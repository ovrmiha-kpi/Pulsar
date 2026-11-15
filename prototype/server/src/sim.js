/**
 * Per-device simulation — локальний генератор телеметрії для демо/тестів.
 * Кожен пристрій вмикається окремо з панелі керування.
 */

/** @typedef {{ hz: number, profile: string, timer: ReturnType<typeof setInterval>|null, tick: number }} SimState */

/** @type {Map<string, SimState>} */
const sims = new Map();

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

export function listProfiles() {
  return Object.keys(PROFILES);
}

export function isSimulating(id) {
  return sims.has(id);
}

export function getSimState(id) {
  const s = sims.get(id);
  if (!s) return null;
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
 * @param {string} id
 * @param {{
 *   hz?: number,
 *   profile?: string,
 *   emit: (sample: object) => void
 * }} opts
 */
export function startSim(id, opts) {
  stopSim(id);
  const profile = PROFILES[opts.profile] ? opts.profile : "normal";
  const hz = Math.min(5, Math.max(0.2, Number(opts.hz) || 1));
  const period = Math.round(1000 / hz);
  const state = /** @type {SimState} */ ({
    hz,
    profile,
    tick: 0,
    timer: null,
  });

  const gen = PROFILES[profile];
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
