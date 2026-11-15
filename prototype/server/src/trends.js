/** Тенденції + гіпотези здоров'я в RAM — без I/O. */

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

function trendLabel(s) {
  if (Math.abs(s) < 0.2) return "стабільно";
  if (s > 0) return "зростає";
  return "падає";
}

/** Ризик 0–10 за один семпл (вище = гірше). */
export function sampleRisk(hr, spo2, temp) {
  let r = 0;
  const hasHr = hr >= 30;
  const hasSp = spo2 >= 50;
  const hasRoom = Number.isFinite(temp) && temp >= 5 && temp < 55;

  if (hasHr && hr >= 130) r += 4;
  else if (hasHr && hr >= 120) r += 3;
  else if (hasHr && hr >= 100) r += 2;
  else if (hasHr && hr < 45) r += 2;

  if (hasSp && spo2 < 88) r += 4;
  else if (hasSp && spo2 < 90) r += 3;
  else if (hasSp && spo2 < 94) r += 2;

  if (hasRoom && (temp < 10 || temp > 35)) r += 2;
  else if (hasRoom && (temp < 16 || temp > 28)) r += 1;

  return Math.min(10, r);
}

function classify(hr, spo2, temp, trends, trajectory) {
  let score = sampleRisk(hr, spo2, temp);
  if (trends.hr > 1.2) score += 1;
  if (trends.spo2 < -0.25) score += 2;
  if (trajectory?.worseningDays >= 2) score += 2;
  if (trajectory?.worseningDays >= 3) score += 2;

  if (score >= 5) return "critical";
  if (score >= 2) return "warning";
  return "normal";
}

/**
 * Денна траєкторія: чи з кожним днем гірше.
 * @param {Array<{ day: string, riskAvg: number, n: number }>} days
 */
export function buildTrajectory(days) {
  const list = (days || [])
    .filter((d) => d && d.n > 0)
    .slice(-14)
    .map((d) => ({
      day: d.day,
      riskAvg: Number(d.riskAvg) || 0,
      n: d.n,
      hrAvg: d.hrAvg,
      spo2Avg: d.spo2Avg,
      tempAvg: d.tempAvg,
    }));

  if (list.length < 2) {
    return {
      direction: "unknown",
      directionLabel: "недостатньо днів",
      worseningDays: 0,
      improvingDays: 0,
      days: list,
      delta: 0,
    };
  }

  let worseningDays = 0;
  let improvingDays = 0;
  for (let i = 1; i < list.length; i++) {
    const d = list[i].riskAvg - list[i - 1].riskAvg;
    if (d >= 0.35) worseningDays++;
    else if (d <= -0.35) improvingDays++;
  }

  const delta = list[list.length - 1].riskAvg - list[0].riskAvg;
  let direction = "stable";
  if (worseningDays >= 2 && worseningDays > improvingDays) direction = "worsening";
  else if (improvingDays >= 2 && improvingDays > worseningDays) direction = "improving";
  else if (delta >= 0.8) direction = "worsening";
  else if (delta <= -0.8) direction = "improving";

  return {
    direction,
    directionLabel:
      direction === "worsening"
        ? "погіршення день-за-днем"
        : direction === "improving"
          ? "покращення"
          : direction === "stable"
            ? "стабільно між днями"
            : "недостатньо днів",
    worseningDays,
    improvingDays,
    days: list,
    delta: Number(delta.toFixed(2)),
  };
}

function buildHypotheses(latest, trends, trajectory) {
  const h = [];
  if (latest.hr >= 120) {
    h.push({
      id: "tachycardia",
      confidence: latest.hr >= 130 ? "high" : "medium",
      text: "Можливе перенапруження / тахікардія — перевірити навантаження і гідратацію.",
    });
  } else if (latest.hr >= 100 && trends.hr > 0.5) {
    h.push({
      id: "hr_rising",
      confidence: "medium",
      text: "Пульс росте в короткому вікні — стрес або фізична активність.",
    });
  }
  if (latest.spo2 >= 50 && latest.spo2 < 94) {
    h.push({
      id: "hypoxia_risk",
      confidence: latest.spo2 < 90 ? "high" : "medium",
      text: "Знижена сатурація — перевірити щільність пальця на сенсорі й якість повітря.",
    });
  }
  if (trends.spo2 < -0.25) {
    h.push({
      id: "spo2_trend_down",
      confidence: "medium",
      text: "SpO₂ має спадний тренд — варто повторити вимірювання в спокої.",
    });
  }
  if (Number.isFinite(latest.temp) && (latest.temp < 16 || latest.temp > 28)) {
    h.push({
      id: "cabin_thermal",
      confidence: "medium",
      text: "Температура кабіни поза комфортом може погіршувати самопочуття.",
    });
  }
  if (trajectory?.direction === "worsening") {
    h.push({
      id: "multi_day_decline",
      confidence: trajectory.worseningDays >= 3 ? "high" : "medium",
      text: `Стан погіршується ${trajectory.worseningDays} дн. поспіль — потрібен глибший огляд.`,
    });
  }
  if (!h.length) {
    h.push({
      id: "stable",
      confidence: "low",
      text: "Короткострокові показники без явних тривожних патернів.",
    });
  }
  return h;
}

function buildRecommendations(latest, trends, status, trajectory, hypotheses) {
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

  const needDeep =
    trajectory?.direction === "worsening" && trajectory.worseningDays >= 2;

  if (needDeep) {
    recs.unshift({
      level: "critical",
      code: "DEEP_CHECK",
      toDevice: true,
      text: "Рекомендація: проведіть глибокий аналіз стану здоров'я (пульс у спокої, SpO₂, самопочуття).",
    });
  } else if (status === "critical") {
    recs.unshift({
      level: "critical",
      code: "CONFIRM",
      toDevice: true,
      text: "Тривога — підтвердити стан і повторити вимірювання.",
    });
  }

  if (!recs.length) {
    recs.push({ level: "normal", text: "Показники стабільні." });
  }

  // коротка «догадка» з гіпотези з найвищою впевненістю
  const top = hypotheses.find((x) => x.confidence === "high") || hypotheses[0];
  if (top && top.id !== "stable") {
    recs.push({ level: "info", code: "GUESS", text: `Догадка: ${top.text}` });
  }

  return recs;
}

/**
 * @param {Array} points
 * @param {{ days?: Array }} [ctx]
 */
export function analyzeSeries(points, ctx = {}) {
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
      risk: null,
      trends: { hr: "—", spo2: "—", temp: "—", raw: { hr: 0, spo2: 0, temp: 0 } },
      trajectory: buildTrajectory(ctx.days || []),
      hypotheses: [],
      history: [],
      alert: "Немає даних.",
      recommendations: [{ level: "normal", text: "Очікування UDP/HTTP ingest." }],
      deviceCommand: null,
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
  const trajectory = buildTrajectory(ctx.days || []);
  const status = classify(latest.hr, latest.spo2, latest.temp, raw, trajectory);
  const hypotheses = buildHypotheses(latest, raw, trajectory);
  const recommendations = buildRecommendations(
    latest,
    raw,
    status,
    trajectory,
    hypotheses
  );
  const risk = sampleRisk(latest.hr, latest.spo2, latest.temp);

  const deep = recommendations.find((r) => r.code === "DEEP_CHECK");
  const confirm = recommendations.find((r) => r.code === "CONFIRM");
  const deviceRec = deep || confirm || null;
  const deviceCommand = deviceRec
    ? {
        code: deviceRec.code,
        text: deviceRec.text,
        // рядок для ESP (міст пише в Serial)
        line: `REC|${deviceRec.code}|${String(deviceRec.text).slice(0, 60)}`,
      }
    : null;

  const alert = deep
    ? deep.text
    : status === "critical"
      ? recommendations.find((r) => r.level === "critical")?.text || "Критичний."
      : status === "warning"
        ? recommendations.find((r) => r.level === "warning")?.text || "Попередження."
        : trajectory.direction === "worsening"
          ? trajectory.directionLabel
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
    risk,
    trends: {
      hr: trendLabel(raw.hr),
      spo2: trendLabel(raw.spo2),
      temp: trendLabel(raw.temp),
      raw,
    },
    trajectory,
    hypotheses,
    history: series.slice(-40),
    alert,
    recommendations,
    deviceCommand,
    alarm: status === "critical" || !!deep,
    hasData: true,
  };
}
