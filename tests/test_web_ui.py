"""Regression tests for the v3 UI, dev-auth helper and the fixes bundled with it.

Everything here is offline: the FastAPI TestClient talks to a temp SQLite file
and the mock LLM provider. The UI is plain static files, so "UI tests" check
that they are actually served, self-contained and wired to the app.
"""

from __future__ import annotations

import tomllib
from pathlib import Path

import pytest

from src import __version__
from src.api import WEB_DIR, create_app
from src.config import load_config
from src.desk.seed import seed_desk
from src.llm_client import MockLLMClient

ROOT = Path(__file__).resolve().parents[1]


class TestWebUI:
    def test_root_serves_the_spa(self, api_client):
        response = api_client.get("/")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        assert "TriageDesk" in response.text
        assert 'id="ticket-list"' in response.text

    def test_static_assets_are_served_locally(self, api_client):
        for name, fragment in (
            ("styles.css", ".ticket-row"),
            ("app.js", "auth/dev/agents"),
            ("i18n.js", "brandTagline"),
        ):
            response = api_client.get(f"/assets/{name}")
            assert response.status_code == 200, name
            assert fragment in response.text

        favicon = api_client.get("/favicon.ico")
        assert favicon.status_code == 200
        assert "svg" in favicon.headers["content-type"]

    def test_ui_has_no_external_dependencies(self, api_client):
        html = api_client.get("/").text
        assert "https://" not in html
        assert "http://" not in html
        assert html.count("/assets/") >= 3

    def test_openapi_docs_still_work_with_ui_mounted(self, api_client):
        assert api_client.get("/openapi.json").status_code == 200
        assert api_client.get("/docs").status_code == 200
        assert api_client.get("/health").status_code == 200

    def test_app_version_matches_package(self):
        metadata = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
        assert metadata["project"]["name"] == "triagedesk"
        assert metadata["project"]["version"] == __version__
        assert create_app().version == __version__
        assert WEB_DIR.joinpath("index.html").is_file()


class TestDevAuthHelper:
    def test_lists_active_agents_without_authentication(self, desk_api):
        response = desk_api.client.get("/auth/dev/agents")
        assert response.status_code == 200
        payload = response.json()
        assert payload["mode"] == "development"
        assert payload["header"] == "X-Agent-Id"
        assert payload["provider"] == "mock"
        ids = {item["id"] for item in payload["items"]}
        assert {desk_api.admin.agent_id, desk_api.agent.agent_id} <= ids
        # no emails, no secrets — just the three fields needed by the UI
        assert all(set(item) == {"id", "name", "role"} for item in payload["items"])

    def test_regular_desk_endpoints_still_require_auth(self, desk_api):
        assert desk_api.client.get("/tickets").status_code == 401
        assert desk_api.client.get("/auth/dev/agents").status_code == 200


class TestApiFixes:
    def test_remove_tag_returns_an_empty_204(self, desk_api):
        customer = desk_api.client.post(
            "/customers", json={"name": "Pat", "email": "pat@example.com"},
            headers=desk_api.admin_headers,
        ).json()
        ticket = desk_api.client.post(
            "/tickets",
            json={"customer_id": customer["id"], "subject": "Help", "message": "A question"},
            headers=desk_api.admin_headers,
        ).json()
        tag = desk_api.client.post(
            "/tags", json={"name": "vip"}, headers=desk_api.admin_headers
        ).json()
        desk_api.client.post(
            f"/tickets/{ticket['id']}/tags", json={"tag_id": tag["id"]},
            headers=desk_api.admin_headers,
        )
        response = desk_api.client.delete(
            f"/tickets/{ticket['id']}/tags/{tag['id']}", headers=desk_api.admin_headers
        )
        assert response.status_code == 204
        assert response.content == b""

    def test_customers_pagination_is_honoured(self, desk_api):
        for index in range(4):
            desk_api.client.post(
                "/customers", json={"name": f"Person {index}", "email": f"p{index}@example.com"},
                headers=desk_api.admin_headers,
            )
        first = desk_api.client.get(
            "/customers?limit=2&offset=0", headers=desk_api.admin_headers
        ).json()
        second = desk_api.client.get(
            "/customers?limit=2&offset=2", headers=desk_api.admin_headers
        ).json()
        assert len(first["items"]) == 2
        assert len(second["items"]) == 2
        assert {item["email"] for item in first["items"]}.isdisjoint(
            {item["email"] for item in second["items"]}
        )
        assert desk_api.client.get(
            "/customers?limit=0", headers=desk_api.admin_headers
        ).status_code == 422

    def test_store_counts_are_accurate(self, tmp_path):
        from src.desk.storage import DeskStore

        db = str(tmp_path / "counts.db")
        seed_desk(db)
        store = DeskStore(db)
        assert store.count_customers() == 4
        assert store.count_tickets() == 8
        assert store.count_tickets(statuses=["open"]) == len(
            store.list_tickets(statuses=["open"], limit=200)
        )
        assert store.count_tickets(search="no-such-customer-text") == 0
        assert store.count_customers("zzz-no-match") == 0

    def test_total_counts_all_matches_not_just_the_page(self, desk_api):
        for index in range(5):
            customer = desk_api.client.post(
                "/customers",
                json={"name": f"Team {index}", "email": f"team{index}@example.com"},
                headers=desk_api.admin_headers,
            ).json()
            desk_api.client.post(
                "/tickets",
                json={
                    "customer_id": customer["id"],
                    "subject": f"Question {index}",
                    "message": f"A distinct question number {index}",
                },
                headers=desk_api.admin_headers,
            )
        customers = desk_api.client.get(
            "/customers?limit=2", headers=desk_api.admin_headers
        ).json()
        tickets = desk_api.client.get(
            "/tickets?limit=2", headers=desk_api.admin_headers
        ).json()
        assert len(customers["items"]) == 2
        assert customers["total"] == 5
        assert len(tickets["items"]) == 2
        assert tickets["total"] == 5
        assert desk_api.client.get(
            "/audit?limit=3", headers=desk_api.admin_headers
        ).json()["total"] >= 10

    def test_invalid_filters_and_pagination_are_422(self, desk_api):
        headers = desk_api.admin_headers
        for query in (
            "/tickets?status=bogus",
            "/tickets?priority=bogus",
            "/tickets?status=open,wrong",
            "/tickets?limit=0",
            "/tickets?limit=500",
            "/tickets?offset=-1",
            "/audit?limit=0",
        ):
            response = desk_api.client.get(query, headers=headers)
            assert response.status_code == 422, query

    def test_invalid_status_patch_is_a_json_422(self, desk_api):
        customer = desk_api.client.post(
            "/customers", json={"name": "Zed", "email": "zed@example.com"},
            headers=desk_api.admin_headers,
        ).json()
        ticket = desk_api.client.post(
            "/tickets",
            json={"customer_id": customer["id"], "subject": "Hi", "message": "Hello there"},
            headers=desk_api.admin_headers,
        ).json()
        response = desk_api.client.patch(
            f"/tickets/{ticket['id']}", json={"status": "not-a-status"},
            headers=desk_api.admin_headers,
        )
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_status"

    def test_raw_domain_error_never_becomes_a_500(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from src.desk.api import register_desk_exception_handlers
        from src.desk.models import DeskValidationError

        app = FastAPI()
        register_desk_exception_handlers(app)

        @app.get("/boom")
        def boom():
            raise DeskValidationError("invalid domain value")

        response = TestClient(app, raise_server_exceptions=False).get("/boom")
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"


class TestConfigCompatibility:
    def test_current_prefix_wins_over_legacy(self, monkeypatch, tmp_path):
        monkeypatch.chdir(tmp_path)
        monkeypatch.setenv("TRIAGEDESK_DB_PATH", "data/new.db")
        monkeypatch.setenv("AI_INQUIRY_DB_PATH", "data/old.db")
        monkeypatch.setenv("TRIAGEDESK_PROVIDER", "mock")
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.setenv("TRIAGEDESK_OUTPUT_DIR", "reports")
        config = load_config()
        assert config.db_path == Path("data/new.db")
        assert config.provider == "mock"
        assert config.output_dir == Path("reports")

    def test_legacy_names_still_work(self, monkeypatch, tmp_path):
        monkeypatch.chdir(tmp_path)
        monkeypatch.delenv("TRIAGEDESK_DB_PATH", raising=False)
        monkeypatch.delenv("TRIAGEDESK_PROVIDER", raising=False)
        monkeypatch.delenv("LLM_PROVIDER", raising=False)
        monkeypatch.setenv("AI_INQUIRY_DB_PATH", "data/legacy.db")
        monkeypatch.setenv("AI_INQUIRY_PROVIDER", "mock")
        config = load_config()
        assert config.db_path == Path("data/legacy.db")
        assert config.provider == "mock"


class TestBilingualDemo:
    def test_chinese_dataset_has_the_same_shape(self, tmp_path):
        en = seed_desk(str(tmp_path / "en.db"))
        zh = seed_desk(str(tmp_path / "zh.db"), lang="zh")
        for key in ("agents", "customers", "tags", "tickets", "ai_analyzed", "ai_replies", "notes"):
            assert en[key] == zh[key], key
        assert zh["lang"] == "zh"

    def test_chinese_content_is_stored_and_localized_ai_works(self, tmp_path):
        db = str(tmp_path / "zh.db")
        seed_desk(db, lang="zh")
        from src.desk.storage import DeskStore

        tickets = DeskStore(db).list_tickets(limit=50)
        assert any("登录" in ticket.subject for ticket in tickets)
        drafts = [ticket for ticket in tickets if ticket.ai_reply]
        assert len(drafts) == 1
        assert "您好" in drafts[0].ai_reply

    def test_unknown_language_is_rejected(self, tmp_path):
        with pytest.raises(ValueError, match="unknown demo language"):
            seed_desk(str(tmp_path / "x.db"), lang="fr")

    def test_mock_classifies_chinese_text(self):
        client = MockLLMClient()
        payload = client.complete_structured(
            system_prompt="mock",
            user_content='{"customer_name":"赵敏","subject":"账单","message":"九月账单被重复扣款，请退款。"}',
            response_format={"json_schema": {"name": "ticket_analysis"}},
        ).payload
        assert payload["category"] == "Billing"
        assert payload["urgency"] == "high"
