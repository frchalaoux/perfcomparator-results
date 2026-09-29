"""Valide les rapports suivis et construit leur index déterministe en mémoire."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS_ROOT = ROOT / "reports"
MAX_REPORT_BYTES = 2 * 1_048_576
SUPPORTED_PROTOCOLS = frozenset({"0.3.0"})


def report_paths(root: Path = REPORTS_ROOT) -> list[Path]:
    """Retourne uniquement les rapports JSON, dans un ordre stable."""
    return sorted(root.glob("protocol-*/*.json"))


def _validate_with_perfcomparator(path: Path, validator: str) -> None:
    try:
        subprocess.run(
            [validator, "validate-public", str(path)],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as error:
        raise ValueError(f"Validateur introuvable : {validator}") from error
    except subprocess.CalledProcessError as error:
        detail = error.stderr.strip() or error.stdout.strip() or "erreur inconnue"
        raise ValueError(f"Rapport invalide {path.relative_to(ROOT)} : {detail}") from error


def load_entry(
    path: Path,
    *,
    validator: str = "perfcomparator",
    catalog_root: Path = ROOT,
) -> dict[str, object]:
    """Valide un rapport et extrait exclusivement les clés utiles à l'index."""
    if path.stat().st_size > MAX_REPORT_BYTES:
        raise ValueError(f"Rapport trop volumineux : {path.relative_to(catalog_root)}")
    _validate_with_perfcomparator(path, validator)
    payload = json.loads(path.read_text(encoding="utf-8"))
    protocol = payload["protocol_version"]
    if protocol not in SUPPORTED_PROTOCOLS:
        raise ValueError(f"Protocole non pris en charge : {protocol}")
    expected_parent = f"protocol-{protocol}"
    if path.parent.name != expected_parent:
        raise ValueError(f"Emplacement incorrect pour {path.relative_to(catalog_root)}")
    report_id = payload["report_id"]
    expected_name = f"{report_id.removeprefix('sha256:')}.json"
    if path.name != expected_name:
        raise ValueError(
            f"Nom incorrect pour {path.relative_to(catalog_root)} : {expected_name} attendu"
        )

    system = payload["system"]
    commercial_name = system.get("commercial_name") or system["processor"]
    return {
        "report_id": report_id,
        "path": path.relative_to(catalog_root).as_posix(),
        "protocol_version": protocol,
        "suite_version": payload["suite_version"],
        "profile": payload["profile"],
        "benchmark_count": len(payload["results"]),
        "failed_benchmark_count": len(payload["failed_benchmarks"]),
        "system": {
            "operating_system": system["operating_system"],
            "architecture": system["architecture"],
            "manufacturer": system.get("manufacturer"),
            "commercial_name": commercial_name,
            "model_identifier": system.get("model_identifier"),
            "product_sku": system.get("product_sku"),
            "processor": system["processor"],
            "physical_cpu_count": system["physical_cpu_count"],
            "logical_cpu_count": system["logical_cpu_count"],
            "memory_bytes": system["memory_bytes"],
            "gpu_devices": system["gpu_devices"],
        },
    }


def build_index(
    *,
    reports_root: Path = REPORTS_ROOT,
    validator: str = "perfcomparator",
) -> dict[str, object]:
    """Construit l'index et refuse les identifiants ou chemins dupliqués."""
    entries = [
        load_entry(path, validator=validator, catalog_root=reports_root.parent)
        for path in report_paths(reports_root)
    ]
    identifiers = [entry["report_id"] for entry in entries]
    if len(identifiers) != len(set(identifiers)):
        raise ValueError("Le catalogue contient un identifiant de rapport dupliqué.")
    entries.sort(key=lambda entry: str(entry["report_id"]))
    return {
        "format": "perfcomparator-community-catalog",
        "format_version": 1,
        "report_count": len(entries),
        "reports": entries,
    }


def serialize_index(index: dict[str, object]) -> str:
    return json.dumps(index, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("validate",))
    parser.add_argument(
        "--validator",
        default="perfcomparator",
        help="Commande PerfComparator fournissant validate-public.",
    )
    arguments = parser.parse_args()
    try:
        index = build_index(validator=arguments.validator)
    except (OSError, ValueError, json.JSONDecodeError, KeyError, TypeError) as error:
        parser.error(str(error))
    print(f"{index['report_count']} rapport(s) valide(s).")


if __name__ == "__main__":
    main()
