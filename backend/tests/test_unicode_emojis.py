"""
Tests verifying that Unicode emojis and special characters do NOT trigger
Windows 'charmap' / cp1252 codec errors in logging, Ollama/model client, or Copilot.
"""

import pytest
from backend.app.agents.logger_util import safe_print
from backend.app.agents.model_client import model_client
from backend.app.agents.performance_analyst import performance_analyst_agent


def test_safe_print_handles_emojis_without_exception():
    """Verifies safe_print does not crash even with non-cp1252 characters."""
    emoji_string = "Testing emojis: ✅ \u2705 🎯 \U0001f3af 💡 \U0001f4a1 🗓️ ⭐ Phase I"
    # Should run with zero exceptions
    safe_print(emoji_string)
    safe_print("Preview:", repr(emoji_string))


def test_model_client_error_response_handles_emojis():
    """Verifies that _error_response does not fail when reason contains emojis."""
    emoji_reason = "Model error: \u2705 \U0001f3af failed to load topic"
    resp = model_client._error_response(emoji_reason)
    assert "overall_score" in resp
    assert "_pipeline_error" in resp
    assert "\u2705" in resp or "\\u2705" in resp


def test_performance_analyst_handles_non_json_with_emojis():
    """Verifies that diagnosis parser does not crash when raw response contains emojis."""
    raw_markdown_with_emojis = (
        "Hello! Here is your syllabus plan:\n"
        "#### ✅ Phase I: The Foundation\n"
        "### 🎯 Concrete Classroom Interventions\n"
        "1. Daily 15-min quiz\n"
    )
    diagnosis = performance_analyst_agent._parse_diagnosis(raw_markdown_with_emojis)
    assert diagnosis is not None
    assert diagnosis.overall_score == 0.0
    assert "Parse Error" in diagnosis.detected_topic or "Diagnosis completed" in diagnosis.diagnostic_summary or "The AI model responded" in diagnosis.diagnostic_summary


def test_prepare_image_base64_strips_data_uri_and_whitespace():
    """Verifies that data URI headers (data:image/jpeg;base64,) and whitespace are thoroughly stripped."""
    data_uri = "data:image/jpeg;base64,  iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMElEQVR42mNk+M9QDwADEAE5gA=="
    clean = performance_analyst_agent._prepare_image_base64(data_uri)
    assert not clean.startswith("data:")
    assert ":" not in clean
    assert " " not in clean
    assert clean.startswith("iVBOR")


from unittest.mock import patch


def test_analyze_answer_sheet_accepts_source_parameter():
    """Verifies that analyze_answer_sheet accepts source='copilot' without TypeError."""
    mock_json = '{"overall_score": 0.5, "detected_topic": "Calculus Derivatives", "weak_question_types": [], "question_breakdown": {}, "diagnostic_summary": "OK"}'
    with patch.object(performance_analyst_agent.client, 'generate', return_value=mock_json):
        diag = performance_analyst_agent.analyze_answer_sheet(
            image_input="data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUg==",
            filename="class_a_math_calculus_chain_rule_error.jpg",
            provider="rule_based",
            source="copilot"
        )
        assert diag is not None
        assert diag.detected_topic == "Calculus Derivatives"
        assert diag.overall_score == 0.5
