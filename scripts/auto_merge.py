"""Fusionne une contribution de rapport après sa validation non privilégiée."""

from __future__ import annotations

import argparse
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

REPORT_PATH = re.compile(r"^reports/protocol-\d+\.\d+\.\d+/[0-9a-f]{64}\.json$")
API_VERSION = "2026-03-10"


class GitHubClient:
    """Client REST minimal utilisant uniquement le jeton éphémère du workflow."""

    def __init__(self, *, repository: str, token: str) -> None:
        self.repository = repository
        self.token = token

    def request(
        self,
        method: str,
        path: str,
        payload: dict[str, object] | None = None,
    ) -> Any:
        data = json.dumps(payload).encode() if payload is not None else None
        request = urllib.request.Request(
            f"https://api.github.com/repos/{self.repository}{path}",
            data=data,
            method=method,
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
                "X-GitHub-Api-Version": API_VERSION,
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")
            raise ValueError(f"GitHub API {error.code}: {detail}") from error
        return json.loads(body) if body else None


def validated_pull_request_number(event: dict[str, object]) -> int | None:
    """Retrouve l'unique PR du contrôle réussi, sinon ignore l'événement."""
    run = event.get("workflow_run")
    if not isinstance(run, dict):
        return None
    if run.get("event") != "pull_request" or run.get("conclusion") != "success":
        return None
    pull_requests = run.get("pull_requests")
    if not isinstance(pull_requests, list) or len(pull_requests) != 1:
        return None
    number = pull_requests[0].get("number")
    return number if isinstance(number, int) else None


def validate_changed_files(files: list[dict[str, object]]) -> None:
    """N'autorise qu'un unique nouveau rapport public."""
    if len(files) != 1:
        raise ValueError("La contribution doit ajouter exactement un fichier.")
    statuses = {str(item.get("filename")): item.get("status") for item in files}
    reports = [path for path in statuses if REPORT_PATH.fullmatch(path)]
    if len(reports) != 1 or statuses[reports[0]] != "added":
        raise ValueError("La contribution doit ajouter exactement un rapport public.")


def merge_validated_report(event: dict[str, object], client: GitHubClient) -> str:
    """Revérifie la PR, la fusionne, puis déclenche explicitement Pages."""
    number = validated_pull_request_number(event)
    if number is None:
        return "Aucune pull request de rapport validée à fusionner."

    run = event["workflow_run"]
    assert isinstance(run, dict)
    validated_sha = run.get("head_sha")
    pull_request = client.request("GET", f"/pulls/{number}")
    if pull_request.get("state") != "open":
        return f"La pull request #{number} n'est plus ouverte."
    if pull_request.get("draft"):
        return f"Pull request #{number} ignorée : elle est encore en brouillon."
    if pull_request.get("base", {}).get("ref") != "main":
        return f"Pull request #{number} ignorée : elle ne cible pas main."
    head_sha = pull_request.get("head", {}).get("sha")
    if not isinstance(validated_sha, str) or head_sha != validated_sha:
        raise ValueError("La tête de la pull request a changé depuis sa validation.")
    if pull_request.get("changed_files") != 1:
        return f"Pull request #{number} ignorée : elle ne contient pas un unique rapport."

    files = client.request("GET", f"/pulls/{number}/files?per_page=100")
    if not isinstance(files, list):
        raise TypeError("La liste des fichiers de la pull request est invalide.")
    try:
        validate_changed_files(files)
    except ValueError:
        return f"Pull request #{number} ignorée : elle ne contient pas un unique rapport ajouté."

    result = client.request(
        "PUT",
        f"/pulls/{number}/merge",
        {"sha": validated_sha, "merge_method": "merge"},
    )
    if not result.get("merged"):
        raise ValueError(str(result.get("message", "GitHub a refusé la fusion.")))

    client.request(
        "POST",
        "/actions/workflows/deploy-pages.yml/dispatches",
        {"ref": "main"},
    )
    return f"Pull request #{number} fusionnée ; déploiement Pages demandé."


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("event", type=Path, help="Fichier JSON de l'événement workflow_run.")
    arguments = parser.parse_args()
    try:
        event = json.loads(arguments.event.read_text(encoding="utf-8"))
        client = GitHubClient(
            repository=os.environ["GITHUB_REPOSITORY"],
            token=os.environ["PERFCOMPARATOR_GITHUB_TOKEN"],
        )
        print(merge_validated_report(event, client))
    except (KeyError, OSError, TypeError, ValueError, json.JSONDecodeError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
