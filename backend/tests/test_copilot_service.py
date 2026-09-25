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

def test_copilot_image_diagnosis_tool():
    """Verifies image diagnosis in Copilot chat without base64 or source argument errors."""
    from unittest.mock import patch
    from backend.app.agents.performance_analyst import performance_analyst_agent
    from backend.app.agents.model_client import model_client

    _system_settings_state["active_tier"] = "local"
    mock_diag = '{"overall_score": 0.45, "detected_topic": "Calculus Derivatives & Chain Rule", "weak_question_types": ["Chain Rule"], "question_breakdown": {}, "diagnostic_summary": "Diagnosis completed."}'

    def mock_generate(*args, **kwargs):
        prompt = kwargs.get("prompt") or (args[0] if args else "")
        if "student answer sheet" in prompt.lower() or "transcript" in prompt.lower() or "ocr" in prompt.lower():
            return mock_diag
        return "I have diagnosed Alex Mercer's answer sheet and identified errors in the Chain Rule."

    with patch.object(model_client, 'generate', side_effect=mock_generate):
        response = client.post(
            "/api/agents/copilot/chat",
            json={
                "message": "Please analyze this student answer sheet.",
                "image_base64": "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9h",
                "filename": "class_a_math_calculus_chain_rule_error.jpg",
                "class_id": "class_a"
            }
        )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "diagnose_answer_sheet" in data["actions_taken"]
    assert data["diagnosis"] is not None
    assert "Calculus" in data["diagnosis"]["detected_topic"]

    # Reset tier back to free
    _system_settings_state["active_tier"] = "free"


def test_copilot_knows_class_marks_and_schedule():
    """Verifies that Copilot prompt contains live database ground truth: marks, average score, topics, timetable."""
    from unittest.mock import patch
    from backend.app.agents.model_client import model_client

    _system_settings_state["active_tier"] = "local"
    captured_prompts = []

    def mock_gen(*args, **kwargs):
        prompt = kwargs.get("prompt") or (args[0] if args else "")
        captured_prompts.append(prompt)
        return "Class 11-A average score is 61% based on database performance records."

    with patch.object(model_client, 'generate', side_effect=mock_gen):
        response = client.post(
            "/api/agents/copilot/chat",
            json={
                "message": "Give me a diagnostic snapshot of our class performance and average score.",
                "class_id": "class_a"
            }
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(captured_prompts) > 0
    prompt_text = captured_prompts[0]

    # Verify real-time database context was provided to the LLM
    assert "LIVE CLASSROOM CONTEXT" in prompt_text
    assert "Overall Class Performance Average" in prompt_text
    assert "Calculus Derivatives & Chain Rule" in prompt_text
    assert "Upcoming Teaching Lessons" in prompt_text or "Syllabus Topics" in prompt_text

    _system_settings_state["active_tier"] = "free"

