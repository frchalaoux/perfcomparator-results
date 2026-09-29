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
