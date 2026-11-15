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
      pulseHistory: hrHist.length ? hrHist : pulse != null ? [pulse] : [],
      trends: d.trends || null,
      trajectory: d.trajectory || null,
      hypotheses: d.hypotheses || [],
      recommendations: d.recommendations || [],
      alert: d.alert || warning,
      sos: !!d.sos,
    };
  }

  async function fetchDashboard() {
    const res = await fetch(`${API}/api/dashboard`, { cache: "no-store" });
    if (!res.ok) throw new Error("dashboard " + res.status);
    return res.json();
  }

  async function fetchDevice(id) {
    const res = await fetch(
      `${API}/api/devices/${encodeURIComponent(id)}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("device " + res.status);
    return mapDevice(await res.json());
  }

  async function postSos(id) {
    const res = await fetch(`${API}/api/sos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "SOS failed");
    return data;
  }

  function setLinkState(el, state) {
    if (!el) return;
    el.dataset.state = state;
    // Колір і крапка — у CSS (.link-chip[data-state])
    el.textContent =
      state === "live"
        ? "Live"
        : state === "reconnect"
          ? "Reconnecting"
          : "Offline";
  }

  /** UTC-годинник у шапці (#utc-clock) */
  function startClock() {
    const el = document.getElementById("utc-clock");
    if (!el) return;
    const tick = () => {
      el.textContent = new Date().toISOString().slice(11, 19) + " UTC";
    };
    tick();
    setInterval(tick, 1000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startClock);
  } else {
    startClock();
  }

  /**
   * @param {{
   *   onDashboard:(crew:object[], summary:object)=>void,
   *   onSample?:(person:object)=>void,
   *   linkEl?: HTMLElement|null
   * }} hooks
   */
  function connect(hooks) {
    const { onDashboard, onSample, linkEl } = hooks;
    let ws = null;
    let closed = false;
    let retryMs = 800;

    async function pull() {
      try {
        const dash = await fetchDashboard();
        const crew = (dash.devices || []).map(mapDevice);
        onDashboard(crew, dash.summary || {});
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
            onDashboard(crew, msg.dashboard.summary || {});
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
          if (msg.type === "device_meta" || msg.type === "admin" || msg.type === "sos") {
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
    connect,
    setLinkState,
  };
})(window);
