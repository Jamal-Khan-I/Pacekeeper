"""
Unified Model Client & Multi-Provider Abstraction Layer.
Supports Local Ollama (Moondream vision + Gemma 4 text), Google Gemini Cloud, Groq Cloud, OpenAI, Claude.
"""

import json
import urllib.request
import urllib.error
import base64
import datetime
from typing import Dict, Any, Optional, List, Union
from backend.app.agents.logger_util import safe_print


def _ts() -> str:
    """Returns current timestamp string for logs."""
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class UnifiedModelClient:

    def __init__(
        self,
        ollama_host: str = "http://localhost:11434",
        default_local_model: str = "gemma4:latest"
    ):
        self.ollama_host = ollama_host.rstrip("/")
        self.default_local_model = default_local_model
        # Best vision model to prefer for image requests
        self._vision_model_preference = ["moondream", "llava", "bakllava", "gemma4"]

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        images: Optional[List[str]] = None,
        provider: str = "local", # "local", "gemini", "groq"
        api_key: Optional[str] = None,
        model: Optional[str] = None
    ) -> str:
        """
        Routes generation requests to Local Ollama, Gemini Cloud, or Groq Cloud.
        """
        prov = (provider or "local").lower()

        if prov == "gemini":
            return self._generate_gemini(
                prompt=prompt,
                system_prompt=system_prompt,
                images=images,
                api_key=api_key,
                model=model or "gemini-1.5-flash"
            )

        if prov == "groq":
            return self._generate_groq(
                prompt=prompt,
                system_prompt=system_prompt,
                images=images,
                api_key=api_key,
                model=model or "llama-3.2-11b-vision-preview"
            )

        if prov in ["openai", "gpt"]:
            return self._generate_openai(
                prompt=prompt,
                system_prompt=system_prompt,
                images=images,
                api_key=api_key,
                model=model or "gpt-4o-mini"
            )

        if prov in ["claude", "anthropic"]:
            return self._generate_claude(
                prompt=prompt,
                system_prompt=system_prompt,
                images=images,
                api_key=api_key,
                model=model or "claude-3-5-sonnet-20241022"
            )

        # Default: Local Ollama daemon
        return self._generate_ollama(
            prompt=prompt,
            system_prompt=system_prompt,
            images=images,
            model=model or self.default_local_model
        )

    def _generate_gemini(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        images: Optional[List[str]] = None,
        api_key: Optional[str] = None,
        model: str = "gemini-1.5-flash"
    ) -> str:
        """Invokes Google Gemini REST API."""
        if not api_key:
            return self._cloud_fallback_response(prompt, images, provider="Gemini (Missing API Key)")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key.strip()}"
        
        parts = []
        if system_prompt:
            prompt_full = f"{system_prompt}\n\n{prompt}"
        else:
            prompt_full = prompt

        parts.append({"text": prompt_full})

        if images:
            for img_b64 in images:
                clean_b64 = img_b64.split(",")[-1] if "," in img_b64 else img_b64
                parts.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": clean_b64
                    }
                })

        payload = {
            "contents": [{"parts": parts}]
        }

        try:
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data_bytes,
                headers={"Content-Type": "application/json"}
            )
            res = urllib.request.urlopen(req, timeout=15)
            if res.status == 200:
                resp_json = json.loads(res.read().decode("utf-8", errors="replace"))
                candidates = resp_json.get("candidates", [])
                if candidates:
                    parts_resp = candidates[0].get("content", {}).get("parts", [])
                    if parts_resp:
                        return parts_resp[0].get("text", "")
        except Exception as e:
            safe_print(f"Gemini API error: {e}")

        return self._cloud_fallback_response(prompt, images, provider=f"Gemini Cloud ({model})")

    def _generate_groq(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        images: Optional[List[str]] = None,
        api_key: Optional[str] = None,
        model: str = "llama-3.2-11b-vision-preview"
    ) -> str:
        """Invokes Groq Cloud Chat Completions API."""
        if not api_key:
            return self._cloud_fallback_response(prompt, images, provider="Groq (Missing API Key)")

        url = "https://api.groq.com/openai/v1/chat/completions"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        user_content = []
        user_content.append({"type": "text", "text": prompt})

        if images:
            for img_b64 in images:
                clean_b64 = img_b64.split(",")[-1] if "," in img_b64 else img_b64
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{clean_b64}"}
                })

        messages.append({"role": "user", "content": user_content})

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.2
        }

        try:
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data_bytes,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key.strip()}"
                }
            )
            res = urllib.request.urlopen(req, timeout=15)
            if res.status == 200:
                resp_json = json.loads(res.read().decode("utf-8", errors="replace"))
                choices = resp_json.get("choices", [])
                if choices:
                    return choices[0].get("message", {}).get("content", "")
        except Exception as e:
            safe_print(f"Groq API error: {e}")

        return self._cloud_fallback_response(prompt, images, provider=f"Groq Cloud ({model})")

    def _generate_openai(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        images: Optional[List[str]] = None,
        api_key: Optional[str] = None,
        model: str = "gpt-4o-mini"
    ) -> str:
        """Invokes OpenAI Chat Completions API."""
        if not api_key:
            return self._cloud_fallback_response(prompt, images, provider="OpenAI (Missing API Key)")

        url = "https://api.openai.com/v1/chat/completions"
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {"model": model, "messages": messages, "temperature": 0.2}

        try:
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data_bytes,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key.strip()}"
                }
            )
            res = urllib.request.urlopen(req, timeout=15)
            if res.status == 200:
                resp_json = json.loads(res.read().decode("utf-8", errors="replace"))
                choices = resp_json.get("choices", [])
                if choices:
                    return choices[0].get("message", {}).get("content", "")
        except Exception as e:
            safe_print(f"OpenAI API error: {e}")

        return self._cloud_fallback_response(prompt, images, provider=f"OpenAI Cloud ({model})")

    def _generate_claude(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        images: Optional[List[str]] = None,
        api_key: Optional[str] = None,
        model: str = "claude-3-5-sonnet-20241022"
    ) -> str:
        """Invokes Anthropic Claude Messages API."""
        if not api_key:
            return self._cloud_fallback_response(prompt, images, provider="Claude (Missing API Key)")

        url = "https://api.anthropic.com/v1/messages"
        payload = {
            "model": model,
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}]
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data_bytes,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": api_key.strip(),
                    "anthropic-version": "2023-06-01"
                }
            )
            res = urllib.request.urlopen(req, timeout=15)
            if res.status == 200:
                resp_json = json.loads(res.read().decode("utf-8", errors="replace"))
                content_list = resp_json.get("content", [])
                if content_list:
                    return content_list[0].get("text", "")
        except Exception as e:
            safe_print(f"Claude API error: {e}")

        return self._cloud_fallback_response(prompt, images, provider=f"Anthropic Claude ({model})")

    def _generate_ollama(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        images: Optional[List[str]] = None,
        model: Optional[str] = None
    ) -> str:
        """Sends request to local Ollama daemon with explicit vision-model routing and timestamped logging."""
        ts = _ts()

        # 1. Query installed models
        installed_models = []
        try:
            req_tags = urllib.request.urlopen(f"{self.ollama_host}/api/tags", timeout=3)
            if req_tags.status == 200:
                tags_data = json.loads(req_tags.read().decode("utf-8", errors="replace"))
                installed_models = [m.get("name") for m in tags_data.get("models", [])]
        except Exception as e:
            safe_print(f"[{ts}] [AI Pipeline] Provider: local | Ollama Unreachable: {e}")
            return self._error_response(f"Ollama unreachable: {e}")

        # 2. Pick best model for the request type
        model_to_use = model
        if not model_to_use or model_to_use in ["gemma4:e4b", "auto"]:
            if images:
                # Prefer dedicated vision models for image input
                vision_candidates = [
                    m for m in installed_models
                    if any(v in m.lower() for v in self._vision_model_preference)
                ]
                # Sort by preference order
                for pref in self._vision_model_preference:
                    for candidate in vision_candidates:
                        if pref in candidate.lower():
                            model_to_use = candidate
                            break
                    if model_to_use:
                        break
                if not model_to_use:
                    model_to_use = installed_models[0] if installed_models else "gemma4:latest"
            else:
                model_to_use = installed_models[0] if installed_models else "gemma4:latest"

        has_images = bool(images)
        safe_print(f"[{ts}] [AI Pipeline] Provider: local | Model: {model_to_use} | Images: {len(images) if images else 0} | Fallback Fired: False")

        payload: dict = {
            "model": model_to_use,
            "prompt": prompt,
            "stream": False
        }
        if system_prompt:
            payload["system"] = system_prompt
        if images:
            payload["images"] = images

        try:
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                f"{self.ollama_host}/api/generate",
                data=data_bytes,
                headers={"Content-Type": "application/json"}
            )
            res = urllib.request.urlopen(req, timeout=60)
            if res.status == 200:
                resp_json = json.loads(res.read().decode("utf-8", errors="replace"))
                resp_text = resp_json.get("response", "")
                ts2 = _ts()
                try:
                    safe_print(f"[{ts2}] [AI Pipeline Raw Output] Model={model_to_use} | Preview: {repr(resp_text[:400])}")
                except Exception:
                    pass
                if resp_text:
                    return resp_text
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else str(e)
            ts2 = _ts()
            safe_print(f"[{ts2}] [AI Pipeline] Provider: local | Model: {model_to_use} | HTTP Error {e.code}: {err_body}")
            return self._error_response(f"Ollama HTTP {e.code} error: {err_body}")
        except Exception as e:
            ts2 = _ts()
            safe_print(f"[{ts2}] [AI Pipeline] Provider: local | Model: {model_to_use} | Fallback Fired: True | Error: {e}")
            return self._error_response(f"Ollama request failed: {e}")

        ts2 = _ts()
        safe_print(f"[{ts2}] [AI Pipeline] Provider: local | Model: {model_to_use} | Fallback Fired: True | Empty response from model")
        return self._error_response(f"Empty response from {model_to_use}")

    def _error_response(self, reason: str) -> str:
        """Returns a transparent error JSON rather than hardcoded Calculus fixture."""
        ts = _ts()
        safe_print(f"[{ts}] [AI Pipeline] Fallback Fired: True | Reason: {reason}")
        return json.dumps({
            "overall_score": 0.0,
            "detected_topic": "Unable to determine — AI pipeline error",
            "weak_question_types": [],
            "question_breakdown": {},
            "diagnostic_summary": f"AI evaluation failed: {reason}. Please check logs and ensure the model is running.",
            "_pipeline_error": reason
        })

    def _cloud_fallback_response(self, prompt: str, images: Optional[List[str]], provider: str) -> str:
        """Transparent fallback — no hardcoded content, returns honest error for surface-level feedback."""
        ts = _ts()
        reason = f"Provider '{provider}' unavailable or returned empty response"
        safe_print(f"[{ts}] [AI Pipeline] Provider: {provider} | Fallback Fired: True | Reason: {reason}")
        return self._error_response(reason)

    def _cloud_log(self, ts: str, provider: str, model: str, fallback: bool, raw_preview: str = "") -> None:
        """Unified log line for all cloud providers."""
        safe_print(f"[{ts}] [AI Pipeline] Provider: {provider} | Model: {model} | Fallback Fired: {fallback}")
        if raw_preview:
            try:
                safe_print(f"[{ts}] [AI Pipeline Raw Output] Provider={provider} | Preview: {repr(raw_preview[:400])}")
            except Exception:
                pass

    def test_connection(self, provider: str, api_key: str, model: Optional[str] = None) -> Dict[str, Any]:
        """Validates API Key with lightweight ping request."""
        prov = (provider or "").lower()
        if not api_key or not api_key.strip():
            return {"success": False, "provider": provider, "message": "API key cannot be empty."}

        key = api_key.strip()

        if prov in ["openai", "gpt"]:
            url = "https://api.openai.com/v1/models"
            try:
                req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}"})
                res = urllib.request.urlopen(req, timeout=8)
                if res.status == 200:
                    return {"success": True, "provider": "OpenAI", "message": "Successfully connected to OpenAI API."}
            except Exception as e:
                return {"success": False, "provider": "OpenAI", "message": f"OpenAI connection failed: {str(e)}"}

        elif prov in ["claude", "anthropic"]:
            url = "https://api.anthropic.com/v1/messages"
            payload = {"model": "claude-3-5-sonnet-20241022", "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]}
            try:
                data_bytes = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=data_bytes,
                    headers={"Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01"}
                )
                res = urllib.request.urlopen(req, timeout=8)
                if res.status == 200:
                    return {"success": True, "provider": "Claude", "message": "Successfully connected to Anthropic Claude API."}
            except Exception as e:
                return {"success": False, "provider": "Claude", "message": f"Claude connection failed: {str(e)}"}

        elif prov == "gemini":
            mod = model or "gemini-1.5-flash"
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{mod}:generateContent?key={key}"
            payload = {"contents": [{"parts": [{"text": "Hello"}]}]}
            try:
                data_bytes = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(url, data=data_bytes, headers={"Content-Type": "application/json"})
                res = urllib.request.urlopen(req, timeout=8)
                if res.status == 200:
                    return {"success": True, "provider": "Gemini", "message": "Successfully connected to Gemini API."}
            except Exception as e:
                return {"success": False, "provider": "Gemini", "message": f"Gemini connection failed: {str(e)}"}

        elif prov == "groq":
            url = "https://api.groq.com/openai/v1/models"
            try:
                req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}"})
                res = urllib.request.urlopen(req, timeout=8)
                if res.status == 200:
                    return {"success": True, "provider": "Groq", "message": "Successfully connected to Groq API."}
            except Exception as e:
                return {"success": False, "provider": "Groq", "message": f"Groq connection failed: {str(e)}"}

        # Generic success response for user-provided custom API key
        return {"success": True, "provider": provider.title(), "message": f"API key configured for {provider.title()}."}


# Global client instance
model_client = UnifiedModelClient()
