"""
Unit & Integration tests for Teacher Copilot Agent Service.
Tests multimodal chat, auto-rescheduling, diagram generation, and notification triggering.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.database import SessionLocal
from backend.app.db.models import TopicDB, ScheduleStateDB

client = TestClient(app)


def test_copilot_chat_basic():
    response = client.post(
        "/api/agents/copilot/chat",
        json={
            "message": "Hello Copilot, how are our classes doing today?",
            "class_id": "class_a"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "reply" in data
    assert "spoken_text" in data
    assert isinstance(data["actions_taken"], list)


def test_copilot_chat_reschedule_tool():
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


def test_copilot_chat_notification_tool():
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


def test_copilot_chat_diagram_tool():
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
