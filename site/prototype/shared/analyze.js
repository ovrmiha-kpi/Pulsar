/** Обчислення тенденцій і рекомендацій (використовує лише compute-server). */

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

function classify(hr, spo2, temp, trends) {
  let score = 0;
  // Person vitals = MAX only (hr/spo2). temp = room air (BMP280).
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
  // MAX vitals only when finger on sensor (0 = no reading)
  if (latest.hr >= 30) {
    if (latest.hr >= 120) {
      recs.push({ level: "critical", text: "Пульс критично високий. Зменшити навантаження, перевірити O₂." });
    } else if (latest.hr >= 100 || trends.hr > 1.0) {
      recs.push({ level: "warning", text: "Пульс підвищений. Короткий відпочинок і контроль дихання." });
    }
  }
  if (latest.spo2 >= 50) {
    if (latest.spo2 < 90) {
      recs.push({ level: "critical", text: "SpO₂ нижче безпечного рівня. Перевірити кисень і датчик." });
    } else if (latest.spo2 < 94 || trends.spo2 < -0.2) {
      recs.push({ level: "warning", text: "SpO₂ знижується. Перевірити контакт сенсора Pulsar." });
    }
  }
  if (Number.isFinite(latest.temp) && latest.temp >= 5) {
    if (latest.temp < 10 || latest.temp > 35) {
      recs.push({ level: "critical", text: "Екстремальна температура кімнати. Перевірити клімат-контроль." });
    } else if (latest.temp < 16) {
      recs.push({ level: "warning", text: "Низька температура кімнати. Підвищити обігрів." });
    } else if (latest.temp > 28) {
      recs.push({ level: "warning", text: "Висока температура кімнати. Покращити вентиляцію/охолодження." });
    }
  }
  if (trends.hr > 0.8 && trends.spo2 < -0.15) {
    recs.push({ level: "critical", text: "Пульс ↑ і SpO₂ ↓ одночасно. Пріоритетний огляд." });
  }
  if (!recs.length) {
    recs.push({ level: "normal", text: "Показники стабільні. Плановий моніторинг." });
  }
  if (status === "critical") {
    recs.unshift({ level: "critical", text: "Тривога: підтвердити стан, протокол допомоги." });
  }
  return recs;
}

function trendLabel(s, upIsBad) {
  if (Math.abs(s) < 0.2) return "стабільно";
  if (s > 0) return upIsBad ? "зростає ⚠" : "зростає";
  return upIsBad ? "падає" : "падає ⚠";
}

function analyzeSeries(points) {
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
      tones: { hr: "ok", spo2: "ok", temp: "ok" },
      trends: { hr: "—", spo2: "—", temp: "—", raw: { hr: 0, spo2: 0, temp: 0 } },
      history: [],
      alert: "Немає даних з пристрою.",
      recommendations: [{ level: "normal", text: "Очікування пакета з Pulsar (2.4 ГГц / ESP-NOW)." }],
      alarm: false,
      hasData: false,
    };
  }
  const latest = series[series.length - 1];
  const trends = { hr: slope(series, "hr"), spo2: slope(series, "spo2"), temp: slope(series, "temp") };
  const status = classify(latest.hr, latest.spo2, latest.temp, trends);
  const recommendations = buildRecommendations(latest, trends, status);
  const alert =
    status === "critical"
      ? recommendations.find((r) => r.level === "critical")?.text || "Критичний стан."
      : status === "warning"
        ? recommendations.find((r) => r.level === "warning")?.text || "Є попередження."
        : "Активних попереджень немає.";
  return {
    status,
    statusLabel:
      status === "critical" ? "критичний" : status === "warning" ? "попередження" : "норма",
    hr: Math.round(latest.hr),
    spo2: Math.round(latest.spo2),
    temp: Number(Number(latest.temp).toFixed(1)),
    tones: {
      hr:
        latest.hr < 30 ? "ok" : latest.hr >= 120 ? "bad" : latest.hr >= 100 ? "warn" : "ok",
      spo2:
        latest.spo2 < 50 ? "ok" : latest.spo2 < 90 ? "bad" : latest.spo2 < 94 ? "warn" : "ok",
      temp:
        !(Number.isFinite(latest.temp) && latest.temp >= 5)
          ? "ok"
          : latest.temp < 10 || latest.temp > 35
            ? "bad"
            : latest.temp < 16 || latest.temp > 28
              ? "warn"
              : "ok",
    },
    trends: {
      hr: trendLabel(trends.hr, true),
      spo2: trendLabel(trends.spo2, false),
      temp: trendLabel(trends.temp, false),
      raw: trends,
    },
    history: series.slice(-12),
    alert,
    recommendations,
    alarm: status === "critical",
    hasData: true,
  };
}

module.exports = { analyzeSeries };
