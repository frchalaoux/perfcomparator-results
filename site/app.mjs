import {
  catalogStats,
  filterReports,
  formatMemory,
  paginateReports,
  reportTitle,
  sortReports,
  uniqueValues,
} from "./catalog.mjs";
import { createStoredZip } from "./zip.mjs";

const PAGE_SIZE = 20;

const elements = {
  filters: document.querySelector("#filters"),
  query: document.querySelector("#query"),
  operatingSystem: document.querySelector("#operating-system"),
  profile: document.querySelector("#profile"),
  sortOrder: document.querySelector("#sort-order"),
  results: document.querySelector("#results"),
  summary: document.querySelector("#results-summary"),
  pagination: document.querySelector("#pagination"),
  previousPage: document.querySelector("#previous-page"),
  nextPage: document.querySelector("#next-page"),
  pageSummary: document.querySelector("#page-summary"),
  selectPage: document.querySelector("#select-page"),
  selectAllResults: document.querySelector("#select-all-results"),
  clearSelection: document.querySelector("#clear-selection"),
  downloadSelection: document.querySelector("#download-selection"),
  downloadStatus: document.querySelector("#download-status"),
  reportCount: document.querySelector("#report-count"),
  systemCount: document.querySelector("#system-count"),
  protocolCount: document.querySelector("#protocol-count"),
};

let reports = [];
let currentPage = 1;
let pageReports = [];
let filteredReports = [];
const selectedReportIds = new Set();

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
  card.classList.toggle("selected", selectedReportIds.has(report.report_id));

  const header = document.createElement("header");
  const selection = document.createElement("label");
  const checkbox = document.createElement("input");
  const selectionLabel = document.createElement("span");
  const titleGroup = document.createElement("div");
  const title = document.createElement("h3");
  const architecture = document.createElement("p");
  const badge = document.createElement("span");
  const machineName = reportTitle(report);
  selection.className = "report-selection";
  checkbox.type = "checkbox";
  checkbox.checked = selectedReportIds.has(report.report_id);
  checkbox.setAttribute("aria-label", `Sélectionner le rapport ${machineName}`);
  selectionLabel.textContent = checkbox.checked ? "Sélectionné" : "Sélectionner";
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) selectedReportIds.add(report.report_id);
    else selectedReportIds.delete(report.report_id);
    selectionLabel.textContent = checkbox.checked ? "Sélectionné" : "Sélectionner";
    card.classList.toggle("selected", checkbox.checked);
    updateSelectionControls();
  });
  selection.append(checkbox, selectionLabel);
  title.textContent = machineName;
  architecture.className = "architecture";
  architecture.textContent = [
    report.system.model_identifier,
    report.system.operating_system,
    report.system.architecture,
  ].filter(Boolean).join(" · ");
  badge.className = "badge";
  badge.textContent = report.profile;
  titleGroup.append(title, architecture);
  header.append(titleGroup, badge);

  const essentials = document.createElement("div");
  essentials.className = "report-essentials";
  const processor = document.createElement("span");
  const memory = document.createElement("span");
  processor.textContent = report.system.processor;
  memory.textContent = formatMemory(report.system.memory_bytes);
  essentials.append(processor, memory);

  const details = document.createElement("dl");
  details.className = "report-details";
  details.id = `details-${report.report_id.replace("sha256:", "")}`;
  details.hidden = true;
  if (report.system.product_sku) {
    details.append(detail("Référence commerciale", report.system.product_sku));
  }
  details.append(
    detail("Processeur", report.system.processor),
    detail("CPU", `${report.system.physical_cpu_count ?? "?"} cœurs · ${report.system.logical_cpu_count} threads`),
    detail("Mémoire", formatMemory(report.system.memory_bytes)),
    detail("GPU", report.system.gpu_devices.join(", ") || "Non renseigné"),
    detail("Mesures", `${report.benchmark_count} résultat${report.benchmark_count > 1 ? "s" : ""}`),
  );

  const download = document.createElement("a");
  download.className = "download";
  download.href = `./${report.path}`;
  download.download = "";
  download.textContent = "Télécharger le JSON";
  download.setAttribute("aria-label", `Télécharger le rapport ${machineName}`);

  const toggle = document.createElement("button");
  toggle.className = "detail-toggle";
  toggle.type = "button";
  toggle.textContent = "Détails";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", details.id);
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    toggle.textContent = expanded ? "Détails" : "Masquer";
    details.hidden = expanded;
  });

  const actions = document.createElement("div");
  actions.className = "report-actions";
  actions.append(selection, toggle, download);

  card.append(header, essentials, actions, details);
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

function updateSelectionControls() {
  const selectedOnPage = pageReports.filter((report) => selectedReportIds.has(report.report_id)).length;
  elements.selectPage.checked = pageReports.length > 0 && selectedOnPage === pageReports.length;
  elements.selectPage.indeterminate = selectedOnPage > 0 && selectedOnPage < pageReports.length;
  elements.selectPage.disabled = pageReports.length === 0;
  elements.selectAllResults.disabled = filteredReports.length === 0;
  elements.clearSelection.hidden = selectedReportIds.size === 0;
  elements.downloadSelection.disabled = selectedReportIds.size === 0;
  elements.downloadSelection.textContent = `Télécharger tout (.zip) · ${selectedReportIds.size}`;
}

function render() {
  const filtered = filterReports(reports, {
    query: elements.query.value,
    operatingSystem: elements.operatingSystem.value,
    profile: elements.profile.value,
  });
  const sorted = sortReports(filtered, elements.sortOrder.value);
  const page = paginateReports(sorted, currentPage, PAGE_SIZE);
  currentPage = page.currentPage;
  filteredReports = filtered;
  pageReports = page.reports;
  elements.results.replaceChildren();
  const firstVisible = filtered.length ? (page.currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastVisible = Math.min(page.currentPage * PAGE_SIZE, filtered.length);
  elements.summary.textContent = filtered.length > PAGE_SIZE
    ? `${filtered.length} rapports · affichage ${firstVisible}–${lastVisible}`
    : `${filtered.length} rapport${filtered.length > 1 ? "s" : ""} affiché${filtered.length > 1 ? "s" : ""}`;
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
    elements.results.append(...page.reports.map(reportCard));
  }
  elements.pagination.hidden = filtered.length <= PAGE_SIZE;
  elements.pageSummary.textContent = `Page ${page.currentPage} sur ${page.pageCount}`;
  elements.previousPage.disabled = page.currentPage === 1;
  elements.nextPage.disabled = page.currentPage === page.pageCount;
  updateSelectionControls();
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

elements.filters.addEventListener("input", () => {
  currentPage = 1;
  render();
});
elements.filters.addEventListener("reset", () => window.setTimeout(() => {
  currentPage = 1;
  render();
}, 0));
elements.previousPage.addEventListener("click", () => {
  currentPage -= 1;
  render();
  elements.summary.scrollIntoView({ behavior: "smooth", block: "start" });
});
elements.nextPage.addEventListener("click", () => {
  currentPage += 1;
  render();
  elements.summary.scrollIntoView({ behavior: "smooth", block: "start" });
});
elements.selectPage.addEventListener("change", () => {
  for (const report of pageReports) {
    if (elements.selectPage.checked) selectedReportIds.add(report.report_id);
    else selectedReportIds.delete(report.report_id);
  }
  render();
});
elements.selectAllResults.addEventListener("click", () => {
  for (const report of filteredReports) selectedReportIds.add(report.report_id);
  render();
});
elements.clearSelection.addEventListener("click", () => {
  selectedReportIds.clear();
  elements.downloadStatus.textContent = "";
  render();
});
elements.downloadSelection.addEventListener("click", async () => {
  const selectedReports = reports.filter((report) => selectedReportIds.has(report.report_id));
  if (!selectedReports.length) return;
  elements.downloadSelection.disabled = true;
  elements.downloadStatus.textContent = `Préparation de ${selectedReports.length} rapport${selectedReports.length > 1 ? "s" : ""}…`;
  try {
    const files = await Promise.all(selectedReports.map(async (report) => {
      const response = await fetch(`./${report.path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status} pour ${report.path}`);
      return {
        name: report.path.split("/").at(-1),
        data: new Uint8Array(await response.arrayBuffer()),
      };
    }));
    const archive = createStoredZip(files);
    const url = URL.createObjectURL(new Blob([archive], { type: "application/zip" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "perfcomparator-reports.zip";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    elements.downloadStatus.textContent = `Archive créée : ${files.length} rapport${files.length > 1 ? "s" : ""}.`;
  } catch (error) {
    elements.downloadStatus.textContent = "Impossible de créer l’archive. Réessayez ou téléchargez les rapports séparément.";
    console.error(error);
  } finally {
    elements.downloadSelection.disabled = selectedReportIds.size === 0;
  }
});

try {
  const response = await fetch("./catalog/index.json", { cache: "no-store" });
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
