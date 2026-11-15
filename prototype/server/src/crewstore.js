/**
 * Crew UI state owned by the server:
 * medical card, settings/reminders, notification inbox, dashboard UX prefs.
 */

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const mission = {
  notifications: [],
  ui: {
    filter: "All",
    search: "",
  },
  habitat: null,
};

export function ensureCrewFields(device) {
  if (!device.crew) {
    device.crew = {
      medicalCard: null,
      settings: {
        reminders: {
          checkinEnabled: false,
          checkinTime: "20:00",
          measurementEnabled: false,
          measurementTime: "08:00",
        },
        notifications: {
          health: true,
          device: true,
          battery: true,
        },
        animations: true,
      },
      baseline: null,
    };
  }
  if (!device.crew.settings) {
    device.crew.settings = {
      reminders: {},
      notifications: {},
      animations: true,
    };
  }
  return device.crew;
}

export function crewPayload(device) {
  const c = ensureCrewFields(device);
  return {
    medicalCard: c.medicalCard,
    settings: c.settings,
    baseline: c.baseline,
  };
}

export function setMedicalCard(device, body) {
  const c = ensureCrewFields(device);
  const medicalCard = {
    ...(c.medicalCard || {}),
    ...(body?.medicalCard || body || {}),
    updatedAt: nowIso(),
  };
  c.medicalCard = medicalCard;
  if (body?.baseline && typeof body.baseline === "object") {
    c.baseline = { ...(c.baseline || {}), ...body.baseline };
  }
  return { medicalCard: c.medicalCard, baseline: c.baseline };
}

export function setSettings(device, body) {
  const c = ensureCrewFields(device);
  const next = body?.settings || body || {};
  c.settings = {
    ...c.settings,
    ...next,
    reminders: {
      ...(c.settings.reminders || {}),
      ...(next.reminders || {}),
    },
    notifications: {
      ...(c.settings.notifications || {}),
      ...(next.notifications || {}),
    },
  };
  return c.settings;
}

export function setBaseline(device, baseline) {
  const c = ensureCrewFields(device);
  c.baseline = { ...(c.baseline || {}), ...(baseline || {}) };
  return c.baseline;
}

export function listNotifications() {
  return mission.notifications.slice().sort((a, b) => {
    const ta = new Date(b.createdAt || 0).getTime();
    const tb = new Date(a.createdAt || 0).getTime();
    return ta - tb;
  });
}

export function addNotification(data = {}) {
  const row = {
    id: data.id || uid(),
    type: String(data.type || "info").slice(0, 32),
    priority: data.priority || "info",
    title: String(data.title || "Notice").slice(0, 160),
    body: String(data.body || data.message || "").slice(0, 800),
    deviceId: data.deviceId || data.astronautId || null,
    astronautId: data.astronautId || data.deviceId || null,
    section: data.section || null,
    read: !!data.read,
    createdAt: data.createdAt || nowIso(),
    source: data.source || "server",
  };
  const i = mission.notifications.findIndex((n) => n.id === row.id);
  if (i >= 0) mission.notifications[i] = { ...mission.notifications[i], ...row };
  else mission.notifications.unshift(row);
  if (mission.notifications.length > 200) {
    mission.notifications.length = 200;
  }
  return row;
}

export function patchNotification(id, patch = {}) {
  const n = mission.notifications.find((x) => String(x.id) === String(id));
  if (!n) return null;
  if (patch.read != null) n.read = !!patch.read;
  if (patch.title != null) n.title = String(patch.title).slice(0, 160);
  if (patch.body != null) n.body = String(patch.body).slice(0, 800);
  return n;
}

export function markAllNotificationsRead() {
  for (const n of mission.notifications) n.read = true;
  return listNotifications();
}

export function replaceNotifications(list) {
  if (!Array.isArray(list)) return listNotifications();
  mission.notifications = list
    .slice(0, 200)
    .map((n) => ({
      id: n.id || uid(),
      type: n.type || "info",
      priority: n.priority || "info",
      title: String(n.title || "Notice").slice(0, 160),
      body: String(n.body || "").slice(0, 800),
      deviceId: n.deviceId || n.astronautId || null,
      astronautId: n.astronautId || n.deviceId || null,
      section: n.section || null,
      read: !!n.read,
      createdAt: n.createdAt || nowIso(),
      source: n.source || "ui",
    }));
  return listNotifications();
}

export function getMissionUi() {
  return { ...mission.ui };
}

export function setMissionUi(patch = {}) {
  if (patch.filter != null) mission.ui.filter = String(patch.filter);
  if (patch.search != null) mission.ui.search = String(patch.search).slice(0, 120);
  return getMissionUi();
}

export function getHabitat() {
  return mission.habitat;
}

export function setHabitat(data) {
  mission.habitat = data || null;
  return mission.habitat;
}

/** Push alert-derived notification when device status worsens */
export function maybeAlertNotification(device, analysis) {
  const status = String(analysis?.status || "").toLowerCase();
  if (status !== "warning" && status !== "critical") return null;
  const key = `status:${device.id}:${status}:${String(analysis?.alert || "").slice(0, 40)}`;
  const recent = mission.notifications.find(
    (n) => n.id === key || (n.deviceId === device.id && n.type === status && !n.read)
  );
  if (recent && recent.id === key) return null;
  return addNotification({
    id: key,
    type: status,
    priority: status,
    title: `${device.label || device.device_no}: ${status}`,
    body: analysis?.alert || analysis?.warning || "Health status changed",
    deviceId: device.id,
    section: "health",
    source: "telemetry",
  });
}
