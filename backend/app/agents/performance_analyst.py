"""
Performance Analyst Agent.
Analyzes photographed/captured student answer sheets to diagnose specific topic performance gaps,
question-type weaknesses (MCQ vs Derivation), subtopic matches, and exam-weightage penalties.

Logging: Every call prints [AI Pipeline] lines with timestamp, provider, model, fallback status,
and the first 400 chars of raw model output so you can verify the diagnosis reflects the image.
"""

import os
import re
import json
import base64
import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from backend.app.agents.model_client import model_client


def _ts() -> str:
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class QuestionAnalysis(BaseModel):
    status: str                  # "correct", "incorrect", "partial"
    score: float                 # 0.0 to 1.0
    type: str                    # "MCQ", "Derivation", "Essay", "Numerical"
    error_reason: Optional[str] = None
    subtopic_name: Optional[str] = None
    exam_weightage: float = 15.0


class AnswerSheetDiagnosis(BaseModel):
    overall_score: float = Field(..., ge=0.0, le=1.0, description="Overall test score 0.0 to 1.0")
    detected_topic: str = Field(..., description="Main topic identified in answer sheet")
    weak_question_types: List[str] = Field(default_factory=list, description="Question types where student lost points")
    question_breakdown: Dict[str, QuestionAnalysis] = Field(default_factory=dict)
    diagnostic_summary: str = Field(..., description="Natural language diagnostic explanation")
    weighted_penalty_score: float = Field(default=0.0, description="Exam-weightage error impact penalty")


class PerformanceAnalystAgent:

    def __init__(self, client=None):
        self.client = client or model_client
        self.transcripts = {}
        try:
            # Look up demo_data/transcripts.json
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            t_path = os.path.join(base_dir, "demo_data", "transcripts.json")
            if os.path.exists(t_path):
                with open(t_path, "r", encoding="utf-8") as f:
                    self.transcripts = json.load(f)
                print(f"[{_ts()}] [PerformanceAnalystAgent] Loaded {len(self.transcripts)} transcripts from {t_path}")
        except Exception as e:
            print(f"[{_ts()}] [PerformanceAnalystAgent] Could not load demo transcripts: {e}")

    def analyze_answer_sheet(
        self,
        image_input: str,
        topic_hint: Optional[str] = None,
        available_topics: Optional[List[Dict[str, Any]]] = None,
        provider: str = "local",
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        class_id: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> AnswerSheetDiagnosis:
        """
        Processes a photographed answer sheet image and returns structured diagnosis.
        Logs timestamp, provider, model, and raw output for every call.
        image_input: File path to image or base64 string
        """
        ts = _ts()
        base64_image = self._prepare_image_base64(image_input)

        # Check for transcript matching this filename or demo sheet
        transcript = None
        if filename:
            bname = os.path.basename(filename)
            transcript = self.transcripts.get(bname)

        print(f"[{ts}] [PerformanceAnalystAgent] Starting analysis | Provider={provider} | ClassID={class_id or 'default'} | File={filename or 'none'} | Transcript={'FOUND' if transcript else 'NONE'} | Image={'YES' if base64_image else 'NO'}")

        system_prompt = (
            "You are an expert academic evaluator AI with OCR capability. "
            "Read ALL text visible in the student answer sheet image or transcript carefully. "
            "Identify the subject/topic, each question number, question type (MCQ, Derivation, Calculation, Proof), "
            "the student's written answer, whether it is correct or incorrect, and what the error was if any. "
            "Match recognized questions against the syllabus context provided. "
            "Weight error severity by each subtopic's exam weightage percentage. "
            "CRITICAL: If the input is clearly a non-academic photo (e.g. landscape, wallpaper, nature, animal) with no academic coursework: "
            "return overall_score: 0.0, detected_topic: 'Non-academic image', weak_question_types: [], question_breakdown: {}, "
            "and explain in diagnostic_summary that this is a non-academic photo and contains no student coursework. "
            "CRITICAL: Your output must be ONLY valid JSON with these exact keys: "
            "overall_score (float 0.0-1.0), detected_topic (string), "
            "weak_question_types (list of strings), "
            "question_breakdown (object mapping q_id to {status, score, type, error_reason, subtopic_name, exam_weightage}), "
            "diagnostic_summary (string). "
            "Do NOT add any text outside the JSON object."
        )

        syllabus_ctx = json.dumps(available_topics or [
            {"name": "Calculus Integration", "subject": "Mathematics", "exam_weightage": 30.0},
            {"name": "Quantum Mechanics", "subject": "Physics", "exam_weightage": 25.0},
            {"name": "Organic Chemistry", "subject": "Chemistry", "exam_weightage": 20.0},
            {"name": "Cell Biology", "subject": "Biology", "exam_weightage": 10.0}
        ])

        if transcript:
            prompt = (
                f"Analyze the following student answer sheet / image transcript:\n"
                f'"""\n{transcript}\n"""\n\n'
                f"Topic hint (use for context, not as assumption): {topic_hint or 'Auto-detect from content'}. "
                f"Available syllabus topics: {syllabus_ctx}. "
                "Analyze each visible question, the student's answer, and whether it was correct or what the error was. "
                "If it is a non-academic photo or artwork, return score 0.0 and state that no academic questions were found. "
                "Return ONLY a valid JSON object with keys: overall_score, detected_topic, weak_question_types, question_breakdown, diagnostic_summary. "
                "The diagnosis MUST reflect what is actually written, not generic or hardcoded content."
            )
        else:
            prompt = (
                f"Carefully read all text in this answer sheet image using OCR. "
                f"Topic hint (use for context, not as assumption): {topic_hint or 'Auto-detect from image content'}. "
                f"Available syllabus topics: {syllabus_ctx}. "
                "Analyze each visible question and student answer. "
                "If it is a non-academic photo or artwork, return score 0.0 and state that no academic questions were found. "
                "Return ONLY a JSON object with keys: overall_score, detected_topic, weak_question_types, question_breakdown, diagnostic_summary. "
                "The diagnosis MUST reflect what is actually written in the image, not generic content."
            )

        print(f"[{ts}] [AI Pipeline] Sending to provider='{provider}' | Hint='{topic_hint}' | Image attached: {bool(base64_image)} | Transcript: {bool(transcript)}")

        raw_response = self.client.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            images=[base64_image] if (base64_image and not transcript) else None,
            provider=provider,
            api_key=api_key,
            model=model
        )

        ts2 = _ts()
        print(f"[{ts2}] [AI Pipeline Raw Output] Length={len(raw_response)} chars | First 400: {repr(raw_response[:400])}")

        return self._parse_diagnosis(raw_response, available_topics)

    def _prepare_image_base64(self, image_input: str) -> Optional[str]:
        if not image_input:
            return None

        # Already base64 data URI
        if image_input.startswith("data:image") or (len(image_input) > 500 and not os.path.exists(image_input)):
            if "," in image_input:
                return image_input.split(",")[1]
            return image_input

        # File path
        if os.path.exists(image_input):
            try:
                with open(image_input, "rb") as f:
                    return base64.b64encode(f.read()).decode("utf-8")
            except Exception as e:
                print(f"[{_ts()}] [PerformanceAnalystAgent] Error reading image file {image_input}: {e}")

        return None

    def _parse_diagnosis(
        self,
        raw_text: str,
        available_topics: Optional[List[Dict[str, Any]]] = None
    ) -> AnswerSheetDiagnosis:
        ts = _ts()
        try:
            clean_text = raw_text.strip()

            # Strip markdown code fences if present
            if "```json" in clean_text:
                clean_text = clean_text.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_text:
                clean_text = clean_text.split("```")[1].split("```")[0].strip()

            # Try to extract JSON object even if surrounded by prose
            if not clean_text.startswith("{"):
                match = re.search(r'\{.*\}', clean_text, re.DOTALL)
                if match:
                    clean_text = match.group(0)

            parsed = json.loads(clean_text)

            # Check if the model returned a pipeline error
            if "_pipeline_error" in parsed:
                reason = parsed.get("_pipeline_error", "Unknown pipeline error")
                print(f"[{ts}] [PerformanceAnalystAgent] Pipeline error surfaced: {reason}")
                return AnswerSheetDiagnosis(
                    overall_score=0.0,
                    detected_topic="Diagnosis unavailable",
                    weak_question_types=[],
                    question_breakdown={},
                    diagnostic_summary=f"AI evaluation was not completed: {reason}. Check the backend logs.",
                    weighted_penalty_score=0.0
                )

            breakdown_dict = {}
            total_penalty = 0.0

            for q_id, q_data in parsed.get("question_breakdown", {}).items():
                if isinstance(q_data, dict):
                    status_raw = str(q_data.get("status") or q_data.get("result") or "unknown").lower()
                    if "score" in q_data:
                        try:
                            q_score = float(q_data["score"])
                        except (ValueError, TypeError):
                            q_score = 1.0 if "correct" in status_raw and "incorrect" not in status_raw else 0.0
                    else:
                        q_score = 1.0 if "correct" in status_raw and "incorrect" not in status_raw else 0.0

                    try:
                        q_weight = float(q_data.get("exam_weightage", 15.0))
                    except (ValueError, TypeError):
                        raw_w = str(q_data.get("exam_weightage", "")).lower()
                        q_weight = 25.0 if "high" in raw_w else (10.0 if "low" in raw_w else 15.0)
                    total_penalty += (1.0 - q_score) * (q_weight / 100.0)

                    breakdown_dict[q_id] = QuestionAnalysis(
                        status="correct" if ("correct" in status_raw and "incorrect" not in status_raw) else ("incorrect" if ("incorrect" in status_raw or "error" in status_raw or "wrong" in status_raw) else "partial"),
                        score=q_score,
                        type=str(q_data.get("type") or q_data.get("mastery") or "General"),
                        error_reason=q_data.get("error_reason") or q_data.get("details"),
                        subtopic_name=q_data.get("subtopic_name"),
                        exam_weightage=q_weight
                    )

            overall_sc = float(parsed.get("overall_score", 0.0))
            detected = parsed.get("detected_topic", "Unknown Topic")

            print(f"[{ts}] [PerformanceAnalystAgent] Parsed OK | Topic={detected} | Score={overall_sc:.2f} | Questions={len(breakdown_dict)}")

            return AnswerSheetDiagnosis(
                overall_score=max(0.0, min(1.0, overall_sc)),
                detected_topic=detected,
                weak_question_types=parsed.get("weak_question_types", []),
                question_breakdown=breakdown_dict,
                diagnostic_summary=parsed.get("diagnostic_summary", "Diagnosis completed."),
                weighted_penalty_score=total_penalty
            )

        except Exception as err:
            print(f"[{ts}] [PerformanceAnalystAgent] JSON parse error: {err} | Raw text (first 300): {raw_text[:300]}")
            # Surface the actual raw model text in the diagnostic summary so it's visible in the UI
            return AnswerSheetDiagnosis(
                overall_score=0.0,
                detected_topic="Parse Error — See Diagnostic Summary",
                weak_question_types=["JSON parsing failed"],
                question_breakdown={},
                diagnostic_summary=(
                    f"The AI model responded but the output could not be parsed as JSON. "
                    f"Raw model output (first 500 chars): {raw_text[:500]}"
                ),
                weighted_penalty_score=0.0
            )


# Global instance
performance_analyst_agent = PerformanceAnalystAgent()
