"""
Spaced Repetition Revision Module.
Calculates memory retention curves and generates optimal revision session schedules
weighted by performance gap and difficulty.
"""

import math
from datetime import date, timedelta
from typing import List, Dict, Optional
from backend.app.core.schemas import Topic, CalendarDay, ScheduledSession, SessionType


def calculate_initial_revision_interval(performance_score: Optional[float]) -> int:
    """
    Calculates initial revision interval in days based on performance score [0.0, 1.0].
    - High performance score -> longer interval before revision needed.
    - Low performance score / un-tested -> short interval (1-2 days).
    """
    if performance_score is None:
        return 2  # Default baseline for untested topics

    p = max(0.0, min(1.0, performance_score))
    # Quadratic mapping: 0.0 score -> 1 day, 0.5 score -> 3 days, 1.0 score -> 10 days
    interval = round(1 + 9 * (p ** 2))
    return int(max(1, interval))


def calculate_ease_factor(performance_score: Optional[float]) -> float:
    """
    Calculates ease factor for subsequent revision interval scaling.
    Ranges from 1.3 (hard/weak topic) to 2.5 (easy/mastered topic).
    """
    if performance_score is None:
        return 1.8
    p = max(0.0, min(1.0, performance_score))
    return round(1.3 + 1.2 * p, 2)


def generate_revision_dates(
    start_date: date,
    performance_score: Optional[float],
    stages: int = 3
) -> List[date]:
    """
    Generates target revision dates following a spaced repetition expansion curve.
    """
    initial_interval = calculate_initial_revision_interval(performance_score)
    ease_factor = calculate_ease_factor(performance_score)

    target_dates = []
    current_date = start_date
    current_interval = float(initial_interval)

    for _ in range(stages):
        current_date += timedelta(days=max(1, math.ceil(current_interval)))
        target_dates.append(current_date)
        current_interval *= ease_factor

    return target_dates


def schedule_revision_sessions(
    topics: List[Topic],
    calendar_days: List[CalendarDay],
    start_date: date,
    session_duration_hrs: float = 0.5
) -> List[ScheduledSession]:
    """
    Schedules revision sessions across available calendar days using spaced repetition targets.
    """
    scheduled_sessions: List[ScheduledSession] = []
    
    # Filter valid non-holiday calendar days sorted by date
    available_days = {
        cd.date_val: cd for cd in calendar_days 
        if not cd.is_holiday and cd.available_revision_hours > 0 and cd.date_val >= start_date
    }
    
    if not available_days:
        return scheduled_sessions

    session_counter = 1
    
    for topic in topics:
        # Generate target revision dates for 3 stages
        target_dates = generate_revision_dates(
            start_date=start_date,
            performance_score=topic.performance_score,
            stages=3
        )
        
        for stage_idx, t_date in enumerate(target_dates, start=1):
            # Find closest available calendar day on or after t_date
            assigned_day: Optional[CalendarDay] = None
            
            # Look up to 14 days ahead of target date for an available revision slot
            for day_offset in range(14):
                candidate_date = t_date + timedelta(days=day_offset)
                if candidate_date in available_days and available_days[candidate_date].available_revision_hours >= session_duration_hrs:
                    assigned_day = available_days[candidate_date]
                    break
            
            if assigned_day:
                session = ScheduledSession(
                    session_id=f"rev_{topic.id}_{stage_idx}_{session_counter}",
                    topic_id=topic.id,
                    topic_name=topic.name,
                    subject=topic.subject,
                    session_type=SessionType.REVISION,
                    scheduled_date=assigned_day.date_val,
                    allocated_hours=session_duration_hrs,
                    sequence_index=session_counter,
                    revision_stage=stage_idx,
                    notes=f"Stage {stage_idx} Spaced Revision (Perf Score: {topic.performance_score if topic.performance_score is not None else 'N/A'})"
                )
                scheduled_sessions.append(session)
                assigned_day.available_revision_hours -= session_duration_hrs
                session_counter += 1

    return scheduled_sessions
