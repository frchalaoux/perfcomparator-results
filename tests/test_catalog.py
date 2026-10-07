import json
import threading
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest

from scripts.build_catalog import build_index, load_entry
from scripts.build_site import build_site
from scripts.serve_site import (
    LocalSiteHandler,
    delete_public_report,
    local_mutation_allowed,
    rebuild_site,
    source_snapshot,
)


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
    for name in (
        "index.html",
        "styles.css",
        "catalog.mjs",
        "app.mjs",
        "zip.mjs",
        "comparison.mjs",
    ):
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
    assert (destination / "comparison.mjs").read_text(encoding="utf-8") == "comparison.mjs"
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
    for name in (
        "index.html",
        "styles.css",
        "catalog.mjs",
        "app.mjs",
        "zip.mjs",
        "comparison.mjs",
    ):
        (site / name).write_text(name, encoding="utf-8")
    destination = tmp_path / "built"

    with pytest.raises(ValueError, match="rapport invalide"):
        build_site(destination, site_source=site, reports_source=tmp_path / "reports")

    assert not destination.exists()


def test_live_preview_replaces_a_previous_build_only_after_success(tmp_path) -> None:
    destination = tmp_path / "_site"
    destination.mkdir()
    (destination / "version.txt").write_text("ancienne", encoding="utf-8")

    def successful_builder(candidate: Path) -> Path:
        candidate.mkdir()
        (candidate / "version.txt").write_text("nouvelle", encoding="utf-8")
        return candidate

    rebuild_site(destination, builder=successful_builder)

    assert (destination / "version.txt").read_text(encoding="utf-8") == "nouvelle"


def test_live_preview_preserves_the_previous_build_after_failure(tmp_path) -> None:
    destination = tmp_path / "_site"
    destination.mkdir()
    (destination / "version.txt").write_text("valide", encoding="utf-8")

    def failing_builder(candidate: Path) -> Path:
        candidate.mkdir()
        raise ValueError("rapport invalide")

    with pytest.raises(ValueError, match="rapport invalide"):
        rebuild_site(destination, builder=failing_builder)

    assert (destination / "version.txt").read_text(encoding="utf-8") == "valide"


def test_live_preview_snapshot_detects_site_and_report_changes(tmp_path) -> None:
    site = tmp_path / "site"
    reports = tmp_path / "reports"
    site.mkdir()
    reports.mkdir()
    before = source_snapshot(site_source=site, reports_source=reports)
    (site / "app.mjs").write_text("export {};\n", encoding="utf-8")
    after = source_snapshot(site_source=site, reports_source=reports)

    assert before != after


def test_local_report_deletion_requires_an_exact_public_identifier(tmp_path) -> None:
    reports = tmp_path / "reports"
    digest = "a" * 64
    source = write_report(reports, digest)

    with pytest.raises(ValueError, match="Identifiant"):
        delete_public_report("a" * 64, reports_source=reports)
    assert source.exists()

    deleted = delete_public_report(f"sha256:{digest}", reports_source=reports)

    assert deleted == Path("reports/protocol-0.3.0") / f"{digest}.json"
    assert not source.exists()


def test_local_report_deletion_refuses_missing_files_and_symlinks(tmp_path) -> None:
    reports = tmp_path / "reports"
    directory = reports / "protocol-0.3.0"
    directory.mkdir(parents=True)
    digest = "b" * 64
    outside = tmp_path / "outside.json"
    outside.write_text("{}", encoding="utf-8")
    (directory / f"{digest}.json").symlink_to(outside)

    with pytest.raises(FileNotFoundError, match="introuvable"):
        delete_public_report(f"sha256:{digest}", reports_source=reports)
    assert outside.exists()


def test_local_mutations_require_loopback_and_the_same_origin() -> None:
    assert local_mutation_allowed("127.0.0.1", "localhost:8000", None)
    assert local_mutation_allowed(
        "::1",
        "[::1]:8000",
        "http://[::1]:8000",
    )
    assert not local_mutation_allowed(
        "127.0.0.1",
        "localhost:8000",
        "https://example.com",
    )
    assert not local_mutation_allowed("127.0.0.1", "example.com", None)
    assert not local_mutation_allowed("192.0.2.10", "localhost:8000", None)


def test_local_server_exposes_capabilities_and_deletes_a_report(tmp_path) -> None:
    site = tmp_path / "site"
    site.mkdir()
    (site / "index.html").write_text("local", encoding="utf-8")
    reports = tmp_path / "reports"
    digest = "c" * 64
    source = write_report(reports, digest)
    handler = partial(LocalSiteHandler, directory=str(site), reports_source=reports)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    payload = json.dumps({"report_id": f"sha256:{digest}"}).encode()
    try:
        with urlopen(f"{origin}/__local/capabilities") as response:
            assert json.load(response) == {"delete_reports": True}

        rejected = Request(
            f"{origin}/__local/reports/delete",
            data=payload,
            headers={"Content-Type": "application/json", "Origin": "https://example.com"},
            method="POST",
        )
        with pytest.raises(HTTPError) as error:
            urlopen(rejected)
        assert error.value.code == 403
        assert source.exists()

        accepted = Request(
            f"{origin}/__local/reports/delete",
            data=payload,
            headers={"Content-Type": "application/json", "Origin": origin},
            method="POST",
        )
        with urlopen(accepted) as response:
            assert response.status == 202
            assert json.load(response)["deleted"].endswith(f"{digest}.json")
        assert not source.exists()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
