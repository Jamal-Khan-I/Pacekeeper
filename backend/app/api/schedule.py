"""
API Router for Schedule Generation & State Retrieval.
"""

import json
from datetime import datetime, date, timezone
from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import TopicDB, CalendarDayDB, PerformanceRecordDB, ScheduleStateDB, AdaptiveWeightsDB
from backend.app.schemas.api_schemas import ScheduleResponse, ScheduledSessionSchema, AdaptiveWeightsSchema
from backend.app.core.schemas import (
    Topic as CoreTopic,
    CalendarDay as CoreCalendarDay,
    PerformanceRecord as CorePerformanceRecord,
    AdaptiveWeights as CoreAdaptiveWeights,
    TopicStatus,
)
from backend.app.core.planner import DeterministicPlannerEngine

router = APIRouter(prefix="/api/schedule", tags=["Schedule"])
planner_engine = DeterministicPlannerEngine()


def execute_and_persist_schedule(
    db: Session,
    class_id: Optional[str] = "class_a",
    adjust_weights: bool = False
) -> ScheduleResponse:
    # 1. Load topics from DB (scoped to class_id if present)
    target_class = class_id or "class_a"
    topics_query = db.query(TopicDB)
    if target_class:
        topics_query = topics_query.filter(TopicDB.class_id == target_class)
    topics_db = topics_query.all()
    
    # Fallback to all topics if specific class has none
    if not topics_db:
        topics_db = db.query(TopicDB).all()

    core_topics: List[CoreTopic] = []
    for t in topics_db:
        tags = json.loads(t.tags_json) if t.tags_json else []
        target_score_val = getattr(t, 'target_score', 0.85) or 0.85
        core_topics.append(
            CoreTopic(
                id=t.id,
                name=t.name,
                subject=t.subject,
                exam_weightage=t.exam_weightage,
                difficulty=t.difficulty,
                target_score=target_score_val,
                estimated_hours=t.estimated_hours,
                completed_hours=t.completed_hours,
                performance_score=t.performance_score,
                status=TopicStatus(t.status) if t.status in TopicStatus.__members__.values() else TopicStatus.NOT_STARTED,
                tags=tags,
            )
        )

    # 2. Load calendar days from DB
    calendar_db = db.query(CalendarDayDB).all()
    core_calendar: List[CoreCalendarDay] = [
        CoreCalendarDay(
            date_val=date.fromisoformat(c.date_val),
            is_holiday=c.is_holiday,
            available_teaching_hours=c.available_teaching_hours,
            available_revision_hours=c.available_revision_hours,
            note=c.note,
        )
        for c in calendar_db
    ]

    # 3. Load performance history (scoped to class)
    perf_query = db.query(PerformanceRecordDB)
    if target_class:
        perf_query = perf_query.filter(PerformanceRecordDB.class_id == target_class)
    perf_db = perf_query.all()
    
    core_perf: List[CorePerformanceRecord] = [
        CorePerformanceRecord(
            topic_id=p.topic_id,
            score=p.score,
            test_date=date.fromisoformat(p.test_date),
            max_score=p.max_score,
            raw_score=p.raw_score,
            question_breakdown=json.loads(p.question_breakdown_json) if p.question_breakdown_json else {},
        )
        for p in perf_db
    ]

    # 4. Load or default adaptive weights (strictly bounded in [0.5, 2.0])
    weights_db = db.query(AdaptiveWeightsDB).filter(AdaptiveWeightsDB.id == 1).first()
    if weights_db:
        weights = CoreAdaptiveWeights(
            weightage_weight=min(2.0, max(0.5, weights_db.weightage_weight)),
            difficulty_weight=min(2.0, max(0.5, weights_db.difficulty_weight)),
            gap_weight=min(2.0, max(0.5, weights_db.gap_weight)),
        )
    else:
        weights = CoreAdaptiveWeights()

    # 5. Generate plan via Phase 1 Engine with 0.5h floor and granular 0.5h blocks
    result = planner_engine.generate_plan(
        topics=core_topics,
        calendar_days=core_calendar,
        current_weights=weights,
        performance_history=core_perf,
        min_session_block=0.5,
        adjust_weights=adjust_weights
    )

    # Update or insert adaptive weights back to DB only if weights adjustment was requested
    if adjust_weights:
        if not weights_db:
            weights_db = AdaptiveWeightsDB(
                id=1,
                weightage_weight=result.weights_used.weightage_weight,
                difficulty_weight=result.weights_used.difficulty_weight,
                gap_weight=result.weights_used.gap_weight,
                updated_at=datetime.now(timezone.utc)
            )
            db.add(weights_db)
        else:
            weights_db.weightage_weight = result.weights_used.weightage_weight
            weights_db.difficulty_weight = result.weights_used.difficulty_weight
            weights_db.gap_weight = result.weights_used.gap_weight
            weights_db.updated_at = datetime.now(timezone.utc)

    # Serialize sessions for DB storage
    teaching_sessions_dict = [
        {
            "session_id": s.session_id,
            "topic_id": s.topic_id,
            "topic_name": s.topic_name,
            "subject": s.subject,
            "session_type": s.session_type.value,
            "scheduled_date": s.scheduled_date.isoformat(),
            "allocated_hours": s.allocated_hours,
            "sequence_index": s.sequence_index,
            "revision_stage": s.revision_stage,
            "notes": s.notes,
        }
        for s in result.teaching_sessions
    ]

    revision_sessions_dict = [
        {
            "session_id": s.session_id,
            "topic_id": s.topic_id,
            "topic_name": s.topic_name,
            "subject": s.subject,
            "session_type": s.session_type.value,
            "scheduled_date": s.scheduled_date.isoformat(),
            "allocated_hours": s.allocated_hours,
            "sequence_index": s.sequence_index,
            "revision_stage": s.revision_stage,
            "notes": s.notes,
        }
        for s in result.revision_sessions
    ]

    now = datetime.now(timezone.utc)

    state_db = db.query(ScheduleStateDB).filter(ScheduleStateDB.id == 1).first()
    if not state_db:
        state_db = ScheduleStateDB(
            id=1,
            generated_at=now,
            teaching_sessions_json=json.dumps(teaching_sessions_dict),
            revision_sessions_json=json.dumps(revision_sessions_dict),
            topic_scores_json=json.dumps(result.topic_scores),
            allocated_hours_json=json.dumps(result.allocated_hours_per_topic),
            unallocated_hours=result.unallocated_hours,
            weights_json=json.dumps(result.weights_used.to_dict()),
            explanation_summary=result.explanation_summary,
        )
        db.add(state_db)
    else:
        state_db.generated_at = now
        state_db.teaching_sessions_json = json.dumps(teaching_sessions_dict)
        state_db.revision_sessions_json = json.dumps(revision_sessions_dict)
        state_db.topic_scores_json = json.dumps(result.topic_scores)
        state_db.allocated_hours_json = json.dumps(result.allocated_hours_per_topic)
        state_db.unallocated_hours = result.unallocated_hours
        state_db.weights_json = json.dumps(result.weights_used.to_dict())
        state_db.explanation_summary = result.explanation_summary

    db.commit()

    return db_schedule_to_response(state_db, topic_priority_details=result.topic_priority_details)


def db_schedule_to_response(
    state_db: ScheduleStateDB,
    topic_priority_details: Optional[Dict[str, Any]] = None
) -> ScheduleResponse:
    teaching_raw = json.loads(state_db.teaching_sessions_json) if state_db.teaching_sessions_json else []
    revision_raw = json.loads(state_db.revision_sessions_json) if state_db.revision_sessions_json else []
    
    teaching_sessions = [
        ScheduledSessionSchema(
            session_id=s["session_id"],
            topic_id=s["topic_id"],
            topic_name=s["topic_name"],
            subject=s["subject"],
            session_type=s["session_type"],
            scheduled_date=date.fromisoformat(s["scheduled_date"]),
            allocated_hours=s["allocated_hours"],
            sequence_index=s["sequence_index"],
            revision_stage=s.get("revision_stage"),
            notes=s.get("notes"),
        )
        for s in teaching_raw
    ]

    revision_sessions = [
        ScheduledSessionSchema(
            session_id=s["session_id"],
            topic_id=s["topic_id"],
            topic_name=s["topic_name"],
            subject=s["subject"],
            session_type=s["session_type"],
            scheduled_date=date.fromisoformat(s["scheduled_date"]),
            allocated_hours=s["allocated_hours"],
            sequence_index=s["sequence_index"],
            revision_stage=s.get("revision_stage"),
            notes=s.get("notes"),
        )
        for s in revision_raw
    ]

    weights_dict = json.loads(state_db.weights_json) if state_db.weights_json else {}

    return ScheduleResponse(
        teaching_sessions=teaching_sessions,
        revision_sessions=revision_sessions,
        topic_scores=json.loads(state_db.topic_scores_json) if state_db.topic_scores_json else {},
        allocated_hours_per_topic=json.loads(state_db.allocated_hours_json) if state_db.allocated_hours_json else {},
        unallocated_hours=state_db.unallocated_hours,
        weights_used=AdaptiveWeightsSchema(
            weightage_weight=min(2.0, max(0.5, float(weights_dict.get("weightage_weight", 1.0)))),
            difficulty_weight=min(2.0, max(0.5, float(weights_dict.get("difficulty_weight", 1.0)))),
            gap_weight=min(2.0, max(0.5, float(weights_dict.get("gap_weight", 1.1)))),
        ),
        explanation_summary=state_db.explanation_summary,
        topic_priority_details=topic_priority_details,
        generated_at=state_db.generated_at,
    )


@router.post("/generate", response_model=ScheduleResponse)
def generate_schedule(
    class_id: Optional[str] = Query("class_a", description="Class identifier to schedule"),
    db: Session = Depends(get_db)
):
    return execute_and_persist_schedule(db, class_id=class_id)


@router.get("/current", response_model=ScheduleResponse)
def get_current_schedule(
    class_id: Optional[str] = Query("class_a", description="Class identifier to fetch"),
    db: Session = Depends(get_db)
):
    state_db = db.query(ScheduleStateDB).filter(ScheduleStateDB.id == 1).first()
    if not state_db:
        return execute_and_persist_schedule(db, class_id=class_id)
    return db_schedule_to_response(state_db)


@router.get("/export-ics")
def export_schedule_ics(db: Session = Depends(get_db)):
    """
    Generates and downloads a standard RFC 5545 .ics calendar file.
    """
    from fastapi.responses import Response
    from backend.app.services.ics_exporter import generate_ics_calendar

    state_db = db.query(ScheduleStateDB).filter(ScheduleStateDB.id == 1).first()
    if not state_db:
        sched_obj = execute_and_persist_schedule(db)
        sched_dict = sched_obj.model_dump(mode="json") if hasattr(sched_obj, "model_dump") else sched_obj.dict()
    else:
        sched_obj = db_schedule_to_response(state_db)
        sched_dict = sched_obj.model_dump(mode="json") if hasattr(sched_obj, "model_dump") else sched_obj.dict()

    ics_content = generate_ics_calendar(sched_dict)
    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=pacekeeper_schedule.ics"}
    )


@router.post("/notify")
def trigger_schedule_notifications(db: Session = Depends(get_db)):
    """
    Triggers local OS desktop notifications for upcoming revision sessions.
    """
    from backend.app.services.notifications import notify_upcoming_revisions

    state_db = db.query(ScheduleStateDB).filter(ScheduleStateDB.id == 1).first()
    if not state_db:
        sched_obj = execute_and_persist_schedule(db)
        sched_dict = sched_obj.model_dump(mode="json") if hasattr(sched_obj, "model_dump") else sched_obj.dict()
    else:
        sched_obj = db_schedule_to_response(state_db)
        sched_dict = sched_obj.model_dump(mode="json") if hasattr(sched_obj, "model_dump") else sched_obj.dict()

    sent_list = notify_upcoming_revisions(sched_dict)
    return {
        "status": "success",
        "notifications_count": len(sent_list),
        "notifications": sent_list
    }
