export const SCENARIOS = {
  quotidien: {
    "cpu.integer": 0.25,
    "cpu.float": 0.10,
    "application.json": 0.25,
    "application.sqlite": 0.25,
    "storage.random-read": 0.15,
  },
  developpement: {
    "cpu.integer": 0.15,
    "cpu.multicore": 0.25,
    "cpu.compression": 0.10,
    "memory.copy": 0.10,
    "storage.random-read": 0.15,
    "storage.random-write": 0.10,
    "application.sqlite": 0.15,
  },
  "calcul-intensif": {
    "cpu.float": 0.15,
    "cpu.multicore": 0.20,
    "memory.copy": 0.15,
    "cpu.hash": 0.10,
    "gpu.compute-fp32": 0.40,
  },
  fichiers: {
    "cpu.hash": 0.15,
    "cpu.compression": 0.25,
    "storage.read": 0.20,
    "storage.write": 0.20,
    "storage.random-read": 0.10,
    "storage.random-write": 0.10,
  },
  "base-de-donnees": {
    "application.sqlite": 0.40,
    "memory.copy": 0.15,
    "storage.random-read": 0.25,
    "storage.random-write": 0.20,
  },
  creation: {
    "cpu.float": 0.10,
    "cpu.multicore": 0.15,
    "memory.copy": 0.10,
    "storage.read": 0.10,
    "storage.write": 0.10,
    "gpu.image-filter": 0.25,
    "gpu.raster": 0.20,
  },
  "jeu-3d": {
    "gpu.raster": 0.55,
    "gpu.memory": 0.20,
    "gpu.compute-fp32": 0.15,
    "memory.copy": 0.10,
  },
};

export const SCENARIO_LABELS = {
  quotidien: "Réactivité quotidienne",
  developpement: "Développement",
  "calcul-intensif": "Calcul intensif",
  fichiers: "Gestion de fichiers",
  "base-de-donnees": "Base de données locale",
  creation: "Création 3D/vidéo",
  "jeu-3d": "Jeu et rendu 3D généraliste",
};

const CATEGORY_LABELS = {
  application: "Applications",
  cpu: "Processeur",
  memory: "Mémoire",
  storage: "Stockage",
  gpu: "Processeur graphique",
};

const REFERENCE_DURATIONS = [10, 120, 1_800, 14_400];
const MACHINE_PARAMETERS = {
  "cpu.multicore": new Set(["workers"]),
  "gpu.compute-fp32": new Set([
    "gpu_index", "gpu_device", "gpu_backend", "gpu_adapter_type", "wgpu_version",
  ]),
  "gpu.memory": new Set([
    "gpu_index", "gpu_device", "gpu_backend", "gpu_adapter_type", "wgpu_version",
  ]),
  "gpu.image-filter": new Set([
    "gpu_index", "gpu_device", "gpu_backend", "gpu_adapter_type", "wgpu_version",
  ]),
  "gpu.raster": new Set([
    "gpu_index", "gpu_device", "gpu_backend", "gpu_adapter_type", "wgpu_version",
  ]),
};

function reportLabel(report) {
  return report.system.commercial_name || report.system.processor;
}

function validateReports(reports) {
  if (reports.length < 2) throw new Error("Sélectionnez au moins deux rapports.");
  const reference = reports[0];
  for (const report of reports) {
    if (report.format !== "perfcomparator-public-report") {
      throw new Error("La sélection contient un fichier qui n’est pas un rapport public.");
    }
    if (!Array.isArray(report.results) || report.results.length === 0) {
      throw new Error("Un rapport sélectionné ne contient aucun résultat.");
    }
  }
  for (const report of reports.slice(1)) {
    if (report.protocol_version !== reference.protocol_version) {
      throw new Error("Les rapports doivent utiliser des versions compatibles du protocole.");
    }
    if (report.profile !== reference.profile) {
      throw new Error("Les rapports doivent utiliser le même profil.");
    }
    if (report.system.python_version !== reference.system.python_version) {
      throw new Error("Les rapports doivent utiliser la même version de Python.");
    }
    if (report.system.python_implementation !== reference.system.python_implementation) {
      throw new Error("Les rapports doivent utiliser la même implémentation de Python.");
    }
  }
}

function normalizedParameters(result) {
  const ignored = MACHINE_PARAMETERS[result.benchmark_id] ?? new Set();
  return Object.fromEntries(
    Object.entries(result.parameters ?? {})
      .filter(([name]) => !ignored.has(name))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function performanceRatio(result, baseline) {
  if (result.higher_is_better !== baseline.higher_is_better) {
    throw new Error(`Sens de métrique incohérent pour ${result.benchmark_id}.`);
  }
  if (result.unit !== baseline.unit) {
    throw new Error(`Unité incohérente pour ${result.benchmark_id}.`);
  }
  if (JSON.stringify(normalizedParameters(result)) !== JSON.stringify(normalizedParameters(baseline))) {
    throw new Error(`Paramètres incohérents pour ${result.benchmark_id}.`);
  }
  return result.higher_is_better
    ? result.value / baseline.value
    : baseline.value / result.value;
}

function geometricMean(values) {
  const totalWeight = values.reduce((total, [, weight]) => total + weight, 0);
  if (!values.length || totalWeight <= 0) return 1;
  return Math.exp(
    values.reduce((total, [value, weight]) => total + weight * Math.log(value), 0)
      / totalWeight,
  );
}

function uncertainty(result, baseline) {
  if (result.repetitions < 2 || baseline.repetitions < 2) {
    return [false, "incertitude non estimée (un seul passage)"];
  }
  const resultLow = result.minimum ?? result.value;
  const resultHigh = result.maximum ?? result.value;
  const baselineLow = baseline.minimum ?? baseline.value;
  const baselineHigh = baseline.maximum ?? baseline.value;
  const overlaps = Math.max(resultLow, baselineLow) <= Math.min(resultHigh, baselineHigh);
  return overlaps
    ? [true, "plages min–max chevauchantes"]
    : [false, "plages min–max séparées"];
}

export function differenceLabel(difference, inconclusive = false) {
  if (inconclusive) return "différence non concluante";
  const magnitude = Math.abs(difference);
  if (magnitude < 5) return "sensiblement équivalent";
  let strength = "changement de catégorie";
  if (magnitude < 15) strength = "différence légère";
  else if (magnitude < 30) strength = "différence nette";
  else if (magnitude < 60) strength = "différence importante";
  const direction = difference > 0 ? "en faveur de cette machine" : "en sa défaveur";
  return `${strength} ${direction}`;
}

function formatSigned(value, digits = 0) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3_600);
  const remainder = rounded % 3_600;
  const minutes = Math.floor(remainder / 60);
  const secs = remainder % 60;
  if (hours) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  return `${minutes} min ${String(secs).padStart(2, "0")} s`;
}

function narrative(label, scenarios) {
  const entries = Object.entries(scenarios);
  if (!entries.length) return `${label} ne partage aucun scénario complet avec la référence.`;
  const [bestName, bestIndex] = entries.reduce((best, item) => item[1] > best[1] ? item : best);
  const [worstName, worstIndex] = entries.reduce((worst, item) => item[1] < worst[1] ? item : worst);
  const bestDuration = 3_600 / (bestIndex / 100);
  const delta = 3_600 - bestDuration;
  const timePhrase = delta >= 0
    ? `${formatDuration(Math.abs(delta))} gagnées`
    : `${formatDuration(Math.abs(delta))} supplémentaires`;
  let sentence = `${label} obtient son meilleur résultat relatif en ${SCENARIO_LABELS[bestName].toLocaleLowerCase("fr")} (${formatSigned(bestIndex - 100)} %), soit ${formatDuration(bestDuration)} pour une charge équivalente à une heure sur la référence (${timePhrase}).`;
  if (worstIndex < 100) {
    sentence += ` Son point le moins favorable est ${SCENARIO_LABELS[worstName].toLocaleLowerCase("fr")} (${formatSigned(worstIndex - 100)} %).`;
  }
  return sentence;
}

export function analyzePublicReports(reports) {
  validateReports(reports);
  const maps = reports.map((report) => new Map(
    report.results.map((result) => [result.benchmark_id, result]),
  ));
  const common = [...maps[0].keys()]
    .filter((benchmarkId) => maps.slice(1).every((items) => items.has(benchmarkId)))
    .sort();
  if (!common.length) throw new Error("Les rapports ne partagent aucun benchmark.");

  const equalWeight = 1 / Object.keys(SCENARIOS).length;
  const activeWeights = Object.fromEntries(
    Object.entries(SCENARIOS)
      .filter(([, weights]) => Object.keys(weights).some((benchmarkId) => common.includes(benchmarkId)))
      .map(([scenario]) => [scenario, equalWeight]),
  );
  const activeTotal = Object.values(activeWeights).reduce((total, weight) => total + weight, 0);
  if (activeTotal <= 0) throw new Error("Les rapports ne couvrent aucun scénario comparable.");
  for (const scenario of Object.keys(activeWeights)) activeWeights[scenario] /= activeTotal;

  const warnings = [];
  const suiteVersions = [...new Set(reports.map((report) => report.suite_version))].sort();
  if (suiteVersions.length > 1) {
    warnings.push(`Versions compatibles du protocole ${reports[0].protocol_version} comparées : ${suiteVersions.join(", ")}.`);
  }
  if (reports.some((report) => report.repetitions < 3)) {
    warnings.push("Moins de trois passages : la dispersion est peu représentative.");
  }
  const union = new Set(maps.flatMap((items) => [...items.keys()]));
  if (common.length !== union.size) {
    warnings.push(`La comparaison utilise seulement ${common.length} benchmark(s) commun(s) sur ${union.size} présent(s) dans les rapports.`);
  }
  if (common.includes("cpu.multicore")) {
    const workers = maps.map((items) => items.get("cpu.multicore").parameters?.workers);
    if (new Set(workers).size > 1) {
      const detail = reports.map((report, index) => `${reportLabel(report)} : ${workers[index]} processus`).join(", ");
      warnings.push(`cpu.multicore mesure le débit total avec le parallélisme propre à chaque machine (${detail}).`);
    }
  }
  for (const report of reports) {
    const unstable = report.results.filter(
      (result) => result.relative_spread_percent != null && result.relative_spread_percent > 15,
    );
    if (unstable.length) {
      warnings.push(`${reportLabel(report)} : ${unstable.length} benchmark(s) dépassent 15 % de dispersion ; répéter la campagne dans des conditions plus stables.`);
    }
  }
  const ignoredScenarios = Object.keys(SCENARIOS)
    .filter((scenario) => !(scenario in activeWeights))
    .sort();
  if (ignoredScenarios.length) {
    warnings.push(`Scénarios ignorés faute de benchmarks communs : ${ignoredScenarios.map((scenario) => SCENARIO_LABELS[scenario]).join(", ")}.`);
  }
  for (const [scenario, weights] of Object.entries(SCENARIOS)) {
    if (!(scenario in activeWeights)) continue;
    const missing = Object.keys(weights).filter((benchmarkId) => !common.includes(benchmarkId)).sort();
    if (missing.length) {
      warnings.push(`${SCENARIO_LABELS[scenario]} est calculé partiellement ; absents : ${missing.join(", ")}.`);
    }
  }

  const baselineMap = maps[0];
  const machines = reports.map((report, reportIndex) => {
    const resultMap = maps[reportIndex];
    const ratios = {};
    const metrics = {};
    for (const benchmarkId of common) {
      const result = resultMap.get(benchmarkId);
      const baseline = baselineMap.get(benchmarkId);
      const ratio = performanceRatio(result, baseline);
      const [inconclusive, uncertaintyLabel] = uncertainty(result, baseline);
      const difference = (ratio - 1) * 100;
      ratios[benchmarkId] = ratio;
      metrics[benchmarkId] = {
        ...result,
        index: ratio * 100,
        difference_percent: difference,
        conclusion: differenceLabel(difference, inconclusive),
        uncertainty: uncertaintyLabel,
        spread_percent: result.relative_spread_percent,
      };
    }
    const groups = [...new Set(common.map((benchmarkId) => resultMap.get(benchmarkId).group))].sort();
    const categories = Object.fromEntries(groups.map((group) => [group, geometricMean(
      Object.entries(ratios)
        .filter(([benchmarkId]) => resultMap.get(benchmarkId).group === group)
        .map(([, ratio]) => [ratio, 1]),
    ) * 100]));
    const scenarios = Object.fromEntries(Object.entries(SCENARIOS)
      .filter(([scenario]) => scenario in activeWeights)
      .map(([scenario, weights]) => [scenario, geometricMean(
        Object.entries(weights)
          .filter(([benchmarkId]) => benchmarkId in ratios)
          .map(([benchmarkId, weight]) => [ratios[benchmarkId], weight]),
      ) * 100]));
    const overallIndex = geometricMean(Object.entries(activeWeights).map(
      ([scenario, weight]) => [scenarios[scenario] / 100, weight],
    )) * 100;
    const label = reportLabel(report);
    return {
      label,
      report,
      metrics,
      categories,
      scenarios,
      overall_index: overallIndex,
      narrative: narrative(label, scenarios),
    };
  });

  return {
    baseline_label: reportLabel(reports[0]),
    machines,
    common_benchmarks: common,
    scenario_weights: activeWeights,
    warnings,
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function barWidth(index, maximum) {
  return Math.max(2, Math.min(100, index / maximum * 100));
}

function heatColor(index) {
  const difference = Math.max(-50, Math.min(50, index - 100));
  if (Math.abs(difference) < 2) return "#edf0f6";
  const hue = difference > 0 ? 132 : 4;
  const lightness = 92 - Math.abs(difference) * 0.35;
  return `hsl(${hue} 55% ${lightness.toFixed(0)}%)`;
}

function barSections(analysis, source, labels, secondary = false) {
  const keys = Object.keys(analysis.machines[0][source]);
  const maximum = Math.max(...analysis.machines.flatMap(
    (machine) => keys.map((key) => machine[source][key]),
  ));
  return keys.map((key) => `<section class="scenario"><h3>${escapeHtml(labels[key] ?? key)}</h3>${analysis.machines.map((machine) => {
    const index = machine[source][key];
    return `<div class="bar-row"><span>${escapeHtml(machine.label)}</span><div class="bar-track"><div class="bar${secondary ? " secondary" : ""}" style="width:${barWidth(index, maximum).toFixed(1)}%"></div></div><strong>${index.toFixed(0)}</strong></div>`;
  }).join("")}</section>`).join("");
}

function heatmap(analysis) {
  const headers = analysis.machines.map((machine) => `<th>${escapeHtml(machine.label)}</th>`).join("");
  const rows = Object.keys(analysis.scenario_weights).map((scenario) => {
    const cells = analysis.machines.map((machine) => {
      const index = machine.scenarios[scenario];
      return `<td style="background:${heatColor(index)}">${index.toFixed(0)}</td>`;
    }).join("");
    return `<tr><th>${escapeHtml(SCENARIO_LABELS[scenario])}</th>${cells}</tr>`;
  }).join("");
  return `<table><thead><tr><th>Scénario</th>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}

function timelines(analysis) {
  return Object.keys(analysis.scenario_weights).map((scenario) => {
    const headers = analysis.machines.map((machine) => `<th>${escapeHtml(machine.label)}</th>`).join("");
    const rows = REFERENCE_DURATIONS.map((duration) => {
      const cells = analysis.machines.map((machine) => {
        const equivalent = duration / (machine.scenarios[scenario] / 100);
        const delta = duration - equivalent;
        const deltaLabel = Math.abs(delta) < 0.5
          ? "référence"
          : delta > 0
            ? `${formatDuration(delta)} gagnées`
            : `${formatDuration(Math.abs(delta))} supplémentaires`;
        return `<td><strong>${escapeHtml(formatDuration(equivalent))}</strong><small class="time-delta">${escapeHtml(deltaLabel)}</small></td>`;
      }).join("");
      return `<tr><th>${escapeHtml(formatDuration(duration))}</th>${cells}</tr>`;
    }).join("");
    return `<section class="timeline"><h3>${escapeHtml(SCENARIO_LABELS[scenario])}</h3><table><thead><tr><th>Temps sur la référence</th>${headers}</tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join("");
}

function benchmarkDetails(analysis) {
  const maximum = Math.max(...analysis.common_benchmarks.flatMap(
    (benchmarkId) => analysis.machines.map((machine) => machine.metrics[benchmarkId].index),
  ));
  return analysis.common_benchmarks.map((benchmarkId) => {
    const rows = analysis.machines.map((machine) => {
      const metric = machine.metrics[benchmarkId];
      const spread = metric.spread_percent == null
        ? "dispersion indisponible"
        : `dispersion ${metric.spread_percent.toFixed(1)} %`;
      return `<div class="metric-row"><span>${escapeHtml(machine.label)}</span><div class="bar-track"><div class="bar secondary" style="width:${barWidth(metric.index, maximum).toFixed(1)}%"></div></div><strong>${metric.index.toFixed(0)}</strong><small>${metric.value.toFixed(2)} ${escapeHtml(metric.unit)} · ${escapeHtml(spread)}</small></div>`;
    }).join("");
    const notes = analysis.machines.slice(1).map((machine) => {
      const metric = machine.metrics[benchmarkId];
      return `<li><strong>${escapeHtml(machine.label)}</strong> : ${formatSigned(metric.difference_percent, 1)} % — ${escapeHtml(metric.conclusion)} ; ${escapeHtml(metric.uncertainty)}</li>`;
    }).join("");
    return `<details><summary>${escapeHtml(analysis.machines[0].metrics[benchmarkId].name)} <code>${escapeHtml(benchmarkId)}</code></summary>${rows}<ul>${notes}</ul></details>`;
  }).join("");
}

export function renderComparisonHtml(analysis) {
  const cards = analysis.machines.map((machine) => {
    const memory = machine.report.system.memory_bytes
      ? `${Math.floor(machine.report.system.memory_bytes / 1_073_741_824)} Gio`
      : "mémoire inconnue";
    return `<article class="card"><h3>${escapeHtml(machine.label)}</h3><div class="big">${machine.overall_index.toFixed(0)}</div><p>Indice global · ${formatSigned(machine.overall_index - 100, 1)} %</p><small>${escapeHtml(machine.report.system.processor)} · ${memory}</small></article>`;
  }).join("");
  const narratives = analysis.machines.slice(1).map(
    (machine) => `<p><strong>${escapeHtml(machine.label)}.</strong> ${escapeHtml(machine.narrative)}</p>`,
  ).join("");
  const weights = Object.entries(analysis.scenario_weights).map(
    ([scenario, weight]) => `${SCENARIO_LABELS[scenario]} ${(weight * 100).toFixed(0)} %`,
  ).join(" · ");
  const warnings = analysis.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
  const sources = analysis.machines.map(
    (machine) => `<li>${escapeHtml(machine.label)} — <code>${escapeHtml(machine.report.report_id)}</code></li>`,
  ).join("");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Comparaison publique PerfComparator</title><style>
:root{--ink:#172033;--muted:#667085;--paper:#f6f7fb;--accent:#315efb;--accent2:#19a974}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--paper);line-height:1.5}main{max-width:1180px;margin:auto;padding:32px 20px 64px}h1{font-size:clamp(2rem,5vw,4rem);line-height:1;margin-bottom:8px}h2{margin-top:48px}.lead,.muted,small{color:var(--muted)}.time-delta{display:block;margin-top:3px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.card,.scenario,.timeline,details,.notice{background:white;border:1px solid #e2e5ee;border-radius:14px;padding:18px;box-shadow:0 5px 18px #18203b0c}.notice.public{border-color:#ebcf7f;background:#fff8e7}.big{font-size:3rem;font-weight:800;color:var(--accent)}.scenario,.timeline,details{margin:12px 0}.bar-row,.metric-row{display:grid;grid-template-columns:minmax(130px,1fr) minmax(180px,4fr) 60px;gap:12px;align-items:center;margin:9px 0}.metric-row{grid-template-columns:minmax(130px,1fr) minmax(180px,4fr) 60px minmax(180px,2fr)}.bar-track{height:14px;background:#edf0f6;border-radius:999px;overflow:hidden}.bar{height:100%;background:linear-gradient(90deg,var(--accent),#7892ff);border-radius:inherit}.bar.secondary{background:linear-gradient(90deg,var(--accent2),#65d6a8)}table{border-collapse:collapse;width:100%;background:white}th,td{padding:11px;border:1px solid #dfe3ec;text-align:right}th:first-child{text-align:left}details summary{cursor:pointer;font-weight:700}code{color:#45506a;overflow-wrap:anywhere}@media(max-width:700px){.metric-row,.bar-row{grid-template-columns:1fr 2fr 52px}.metric-row small{grid-column:1/-1}table{font-size:.8rem}}@media print{body{background:white}.card,.scenario,.timeline,details,.notice{box-shadow:none;break-inside:avoid}}
</style></head><body><main>
<header><p class="muted">PerfComparator · rapport HTML public autonome</p><h1>Ce que ces performances changent au quotidien</h1><p class="lead">Référence : <strong>${escapeHtml(analysis.baseline_label)}</strong>, ramenée à l’indice 100. Les temps sont des équivalences relatives, pas des durées applicatives observées.</p><p class="notice public"><strong>Rapports communautaires non certifiés.</strong> Le catalogue valide leur format et leur cohérence, jamais l’authenticité des performances.</p></header>
<section class="cards">${cards}</section>
<section><h2>Lecture en langage courant</h2>${narratives}<div class="notice"><strong>Pondération :</strong> ${escapeHtml(weights)}${warnings ? `<ul>${warnings}</ul>` : ""}</div></section>
<section><h2>Catégories techniques</h2>${barSections(analysis, "categories", CATEGORY_LABELS, true)}</section>
<section><h2>Scénarios d’usage</h2>${barSections(analysis, "scenarios", SCENARIO_LABELS)}</section>
<section><h2>Carte thermique</h2><p class="muted">100 égale la référence ; vert signifie plus rapide, rouge plus lent.</p>${heatmap(analysis)}</section>
<section><h2>Temps équivalents</h2><p class="muted">Durée théorique pour accomplir une quantité de travail identique à la référence.</p>${timelines(analysis)}</section>
<section><h2>Benchmarks détaillés</h2>${benchmarkDetails(analysis)}</section>
<footer><h2>Sources publiques</h2><ul>${sources}</ul><h2>Précautions</h2><p>Comparer au moins trois passages réalisés avec le même profil, le même protocole et la même version de Python. Une plage min–max chevauchante est présentée comme non concluante. Les seuils qualitatifs sont des aides de lecture, pas des lois de perception.</p></footer>
</main></body></html>`;
}
