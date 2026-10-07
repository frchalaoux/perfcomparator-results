"""Construit, sert et reconstruit automatiquement le catalogue local."""

from __future__ import annotations

import argparse
import ipaddress
import json
import re
import shutil
import sys
import tempfile
import threading
from collections.abc import Callable
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from time import monotonic
from urllib.parse import urlsplit

if __package__:
    from .build_site import DEFAULT_OUTPUT, REPORTS_SOURCE, SITE_SOURCE, build_site
else:
    from build_site import DEFAULT_OUTPUT, REPORTS_SOURCE, SITE_SOURCE, build_site

Snapshot = tuple[tuple[str, int, int], ...]
Builder = Callable[[Path], Path]
REPORT_ID_PATTERN = re.compile(r"sha256:[0-9a-f]{64}")
CAPABILITIES_PATH = "/__local/capabilities"
DELETE_REPORT_PATH = "/__local/reports/delete"


def source_snapshot(
    *, site_source: Path = SITE_SOURCE, reports_source: Path = REPORTS_SOURCE
) -> Snapshot:
    """Capture les fichiers qui influencent l'artefact statique."""
    files = [
        path
        for root in (site_source, reports_source)
        if root.exists()
        for path in root.rglob("*")
        if path.is_file()
    ]
    entries: list[tuple[str, int, int]] = []
    for path in sorted(files):
        try:
            metadata = path.stat()
        except FileNotFoundError:
            continue
        entries.append((str(path), metadata.st_mtime_ns, metadata.st_size))
    return tuple(entries)


def rebuild_site(destination: Path, *, builder: Builder = build_site) -> Path:
    """Remplace atomiquement l'aperçu seulement après une construction réussie."""
    destination = destination.resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary_root = Path(
        tempfile.mkdtemp(prefix=f".{destination.name}-build-", dir=destination.parent)
    )
    candidate = temporary_root / "candidate"
    previous = temporary_root / "previous"
    try:
        builder(candidate)
        if destination.exists():
            destination.rename(previous)
        try:
            candidate.rename(destination)
        except OSError:
            if previous.exists() and not destination.exists():
                previous.rename(destination)
            raise
        if previous.exists():
            shutil.rmtree(previous)
    finally:
        shutil.rmtree(temporary_root, ignore_errors=True)
    return destination


def delete_public_report(report_id: str, *, reports_source: Path = REPORTS_SOURCE) -> Path:
    """Supprime uniquement le rapport source désigné par son identifiant exact."""
    if not REPORT_ID_PATTERN.fullmatch(report_id):
        raise ValueError("Identifiant de rapport invalide.")
    digest = report_id.removeprefix("sha256:")
    root = reports_source.resolve()
    candidates = [
        path
        for path in reports_source.glob(f"protocol-*/{digest}.json")
        if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root)
    ]
    if not candidates:
        raise FileNotFoundError("Rapport public introuvable.")
    if len(candidates) != 1:
        raise ValueError("Plusieurs rapports correspondent à cet identifiant.")
    source = candidates[0]
    source.unlink()
    return source.relative_to(reports_source.parent)


def _loopback_name(value: str | None) -> bool:
    if value is None:
        return False
    if value.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(value).is_loopback
    except ValueError:
        return False


def local_mutation_allowed(client_host: str, host_header: str, origin: str | None) -> bool:
    """Refuse l'écriture distante, le DNS rebinding et les origines tierces."""
    try:
        client_is_local = ipaddress.ip_address(client_host).is_loopback
    except ValueError:
        client_is_local = False
    requested_host = urlsplit(f"//{host_header}").hostname
    if not client_is_local or not _loopback_name(requested_host):
        return False
    if origin is None:
        return True
    parsed_origin = urlsplit(origin)
    return (
        parsed_origin.scheme == "http"
        and _loopback_name(parsed_origin.hostname)
        and parsed_origin.netloc.lower() == host_header.lower()
    )


class NoCacheHandler(SimpleHTTPRequestHandler):
    """Sert l'aperçu sans conserver d'anciens modules dans le navigateur."""

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


class LocalSiteHandler(NoCacheHandler):
    """Expose les fonctions d'administration uniquement sur la boucle locale."""

    def __init__(self, *args, reports_source: Path = REPORTS_SOURCE, **kwargs) -> None:
        self.reports_source = reports_source
        super().__init__(*args, **kwargs)

    def _send_json(self, status: int, payload: dict[str, object]) -> None:
        content = (json.dumps(payload, ensure_ascii=False) + "\n").encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _mutation_allowed(self) -> bool:
        return local_mutation_allowed(
            self.client_address[0],
            self.headers.get("Host", ""),
            self.headers.get("Origin"),
        )

    def do_GET(self) -> None:
        if self.path != CAPABILITIES_PATH:
            super().do_GET()
            return
        if not self._mutation_allowed():
            self._send_json(403, {"error": "Administration locale refusée."})
            return
        self._send_json(200, {"delete_reports": True})

    def do_POST(self) -> None:
        if self.path != DELETE_REPORT_PATH:
            self._send_json(404, {"error": "Fonction locale inconnue."})
            return
        if not self._mutation_allowed():
            self._send_json(403, {"error": "Suppression locale refusée."})
            return
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_type != "application/json" or not 0 < content_length <= 1_024:
            self._send_json(400, {"error": "Requête JSON invalide."})
            return
        try:
            payload = json.loads(self.rfile.read(content_length))
            if not isinstance(payload, dict) or set(payload) != {"report_id"}:
                raise ValueError("Corps de requête invalide.")
            deleted = delete_public_report(
                payload["report_id"],
                reports_source=self.reports_source,
            )
        except FileNotFoundError as error:
            self._send_json(404, {"error": str(error)})
            return
        except (json.JSONDecodeError, TypeError, ValueError) as error:
            self._send_json(400, {"error": str(error)})
            return
        print(f"Rapport local supprimé : {deleted}", flush=True)
        self._send_json(202, {"deleted": deleted.as_posix()})


def watch_sources(
    destination: Path,
    stop: threading.Event,
    *,
    interval: float = 0.5,
    site_source: Path = SITE_SOURCE,
    reports_source: Path = REPORTS_SOURCE,
) -> None:
    """Reconstruit après stabilisation d'un changement de source."""
    snapshot = source_snapshot(site_source=site_source, reports_source=reports_source)
    while not stop.wait(interval):
        current = source_snapshot(site_source=site_source, reports_source=reports_source)
        if current == snapshot:
            continue
        changed_at = monotonic()
        while not stop.wait(interval):
            latest = source_snapshot(site_source=site_source, reports_source=reports_source)
            if latest == current or monotonic() - changed_at >= 2:
                current = latest
                break
            current = latest
            changed_at = monotonic()
        print("Changement détecté, reconstruction…", flush=True)
        try:
            rebuild_site(destination)
        except (OSError, ValueError, json.JSONDecodeError, KeyError, TypeError) as error:
            print(
                f"Reconstruction refusée, l'ancien aperçu est conservé : {error}",
                file=sys.stderr,
                flush=True,
            )
        else:
            print("Aperçu reconstruit. Rechargez la page si nécessaire.", flush=True)
        snapshot = source_snapshot(site_source=site_source, reports_source=reports_source)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    arguments = parser.parse_args()

    try:
        destination = rebuild_site(arguments.output)
    except (OSError, ValueError, json.JSONDecodeError, KeyError, TypeError) as error:
        parser.error(str(error))

    stop = threading.Event()
    watcher = threading.Thread(
        target=watch_sources,
        args=(destination, stop),
        daemon=True,
        name="catalog-watcher",
    )
    watcher.start()
    handler = partial(
        LocalSiteHandler,
        directory=str(destination),
        reports_source=REPORTS_SOURCE,
    )
    try:
        server = ThreadingHTTPServer((arguments.host, arguments.port), handler)
    except OSError as error:
        stop.set()
        watcher.join(timeout=2)
        parser.error(f"impossible d'ouvrir le serveur : {error}")
    print(
        f"Catalogue servi sur http://{arguments.host}:{arguments.port}/ "
        "(reconstruction automatique active).",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur local.")
    finally:
        stop.set()
        server.server_close()
        watcher.join(timeout=2)


if __name__ == "__main__":
    main()
