"""Assemble l'artefact statique autonome destiné à GitHub Pages."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_SOURCE = ROOT / "site"
CATALOG_SOURCE = ROOT / "catalog"
REPORTS_SOURCE = ROOT / "reports"
DEFAULT_OUTPUT = ROOT / "_site"


def build_site(
    destination: Path = DEFAULT_OUTPUT,
    *,
    site_source: Path = SITE_SOURCE,
    catalog_source: Path = CATALOG_SOURCE,
    reports_source: Path = REPORTS_SOURCE,
) -> Path:
    """Copie uniquement le site, l'index et les rapports publics suivis."""
    if destination.exists():
        raise ValueError(f"La destination existe déjà : {destination}")
    required = (
        site_source / "index.html",
        site_source / "styles.css",
        site_source / "catalog.mjs",
        site_source / "app.mjs",
        catalog_source / "index.json",
    )
    missing = [path for path in required if not path.is_file()]
    if missing:
        raise ValueError(f"Fichier requis introuvable : {missing[0]}")

    destination.mkdir(parents=True)
    for source in required[:4]:
        shutil.copy2(source, destination / source.name)
    (destination / "catalog").mkdir()
    shutil.copy2(catalog_source / "index.json", destination / "catalog" / "index.json")
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
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(f"Site assemblé dans {destination}")


if __name__ == "__main__":
    main()
