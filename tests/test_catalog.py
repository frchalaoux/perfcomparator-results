import json
from pathlib import Path
from unittest.mock import patch

import pytest

from scripts.build_catalog import build_index, load_entry
from scripts.build_site import build_site


def public_payload(report_id: str) -> dict[str, object]:
    return {
        "report_id": f"sha256:{report_id}",
        "protocol_version": "0.3.0",
        "suite_version": "0.4.0.dev0",
        "profile": "standard",
        "results": [{"benchmark_id": "cpu.integer"}],
        "failed_benchmarks": [],
        "system": {
            "operating_system": "Linux",
            "architecture": "x86_64",
            "manufacturer": "Example Computer",
            "commercial_name": "Example Computer Workstation 15",
            "model_identifier": "WS15",
            "product_sku": "WS15-FR-32",
            "processor": "Example CPU",
            "physical_cpu_count": 4,
            "logical_cpu_count": 8,
            "memory_bytes": 16_000_000_000,
            "gpu_devices": [],
        },
    }


def write_report(root: Path, report_id: str) -> Path:
    directory = root / "protocol-0.3.0"
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{report_id}.json"
    path.write_text(json.dumps(public_payload(report_id)), encoding="utf-8")
    return path


@patch("scripts.build_catalog._validate_with_perfcomparator")
def test_build_index_is_sorted_and_minimal(validate, tmp_path) -> None:
    reports_root = tmp_path / "reports"
    write_report(reports_root, "b" * 64)
    write_report(reports_root, "a" * 64)

    index = build_index(reports_root=reports_root)

    assert index["report_count"] == 2
    assert [entry["report_id"] for entry in index["reports"]] == [
        f"sha256:{'a' * 64}",
        f"sha256:{'b' * 64}",
    ]
    assert "results" not in index["reports"][0]
    assert index["reports"][0]["system"]["commercial_name"] == ("Example Computer Workstation 15")
    assert index["reports"][0]["system"]["product_sku"] == "WS15-FR-32"
    assert validate.call_count == 2


@patch("scripts.build_catalog._validate_with_perfcomparator")
def test_legacy_report_uses_its_processor_as_title(validate, tmp_path) -> None:
    path = write_report(tmp_path / "reports", "a" * 64)
    payload = json.loads(path.read_text(encoding="utf-8"))
    for field in ("manufacturer", "commercial_name", "model_identifier", "product_sku"):
        payload["system"].pop(field)
    path.write_text(json.dumps(payload), encoding="utf-8")

    entry = load_entry(path, catalog_root=tmp_path)

    assert entry["system"]["commercial_name"] == "Example CPU"
    assert entry["system"]["manufacturer"] is None
    assert entry["system"]["product_sku"] is None


@patch("scripts.build_catalog._validate_with_perfcomparator")
def test_load_entry_rejects_a_filename_different_from_the_content_id(validate, tmp_path) -> None:
    path = write_report(tmp_path / "reports", "a" * 64)
    payload = public_payload("b" * 64)
    path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ValueError, match="Nom incorrect"):
        load_entry(path, catalog_root=tmp_path)


@patch("scripts.build_site.build_index")
def test_build_site_generates_the_index_and_assembles_only_public_assets(
    generated_index, tmp_path
) -> None:
    site = tmp_path / "sources" / "site"
    reports = tmp_path / "sources" / "reports"
    for path in (site, reports / "protocol-0.3.0"):
        path.mkdir(parents=True)
    for name in ("index.html", "styles.css", "catalog.mjs", "app.mjs", "zip.mjs"):
        (site / name).write_text(name, encoding="utf-8")
    (reports / "protocol-0.3.0" / "public.json").write_text("{}\n", encoding="utf-8")
    destination = tmp_path / "built"
    generated_index.return_value = {
        "format": "perfcomparator-community-catalog",
        "format_version": 1,
        "report_count": 1,
        "reports": [],
    }

    build_site(
        destination,
        site_source=site,
        reports_source=reports,
        validator="/fake/perfcomparator",
    )

    assert (destination / "index.html").read_text(encoding="utf-8") == "index.html"
    index = json.loads((destination / "catalog" / "index.json").read_text(encoding="utf-8"))
    assert index["report_count"] == 1
    assert (destination / "zip.mjs").read_text(encoding="utf-8") == "zip.mjs"
    assert (destination / "reports" / "protocol-0.3.0" / "public.json").exists()
    assert (destination / ".nojekyll").exists()
    generated_index.assert_called_once_with(
        reports_root=reports,
        validator="/fake/perfcomparator",
    )


def test_build_site_rejects_a_stale_destination(tmp_path) -> None:
    destination = tmp_path / "built"
    destination.mkdir()

    with pytest.raises(ValueError, match="existe déjà"):
        build_site(destination)


@patch("scripts.build_site.build_index", side_effect=ValueError("rapport invalide"))
def test_build_site_validates_before_creating_the_destination(_build_index, tmp_path) -> None:
    site = tmp_path / "site"
    site.mkdir()
    for name in ("index.html", "styles.css", "catalog.mjs", "app.mjs", "zip.mjs"):
        (site / name).write_text(name, encoding="utf-8")
    destination = tmp_path / "built"

    with pytest.raises(ValueError, match="rapport invalide"):
        build_site(destination, site_source=site, reports_source=tmp_path / "reports")

    assert not destination.exists()
