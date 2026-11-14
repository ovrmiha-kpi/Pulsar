(() => {
  const state = { data: null, filter: "all", query: "", expanded: null };

  const el = {
    summary: document.getElementById("summary"),
    crew: document.getElementById("crew"),
    filters: document.getElementById("filters"),
    search: document.getElementById("search"),
    hint: document.getElementById("hint"),
    toast: document.getElementById("toast"),
    clock: document.getElementById("clock"),
    mission: document.getElementById("mission"),
    live: document.getElementById("live"),
    dbMode: document.getElementById("dbMode"),
    alarmBanner: document.getElementById("alarmBanner"),
    btnRefresh: document.getElementById("btnRefresh"),
    btnUsb: document.getElementById("btnUsb"),
  };

  function toast(msg) {
    el.toast.hidden = false;
    el.toast.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.toast.hidden = true), 3200);
  }

  function statusColor(status) {
    if (status === "critical") return "#ef4444";
    if (status === "warning") return "#eab308";
    if (status === "pending") return "#64748b";
    return "#22c55e";
  }

  function sparkline(history, status) {
    if (!history || history.length < 2) {
      return `<svg viewBox="0 0 320 72"><line x1="8" y1="36" x2="312" y2="36" stroke="#334155" stroke-width="2" stroke-dasharray="4 6"/></svg>`;
    }
    const vals = history.map((p) => p.hr);
    const min = Math.min(...vals) - 2;
    const max = Math.max(...vals) + 2;
    const w = 320;
    const h = 72;
    const color = statusColor(status);
    const pts = vals
      .map((v, i) => {
        const x = (i / (vals.length - 1)) * w;
        const y = h - ((v - min) / (max - min || 1)) * (h - 10) - 5;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" points="${pts}"/></svg>`;
  }

  function filtered(tiles) {
    const q = state.query.trim().toLowerCase();
    return tiles.filter((t) => {
      if (state.filter === "pending") {
        if (t.connected) return false;
      } else if (state.filter !== "all") {
        if (!t.connected || t.status !== state.filter) return false;
      }
      if (!q) return true;
      return t.device_no.toLowerCase().includes(q) || (t.role || "").toLowerCase().includes(q);
    });
  }

  function fmt(v, suffix = "") {
    return v == null || Number.isNaN(v) ? "—" : `${v}${suffix}`;
  }

  function avatarText(no) {
    const m = String(no || "").match(/(\d+)/);
    return m ? m[1].slice(-2) : "—";
  }

  function renderSummary(summary, labels) {
    const items = [
      ["total", labels.totalCrew, summary.total, "👥"],
      ["critical", labels.critical, summary.critical, "⚠"],
      ["warning", labels.warnings, summary.warning, "!"],
      ["normal", labels.normal, summary.normal, "✓"],
    ];
    el.summary.innerHTML = items
      .map(
        ([cls, lab, val, icon]) => `
      <article class="stat ${cls}">
        <div><div class="label">${lab}</div><div class="value">${val}</div></div>
        <div class="icon">${icon}</div>
      </article>`
      )
      .join("");
  }

  function renderFilters(labels) {
    const keys = [
      ["all", labels.filters.all],
      ["critical", labels.filters.critical],
      ["warning", labels.filters.warning],
      ["pending", labels.filters.pending],
      ["normal", labels.filters.normal],
    ];
    el.filters.innerHTML = keys
      .map(
        ([k, lab]) =>
          `<button type="button" data-filter="${k}" class="${state.filter === k ? "active" : ""}">${lab}</button>`
      )
      .join("");
  }

  function renderTiles(tiles, labels) {
    const list = filtered(tiles);
    if (!list.length) {
      el.crew.innerHTML = `<p style="color:#8b9bb4;grid-column:1/-1">Пристроїв не знайдено.</p>`;
      return;
    }

    const ordered = [...list];
    if (state.expanded) {
      const ix = ordered.findIndex((t) => t.id === state.expanded);
      if (ix > 0) {
        const [item] = ordered.splice(ix, 1);
        ordered.unshift(item);
      }
    }

    el.crew.innerHTML = ordered
      .map((t) => {
        const open = state.expanded === t.id;
        const st = t.connected ? t.status : "pending";
        const stLabel = t.connected ? t.statusLabel : "очікування";
        const tone = (x) => (x === "bad" ? "bad" : x === "warn" ? "warn" : t.hasData ? "ok" : "mute");
        const recs = (t.recommendations || [])
          .map((r) => `<li class="${r.level}">${r.text}</li>`)
          .join("");

        return `
        <article class="tile ${st} ${open ? "expanded" : ""}" tabindex="0" data-id="${t.id}" role="button">
          <div class="tile-top">
            <div class="who">
              <div class="avatar" aria-hidden="true">${avatarText(t.device_no)}</div>
              <div>
                <p class="device-no">${t.device_no}</p>
                <p class="device-meta">${t.role || "Пристрій"}</p>
              </div>
            </div>
            <span class="badge ${st}">${stLabel}</span>
          </div>

          <div class="metrics">
            <div class="metric">
              <div class="k">${labels.heartRate}</div>
              <div class="v ${tone(t.tones?.hr)}">${fmt(t.hr)} <small>${labels.bpm}</small></div>
              <div class="trend">${t.connected ? t.trends?.hr || "—" : "немає зв’язку"}</div>
            </div>
            <div class="metric">
              <div class="k">${labels.spo2}</div>
              <div class="v ${tone(t.tones?.spo2)}">${fmt(t.spo2, "%")}</div>
              <div class="trend">${t.connected ? t.trends?.spo2 || "—" : "—"}</div>
            </div>
            <div class="metric">
              <div class="k">${labels.skinTemp || "Темп. кімнати"}</div>
              <div class="v ${tone(t.tones?.temp)}">${fmt(t.temp, " °C")}</div>
              <div class="trend">${t.connected ? t.trends?.temp || "—" : "—"}</div>
            </div>
          </div>

          <div class="chart-wrap" title="Тенденція пульсу">${sparkline(t.history, st)}</div>
          <div class="alert ${st}">${t.alert}</div>

          <div class="foot">
            <span><span class="pip ${t.connected ? "" : "off"}"></span>${t.connected ? labels.connected : labels.offline}</span>
            <span>${labels.battery} ${t.battery || 0}%</span>
          </div>

          <button type="button" class="sos ${st === "critical" && t.connected ? "filled" : ""}"
            data-sos="${t.id}" ${t.connected ? "" : "disabled"}>${labels.sos}</button>

          ${
            open
              ? `<div class="expand-body">
                  <div class="expand-grid">
                    <div>
                      <p class="recs-title">Детальний графік</p>
                      <div class="chart-wrap" style="height:120px">${sparkline(t.history, st)}</div>
                    </div>
                    <div>
                      <p class="recs-title">${labels.recommendations}</p>
                      <ul class="recs">${recs}</ul>
                    </div>
                  </div>
                  <div class="expand-actions">
                    <button type="button" class="collapse" data-collapse>Згорнути</button>
                  </div>
                </div>`
              : ""
          }
        </article>`;
      })
      .join("");
  }

  function render() {
    if (!state.data) return;
    const { summary, tiles, labels, mission, dbMode } = state.data;
    if (mission) el.mission.textContent = mission;
    if (labels.expandHint) el.hint.textContent = labels.expandHint;
    el.search.placeholder = labels.search;
    el.dbMode.textContent = dbMode === "mysql" ? "MySQL" : "БД: файл";
    renderSummary(summary, labels);
    renderFilters(labels);
    renderTiles(tiles, labels);

    const alarmed = tiles.filter((t) => t.connected && t.alarm);
    if (alarmed.length) {
      el.alarmBanner.hidden = false;
      el.alarmBanner.textContent =
        "ТРИВОГА: " + alarmed.map((t) => `${t.device_no} — ${t.alert}`).join(" | ");
    } else el.alarmBanner.hidden = true;
  }

  async function load() {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("API");
      state.data = await res.json();
      el.live.textContent = "● API онлайн";
      el.live.style.color = "#22c55e";
      render();
    } catch (_) {
      el.live.textContent = "● API офлайн";
      el.live.style.color = "#ef4444";
    }
  }

  el.filters.addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    state.filter = b.dataset.filter;
    render();
  });

  el.search.addEventListener("input", () => {
    state.query = el.search.value;
    render();
  });

  el.crew.addEventListener("click", async (e) => {
    if (e.target.closest("[data-collapse]")) {
      state.expanded = null;
      render();
      return;
    }

    const sos = e.target.closest("[data-sos]");
    if (sos) {
      e.stopPropagation();
      if (sos.disabled) return toast("Пристрій офлайн");
      sos.disabled = true;
      try {
        const res = await fetch("/api/sos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: sos.dataset.sos }),
        });
        const data = await res.json();
        toast(data.message || data.error || "SOS");
      } catch (_) {
        toast("Помилка SOS");
      } finally {
        sos.disabled = false;
      }
      return;
    }

    const tile = e.target.closest(".tile");
    if (!tile) return;
    const id = tile.dataset.id;
    state.expanded = state.expanded === id ? null : id;
    render();
    if (state.expanded) {
      el.crew.querySelector(".tile.expanded")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  el.crew.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tile = e.target.closest(".tile");
    if (!tile) return;
    e.preventDefault();
    tile.click();
  });

  function tickClock() {
    el.clock.textContent = new Date().toLocaleString("uk-UA", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "short",
    });
  }

  tickClock();
  setInterval(tickClock, 1000);

  // SSE ≈1 с; fallback poll якщо stream впав
  let pollTimer = null;
  let es = null;
  function startPoll() {
    if (pollTimer) return;
    load();
    pollTimer = setInterval(load, 800);
  }
  function stopPoll() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function bindStream() {
    try {
      if (es) {
        es.close();
        es = null;
      }
      es = new EventSource("/api/stream");
      es.addEventListener("dashboard", (ev) => {
        try {
          state.data = JSON.parse(ev.data);
          el.live.textContent = "● API онлайн";
          el.live.style.color = "#22c55e";
          render();
          stopPoll();
        } catch (_) {}
      });
      es.onerror = () => startPoll();
    } catch (_) {
      startPoll();
    }
  }

  async function refreshAll() {
    bindStream();
    startPoll();
    await load();
    toast("Дані оновлено");
  }

  async function reconnectUsb() {
    el.btnUsb.disabled = true;
    try {
      const res = await fetch("/api/link/reconnect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      toast(data.message || "USB reconnect…");
      await new Promise((r) => setTimeout(r, 2500));
      await refreshAll();
    } catch (_) {
      toast("Не вдалося кикнути USB — перевір npm run bt");
    } finally {
      el.btnUsb.disabled = false;
    }
  }

  el.btnRefresh?.addEventListener("click", () => {
    refreshAll();
  });
  el.btnUsb?.addEventListener("click", () => {
    reconnectUsb();
  });

  bindStream();
  startPoll();
})();
