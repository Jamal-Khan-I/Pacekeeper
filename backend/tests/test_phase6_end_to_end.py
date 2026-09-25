"""
Phase 6 End-to-End Integration Tests.
Tests OS Notifications, .ics Calendar Export, and Desktop System Integrity.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_os_notification_endpoint():
    resp = client.post("/api/schedule/notify")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "notifications_count" in data
    assert isinstance(data["notifications"], list)


def test_ics_export_endpoint():
    resp = client.get("/api/schedule/export-ics")
    assert resp.status_code == 200
    assert "text/calendar" in resp.headers["content-type"]
    assert "attachment" in resp.headers["content-disposition"]
    ics_text = resp.text
    assert "BEGIN:VCALENDAR" in ics_text
    assert "END:VCALENDAR" in ics_text
    assert "Pacekeeper" in ics_text


def test_full_workflow_end_to_end():
    # 1. Get topics
    topics_resp = client.get("/api/topics")
    assert topics_resp.status_code == 200

    # 2. Get current schedule
    sched_resp = client.get("/api/schedule/current")
    assert sched_resp.status_code == 200
    sched_data = sched_resp.json()
    assert "teaching_sessions" in sched_data
    assert "revision_sessions" in sched_data

    # 3. Submit performance score
    perf_payload = {
        "topic_id": topics_resp.json()[0]["id"] if len(topics_resp.json()) > 0 else "top_1",
        "score": 0.40,
        "test_date": "2026-09-25",
        "raw_score": 40.0
    }
    perf_resp = client.post("/api/performance", json=perf_payload)
    assert perf_resp.status_code in [200, 201]

    # 4. Export updated schedule as .ics
    ics_resp = client.get("/api/schedule/export-ics")
    assert ics_resp.status_code == 200
    assert "BEGIN:VCALENDAR" in ics_resp.text
