"""
API Router for System Status, Tier Info, and Cloud Settings.
"""

from typing import Dict, Any
from fastapi import APIRouter, HTTPException, status
from backend.app.schemas.api_schemas import (
    TierInfoResponse,
    SystemSettingsSchema,
    SystemSettingsUpdate,
    TestKeyRequest,
    TestKeyResponse
)
from backend.app.agents.model_client import model_client

router = APIRouter(prefix="/api/system", tags=["System"])

# Global System Settings State
_system_settings_state = {
    "active_tier": "free", # "free", "local", "cloud"
    "cloud_provider": "gemini", # "gemini", "groq"
    "gemini_model": "gemini-1.5-flash",
    "groq_model": "llama-3.2-11b-vision-preview",
    "local_model": "gemma4:latest",
    "gemini_api_key": "",
    "groq_api_key": ""
}


def get_current_system_settings() -> Dict[str, Any]:
    return _system_settings_state


@router.get("/tier-info", response_model=TierInfoResponse)
def get_tier_info():
    return TierInfoResponse(tier=_system_settings_state["active_tier"], available_tiers=["free", "local", "cloud"])


@router.get("/settings", response_model=SystemSettingsSchema)
def get_system_settings():
    gemini_key = _system_settings_state.get("gemini_api_key", "")
    groq_key = _system_settings_state.get("groq_api_key", "")

    return SystemSettingsSchema(
        active_tier=_system_settings_state["active_tier"],
        cloud_provider=_system_settings_state["cloud_provider"],
        gemini_model=_system_settings_state["gemini_model"],
        groq_model=_system_settings_state["groq_model"],
        local_model=_system_settings_state["local_model"],
        gemini_api_key=gemini_key[:6] + "..." if len(gemini_key) > 6 else (gemini_key or None),
        groq_api_key=groq_key[:6] + "..." if len(groq_key) > 6 else (groq_key or None),
        has_gemini_key=bool(gemini_key and len(gemini_key.strip()) > 5),
        has_groq_key=bool(groq_key and len(groq_key.strip()) > 5)
    )


@router.post("/settings", response_model=SystemSettingsSchema)
def update_system_settings(payload: SystemSettingsUpdate):
    if payload.active_tier is not None:
        _system_settings_state["active_tier"] = payload.active_tier
    if payload.cloud_provider is not None:
        _system_settings_state["cloud_provider"] = payload.cloud_provider
    if payload.gemini_model is not None:
        _system_settings_state["gemini_model"] = payload.gemini_model
    if payload.groq_model is not None:
        _system_settings_state["groq_model"] = payload.groq_model
    if payload.local_model is not None:
        _system_settings_state["local_model"] = payload.local_model

    if payload.gemini_api_key is not None and not payload.gemini_api_key.endswith("..."):
        _system_settings_state["gemini_api_key"] = payload.gemini_api_key.strip()
    if payload.groq_api_key is not None and not payload.groq_api_key.endswith("..."):
        _system_settings_state["groq_api_key"] = payload.groq_api_key.strip()

    return get_system_settings()


@router.post("/test-key", response_model=TestKeyResponse)
def test_api_key(payload: TestKeyRequest):
    key_to_use = payload.api_key.strip()
    # If masked key sent, check if we have stored key
    if key_to_use.endswith("..."):
        if payload.provider.lower() == "gemini":
            key_to_use = _system_settings_state.get("gemini_api_key", "")
        elif payload.provider.lower() == "groq":
            key_to_use = _system_settings_state.get("groq_api_key", "")

    result = model_client.test_connection(
        provider=payload.provider,
        api_key=key_to_use,
        model=payload.model
    )

    return TestKeyResponse(
        success=result["success"],
        provider=result["provider"],
        message=result["message"]
    )
