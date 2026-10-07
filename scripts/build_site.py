"""Assemble l'artefact statique autonome destiné à GitHub Pages."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

if __package__:
    from .build_catalog import build_index, serialize_index
else:
    from build_catalog import build_index, serialize_index

ROOT = Path(__file__).resolve().parents[1]
SITE_SOURCE = ROOT / "site"
REPORTS_SOURCE = ROOT / "reports"
DEFAULT_OUTPUT = ROOT / "_site"


def build_site(
    destination: Path = DEFAULT_OUTPUT,
    *,
    site_source: Path = SITE_SOURCE,
    reports_source: Path = REPORTS_SOURCE,
    validator: str = "perfcomparator",
) -> Path:
    """Construit l'index puis copie uniquement les fichiers publics nécessaires."""
    if destination.exists():
        raise ValueError(f"La destination existe déjà : {destination}")
    required = (
        site_source / "index.html",
        site_source / "styles.css",
        site_source / "catalog.mjs",
        site_source / "app.mjs",
        site_source / "zip.mjs",
    )
    missing = [path for path in required if not path.is_file()]
    if missing:
        raise ValueError(f"Fichier requis introuvable : {missing[0]}")

    index = build_index(reports_root=reports_source, validator=validator)
    destination.mkdir(parents=True)
    for source in required:
        shutil.copy2(source, destination / source.name)
    (destination / "catalog").mkdir()
    (destination / "catalog" / "index.json").write_text(
        serialize_index(index),
        encoding="utf-8",
    )
    for source in sorted(reports_source.glob("protocol-*/*.json")):
        report_destination = destination / "reports" / source.relative_to(reports_source)
        report_destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, report_destination)
    (destination / "reports").mkdir(exist_ok=True)
    (destination / ".nojekyll").write_text("", encoding="utf-8")
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Répertoire de sortie, qui ne doit pas déjà exister.",
    )
    arguments = parser.parse_args()
    try:
        destination = build_site(arguments.output)
    except (OSError, ValueError, json.JSONDecodeError, KeyError, TypeError) as error:
        parser.error(str(error))
    print(f"Site assemblé dans {destination}")


if __name__ == "__main__":
    main()
