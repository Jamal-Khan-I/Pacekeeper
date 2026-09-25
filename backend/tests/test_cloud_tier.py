"""
Tests for Phase 5 — Cloud Tier Swap-in, Settings Management, and Provider Abstraction.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.agents.model_client import model_client

client = TestClient(app)


def test_system_settings_endpoint():
    # 1. Get default settings
    resp = client.get("/api/system/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "active_tier" in data
    assert "cloud_provider" in data
    assert "has_gemini_key" in data
    assert "has_groq_key" in data

    # 2. Update settings to cloud tier with Gemini provider
    update_payload = {
        "active_tier": "cloud",
        "cloud_provider": "gemini",
        "gemini_model": "gemini-1.5-flash",
        "gemini_api_key": "AIzaSyTestGeminiKey123456"
    }
    post_resp = client.post("/api/system/settings", json=update_payload)
    assert post_resp.status_code == 200
    updated_data = post_resp.json()
    assert updated_data["active_tier"] == "cloud"
    assert updated_data["cloud_provider"] == "gemini"
    assert updated_data["has_gemini_key"] is True


def test_test_key_endpoint():
    # Ping test with invalid/dummy key (should return clean error result, not crash)
    payload = {
        "provider": "gemini",
        "api_key": "invalid_dummy_key_for_testing",
        "model": "gemini-1.5-flash"
    }
    resp = client.post("/api/system/test-key", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "success" in data
    assert "provider" in data
    assert data["provider"] == "Gemini"


def test_model_client_provider_routing():
    # 1. Test local Ollama routing
    res_local = model_client.generate(prompt="Hello local", provider="local")
    assert isinstance(res_local, str)
    assert len(res_local) > 0

    # 2. Test Gemini cloud fallback routing
    res_gemini = model_client.generate(
        prompt="Analyze answer sheet syllabus performance",
        provider="gemini",
        api_key=None,
        model="gemini-1.5-flash"
    )
    assert "Gemini" in res_gemini or "Calculus" in res_gemini

    # 3. Test Groq cloud fallback routing
    res_groq = model_client.generate(
        prompt="Ingest syllabus document",
        provider="groq",
        api_key=None,
        model="llama-3.2-11b-vision-preview"
    )
    assert "Groq" in res_groq or "Calculus" in res_groq


def test_agent_endpoints_with_cloud_provider():
    # Test analyze-answer-sheet API under Cloud Tier
    resp = client.post(
        "/api/agents/analyze-answer-sheet",
        data={
            "topic_hint": "Differential Calculus",
            "provider": "gemini",
            "model": "gemini-1.5-flash"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "diagnosis" in data
    assert data["diagnosis"]["overall_score"] >= 0.0

    # Test ingest-syllabus API under Cloud Tier
    ingest_resp = client.post(
        "/api/agents/ingest-syllabus",
        data={
            "provider": "groq",
            "model": "llama-3.2-11b-vision-preview"
        }
    )
    assert ingest_resp.status_code == 200
    ingest_data = ingest_resp.json()
    assert "extracted_topics" in ingest_data
    assert len(ingest_data["extracted_topics"]) > 0
