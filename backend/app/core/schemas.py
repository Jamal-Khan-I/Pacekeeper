"""
Core data models for Pacekeeper's deterministic scheduling engine.
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import List, Dict, Optional, Any
from enum import Enum


class TopicStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    NEEDS_REVISION = "needs_revision"


@dataclass
class Topic:
    id: str
    name: str
    subject: str
    exam_weightage: float  # Scale 1-10 or 0-100 (percentage)
    difficulty: float      # Scale 1-5 or 1-10
    estimated_hours: float # Recommended hours needed
    target_score: float = 0.85  # Target mastery percentage (e.g. 0.85 for 85%)
    completed_hours: float = 0.0
    performance_score: Optional[float] = None # 0.0 (0%) to 1.0 (100%)
    status: TopicStatus = TopicStatus.NOT_STARTED
    tags: List[str] = field(default_factory=list)

    @property
    def is_completed(self) -> bool:
        return self.status == TopicStatus.COMPLETED or self.completed_hours >= self.estimated_hours

    @property
    def remaining_hours(self) -> float:
        if self.is_completed:
            return 0.0
        return max(0.0, self.estimated_hours - self.completed_hours)

    @property
    def is_untested(self) -> bool:
        return self.performance_score is None

    @property
    def assumed_performance(self) -> float:
        """Assumed performance score for untested topics: target_score - 20%."""
        if self.performance_score is not None:
            return self.performance_score
        return max(0.05, round(self.target_score - 0.20, 4))

    @property
    def performance_gap(self) -> float:
        """
        Calculates performance gap (1.0 - performance).
        For untested topics: varies per topic based on that topic's target score:
        assumed = target_score - 20%, gap = 1.0 - assumed.
        """
        if self.performance_score is not None:
            return max(0.05, min(1.0, round(1.0 - self.performance_score, 4)))
        assumed = self.assumed_performance
        return max(0.05, min(1.0, round(1.0 - assumed, 4)))


@dataclass
class AdaptiveWeights:
    weightage_weight: float = 1.0
    difficulty_weight: float = 1.0
    gap_weight: float = 1.1

    def to_dict(self) -> Dict[str, float]:
        return {
            "weightage_weight": self.weightage_weight,
            "difficulty_weight": self.difficulty_weight,
            "gap_weight": self.gap_weight,
        }


@dataclass
class CalendarDay:
    date_val: date
    is_holiday: bool = False
    available_teaching_hours: float = 0.0
    available_revision_hours: float = 0.0
    note: Optional[str] = None


class SessionType(str, Enum):
    TEACHING = "teaching"
    REVISION = "revision"


@dataclass
class ScheduledSession:
    session_id: str
    topic_id: str
    topic_name: str
    subject: str
    session_type: SessionType
    scheduled_date: date
    allocated_hours: float
    sequence_index: int
    revision_stage: Optional[int] = None # 1st revision, 2nd revision, etc.
    notes: Optional[str] = None


@dataclass
class PerformanceRecord:
    topic_id: str
    score: float # 0.0 to 1.0
    test_date: date
    max_score: float = 100.0
    raw_score: float = 0.0
    question_breakdown: Dict[str, float] = field(default_factory=dict) # e.g. {"mcq": 0.8, "essay": 0.4}


@dataclass
class ScheduleResult:
    teaching_sessions: List[ScheduledSession]
    revision_sessions: List[ScheduledSession]
    topic_scores: Dict[str, float]
    allocated_hours_per_topic: Dict[str, float]
    unallocated_hours: float
    weights_used: AdaptiveWeights
    explanation_summary: str
    topic_priority_details: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    excluded_topics: List[str] = field(default_factory=list)
