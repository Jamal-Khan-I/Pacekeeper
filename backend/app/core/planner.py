"""
Unified Deterministic Lesson Planner Engine.
Combines priority scoring, teaching hour allocation, spaced repetition,
adaptive weighting, and calendar disruption re-planning.
"""

from datetime import date, timedelta
from typing import List, Dict, Optional
import copy

from backend.app.core.schemas import (
    Topic,
    AdaptiveWeights,
    CalendarDay,
    ScheduledSession,
    SessionType,
    PerformanceRecord,
    ScheduleResult,
)
from backend.app.core.scoring import compute_all_topic_scores
from backend.app.core.allocation import allocate_teaching_hours
from backend.app.core.spaced_repetition import schedule_revision_sessions
from backend.app.core.adaptive_weights import adjust_adaptive_weights


class DeterministicPlannerEngine:
    """
    Core Planner Engine. Operates purely deterministically with zero external AI dependencies.
    """

    def generate_plan(
        self,
        topics: List[Topic],
        calendar_days: List[CalendarDay],
        current_weights: Optional[AdaptiveWeights] = None,
        performance_history: Optional[List[PerformanceRecord]] = None,
        start_date: Optional[date] = None,
        min_session_block: float = 1.0,
        adjust_weights: bool = True
    ) -> ScheduleResult:
        """
        Executes complete scheduling pipeline and returns ScheduleResult.
        """
        if current_weights is None:
            current_weights = AdaptiveWeights()

        if performance_history is None:
            performance_history = []

        # Deep copy topics so we don't mutate input objects unpredictably
        topics_working = copy.deepcopy(topics)
        
        # Apply latest performance scores to working topics
        latest_perf: Dict[str, float] = {}
        for rec in sorted(performance_history, key=lambda r: r.test_date):
            latest_perf[rec.topic_id] = rec.score

        for t in topics_working:
            if t.id in latest_perf:
                t.performance_score = latest_perf[t.id]

        # Self-adjust weights if performance history is present and adjustment enabled
        if adjust_weights:
            effective_weights = adjust_adaptive_weights(
                current_weights=current_weights,
                topics=topics_working,
                performance_records=performance_history
            )
        else:
            effective_weights = current_weights

        # Step 1: Compute Priority Scores
        priority_scores = compute_all_topic_scores(topics_working, effective_weights)

        # Sort calendar days by date
        sorted_calendar = sorted(copy.deepcopy(calendar_days), key=lambda d: d.date_val)
        
        if not start_date and sorted_calendar:
            start_date = sorted_calendar[0].date_val
        elif not start_date:
            start_date = date.today()

        # Calculate total available teaching hours across non-holiday days from start_date
        valid_teaching_days = [
            d for d in sorted_calendar
            if not d.is_holiday and d.available_teaching_hours > 0 and d.date_val >= start_date
        ]
        
        total_available_teaching_hrs = sum(d.available_teaching_hours for d in valid_teaching_days)

        # Step 2: Allocate Teaching Hours with Guaranteed Floor
        alloc_res = allocate_teaching_hours(
            topics=topics_working,
            priority_scores=priority_scores,
            total_available_hours=total_available_teaching_hrs,
            min_session_block=min_session_block,
            min_topic_floor=0.5
        )
        allocated_hours_map, unallocated_hrs = alloc_res
        excluded_topics = getattr(alloc_res, "excluded_topics", [])

        # Step 3: Map Teaching Allocations into Discrete Calendar Sessions
        teaching_sessions: List[ScheduledSession] = []
        session_idx = 1

        # Copy of calendar days with mutable hours balance
        calendar_day_map = {d.date_val: d for d in sorted_calendar if not d.is_holiday and d.date_val >= start_date}

        # Sort topics by priority score descending
        sorted_topics = sorted(topics_working, key=lambda t: priority_scores.get(t.id, 0.0), reverse=True)

        for topic in sorted_topics:
            hrs_to_schedule = allocated_hours_map.get(topic.id, 0.0)
            if hrs_to_schedule <= 0:
                continue

            for c_day in sorted(calendar_day_map.values(), key=lambda d: d.date_val):
                if hrs_to_schedule <= 0:
                    break
                if c_day.available_teaching_hours <= 0:
                    continue

                # Take up to available hours on this day, snapped to min_session_block (e.g. 0.5h or 1.0h)
                hrs_for_session = min(hrs_to_schedule, c_day.available_teaching_hours)
                hrs_for_session = round(hrs_for_session / min_session_block) * min_session_block
                if hrs_for_session <= 0:
                    continue

                session = ScheduledSession(
                    session_id=f"tch_{topic.id}_{session_idx}",
                    topic_id=topic.id,
                    topic_name=topic.name,
                    subject=topic.subject,
                    session_type=SessionType.TEACHING,
                    scheduled_date=c_day.date_val,
                    allocated_hours=hrs_for_session,
                    sequence_index=session_idx,
                    notes=f"Priority score: {priority_scores.get(topic.id, 0.0):.2f}"
                )
                teaching_sessions.append(session)
                
                c_day.available_teaching_hours = round(c_day.available_teaching_hours - hrs_for_session, 2)
                hrs_to_schedule = round(hrs_to_schedule - hrs_for_session, 2)
                session_idx += 1

        # Step 4: Generate Revision Sessions via Spaced Repetition
        revision_sessions = schedule_revision_sessions(
            topics=topics_working,
            calendar_days=sorted_calendar,
            start_date=start_date,
            session_duration_hrs=0.5
        )

        # Step 5: Compute Detailed Priority Math Breakdown and Proportional Shares
        max_weightage = max((t.exam_weightage for t in topics_working), default=100.0) or 100.0
        max_diff = max((t.difficulty for t in topics_working), default=5.0) or 5.0
        active_topics = [t for t in topics_working if not t.is_completed and t.remaining_hours > 0]
        total_prio_sum = sum(max(0.0001, priority_scores.get(t.id, 0.0)) for t in active_topics) or 1.0

        from backend.app.core.scoring import calculate_topic_priority_details

        topic_priority_details: Dict[str, Dict[str, Any]] = {}
        for t in topics_working:
            det = calculate_topic_priority_details(t, effective_weights, max_weightage, max_diff)
            raw_p = det["raw_priority"]
            share_pct = round((raw_p / total_prio_sum) * 100.0, 1) if t in active_topics else 0.0
            hrs = allocated_hours_map.get(t.id, 0.0)
            det["share_pct"] = share_pct
            det["allocated_hours"] = hrs
            det["topic_name"] = t.name
            det["subject"] = t.subject
            det["performance_score"] = t.performance_score
            det["is_untested"] = t.is_untested
            det["full_trace"] = f"{det['math_str']} → {share_pct}% share → {hrs}h"
            topic_priority_details[t.id] = det

        # Step 6: Build Deterministic Natural Language Explanation Summary with Traceable Math
        explanation = self._build_explanation(
            topics=topics_working,
            priority_scores=priority_scores,
            topic_priority_details=topic_priority_details,
            total_priority_sum=total_prio_sum,
            allocated_hours=allocated_hours_map,
            total_available_hrs=total_available_teaching_hrs,
            unallocated_hrs=unallocated_hrs,
            teaching_sessions_count=len(teaching_sessions),
            revision_sessions_count=len(revision_sessions),
            weights=effective_weights,
            excluded_topics=excluded_topics
        )

        return ScheduleResult(
            teaching_sessions=teaching_sessions,
            revision_sessions=revision_sessions,
            topic_scores=priority_scores,
            allocated_hours_per_topic=allocated_hours_map,
            unallocated_hours=unallocated_hrs,
            weights_used=effective_weights,
            explanation_summary=explanation,
            topic_priority_details=topic_priority_details,
            excluded_topics=[t.name for t in excluded_topics]
        )

    def _build_explanation(
        self,
        topics: List[Topic],
        priority_scores: Dict[str, float],
        topic_priority_details: Dict[str, Dict[str, Any]],
        total_priority_sum: float,
        allocated_hours: Dict[str, float],
        total_available_hrs: float,
        unallocated_hrs: float,
        teaching_sessions_count: int,
        revision_sessions_count: int,
        weights: AdaptiveWeights,
        excluded_topics: Optional[List[Topic]] = None
    ) -> str:
        """Constructs plain-language summary of scheduling decisions with per-topic mathematical trace."""
        sorted_topics = sorted(topics, key=lambda t: priority_scores.get(t.id, 0.0), reverse=True)
        lines = []
        lines.append(f"Deterministic Proportional Schedule ({total_available_hrs}h available teaching hours).")
        lines.append(
            f"Adaptive Weights: Weightage={weights.weightage_weight:.2f}x | "
            f"Difficulty={weights.difficulty_weight:.2f}x | "
            f"Gap={weights.gap_weight:.2f}x (bounded in [0.50x-2.00x])."
        )

        if excluded_topics:
            lines.append(
                f"\n⚠️ Constraint: {len(excluded_topics)} topic(s) excluded due to insufficient hours "
                f"({total_available_hrs}h available, 0.5h minimum-hour floor per topic). "
                f"Deferred topics: {', '.join(t.name for t in excluded_topics)}."
            )

        lines.append("\nPer-Topic Priority Math & Proportional Share:")

        for idx, t in enumerate(sorted_topics, start=1):
            hrs = allocated_hours.get(t.id, 0.0)
            det = topic_priority_details.get(t.id, {})
            w_norm = det.get("w_norm", 0.1)
            d_norm = det.get("d_norm", 0.1)
            gap = det.get("gap", 0.25)
            raw_p = det.get("raw_priority", priority_scores.get(t.id, 0.0))
            share_pct = det.get("share_pct", 0.0)
            math_str = det.get("math_str", "")

            if t.performance_score is not None:
                status_str = f"Tested ({t.performance_score*100:.0f}% score → Gap={gap:.4f})"
            else:
                target_pct = getattr(t, 'target_score', 0.85) * 100
                assumed_pct = max(5.0, target_pct - 20.0)
                status_str = f"Untested (Target {target_pct:.0f}% − 20% = Assumed {assumed_pct:.0f}% → Gap={gap:.4f})"

            floor_note = " (0.5h floor applied)" if hrs == 0.5 and share_pct * total_available_hrs / 100 < 0.5 else ""
            lines.append(
                f"{idx}. {t.name} ({t.subject}) - {status_str}\n"
                f"   * Math: {math_str}\n"
                f"   * Allocation: {raw_p:.4f} / {total_priority_sum:.4f} = {share_pct}% share → {hrs}h allocated{floor_note}"
            )

        lines.append(f"\nSessions: {teaching_sessions_count} teaching sessions | {revision_sessions_count} spaced revisions.")
        if unallocated_hrs > 0:
            lines.append(f"Unallocated buffer: {unallocated_hrs}h remaining.")

        return "\n".join(lines)
