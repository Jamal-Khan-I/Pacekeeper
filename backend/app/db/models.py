"""
SQLAlchemy ORM models for SQLite database persistence.
"""

from datetime import datetime, date, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, Text, DateTime, ForeignKey
from backend.app.db.database import Base


class TopicDB(Base):
    __tablename__ = "topics"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    class_id = Column(String, nullable=False, default="class_a", index=True)  # Multi-class support
    exam_weightage = Column(Float, nullable=False, default=10.0)
    difficulty = Column(Float, nullable=False, default=3.0)
    target_score = Column(Float, nullable=False, default=0.85)  # Individual target mastery (e.g. 0.85 for 85%)
    estimated_hours = Column(Float, nullable=False, default=5.0)
    completed_hours = Column(Float, nullable=False, default=0.0)
    performance_score = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="not_started")
    tags_json = Column(Text, nullable=False, default="[]")
    source = Column(String, nullable=False, default="live")  # "demo" or "live"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class CalendarDayDB(Base):
    __tablename__ = "calendar_days"

    date_val = Column(String, primary_key=True, index=True) # YYYY-MM-DD
    is_holiday = Column(Boolean, nullable=False, default=False)
    available_teaching_hours = Column(Float, nullable=False, default=2.0)
    available_revision_hours = Column(Float, nullable=False, default=1.0)
    note = Column(String, nullable=True)


class PerformanceRecordDB(Base):
    __tablename__ = "performance_records"

    id = Column(String, primary_key=True, index=True)
    topic_id = Column(String, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    class_id = Column(String, nullable=False, default="class_a", index=True)  # Multi-class scope
    score = Column(Float, nullable=False) # 0.0 to 1.0
    test_date = Column(String, nullable=False) # YYYY-MM-DD
    max_score = Column(Float, nullable=False, default=100.0)
    raw_score = Column(Float, nullable=False, default=0.0)
    question_breakdown_json = Column(Text, nullable=False, default="{}")
    source = Column(String, nullable=False, default="live")  # "demo" or "live"
    image_path = Column(String, nullable=True)  # e.g. uploads/live/...
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ScheduleStateDB(Base):
    __tablename__ = "schedule_state"

    id = Column(Integer, primary_key=True, default=1)
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    teaching_sessions_json = Column(Text, nullable=False, default="[]")
    revision_sessions_json = Column(Text, nullable=False, default="[]")
    topic_scores_json = Column(Text, nullable=False, default="{}")
    allocated_hours_json = Column(Text, nullable=False, default="{}")
    unallocated_hours = Column(Float, nullable=False, default=0.0)
    excluded_topics_json = Column(Text, nullable=False, default="[]")
    weights_json = Column(Text, nullable=False, default="{}")
    explanation_summary = Column(Text, nullable=False, default="")


class AdaptiveWeightsDB(Base):
    __tablename__ = "adaptive_weights"

    id = Column(Integer, primary_key=True, default=1)
    weightage_weight = Column(Float, nullable=False, default=1.0)
    difficulty_weight = Column(Float, nullable=False, default=1.0)
    gap_weight = Column(Float, nullable=False, default=1.2)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
