import { catalogStats, filterReports, formatMemory, uniqueValues } from "./catalog.mjs";

const elements = {
  filters: document.querySelector("#filters"),
  query: document.querySelector("#query"),
  operatingSystem: document.querySelector("#operating-system"),
  profile: document.querySelector("#profile"),
  results: document.querySelector("#results"),
  summary: document.querySelector("#results-summary"),
  reportCount: document.querySelector("#report-count"),
  systemCount: document.querySelector("#system-count"),
  protocolCount: document.querySelector("#protocol-count"),
};

let reports = [];

function addOptions(select, values) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function detail(label, value) {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value;
  wrapper.append(term, description);
  return wrapper;
}

function reportCard(report) {
  const card = document.createElement("article");
  card.className = "report-card";

  const header = document.createElement("header");
  const titleGroup = document.createElement("div");
  const title = document.createElement("h3");
  const architecture = document.createElement("p");
  const badge = document.createElement("span");
  title.textContent = report.system.processor;
  architecture.className = "architecture";
  architecture.textContent = `${report.system.operating_system} · ${report.system.architecture}`;
  badge.className = "badge";
  badge.textContent = report.profile;
  titleGroup.append(title, architecture);
  header.append(titleGroup, badge);

  const details = document.createElement("dl");
  details.className = "report-details";
  details.append(
    detail("CPU", `${report.system.physical_cpu_count ?? "?"} cœurs · ${report.system.logical_cpu_count} threads`),
    detail("Mémoire", formatMemory(report.system.memory_bytes)),
    detail("GPU", report.system.gpu_devices.join(", ") || "Non renseigné"),
    detail("Mesures", `${report.benchmark_count} résultat${report.benchmark_count > 1 ? "s" : ""}`),
  );

  const download = document.createElement("a");
  download.className = "download";
  download.href = `../${report.path}`;
  download.download = "";
  download.textContent = "Télécharger le JSON";
  download.setAttribute("aria-label", `Télécharger le rapport ${report.system.processor}`);

  card.append(header, details, download);
  return card;
}

function emptyState(title, message) {
  const wrapper = document.createElement("div");
  const heading = document.createElement("h3");
  const copy = document.createElement("p");
  wrapper.className = "empty-state";
  heading.textContent = title;
  copy.textContent = message;
  wrapper.append(heading, copy);
  return wrapper;
}

function render() {
  const filtered = filterReports(reports, {
    query: elements.query.value,
    operatingSystem: elements.operatingSystem.value,
    profile: elements.profile.value,
  });
  elements.results.replaceChildren();
  elements.summary.textContent = `${filtered.length} rapport${filtered.length > 1 ? "s" : ""} affiché${filtered.length > 1 ? "s" : ""}`;
  if (!filtered.length) {
    const hasFilters = Boolean(
      elements.query.value || elements.operatingSystem.value || elements.profile.value,
    );
    elements.results.append(emptyState(
      hasFilters ? "Aucun résultat" : "Le catalogue attend ses premiers rapports",
      hasFilters
        ? "Modifiez ou réinitialisez les filtres pour élargir la recherche."
        : "Les contributions validées apparaîtront ici après leur intégration.",
    ));
  } else {
    elements.results.append(...filtered.map(reportCard));
  }
  elements.results.setAttribute("aria-busy", "false");
}

function initialize(data) {
  reports = data.reports;
  const stats = catalogStats(reports);
  elements.reportCount.textContent = String(stats.reports);
  elements.systemCount.textContent = String(stats.systems);
  elements.protocolCount.textContent = String(stats.protocols);
  addOptions(elements.operatingSystem, uniqueValues(reports, (report) => report.system.operating_system));
  addOptions(elements.profile, uniqueValues(reports, (report) => report.profile));
  render();
}

elements.filters.addEventListener("input", render);
elements.filters.addEventListener("reset", () => window.setTimeout(render, 0));

try {
  const response = await fetch("../catalog/index.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  initialize(await response.json());
} catch (error) {
  elements.results.setAttribute("aria-busy", "false");
  elements.summary.textContent = "Catalogue indisponible";
  elements.results.append(emptyState(
    "Impossible de charger l’index",
    "Servez la racine du dépôt avec un serveur HTTP local, puis rechargez cette page.",
  ));
  console.error(error);
}
