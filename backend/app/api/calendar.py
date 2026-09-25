"""
API Router for Calendar Management.
"""

from typing import List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import CalendarDayDB
from backend.app.schemas.api_schemas import CalendarDaySchema, CalendarBulkCreate

router = APIRouter(prefix="/api/calendar", tags=["Calendar"])


@router.get("", response_model=List[CalendarDaySchema])
def get_calendar(db: Session = Depends(get_db)):
    days_db = db.query(CalendarDayDB).all()
    # Sort by date_val
    sorted_days = sorted(days_db, key=lambda d: d.date_val)
    return [
        CalendarDaySchema(
            date_val=date.fromisoformat(d.date_val),
            is_holiday=d.is_holiday,
            available_teaching_hours=d.available_teaching_hours,
            available_revision_hours=d.available_revision_hours,
            note=d.note,
        )
        for d in sorted_days
    ]


@router.post("/bulk", response_model=List[CalendarDaySchema])
def bulk_upsert_calendar(payload: CalendarBulkCreate, db: Session = Depends(get_db)):
    updated_schemas = []
    for day in payload.days:
        date_str = day.date_val.isoformat()
        existing = db.query(CalendarDayDB).filter(CalendarDayDB.date_val == date_str).first()
        if existing:
            existing.is_holiday = day.is_holiday
            existing.available_teaching_hours = day.available_teaching_hours
            existing.available_revision_hours = day.available_revision_hours
            existing.note = day.note
        else:
            new_day = CalendarDayDB(
                date_val=date_str,
                is_holiday=day.is_holiday,
                available_teaching_hours=day.available_teaching_hours,
                available_revision_hours=day.available_revision_hours,
                note=day.note,
            )
            db.add(new_day)
        updated_schemas.append(day)

    db.commit()
    return updated_schemas
