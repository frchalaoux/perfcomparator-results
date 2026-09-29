import pytest

from scripts.auto_merge import merge_validated_report, validate_changed_files

REPORT_PATH = f"reports/protocol-0.3.0/{'a' * 64}.json"


class FakeGitHubClient:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []

    def request(self, method, path, payload=None):
        self.calls.append((method, path, payload))
        return next(self.responses)


def successful_event():
    return {
        "workflow_run": {
            "event": "pull_request",
            "conclusion": "success",
            "head_sha": "abc123",
            "pull_requests": [{"number": 42}],
        }
    }


def test_merge_accepts_only_one_new_report() -> None:
    client = FakeGitHubClient(
        [
            {
                "state": "open",
                "draft": False,
                "base": {"ref": "main"},
                "head": {"sha": "abc123"},
                "changed_files": 1,
            },
            [{"filename": REPORT_PATH, "status": "added"}],
            {"merged": True},
            None,
        ]
    )

    message = merge_validated_report(successful_event(), client)

    assert message == "Pull request #42 fusionnée ; déploiement Pages demandé."
    assert client.calls[-2] == (
        "PUT",
        "/pulls/42/merge",
        {"sha": "abc123", "merge_method": "merge"},
    )
    assert client.calls[-1] == (
        "POST",
        "/actions/workflows/deploy-pages.yml/dispatches",
        {"ref": "main"},
    )


@pytest.mark.parametrize(
    "files",
    [
        [],
        [{"filename": REPORT_PATH, "status": "removed"}],
        [
            {"filename": REPORT_PATH, "status": "added"},
            {"filename": "README.md", "status": "modified"},
        ],
        [
            {"filename": REPORT_PATH, "status": "added"},
            {"filename": ".github/workflows/untrusted.yml", "status": "added"},
        ],
    ],
)
def test_merge_rejects_anything_other_than_a_data_only_contribution(files) -> None:
    with pytest.raises(ValueError):
        validate_changed_files(files)


def test_merge_rejects_a_head_changed_after_validation() -> None:
    client = FakeGitHubClient(
        [
            {
                "state": "open",
                "draft": False,
                "base": {"ref": "main"},
                "head": {"sha": "new-head"},
                "changed_files": 1,
            }
        ]
    )

    with pytest.raises(ValueError, match="a changé"):
        merge_validated_report(successful_event(), client)

    assert all(call[0] != "PUT" for call in client.calls)


def test_unsuccessful_validation_does_nothing() -> None:
    event = successful_event()
    event["workflow_run"]["conclusion"] = "failure"
    client = FakeGitHubClient([])

    assert "Aucune" in merge_validated_report(event, client)
    assert client.calls == []
