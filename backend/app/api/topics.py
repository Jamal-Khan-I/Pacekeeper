"""
API Router for Topic Management (CRUD) with multi-class support.
All endpoints accept optional ?class_id= query parameter to scope topics by class.
"""

import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import TopicDB
from backend.app.schemas.api_schemas import TopicCreate, TopicUpdate, TopicResponse
from backend.app.core.schemas import Topic as CoreTopic

router = APIRouter(prefix="/api/topics", tags=["Topics"])


def db_to_topic_response(db_topic: TopicDB) -> TopicResponse:
    tags = json.loads(db_topic.tags_json) if db_topic.tags_json else []
    target_score_val = getattr(db_topic, 'target_score', 0.85) or 0.85
    core_topic = CoreTopic(
        id=db_topic.id,
        name=db_topic.name,
        subject=db_topic.subject,
        exam_weightage=db_topic.exam_weightage,
        difficulty=db_topic.difficulty,
        target_score=target_score_val,
        estimated_hours=db_topic.estimated_hours,
        completed_hours=db_topic.completed_hours,
        performance_score=db_topic.performance_score,
        status=db_topic.status,
        tags=tags,
    )
    return TopicResponse(
        id=core_topic.id,
        name=core_topic.name,
        subject=core_topic.subject,
        class_id=db_topic.class_id,
        exam_weightage=core_topic.exam_weightage,
        difficulty=core_topic.difficulty,
        target_score=core_topic.target_score,
        estimated_hours=core_topic.estimated_hours,
        completed_hours=core_topic.completed_hours,
        performance_score=core_topic.performance_score,
        status=core_topic.status,
        tags=core_topic.tags,
        remaining_hours=core_topic.remaining_hours,
        performance_gap=core_topic.performance_gap,
        is_completed=core_topic.is_completed,
        source=getattr(db_topic, 'source', 'live') or 'live',
    )


@router.get("", response_model=List[TopicResponse])
def get_all_topics(
    class_id: Optional[str] = Query(None, description="Filter by class ID (e.g. class_a, class_b, class_c)"),
    db: Session = Depends(get_db)
):
    """Returns topics, optionally filtered by class_id."""
    query = db.query(TopicDB)
    if class_id:
        query = query.filter(TopicDB.class_id == class_id)
    topics_db = query.all()
    return [db_to_topic_response(t) for t in topics_db]


@router.post("", response_model=TopicResponse, status_code=status.HTTP_201_CREATED)
def create_topic(payload: TopicCreate, db: Session = Depends(get_db)):
    topic_id = f"top_{uuid.uuid4().hex[:8]}"
    db_topic = TopicDB(
        id=topic_id,
        name=payload.name,
        subject=payload.subject,
        class_id=getattr(payload, 'class_id', None) or "class_a",
        exam_weightage=payload.exam_weightage,
        difficulty=payload.difficulty,
        target_score=getattr(payload, 'target_score', 0.85) or 0.85,
        estimated_hours=payload.estimated_hours,
        completed_hours=payload.completed_hours,
        performance_score=payload.performance_score,
        status=payload.status,
        tags_json=json.dumps(payload.tags),
        source=getattr(payload, 'source', 'live') or 'live',
    )
    db.add(db_topic)
    db.commit()
    db.refresh(db_topic)
    return db_to_topic_response(db_topic)


@router.put("/{topic_id}", response_model=TopicResponse)
def update_topic(topic_id: str, payload: TopicUpdate, db: Session = Depends(get_db)):
    db_topic = db.query(TopicDB).filter(TopicDB.id == topic_id).first()
    if not db_topic:
        raise HTTPException(status_code=404, detail=f"Topic {topic_id} not found")

    if payload.name is not None:
        db_topic.name = payload.name
    if payload.subject is not None:
        db_topic.subject = payload.subject
    if payload.exam_weightage is not None:
        db_topic.exam_weightage = payload.exam_weightage
    if payload.difficulty is not None:
        db_topic.difficulty = payload.difficulty
    if payload.target_score is not None:
        db_topic.target_score = payload.target_score
    if payload.estimated_hours is not None:
        db_topic.estimated_hours = payload.estimated_hours
    if payload.completed_hours is not None:
        db_topic.completed_hours = payload.completed_hours
    if payload.performance_score is not None:
        db_topic.performance_score = payload.performance_score
    if payload.status is not None:
        db_topic.status = payload.status
    if payload.tags is not None:
        db_topic.tags_json = json.dumps(payload.tags)

    db.commit()
    db.refresh(db_topic)
    return db_to_topic_response(db_topic)


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(topic_id: str, db: Session = Depends(get_db)):
    db_topic = db.query(TopicDB).filter(TopicDB.id == topic_id).first()
    if not db_topic:
        raise HTTPException(status_code=404, detail=f"Topic {topic_id} not found")

    db.delete(db_topic)
    db.commit()
    return None
