/**
 * Live bridge: prototype/server → PULSAR UI
 * Config: window.PULSAR_API / window.PULSAR_WS
 */
(function (global) {
  const API =
    global.PULSAR_API ||
    `${location.protocol}//${location.hostname}:4100`;
  const WS_URL =
    global.PULSAR_WS ||
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:4100/ws`;

  let clockOffsetMs = 0;

  function statusLabel(status) {
    const s = String(status || "pending").toLowerCase();
    if (s === "critical") return "Critical";
    if (s === "warning") return "Warning";
    if (s === "normal") return "Normal";
    return "Pending";
  }

  function metricOrNull(v, minUseful) {
    if (v == null || Number.isNaN(Number(v))) return null;
    const n = Number(v);
    if (minUseful != null && n < minUseful) return null;
    return n;
  }

  function historyFromSeries(series) {
    const out = {};
    if (!series || typeof series !== "object") return out;
    for (const [k, arr] of Object.entries(series)) {
      if (!Array.isArray(arr)) continue;
      out[k] = arr
        .map((p) => ({
          value: Number(p.v),
          timestamp: p.t || null,
        }))
        .filter((p) => Number.isFinite(p.value));
    }
    return out;
  }

  /** Server device payload → UI person shape */
  function mapDevice(d) {
    const hrHist = Array.isArray(d.history)
      ? d.history.map((p) => Number(p.hr)).filter((n) => Number.isFinite(n) && n >= 30)
      : [];
    const pulse = metricOrNull(d.hr, 30);
    const oxygen = metricOrNull(d.spo2, 50);
    const temperature =
      d.temp == null || Number.isNaN(Number(d.temp)) ? null : Number(d.temp);

    let warning = d.alert || "Awaiting sensor data";
    if (Array.isArray(d.recommendations) && d.recommendations.length) {
      const top = d.recommendations.find((r) => r.level !== "normal") || d.recommendations[0];
      if (top?.text) warning = top.text;
    }
    if (!d.connected) {
      warning = d.hasData
        ? "Device offline. Showing last known data."
        : "No packets. Start server + bridge/UDP.";
    }

    const analyticsSeries = d.analyticsSeries || null;
    const history = historyFromSeries(analyticsSeries);

    return {
      id: d.id,
      device_no: d.device_no,
      name: d.label || d.device_no || d.id,
      role: d.role || "Wrist station",
      simulating: !!d.simulating,
      status: d.connected ? statusLabel(d.status) : "Pending",
      pulse,
      oxygen,
      temperature,
      battery: d.battery == null ? null : Number(d.battery),
      connected: !!d.connected,
      warning,
      pulseHistory: hrHist.length
        ? hrHist
        : (history.pulse || []).map((p) => p.value).concat(pulse != null ? [pulse] : []).slice(-20),
      history,
      trends: d.trends || null,
      trajectory: d.trajectory || null,
      hypotheses: d.hypotheses || [],
      recommendations: d.recommendations || [],
      alert: d.alert || warning,
      sos: !!d.sos,
      mass: d.mass ?? null,
      gripStrength: d.gripStrength ?? null,
      acceleration: d.acceleration ?? null,
      movement: d.movement ?? null,
      activity: d.activity ?? null,
      pressure: d.pressure ?? null,
      airTemperature: d.airTemperature ?? null,
      airOxygen: d.airOxygen ?? null,
      airQuality: d.airQuality ?? null,
      co2: d.co2 ?? null,
      radiation: d.radiation ?? null,
      radiationDose: d.radiationDose ?? null,
      sleepDuration: d.sleepDuration ?? null,
      sleepQuality: d.sleepQuality ?? null,
      stressLevel: d.stressLevel ?? null,
      checkin: d.checkin ?? null,
      checkinHistory: d.checkinHistory || [],
      baseline: d.baseline || null,
      medicalCard: d.medicalCard || null,
      settings: d.settings || null,
      measurementHistory: d.measurementHistory || [],
      wellbeingHistory: d.wellbeingHistory || [],
      alertHistory: d.alertHistory || [],
      analyticsSeries,
      extSource: d.source || null,
    };
  }

  async function api(path, opts) {
    const res = await fetch(`${API}${path}`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
      ...opts,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `${path} ${res.status}`);
    return data;
  }

  async function postCheckin(id, body) {
    return api(`/api/devices/${encodeURIComponent(id)}/checkin`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  }

  async function putMedical(id, body) {
    return api(`/api/devices/${encodeURIComponent(id)}/medical`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  }

  async function putSettings(id, body) {
    return api(`/api/devices/${encodeURIComponent(id)}/settings`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  }

  async function fetchNotifications() {
    const data = await api("/api/notifications");
    return data.notifications || [];
  }

  async function postNotification(body) {
    return api("/api/notifications", {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  }

  async function replaceNotifications(list) {
    return api("/api/notifications", {
      method: "POST",
      body: JSON.stringify({ replace: true, notifications: list || [] }),
    });
  }

  async function patchNotification(id, patch) {
    return api(`/api/notifications/${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify(patch || {}),
    });
  }

  async function markAllNotificationsRead() {
    return api("/api/notifications/read-all", {
      method: "POST",
      body: "{}",
    });
  }

  async function fetchMissionUi() {
    const data = await api("/api/mission/ui");
    return data.ui || {};
  }

  async function putMissionUi(ui) {
    return api("/api/mission/ui", {
      method: "POST",
      body: JSON.stringify(ui || {}),
    });
  }

  async function fetchHabitat() {
    const data = await api("/api/mission/habitat");
    return data.habitat;
  }

  async function putHabitat(habitat) {
    return api("/api/mission/habitat", {
      method: "POST",
      body: JSON.stringify({ habitat }),
    });
  }

  async function fetchDashboard() {
    return api("/api/dashboard");
  }

  async function fetchDevice(id) {
    return mapDevice(await api(`/api/devices/${encodeURIComponent(id)}`));
  }

  async function postSos(id) {
    return api("/api/sos", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  }

  async function syncClock() {
    try {
      const t0 = Date.now();
      const data = await api("/api/time");
      const t1 = Date.now();
      const serverMs = data.epochMs != null
        ? Number(data.epochMs)
        : Date.parse(data.serverTime);
      if (Number.isFinite(serverMs)) {
        clockOffsetMs = serverMs - Math.round((t0 + t1) / 2);
      }
    } catch (_) {}
  }

  function serverNow() {
    return new Date(Date.now() + clockOffsetMs);
  }

  function setLinkState(el, state) {
    if (!el) return;
    el.dataset.state = state;
    el.textContent =
      state === "live"
        ? "Live"
        : state === "reconnect"
          ? "Reconnecting"
          : "Offline";
  }

  function startClock() {
    const el = document.getElementById("utc-clock");
    if (!el) return;
    const tick = () => {
      el.textContent = serverNow().toISOString().slice(11, 19) + " UTC";
    };
    tick();
    setInterval(tick, 1000);
    syncClock();
    setInterval(syncClock, 60000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startClock);
  } else {
    startClock();
  }

  function connect(hooks) {
    const { onDashboard, onSample, onNotification, onUi, linkEl } = hooks || {};
    let ws = null;
    let closed = false;
    let retryMs = 800;

    async function pull() {
      try {
        const dash = await fetchDashboard();
        const crew = (dash.devices || []).map(mapDevice);
        if (onDashboard) onDashboard(crew, dash.summary || {}, dash);
        if (onUi && dash.ui) onUi(dash.ui);
        if (dash.serverTime) {
          const ms = Date.parse(dash.serverTime);
          if (Number.isFinite(ms)) clockOffsetMs = ms - Date.now();
        }
        setLinkState(linkEl, "live");
        retryMs = 800;
      } catch (_) {
        setLinkState(linkEl, "offline");
      }
    }

    function openWs() {
      if (closed) return;
      setLinkState(linkEl, "reconnect");
      try {
        ws = new WebSocket(WS_URL);
      } catch (_) {
        setTimeout(openWs, retryMs);
        retryMs = Math.min(5000, retryMs * 1.5);
        return;
      }

      ws.onopen = () => {
        setLinkState(linkEl, "live");
        retryMs = 800;
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "hello" && msg.dashboard) {
            const crew = (msg.dashboard.devices || []).map(mapDevice);
            if (onDashboard) onDashboard(crew, msg.dashboard.summary || {}, msg.dashboard);
            if (onUi && msg.dashboard.ui) onUi(msg.dashboard.ui);
            return;
          }
          if (msg.type === "sample" && msg.device_id) {
            const person = mapDevice({
              id: msg.device_id,
              device_no: msg.device_no,
              label: msg.label,
              role: msg.role,
              battery: msg.battery,
              connected: msg.connected !== false,
              last_seen_at: msg.recorded_at,
              simulating: msg.simulating,
              ...(msg.analysis || {}),
              sos: msg.sos,
            });
            if (onSample) onSample(person);
            else pull();
          }
          if (msg.type === "notification" || msg.type === "notifications") {
            if (onNotification) onNotification(msg);
            document.dispatchEvent(
              new CustomEvent("pulsar:notifications-change", { detail: msg })
            );
          }
          if (
            msg.type === "device_meta" ||
            msg.type === "admin" ||
            msg.type === "sos" ||
            msg.type === "habitat"
          ) {
            pull();
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        setLinkState(linkEl, "reconnect");
        setTimeout(openWs, retryMs);
        retryMs = Math.min(5000, retryMs * 1.5);
        pull();
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch (_) {}
      };
    }

    pull();
    openWs();

    return {
      api: API,
      refresh: pull,
      stop() {
        closed = true;
        try {
          ws?.close();
        } catch (_) {}
      },
    };
  }

  global.PulsarLive = {
    API,
    WS_URL,
    mapDevice,
    fetchDashboard,
    fetchDevice,
    postSos,
    postCheckin,
    putMedical,
    putSettings,
    fetchNotifications,
    postNotification,
    replaceNotifications,
    patchNotification,
    markAllNotificationsRead,
    fetchMissionUi,
    putMissionUi,
    fetchHabitat,
    putHabitat,
    syncClock,
    serverNow,
    connect,
    setLinkState,
  };
})(window);
