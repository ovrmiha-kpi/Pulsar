// ==============================
// LIVE CREW (from prototype/server)
// Плитки впритул; клік по плитці розгортає її на весь екран.
// ==============================

/** @type {any[]} */
let astronauts = [];

const STATUSES = ["Critical", "Warning", "Pending", "Normal"];

const crewGrid = document.getElementById("crew-grid");
const linkEl = document.getElementById("live-link");

function escapeHTML(value) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusClassOf(person) {
  return STATUSES.includes(person.status)
    ? person.status.toLowerCase()
    : "pending";
}

function upsertPerson(person) {
  const id = String(person.id);
  const i = astronauts.findIndex((p) => String(p.id) === id);
  if (i >= 0) astronauts[i] = { ...astronauts[i], ...person };
  else astronauts.push(person);
}

function createPulseChart(person) {
  const values = Array.isArray(person.pulseHistory)
    ? person.pulseHistory.slice(-10)
    : [];
  const statusClass = statusClassOf(person);

  if (values.length < 2 || !values.every(Number.isFinite)) {
    return `
      <div class="pulse-chart-container ${statusClass}">
        <div class="pulse-chart-header">
          <span class="pulse-chart-title">Heart Rate Trend</span>
        </div>
        <div class="pulse-chart-empty">No pulse history</div>
      </div>`;
  }

  const width = 400;
  const height = 95;
  const left = 35;
  const right = 8;
  const top = 8;
  const bottom = 10;
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const range = max - min || 1;

  const points = values.map((value, index) => ({
    x: left + (index / (values.length - 1)) * (width - left - right),
    y: height - bottom - ((value - min) / range) * (height - top - bottom),
  }));
  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const last = points[points.length - 1];

  let grid = "";
  for (let i = 0; i <= 3; i++) {
    const y = top + (i / 3) * (height - top - bottom);
    const label = Math.round(max - (i / 3) * range);
    grid += `
      <line class="pulse-chart-grid" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"
        stroke-width="1" stroke-dasharray="4 4"/>
      <text class="pulse-chart-label" x="${left - 8}" y="${y + 4}" text-anchor="end">${label}</text>`;
  }

  const baseY = height - bottom;
  const areaPoints = `${points[0].x},${baseY} ${linePoints} ${last.x},${baseY}`;

  return `
    <div class="pulse-chart-container ${statusClass}">
      <div class="pulse-chart-header">
        <span class="pulse-chart-title">Heart Rate Trend</span>
        <span class="pulse-chart-period">bpm</span>
      </div>
      <svg class="pulse-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"
        role="img" aria-label="Heart rate history">
        ${grid}
        <polygon class="pulse-area" points="${areaPoints}"/>
        <polyline class="pulse-line" points="${linePoints}" fill="none" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        <circle class="pulse-point" cx="${last.x}" cy="${last.y}" r="3.5"/>
      </svg>
    </div>`;
}

function avatarInitials(name) {
  const s = String(name || "?").trim();
  if (/^DEV-/i.test(s)) {
    const m = s.match(/(\d+)/);
    return m ? m[1].slice(-2) : "DV";
  }
  return s
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function createAstronautCard(person) {
  const statusClass = statusClassOf(person);
  const card = document.createElement("article");
  card.className = `astronaut-card ${statusClass}`;
  card.dataset.id = String(person.id);
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${person.name}`);

  const sosActive =
    typeof isSosActive === "function" ? isSosActive(person.id) : !!person.sos;
  card.classList.toggle("sos-active", sosActive);

  const pulseDisp = person.pulse == null ? "—" : person.pulse;
  const oxyDisp = person.oxygen == null ? "—" : person.oxygen;
  const tempDisp = person.temperature == null ? "—" : person.temperature;

  card.innerHTML = `
    <div class="astronaut-header">
      <div class="avatar">${escapeHTML(avatarInitials(person.name))}</div>
      <div class="astronaut-info">
        <h3>${escapeHTML(person.name)}</h3>
        <p>${escapeHTML(person.role)}</p>
      </div>
      <span class="status ${sosActive ? "critical" : statusClass}">${
        sosActive ? "SOS" : escapeHTML(person.status)
      }</span>
    </div>
    <div class="metrics">
      <div class="metric">
        <span class="metric-name">Heart Rate</span>
        <span class="metric-value">${escapeHTML(pulseDisp)}</span>
        <span class="metric-unit">bpm</span>
      </div>
      <div class="metric">
        <span class="metric-name">SpO₂</span>
        <span class="metric-value">${escapeHTML(oxyDisp)}</span>
        <span class="metric-unit">%</span>
      </div>
      <div class="metric">
        <span class="metric-name">Cabin Temp</span>
        <span class="metric-value">${escapeHTML(tempDisp)}</span>
        <span class="metric-unit">°C</span>
      </div>
    </div>
    ${createPulseChart(person)}
    <div class="alert-message ${statusClass}">${escapeHTML(person.warning)}</div>
    <div class="device-info">
      <span class="link-state ${person.connected ? "connected" : ""}">
        ${person.connected ? "Connected" : "No link"}
      </span>
      <span>Battery ${
        person.battery == null ? "—" : escapeHTML(person.battery) + "%"
      }</span>
    </div>`;

  return card;
}

// Кількість колонок: плитки займають усе вікно, сітка близька до квадрата
// (4 пристрої → 2×2), але плитка не вужча за MIN_TILE_PX.
const MIN_TILE_PX = 400;

function layoutGrid(count) {
  if (!crewGrid) return;
  const n = Math.max(1, count);
  const ideal = n <= 3 ? n : Math.ceil(Math.sqrt(n));
  const fit = Math.max(1, Math.floor(window.innerWidth / MIN_TILE_PX));
  crewGrid.style.setProperty("--cols", String(Math.min(ideal, fit)));
}

window.addEventListener("resize", () => layoutGrid(astronauts.length));

function renderAstronauts() {
  if (!crewGrid) return;

  // Стабільний порядок за id — плитки не стрибають при зміні статусу
  const list = [...astronauts].sort((a, b) =>
    String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
  );

  crewGrid.innerHTML = "";
  list.forEach((person) => crewGrid.appendChild(createAstronautCard(person)));
  layoutGrid(list.length);

  if (list.length === 0) {
    crewGrid.innerHTML = `<p class="empty-message">Waiting for devices</p>`;
  }
}

// ==============================
// РОЗГОРТАННЯ ПЛИТКИ НА ВЕСЬ ЕКРАН
// Панель стартує з прямокутника плитки й росте до всього вікна
// (під шапкою), всередині — індивідуальна сторінка пристрою.
// ==============================

let expandedId = null;

function headerHeight() {
  const header = document.querySelector(".header");
  return header ? Math.round(header.getBoundingClientRect().bottom) : 0;
}

function setPanelRect(panel, rect) {
  panel.style.top = `${rect.top}px`;
  panel.style.left = `${rect.left}px`;
  panel.style.width = `${rect.width}px`;
  panel.style.height = `${rect.height}px`;
}

function expandTile(card) {
  if (expandedId != null) return;
  const id = card.dataset.id;
  expandedId = id;

  const panel = document.createElement("section");
  panel.id = "tile-expanded";
  panel.className = "tile-expanded";
  setPanelRect(panel, card.getBoundingClientRect());

  const frame = document.createElement("iframe");
  frame.title = "Device details";
  frame.src = `pages/astronaut.html?id=${encodeURIComponent(id)}&embed=1`;
  panel.appendChild(frame);

  document.body.appendChild(panel);
  document.body.classList.add("tile-open");

  // Два кадри, щоб браузер зафіксував стартовий прямокутник
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const top = headerHeight();
      panel.style.top = `${top}px`;
      panel.style.left = "0px";
      panel.style.width = "100vw";
      panel.style.height = `calc(100vh - ${top}px)`;
      panel.classList.add("is-open");
    });
  });
}

function collapseTile() {
  const panel = document.getElementById("tile-expanded");
  if (!panel || expandedId == null) return;

  const card = crewGrid?.querySelector(
    `.astronaut-card[data-id="${CSS.escape(String(expandedId))}"]`
  );
  expandedId = null;
  document.body.classList.remove("tile-open");
  panel.classList.remove("is-open");

  const done = () => panel.remove();
  if (!card) {
    done();
    return;
  }
  setPanelRect(panel, card.getBoundingClientRect());
  panel.addEventListener("transitionend", done, { once: true });
  setTimeout(done, 500);
}

if (crewGrid) {
  crewGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".astronaut-card");
    if (card) expandTile(card);
  });
  crewGrid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".astronaut-card");
    if (!card) return;
    event.preventDefault();
    expandTile(card);
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") collapseTile();
});

// Розгорнута сторінка (iframe) просить закритись
window.addEventListener("message", (event) => {
  if (event.origin !== location.origin) return;
  if (event.data && event.data.type === "pulsar:close") collapseTile();
  if (event.data && event.data.type === "pulsar:sos-change") renderAstronauts();
});

document.addEventListener("pulsar:sos-change", renderAstronauts);

// Live connect — повний рендер не частіше ніж раз на 900 мс
let renderScheduled = false;
let lastFullRender = 0;
const RENDER_MIN_MS = 900;

function scheduleRender(force) {
  const now = Date.now();
  if (!force && now - lastFullRender < RENDER_MIN_MS) {
    if (renderScheduled) return;
    renderScheduled = true;
    setTimeout(() => {
      renderScheduled = false;
      lastFullRender = Date.now();
      renderAstronauts();
    }, RENDER_MIN_MS - (now - lastFullRender));
    return;
  }
  lastFullRender = now;
  renderAstronauts();
}

if (window.PulsarLive) {
  window.PulsarLive.connect({
    linkEl,
    onDashboard(crew) {
      astronauts = crew || [];
      scheduleRender(true);
    },
    onSample(person) {
      upsertPerson(person);
      scheduleRender(false);
    },
  });
} else {
  renderAstronauts();
}
