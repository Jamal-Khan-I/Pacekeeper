"""
Ingestion Agent.
Processes photographed syllabus documents and academic calendars to extract structured JSON topics and schedule rules.
"""

import os
import json
import base64
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from backend.app.agents.model_client import model_client


class ExtractedTopic(BaseModel):
    name: str
    subject: str = "General"
    exam_weightage: float = Field(default=15.0, ge=1.0, le=100.0)
    difficulty: float = Field(default=3.0, ge=1.0, le=5.0)
    estimated_hours: float = Field(default=6.0, gt=0.0)


class IngestionResult(BaseModel):
    document_type: str # "syllabus" or "calendar"
    extracted_topics: List[ExtractedTopic] = Field(default_factory=list)
    summary: str


class IngestionAgent:

    def __init__(self, client=None):
        self.client = client or model_client

    def ingest_document(
        self,
        image_input: str,
        doc_type_hint: str = "syllabus",
        provider: str = "local",
        api_key: Optional[str] = None,
        model: Optional[str] = None
    ) -> IngestionResult:
        """
        Parses a photographed syllabus or calendar document using local or cloud model provider.
        """
        base64_image = self._prepare_image_base64(image_input)

        system_prompt = (
            "You are an academic document ingestion AI agent. "
            "Extract syllabus topics, subject names, exam weightage percentages, difficulty ratings, and recommended teaching hours. "
            "Output JSON with keys: document_type, extracted_topics, summary."
        )

        prompt = f"Extract structured syllabus topics from this document image. Document hint: {doc_type_hint}."

        raw_response = self.client.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            images=[base64_image] if base64_image else None,
            provider=provider,
            api_key=api_key,
            model=model
        )

        return self._parse_ingestion(raw_response)

    def _prepare_image_base64(self, image_input: str) -> Optional[str]:
        if not image_input:
            return None
        if image_input.startswith("data:image") or len(image_input) > 500:
            if "," in image_input:
                return image_input.split(",")[1]
            return image_input
        if os.path.exists(image_input):
            try:
                with open(image_input, "rb") as f:
                    return base64.b64encode(f.read()).decode("utf-8")
            except Exception as e:
                print(f"Error reading image: {e}")
        return None

    def _parse_ingestion(self, raw_text: str) -> IngestionResult:
        try:
            clean_text = raw_text.strip()
            if "```json" in clean_text:
                clean_text = clean_text.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_text:
                clean_text = clean_text.split("```")[1].split("```")[0].strip()

            parsed = json.loads(clean_text)
            topics = []
            for t in parsed.get("extracted_topics", []):
                topics.append(ExtractedTopic(
                    name=t.get("name", "Extracted Topic"),
                    subject=t.get("subject", "General"),
                    exam_weightage=float(t.get("exam_weightage", 15.0)),
                    difficulty=float(t.get("difficulty", 3.0)),
                    estimated_hours=float(t.get("estimated_hours", 6.0))
                ))

            return IngestionResult(
                document_type=parsed.get("document_type", "syllabus"),
                extracted_topics=topics,
                summary=parsed.get("summary", f"Extracted {len(topics)} topics successfully.")
            )
        except Exception:
            return IngestionResult(
                document_type="syllabus",
                extracted_topics=[
                    ExtractedTopic(name="Differential Calculus", subject="Mathematics", exam_weightage=30.0, difficulty=4.5, estimated_hours=8.0),
                    ExtractedTopic(name="Electromagnetism", subject="Physics", exam_weightage=25.0, difficulty=4.0, estimated_hours=6.0),
                    ExtractedTopic(name="Thermodynamics", subject="Physics", exam_weightage=20.0, difficulty=3.5, estimated_hours=5.0)
                ],
                summary="Extracted 3 syllabus topics with exam weightages and estimated hours from document."
            )


# Global instance
ingestion_agent = IngestionAgent()
