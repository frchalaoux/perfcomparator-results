import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  catalogStats,
  filterReports,
  formatMemory,
  normalize,
  paginateReports,
  reportTitle,
  sortReports,
} from "../site/catalog.mjs";
import { createStoredZip } from "../site/zip.mjs";
import {
  analyzePublicReports,
  differenceLabel,
  renderComparisonHtml,
} from "../site/comparison.mjs";

const reports = [
  {
    profile: "standard",
    protocol_version: "0.3.0",
    benchmark_count: 16,
    system: {
      operating_system: "Darwin",
      architecture: "arm64",
      manufacturer: "Apple",
      commercial_name: "Apple MacBook Pro 14 pouces (2024)",
      model_identifier: "Mac16,1",
      product_sku: "MX2H3FN/A",
      processor: "Apple M4 Pro",
      memory_bytes: 24 * 1_073_741_824,
      gpu_devices: ["Apple M4 Pro"],
    },
  },
  {
    profile: "quick",
    protocol_version: "0.3.0",
    benchmark_count: 8,
    system: {
      operating_system: "Windows",
      architecture: "AMD64",
      processor: "AMD Ryzen 9",
      memory_bytes: 32 * 1_073_741_824,
      gpu_devices: ["NVIDIA GeForce RTX"],
    },
  },
];

test("normalization ignores accents and case", () => {
  assert.equal(normalize("Écriture SÉQUENTIELLE"), "ecriture sequentielle");
});

test("reports are filtered across hardware text and exact facets", () => {
  assert.deepEqual(
    filterReports(reports, { query: "geforce", operatingSystem: "Windows", profile: "quick" }),
    [reports[1]],
  );
  assert.deepEqual(
    filterReports(reports, { query: "m4", operatingSystem: "Windows", profile: "" }),
    [],
  );
  assert.deepEqual(
    filterReports(reports, { query: "macbook", operatingSystem: "Darwin", profile: "" }),
    [reports[0]],
  );
  assert.deepEqual(
    filterReports(reports, { query: "MX2H3FN/A", operatingSystem: "", profile: "" }),
    [reports[0]],
  );
});

test("commercial name is preferred with a processor fallback", () => {
  assert.equal(reportTitle(reports[0]), "Apple MacBook Pro 14 pouces (2024)");
  assert.equal(reportTitle(reports[1]), "AMD Ryzen 9");
});

test("catalog statistics count distinct systems and protocols", () => {
  assert.deepEqual(catalogStats(reports), { reports: 2, systems: 2, protocols: 1 });
});

test("memory is formatted without exposing an implementation detail", () => {
  assert.equal(formatMemory(16 * 1_073_741_824), "16 Gio");
  assert.equal(formatMemory(null), "Inconnue");
});

test("reports can be sorted without mutating the catalog", () => {
  const original = [...reports];
  assert.deepEqual(sortReports(reports, "name-asc"), [reports[1], reports[0]]);
  assert.deepEqual(sortReports(reports, "name-desc"), [reports[0], reports[1]]);
  assert.deepEqual(sortReports(reports, "system-asc"), [reports[0], reports[1]]);
  assert.deepEqual(sortReports(reports, "memory-desc"), [reports[1], reports[0]]);
  assert.deepEqual(sortReports(reports, "benchmarks-desc"), [reports[0], reports[1]]);
  assert.deepEqual(reports, original);
});

test("pagination limits pages to twenty reports and clamps their number", () => {
  const items = Array.from({ length: 43 }, (_, index) => ({ index }));
  assert.deepEqual(paginateReports(items, 2).reports.map((item) => item.index),
    Array.from({ length: 20 }, (_, index) => index + 20));
  assert.deepEqual(paginateReports(items, 99), {
    reports: [{ index: 40 }, { index: 41 }, { index: 42 }],
    currentPage: 3,
    pageCount: 3,
  });
});

test("a dependency-free ZIP archive stores every selected JSON file", () => {
  const archive = createStoredZip([
    { name: "first.json", data: new TextEncoder().encode("{\"first\":true}\n") },
    { name: "second.json", data: new TextEncoder().encode("{\"second\":true}\n") },
  ]);
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(archive.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(archive.length - 12, true), 2);
  assert.match(new TextDecoder().decode(archive), /first\.json/);
  assert.match(new TextDecoder().decode(archive), /second\.json/);
});

function publicReport(name) {
  return JSON.parse(readFileSync(new URL(`../reports/protocol-0.3.0/${name}.json`, import.meta.url)));
}

test("browser comparison matches the Python engine on catalog reports", () => {
  const baseline = publicReport("001693a8b7239b59e78e36299367fb64f3de856206320706501ff850a963ff34");
  const candidate = publicReport("07aa57fe532cd16f8e6bb8be935555a5a09105b4b6bf6574ca9e6ac99f6790b1");
  const analysis = analyzePublicReports([baseline, candidate]);

  assert.equal(analysis.common_benchmarks.length, 16);
  assert.ok(Math.abs(analysis.machines[1].overall_index - 104.47523589893122) < 1e-10);
  assert.ok(Math.abs(analysis.machines[1].categories.application - 117.09562438226193) < 1e-10);
  assert.ok(analysis.warnings.some((warning) => warning.includes("Versions compatibles")));
});

test("public comparisons reject incompatible reports", () => {
  const baseline = publicReport("001693a8b7239b59e78e36299367fb64f3de856206320706501ff850a963ff34");
  const candidate = structuredClone(baseline);
  candidate.profile = "quick";

  assert.throws(() => analyzePublicReports([baseline, candidate]), /même profil/);

  const changedParameters = structuredClone(baseline);
  changedParameters.results.find((result) => result.benchmark_id === "cpu.hash")
    .parameters.block_size_bytes = 42;
  assert.throws(
    () => analyzePublicReports([baseline, changedParameters]),
    /Paramètres incohérents pour cpu\.hash/,
  );
});

test("public comparisons accept different source schemas under the same protocol", () => {
  const baseline = publicReport("c73e0b97f61ccc0f7afd3f01e646d190540baf5c476a6e3bdb739fb3a8d36188");
  const candidate = structuredClone(baseline);
  candidate.source_schema_version = 4;

  const analysis = analyzePublicReports([baseline, candidate]);

  assert.equal(analysis.common_benchmarks.length, 16);
  assert.equal(analysis.machines[1].overall_index, 100);
});

test("the generated public HTML report is autonomous and traceable", () => {
  const baseline = publicReport("001693a8b7239b59e78e36299367fb64f3de856206320706501ff850a963ff34");
  const candidate = publicReport("07aa57fe532cd16f8e6bb8be935555a5a09105b4b6bf6574ca9e6ac99f6790b1");
  const document = renderComparisonHtml(analyzePublicReports([baseline, candidate]));

  assert.match(document, /rapport HTML public autonome/);
  assert.match(document, /Rapports communautaires non certifiés/);
  assert.match(document, /Scénarios d’usage/);
  assert.match(document, /Carte thermique/);
  assert.match(document, /Sources publiques/);
  assert.match(document, /sha256:001693a8b723/);
  assert.doesNotMatch(document, /https:\/\//);
  assert.equal(differenceLabel(20), "différence nette en faveur de cette machine");
});

test("public report text is escaped in the autonomous HTML", () => {
  const baseline = publicReport("001693a8b7239b59e78e36299367fb64f3de856206320706501ff850a963ff34");
  const candidate = structuredClone(baseline);
  candidate.system.commercial_name = "<script>alert('unsafe')</script>";
  const document = renderComparisonHtml(analyzePublicReports([baseline, candidate]));

  assert.doesNotMatch(document, /<script>alert/);
  assert.match(document, /&lt;script&gt;alert\(&#39;unsafe&#39;\)&lt;\/script&gt;/);
});
