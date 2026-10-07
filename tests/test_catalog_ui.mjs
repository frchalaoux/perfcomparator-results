import assert from "node:assert/strict";
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
