/** Тенденції в RAM — без I/O. */

function slope(series, key) {
  if (!series || series.length < 4) return 0;
  const n = Math.min(12, series.length);
  const slice = series.slice(-n);
  const xs = slice.map((_, i) => i);
  const ys = slice.map((p) => Number(p[key]));
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function trendLabel(s, upIsBad) {
  if (Math.abs(s) < 0.2) return "стабільно";
  if (s > 0) return upIsBad ? "зростає ⚠" : "зростає";
  return upIsBad ? "падає" : "падає ⚠";
}

function classify(hr, spo2, temp, trends) {
  let score = 0;
  const hasHr = hr >= 30;
  const hasSp = spo2 >= 50;
  const hasRoom = Number.isFinite(temp) && temp >= 5 && temp < 55;

  if (hasHr && hr >= 120) score += 3;
  else if (hasHr && hr >= 100) score += 2;
  if (hasSp && spo2 < 90) score += 3;
  else if (hasSp && spo2 < 94) score += 2;
  if (hasHr && trends.hr > 1.2) score += 1;
  if (hasSp && trends.spo2 < -0.25) score += 2;
  if (hasRoom && (temp < 10 || temp > 35)) score += 2;
  else if (hasRoom && (temp < 16 || temp > 28)) score += 1;

  if (score >= 3) return "critical";
  if (score >= 1) return "warning";
  return "normal";
}

function buildRecommendations(latest, trends, status) {
  const recs = [];
  if (latest.hr >= 30) {
    if (latest.hr >= 120) {
      recs.push({ level: "critical", text: "Пульс критично високий." });
    } else if (latest.hr >= 100 || trends.hr > 1.0) {
      recs.push({ level: "warning", text: "Пульс підвищений." });
    }
  }
  if (latest.spo2 >= 50) {
    if (latest.spo2 < 90) {
      recs.push({ level: "critical", text: "SpO₂ небезпечно низький." });
    } else if (latest.spo2 < 94 || trends.spo2 < -0.2) {
      recs.push({ level: "warning", text: "SpO₂ знижується." });
    }
  }
  if (Number.isFinite(latest.temp) && latest.temp >= 5) {
    if (latest.temp < 10 || latest.temp > 35) {
      recs.push({ level: "critical", text: "Екстремальна температура кімнати." });
    } else if (latest.temp < 16 || latest.temp > 28) {
      recs.push({ level: "warning", text: "Температура кімнати поза комфортом." });
    }
  }
  if (!recs.length) {
    recs.push({ level: "normal", text: "Показники стабільні." });
  }
  if (status === "critical") {
    recs.unshift({ level: "critical", text: "Тривога — підтвердити стан." });
  }
  return recs;
}

export function analyzeSeries(points) {
  const series = (points || []).map((p) => ({
    t: p.t || p.recorded_at,
    hr: Number(p.hr),
    spo2: Number(p.spo2),
    temp: Number(p.temp ?? p.temp_c),
  }));

  if (!series.length) {
    return {
      status: "pending",
      statusLabel: "очікування",
      hr: null,
      spo2: null,
      temp: null,
      trends: { hr: "—", spo2: "—", temp: "—", raw: { hr: 0, spo2: 0, temp: 0 } },
      history: [],
      alert: "Немає даних.",
      recommendations: [{ level: "normal", text: "Очікування UDP/HTTP ingest." }],
      alarm: false,
      hasData: false,
    };
  }

  const latest = series[series.length - 1];
  const raw = {
    hr: slope(series, "hr"),
    spo2: slope(series, "spo2"),
    temp: slope(series, "temp"),
  };
  const status = classify(latest.hr, latest.spo2, latest.temp, raw);
  const recommendations = buildRecommendations(latest, raw, status);
  const alert =
    status === "critical"
      ? recommendations.find((r) => r.level === "critical")?.text || "Критичний."
      : status === "warning"
        ? recommendations.find((r) => r.level === "warning")?.text || "Попередження."
        : "OK";

  return {
    status,
    statusLabel:
      status === "critical"
        ? "критичний"
        : status === "warning"
          ? "попередження"
          : "норма",
    hr: Math.round(latest.hr),
    spo2: Math.round(latest.spo2),
    temp: Number(Number(latest.temp).toFixed(1)),
    trends: {
      hr: trendLabel(raw.hr, true),
      spo2: trendLabel(raw.spo2, false),
      temp: trendLabel(raw.temp, false),
      raw,
    },
    history: series.slice(-40),
    alert,
    recommendations,
    alarm: status === "critical",
    hasData: true,
  };
}
