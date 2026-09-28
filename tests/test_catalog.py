import json
from pathlib import Path
from unittest.mock import patch

import pytest

from scripts.build_catalog import build_index, check_index, load_entry, serialize_index


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
    assert validate.call_count == 2


@patch("scripts.build_catalog._validate_with_perfcomparator")
def test_load_entry_rejects_a_filename_different_from_the_content_id(validate, tmp_path) -> None:
    path = write_report(tmp_path / "reports", "a" * 64)
    payload = public_payload("b" * 64)
    path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ValueError, match="Nom incorrect"):
        load_entry(path, catalog_root=tmp_path)


def test_empty_index_matches_the_tracked_initial_state(tmp_path) -> None:
    index = build_index(reports_root=tmp_path / "reports")
    destination = tmp_path / "index.json"
    destination.write_text(serialize_index(index), encoding="utf-8")

    check_index(index, destination)


def test_check_rejects_a_stale_index(tmp_path) -> None:
    destination = tmp_path / "index.json"
    destination.write_text("{}\n", encoding="utf-8")

    with pytest.raises(ValueError, match="doit être régénéré"):
        check_index(build_index(reports_root=tmp_path / "reports"), destination)
