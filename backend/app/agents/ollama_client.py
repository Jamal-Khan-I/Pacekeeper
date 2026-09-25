"""
Ollama Connection Handler & Local Model Interface.
Provides communication with local Ollama daemon with transparent error handling.

CRITICAL FIX: Removed ALL hardcoded academic content from _local_fallback_generate.
Every call now logs: timestamp, model, Fallback Fired status, and raw output preview.
On failure, returns a transparent _pipeline_error JSON so the UI shows a clear error
instead of a fake calculus diagnosis.
"""

import datetime
import urllib.request
import urllib.error
import json
import re
from typing import Dict, Any, Optional, List
from backend.app.agents.logger_util import safe_print


def _ts() -> str:
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class OllamaClient:

    def __init__(self, host: str = "http://localhost:11434", default_model: str = "gemma4:latest"):
        self.host = host.rstrip("/")
        self.default_model = default_model

    def check_health(self) -> Dict[str, Any]:
        """Checks if local Ollama daemon is reachable and lists installed models."""
        try:
            req = urllib.request.urlopen(f"{self.host}/api/tags", timeout=3)
            if req.status == 200:
                data = json.loads(req.read().decode("utf-8", errors="replace"))
                models = [m.get("name") for m in data.get("models", [])]
                safe_print(f"[{_ts()}] [OllamaClient] Health check: connected | Models: {models}")
                return {
                    "available": True,
                    "status": "connected",
                    "models": models,
                    "default_model": self.default_model
                }
        except Exception as e:
            safe_print(f"[{_ts()}] [OllamaClient] Health check: OFFLINE | Error: {e}")

        return {
            "available": False,
            "status": "offline",
            "models": [],
            "message": "Local Ollama daemon not reachable at http://localhost:11434."
        }

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        images: Optional[List[str]] = None,
        model: Optional[str] = None
    ) -> str:
        """
        Sends text/image prompt to Ollama model.
        Logs every call with timestamp, model, image count, fallback status.
        Returns transparent _pipeline_error JSON on failure — NO hardcoded content.
        """
        ts = _ts()
        model_to_use = model or self.default_model

        # Sanitize images: strip data:image/...;base64, prefixes and whitespace
        clean_images = []
        if images:
            for img in images:
                if not img or not isinstance(img, str):
                    continue
                s = img.strip()
                if "," in s and ("data:" in s[:30] or ";base64" in s[:30]):
                    s = s.split(",", 1)[1]
                s = re.sub(r'\s+', '', s)
                if s:
                    clean_images.append(s)

        safe_print(
            f"[{ts}] [OllamaClient] Sending request | "
            f"Model: {model_to_use} | "
            f"Images: {len(clean_images)} | "
            f"Fallback Fired: False (attempting real call)"
        )

        payload = {
            "model": model_to_use,
            "prompt": prompt,
            "stream": False
        }
        if system_prompt:
            payload["system"] = system_prompt
        if clean_images:
            payload["images"] = clean_images

        try:
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                f"{self.host}/api/generate",
                data=data_bytes,
                headers={"Content-Type": "application/json"}
            )
            res = urllib.request.urlopen(req, timeout=90)
            if res.status == 200:
                resp_json = json.loads(res.read().decode("utf-8", errors="replace"))
                resp_text = resp_json.get("response", "")
                ts2 = _ts()
                try:
                    safe_print(
                        f"[{ts2}] [OllamaClient] REAL RESPONSE RECEIVED | "
                        f"Fallback Fired: False | "
                        f"Model: {model_to_use} | "
                        f"Length: {len(resp_text)} chars | "
                        f"Raw preview: {repr(resp_text[:400])}"
                    )
                except Exception:
                    pass
                if resp_text:
                    return resp_text
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else str(e)
            ts2 = _ts()
            safe_print(f"[{ts2}] [OllamaClient] HTTP ERROR | Fallback Fired: True | Code: {e.code} | Body: {err_body}")
            return self._transparent_error(f"Ollama HTTP {e.code}: {err_body[:200]}")
        except Exception as e:
            ts2 = _ts()
            safe_print(f"[{ts2}] [OllamaClient] EXCEPTION | Fallback Fired: True | Error: {e}")
            return self._transparent_error(f"Ollama request failed: {e}")

        ts2 = _ts()
        safe_print(f"[{ts2}] [OllamaClient] EMPTY RESPONSE | Fallback Fired: True | Model: {model_to_use}")
        return self._transparent_error(f"Empty response from model '{model_to_use}'")

    def _transparent_error(self, reason: str) -> str:
        """
        Returns a transparent pipeline error JSON — absolutely NO hardcoded academic content.
        The PerformanceAnalystAgent parses _pipeline_error and surfaces it in the UI.
        """
        safe_print(f"[{_ts()}] [OllamaClient] _transparent_error: {reason}")
        return json.dumps({
            "overall_score": 0.0,
            "detected_topic": "Unable to determine — Ollama pipeline error",
            "weak_question_types": [],
            "question_breakdown": {},
            "diagnostic_summary": (
                f"Ollama AI pipeline failed: {reason}. "
                "Ensure Ollama is running ('ollama serve') and the model is installed."
            ),
            "_pipeline_error": reason
        })


# Global client instance
ollama_client = OllamaClient()
