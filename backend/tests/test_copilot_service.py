"""
Unit & Integration tests for Teacher Copilot Agent Service.
Tests tier gating (locked in Free tier, active in Local/Cloud tiers),
auto-rescheduling, diagram generation, and notification triggering.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.api.system import _system_settings_state

client = TestClient(app)


def test_copilot_locked_in_free_tier():
    """Verifies that Teacher Copilot AI is strictly locked in Free Tier."""
    _system_settings_state["active_tier"] = "free"
    response = client.post(
        "/api/agents/copilot/chat",
        json={
            "message": "Hello Copilot, how are our classes doing today?",
            "class_id": "class_a"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "locked"
    assert "reserved for Local LLM and Cloud Tiers" in data["reply"]
    assert data["tier_used"] == "free"


def test_copilot_active_in_local_tier():
    """Verifies that Teacher Copilot AI is fully active when on Local LLM tier."""
    _system_settings_state["active_tier"] = "local"
    response = client.post(
        "/api/agents/copilot/chat",
        json={
            "message": "Hello Copilot, summarize Class 11-A status",
            "class_id": "class_a"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "reply" in data
    assert "spoken_text" in data
    assert data["tier_used"] == "local"


def test_copilot_reschedule_tool():
    """Verifies tool calling for automated rescheduling in Local tier."""
    _system_settings_state["active_tier"] = "local"
    response = client.post(
        "/api/agents/copilot/chat",
        json={
            "message": "Please reschedule our class curriculum to add extra revision blocks",
            "class_id": "class_a"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "reschedule_curriculum" in data["actions_taken"] or "auto_reschedule" in data["actions_taken"]
    assert data["updated_schedule"] is not None
    assert data["diagram_code"] is not None


def test_copilot_notification_tool():
    """Verifies tool calling for dispatching classroom revision notifications."""
    _system_settings_state["active_tier"] = "local"
    response = client.post(
        "/api/agents/copilot/chat",
        json={
            "message": "Send revision notification alerts to the desktop now",
            "class_id": "class_a"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "send_notifications" in data["actions_taken"]
    assert "notifications_count" in data


def test_copilot_diagram_tool():
    """Verifies tool calling for generating Mermaid schedule diagrams."""
    _system_settings_state["active_tier"] = "local"
    response = client.post(
        "/api/agents/copilot/chat",
        json={
            "message": "Draw a schedule diagram for Class 11-A",
            "class_id": "class_a"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["diagram_code"] is not None
    assert "gantt" in data["diagram_code"]

    # Reset tier back to free
    _system_settings_state["active_tier"] = "free"
