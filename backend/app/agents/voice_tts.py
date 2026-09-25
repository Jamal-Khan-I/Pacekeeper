"""
Voice I/O (OS-Native TTS) Handler.
Uses pyttsx3/SAPI for offline spoken explanations.
"""

import threading
import pyttsx3


from backend.app.agents.logger_util import safe_print


class VoiceTTSHandler:

    def __init__(self):
        self._enabled = True

    def speak_text(self, text: str):
        """Speaks text asynchronously in a background thread to prevent UI blocking."""
        if not text or not self._enabled:
            return

        def _worker():
            try:
                engine = pyttsx3.init()
                engine.setProperty('rate', 170) # Word rate
                engine.say(text[:300]) # Speak first 300 chars summary
                engine.runAndWait()
            except Exception as e:
                safe_print(f"TTS Engine Warning: {e}")

        t = threading.Thread(target=_worker, daemon=True)
        t.start()


voice_tts = VoiceTTSHandler()
