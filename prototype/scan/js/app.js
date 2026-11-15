/**
 * Pulsar Scan — station floor map + simulated RF skeletons.
 * Not connected to prototype/server.
 */

const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
const trackList = document.getElementById("track-list");
const statsEl = document.getElementById("stats");
const modeChip = document.getElementById("mode-chip");

/** Plan coordinates: metres → canvas via fit */
const MODULES = [
  { id: "hab", label: "HAB", x: 2, y: 2, w: 10, h: 7 },
  { id: "lab", label: "LAB", x: 13, y: 2, w: 8, h: 7 },
  { id: "galley", label: "GALLEY", x: 2, y: 10, w: 6, h: 5 },
  { id: "airlock", label: "AIRLOCK", x: 9, y: 10.5, w: 5, h: 4 },
  { id: "storage", label: "STORAGE", x: 15, y: 10, w: 6, h: 5 },
];

/** Simulated RF / CSI observation points */
const NODES = [
  { id: "AP-A", x: 3.2, y: 3.2 },
  { id: "AP-B", x: 19.5, y: 3.5 },
  { id: "AP-C", x: 11.5, y: 13.5 },
  { id: "AP-D", x: 4.5, y: 13.2 },
];

const COLORS = ["#3ddc84", "#3a9bff", "#ffbe2e", "#f64137", "#c084fc"];

/** 2D stick skeleton in local metres (hip-centered) */
const BONES = [
  ["head", "neck"],
  ["neck", "l_shoulder"],
  ["neck", "r_shoulder"],
  ["l_shoulder", "l_elbow"],
  ["l_elbow", "l_wrist"],
  ["r_shoulder", "r_elbow"],
  ["r_elbow", "r_wrist"],
  ["neck", "hip"],
  ["hip", "l_hip"],
  ["hip", "r_hip"],
  ["l_hip", "l_knee"],
  ["l_knee", "l_ankle"],
  ["r_hip", "r_knee"],
  ["r_knee", "r_ankle"],
];

function skeletonPose(phase, stride) {
  const swing = Math.sin(phase) * stride;
  const swing2 = Math.sin(phase + Math.PI) * stride;
  return {
    head: [0, -1.55],
    neck: [0, -1.25],
    l_shoulder: [-0.22, -1.18],
    r_shoulder: [0.22, -1.18],
    l_elbow: [-0.35 + swing * 0.15, -0.75],
    r_elbow: [0.35 + swing2 * 0.15, -0.75],
    l_wrist: [-0.28 + swing * 0.25, -0.35],
    r_wrist: [0.28 + swing2 * 0.25, -0.35],
    hip: [0, -0.55],
    l_hip: [-0.12, -0.55],
    r_hip: [0.12, -0.55],
    l_knee: [-0.1 + swing2 * 0.2, -0.15],
    r_knee: [0.1 + swing * 0.2, -0.15],
    l_ankle: [-0.08 + swing2 * 0.35, 0.35],
    r_ankle: [0.08 + swing * 0.35, 0.35],
  };
}

function clampToModules(x, y) {
  // soft clamp into outer deck bounds
  return {
    x: Math.min(20.5, Math.max(2.3, x)),
    y: Math.min(14.5, Math.max(2.3, y)),
  };
}

function moduleAt(x, y) {
  return (
    MODULES.find(
      (m) => x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h
    ) || null
  );
}

let people = [];
let paused = false;
let showNoise = true;
let nextId = 1;
let t0 = performance.now();

function addPerson(seed) {
  const id = nextId++;
  const color = COLORS[(id - 1) % COLORS.length];
  const start = seed || {
    x: 4 + Math.random() * 12,
    y: 4 + Math.random() * 8,
  };
  people.push({
    id,
    label: `Track ${String(id).padStart(2, "0")}`,
    color,
    x: start.x,
    y: start.y,
    vx: (Math.random() - 0.5) * 0.9,
    vy: (Math.random() - 0.5) * 0.9,
    phase: Math.random() * Math.PI * 2,
    confidence: 0.75 + Math.random() * 0.2,
  });
}

addPerson({ x: 6.5, y: 5.2 });
addPerson({ x: 16.2, y: 5.8 });
addPerson({ x: 11.2, y: 12.2 });

function worldBounds() {
  return { minX: 0.5, minY: 0.5, maxX: 22, maxY: 16 };
}

function project(wx, wy) {
  const b = worldBounds();
  const pad = 28;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const sx = (w - pad * 2) / (b.maxX - b.minX);
  const sy = (h - pad * 2) / (b.maxY - b.minY);
  const s = Math.min(sx, sy);
  const ox = pad + (w - pad * 2 - s * (b.maxX - b.minX)) / 2;
  const oy = pad + (h - pad * 2 - s * (b.maxY - b.minY)) / 2;
  return {
    x: ox + (wx - b.minX) * s,
    y: oy + (wy - b.minY) * s,
    s,
  };
}

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(640, Math.floor(rect.width * dpr));
  canvas.height = Math.max(420, Math.floor(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function update(dt) {
  if (paused) return;
  for (const p of people) {
    // wander + soft bounce
    p.vx += (Math.random() - 0.5) * 0.4 * dt;
    p.vy += (Math.random() - 0.5) * 0.4 * dt;
    const sp = Math.hypot(p.vx, p.vy) || 1;
    const max = 1.1;
    if (sp > max) {
      p.vx = (p.vx / sp) * max;
      p.vy = (p.vy / sp) * max;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const c = clampToModules(p.x, p.y);
    if (c.x !== p.x) p.vx *= -0.8;
    if (c.y !== p.y) p.vy *= -0.8;
    p.x = c.x;
    p.y = c.y;
    const moving = Math.hypot(p.vx, p.vy);
    p.phase += dt * (2.2 + moving * 2.5);
    // CSI confidence wobble
    p.confidence = Math.min(
      0.98,
      Math.max(0.45, p.confidence + (Math.random() - 0.5) * 0.04)
    );
  }
}

function drawGrid() {
  // subtle already in CSS; optional extra ticks
}

function drawModules() {
  for (const m of MODULES) {
    const a = project(m.x, m.y);
    const b = project(m.x + m.w, m.y + m.h);
    const x = a.x;
    const y = a.y;
    const w = b.x - a.x;
    const h = b.y - a.y;
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "rgba(154,160,168,0.85)";
    ctx.font = '11px "DM Mono", monospace';
    ctx.fillText(m.label, x + 10, y + 18);
  }
  // corridors / links between modules
  ctx.strokeStyle = "rgba(58,155,255,0.15)";
  ctx.setLineDash([6, 6]);
  const links = [
    [12, 5.5, 13, 5.5],
    [7.5, 9, 7.5, 10],
    [14, 9, 14, 10],
    [11.5, 9, 11.5, 10.5],
  ];
  for (const [x1, y1, x2, y2] of links) {
    const p1 = project(x1, y1);
    const p2 = project(x2, y2);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawNodes() {
  for (const n of NODES) {
    const p = project(n.x, n.y);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#3a9bff";
    ctx.fill();
    ctx.strokeStyle = "rgba(58,155,255,0.35)";
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.fillStyle = "rgba(154,160,168,0.9)";
    ctx.font = '10px "DM Mono", monospace';
    ctx.fillText(n.id, p.x + 10, p.y + 3);

    if (showNoise) {
      // fake multipath rings
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 700 + n.x);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18 + pulse * 22, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(58,155,255,${0.12 + pulse * 0.1})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawLinksToPerson(person) {
  if (!showNoise) return;
  const pp = project(person.x, person.y);
  for (const n of NODES) {
    const np = project(n.x, n.y);
    const dist = Math.hypot(n.x - person.x, n.y - person.y);
    const alpha = Math.max(0.04, 0.22 - dist * 0.012);
    ctx.beginPath();
    ctx.moveTo(np.x, np.y);
    ctx.lineTo(pp.x, pp.y);
    ctx.strokeStyle = `rgba(58,155,255,${alpha})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawSkeleton(person) {
  const base = project(person.x, person.y);
  const s = project(person.x + 1, person.y).x - base.x;
  const moving = Math.hypot(person.vx, person.vy);
  const pose = skeletonPose(person.phase, Math.min(0.55, 0.15 + moving * 0.25));
  const jitter = showNoise ? (1 - person.confidence) * 4 : 0;

  ctx.strokeStyle = person.color;
  ctx.fillStyle = person.color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  const pt = (name) => {
    const [lx, ly] = pose[name];
    return {
      x: base.x + lx * s + (Math.random() - 0.5) * jitter,
      y: base.y + ly * s + (Math.random() - 0.5) * jitter,
    };
  };

  for (const [a, b] of BONES) {
    const pa = pt(a);
    const pb = pt(b);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  // joints
  for (const name of Object.keys(pose)) {
    const p = pt(name);
    ctx.beginPath();
    ctx.arc(p.x, p.y, name === "head" ? 4.5 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // floor blob (localization)
  ctx.beginPath();
  ctx.ellipse(base.x, base.y + 8, 16, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = person.color + "33";
  ctx.fill();

  ctx.fillStyle = "#f2f3f5";
  ctx.font = '11px "DM Mono", monospace';
  ctx.fillText(person.label, base.x + 14, base.y - 10);
  ctx.fillStyle = "rgba(154,160,168,0.9)";
  ctx.font = '10px "DM Mono", monospace';
  ctx.fillText(`${Math.round(person.confidence * 100)}%`, base.x + 14, base.y + 4);
}

function renderUi() {
  trackList.innerHTML = people
    .map((p) => {
      const mod = moduleAt(p.x, p.y);
      return `<div class="track">
        <span class="dot" style="background:${p.color}"></span>
        <div>
          <div class="name">${p.label}</div>
          <div class="pos">${mod ? mod.label : "CORRIDOR"} · ${p.x.toFixed(1)},${p.y.toFixed(1)} m</div>
        </div>
        <div class="pos">${Math.round(p.confidence * 100)}%</div>
      </div>`;
    })
    .join("");
  statsEl.textContent = `${people.length} track${people.length === 1 ? "" : "s"} · ${NODES.length} RF nodes`;
}

function frame(now) {
  const dt = Math.min(0.05, (now - t0) / 1000);
  t0 = now;
  update(dt);

  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  ctx.clearRect(0, 0, cssW, cssH);

  drawModules();
  drawNodes();
  for (const p of people) {
    drawLinksToPerson(p);
    drawSkeleton(p);
  }
  renderUi();
  requestAnimationFrame(frame);
}

document.getElementById("btn-add").onclick = () => addPerson();
document.getElementById("btn-pause").onclick = (e) => {
  paused = !paused;
  e.target.textContent = paused ? "Resume" : "Pause";
  modeChip.textContent = paused ? "Paused" : "Sim CSI";
};
document.getElementById("btn-noise").onclick = () => {
  showNoise = !showNoise;
};

function tickClock() {
  document.getElementById("clock").textContent =
    new Date().toISOString().slice(11, 19) + " UTC";
}
tickClock();
setInterval(tickClock, 1000);

window.addEventListener("resize", resize);
resize();
requestAnimationFrame(frame);
