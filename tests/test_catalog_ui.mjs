import assert from "node:assert/strict";
import test from "node:test";

import {
  catalogStats,
  filterReports,
  formatMemory,
  normalize,
  reportTitle,
} from "../site/catalog.mjs";

const reports = [
  {
    profile: "standard",
    protocol_version: "0.3.0",
    system: {
      operating_system: "Darwin",
      architecture: "arm64",
      manufacturer: "Apple",
      commercial_name: "Apple MacBook Pro 14 pouces (2024)",
      model_identifier: "Mac16,1",
      processor: "Apple M4 Pro",
      gpu_devices: ["Apple M4 Pro"],
    },
  },
  {
    profile: "quick",
    protocol_version: "0.3.0",
    system: {
      operating_system: "Windows",
      architecture: "AMD64",
      processor: "AMD Ryzen 9",
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
