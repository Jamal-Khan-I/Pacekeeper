"""
API Router for Performance Score Input & Automatic Re-planning.
"""

import json
import uuid
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import TopicDB, PerformanceRecordDB, AdaptiveWeightsDB
from backend.app.schemas.api_schemas import PerformanceCreate, PerformanceResponse, ScheduleResponse
from backend.app.api.schedule import execute_and_persist_schedule

router = APIRouter(prefix="/api/performance", tags=["Performance"])


@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
def submit_performance(payload: PerformanceCreate, db: Session = Depends(get_db)):
    topic_db = db.query(TopicDB).filter(TopicDB.id == payload.topic_id).first()
    if not topic_db:
        raise HTTPException(status_code=404, detail=f"Topic {payload.topic_id} not found")

    rec_id = f"perf_{uuid.uuid4().hex[:8]}"
    date_str = payload.test_date.isoformat()

    db_rec = PerformanceRecordDB(
        id=rec_id,
        topic_id=payload.topic_id,
        class_id=topic_db.class_id,
        score=payload.score,
        test_date=date_str,
        max_score=payload.max_score,
        raw_score=payload.raw_score,
        question_breakdown_json=json.dumps(payload.question_breakdown),
        source=payload.source or "live",
        image_path=payload.image_path,
    )
    db.add(db_rec)

    # Update latest performance score on topic DB record
    topic_db.performance_score = payload.score
    if payload.score >= 0.8:
        topic_db.status = "completed"
    elif payload.score < 0.5:
        topic_db.status = "needs_revision"
    else:
        topic_db.status = "in_progress"

    db.commit()

    # Automatically trigger re-plan with adaptive weight adjustment enabled
    updated_schedule = execute_and_persist_schedule(db, class_id=topic_db.class_id, adjust_weights=True)
    return updated_schedule


@router.post("/batch", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
def submit_performance_batch(records: List[PerformanceCreate], db: Session = Depends(get_db)):
    if not records:
        raise HTTPException(status_code=400, detail="Empty records list")

    target_class_id = None
    for payload in records:
        topic_db = db.query(TopicDB).filter(TopicDB.id == payload.topic_id).first()
        if not topic_db:
            continue

        target_class_id = topic_db.class_id
        rec_id = f"perf_{uuid.uuid4().hex[:8]}"
        date_str = payload.test_date.isoformat()

        db_rec = PerformanceRecordDB(
            id=rec_id,
            topic_id=payload.topic_id,
            class_id=topic_db.class_id,
            score=payload.score,
            test_date=date_str,
            max_score=payload.max_score,
            raw_score=payload.raw_score,
            question_breakdown_json=json.dumps(payload.question_breakdown),
            source=payload.source or "live",
            image_path=payload.image_path,
        )
        db.add(db_rec)

        # Update latest score on topic
        topic_db.performance_score = payload.score
        if payload.score >= 0.8:
            topic_db.status = "completed"
        elif payload.score < 0.5:
            topic_db.status = "needs_revision"
        else:
            topic_db.status = "in_progress"

    db.commit()

    # Recompute schedule once for the affected class
    updated_schedule = execute_and_persist_schedule(db, class_id=target_class_id, adjust_weights=True)
    return updated_schedule


@router.get("", response_model=List[PerformanceResponse])
def list_performance_records(
    class_id: Optional[str] = Query(None, description="Filter by class_id"),
    source: Optional[str] = Query(None, description="Filter by source ('live' or 'demo')"),
    db: Session = Depends(get_db)
):
    query = db.query(PerformanceRecordDB)
    if class_id:
        query = query.filter(PerformanceRecordDB.class_id == class_id)
    if source:
        query = query.filter(PerformanceRecordDB.source == source)
    records = query.order_by(PerformanceRecordDB.created_at.desc()).all()
    return [
        PerformanceResponse(
            id=r.id,
            topic_id=r.topic_id,
            score=r.score,
            test_date=r.test_date,
            max_score=r.max_score,
            raw_score=r.raw_score,
            question_breakdown=json.loads(r.question_breakdown_json) if r.question_breakdown_json else {},
            source=r.source or "live",
            image_path=r.image_path,
            created_at=r.created_at,
        )
        for r in records
    ]


@router.post("/reset-live")
def reset_live_performance_records(db: Session = Depends(get_db)):
    """
    Clears all 'live' performance records and uploaded files without touching 'demo' records.
    """
    deleted = db.query(PerformanceRecordDB).filter(PerformanceRecordDB.source == "live").delete()
    db.commit()

    # Also clean live upload files
    uploads_dir = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "uploads", "live"))
    cleaned_files = 0
    if os.path.exists(uploads_dir):
        for root, _, files in os.walk(uploads_dir):
            for f in files:
                try:
                    os.remove(os.path.join(root, f))
                    cleaned_files += 1
                except Exception:
                    pass

    return {
        "status": "success",
        "deleted_records": deleted,
        "cleaned_files": cleaned_files,
        "message": f"Reset {deleted} live records and {cleaned_files} uploaded files. Demo data untouched."
    }


@router.post("/reset-demo")
def reset_demo_performance_records(db: Session = Depends(get_db)):
    """
    Clears all 'demo' performance records without touching 'live' records.
    """
    deleted = db.query(PerformanceRecordDB).filter(PerformanceRecordDB.source == "demo").delete()
    db.commit()
    return {
        "status": "success",
        "deleted_records": deleted,
        "message": f"Reset {deleted} demo records. Live uploaded records untouched."
    }


@router.get("/{topic_id}", response_model=List[PerformanceResponse])
def get_topic_performance_history(topic_id: str, db: Session = Depends(get_db)):
    records = db.query(PerformanceRecordDB).filter(PerformanceRecordDB.topic_id == topic_id).all()
    return [
        PerformanceResponse(
            id=r.id,
            topic_id=r.topic_id,
            score=r.score,
            test_date=r.test_date,
            max_score=r.max_score,
            raw_score=r.raw_score,
            question_breakdown=json.loads(r.question_breakdown_json) if r.question_breakdown_json else {},
            source=r.source or "live",
            image_path=r.image_path,
            created_at=r.created_at,
        )
        for r in records
    ]
