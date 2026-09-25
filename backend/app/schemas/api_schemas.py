"""
Pydantic API schemas for request/response validation.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Optional, Any
from datetime import date, datetime


class TopicCreate(BaseModel):
    name: str
    subject: str
    class_id: str = Field(default="class_a", description="Class identifier (class_a, class_b, class_c)")
    exam_weightage: float = Field(..., ge=0.0, description="Exam weightage score or percentage")
    difficulty: float = Field(..., ge=1.0, le=10.0, description="Difficulty rating 1 to 10")
    target_score: float = Field(default=0.85, ge=0.0, le=1.0, description="Target mastery score (e.g. 0.85 for 85%)")
    estimated_hours: float = Field(..., gt=0.0, description="Estimated teaching hours required")
    completed_hours: float = Field(default=0.0, ge=0.0)
    performance_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    status: str = Field(default="not_started")
    tags: List[str] = Field(default_factory=list)
    source: str = Field(default="live", description="'demo' or 'live'")


class TopicUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    exam_weightage: Optional[float] = None
    difficulty: Optional[float] = None
    target_score: Optional[float] = None
    estimated_hours: Optional[float] = None
    completed_hours: Optional[float] = None
    performance_score: Optional[float] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    source: Optional[str] = None


class TopicResponse(BaseModel):
    id: str
    name: str
    subject: str
    class_id: str = "class_a"
    exam_weightage: float
    difficulty: float
    target_score: float = 0.85
    estimated_hours: float
    completed_hours: float
    performance_score: Optional[float]
    status: str
    tags: List[str]
    remaining_hours: float
    performance_gap: float
    is_completed: bool
    source: str = "live"

    model_config = ConfigDict(from_attributes=True)


class CalendarDaySchema(BaseModel):
    date_val: date
    is_holiday: bool = False
    available_teaching_hours: float = Field(default=2.0, ge=0.0)
    available_revision_hours: float = Field(default=1.0, ge=0.0)
    note: Optional[str] = None


class CalendarBulkCreate(BaseModel):
    days: List[CalendarDaySchema]


class PerformanceCreate(BaseModel):
    topic_id: str
    score: float = Field(..., ge=0.0, le=1.0)
    test_date: date
    max_score: float = 100.0
    raw_score: float = 0.0
    question_breakdown: Dict[str, float] = Field(default_factory=dict)
    source: str = Field(default="live", description="'demo' or 'live'")
    image_path: Optional[str] = None


class PerformanceResponse(BaseModel):
    id: str
    topic_id: str
    score: float
    test_date: date
    max_score: float
    raw_score: float
    question_breakdown: Dict[str, float]
    source: str = "live"
    image_path: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScheduledSessionSchema(BaseModel):
    session_id: str
    topic_id: str
    topic_name: str
    subject: str
    session_type: str
    scheduled_date: date
    allocated_hours: float
    sequence_index: int
    revision_stage: Optional[int] = None
    notes: Optional[str] = None


class AdaptiveWeightsSchema(BaseModel):
    weightage_weight: float
    difficulty_weight: float
    gap_weight: float


class ScheduleResponse(BaseModel):
    teaching_sessions: List[ScheduledSessionSchema]
    revision_sessions: List[ScheduledSessionSchema]
    topic_scores: Dict[str, float]
    allocated_hours_per_topic: Dict[str, float]
    unallocated_hours: float
    weights_used: AdaptiveWeightsSchema
    explanation_summary: str
    topic_priority_details: Optional[Dict[str, Any]] = None
    generated_at: Optional[datetime] = None


class TierInfoResponse(BaseModel):
    tier: str = "free"
    available_tiers: List[str] = ["free", "local", "cloud"]


class SystemSettingsSchema(BaseModel):
    active_tier: str = "free" # "free", "local", "cloud"
    cloud_provider: str = "gemini" # "gemini", "groq"
    gemini_model: str = "gemini-1.5-flash"
    groq_model: str = "llama-3.2-11b-vision-preview"
    local_model: str = "gemma4:latest"
    gemini_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    has_gemini_key: bool = False
    has_groq_key: bool = False


class SystemSettingsUpdate(BaseModel):
    active_tier: Optional[str] = None
    cloud_provider: Optional[str] = None
    gemini_model: Optional[str] = None
    groq_model: Optional[str] = None
    local_model: Optional[str] = None
    gemini_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None


class TestKeyRequest(BaseModel):
    provider: str # "gemini" or "groq"
    api_key: str
    model: Optional[str] = None


class TestKeyResponse(BaseModel):
    success: bool
    provider: str
    message: str
