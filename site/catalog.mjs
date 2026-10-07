export function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

export function reportSearchText(report) {
  const system = report.system;
  return normalize([
    system.operating_system,
    system.architecture,
    system.manufacturer,
    system.commercial_name,
    system.model_identifier,
    system.product_sku,
    system.processor,
    ...system.gpu_devices,
    report.profile,
    report.protocol_version,
  ].join(" "));
}

export function reportTitle(report) {
  return report.system.commercial_name || report.system.processor;
}

export function filterReports(reports, filters) {
  const query = normalize(filters.query).trim();
  return reports.filter((report) => {
    const matchesQuery = !query || reportSearchText(report).includes(query);
    const matchesSystem = !filters.operatingSystem
      || report.system.operating_system === filters.operatingSystem;
    const matchesProfile = !filters.profile || report.profile === filters.profile;
    return matchesQuery && matchesSystem && matchesProfile;
  });
}

export function sortReports(reports, order = "name-asc") {
  const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
  const sorted = [...reports];
  const compareText = (left, right) => collator.compare(left, right);
  const compareNumberDescending = (left, right) => (right ?? -1) - (left ?? -1);
  const comparators = {
    "name-asc": (left, right) => compareText(reportTitle(left), reportTitle(right)),
    "name-desc": (left, right) => compareText(reportTitle(right), reportTitle(left)),
    "system-asc": (left, right) => (
      compareText(left.system.operating_system, right.system.operating_system)
      || compareText(reportTitle(left), reportTitle(right))
    ),
    "memory-desc": (left, right) => (
      compareNumberDescending(left.system.memory_bytes, right.system.memory_bytes)
      || compareText(reportTitle(left), reportTitle(right))
    ),
    "benchmarks-desc": (left, right) => (
      compareNumberDescending(left.benchmark_count, right.benchmark_count)
      || compareText(reportTitle(left), reportTitle(right))
    ),
  };
  return sorted.sort(comparators[order] ?? comparators["name-asc"]);
}

export function paginateReports(reports, page, pageSize = 20) {
  const pageCount = Math.max(1, Math.ceil(reports.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * pageSize;
  return {
    reports: reports.slice(start, start + pageSize),
    currentPage,
    pageCount,
  };
}

export function uniqueValues(reports, selector) {
  return [...new Set(reports.map(selector))].sort((left, right) => left.localeCompare(right, "fr"));
}

export function catalogStats(reports) {
  return {
    reports: reports.length,
    systems: uniqueValues(reports, (report) => report.system.operating_system).length,
    protocols: uniqueValues(reports, (report) => report.protocol_version).length,
  };
}

export function formatMemory(bytes) {
  if (bytes === null || bytes === undefined) return "Inconnue";
  return `${(bytes / 1_073_741_824).toLocaleString("fr", { maximumFractionDigits: 1 })} Gio`;
}
