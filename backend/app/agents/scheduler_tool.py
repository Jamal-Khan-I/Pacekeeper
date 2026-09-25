"""
Scheduler Tool Wrapper for LangGraph.
Calls DeterministicPlannerEngine as a pure deterministic tool.
"""

from typing import List, Dict, Any, Optional
from datetime import date

from backend.app.core.planner import DeterministicPlannerEngine
from backend.app.core.schemas import Topic, CalendarDay, PerformanceRecord, AdaptiveWeights, ScheduleResult


class SchedulerTool:

    def __init__(self):
        self.engine = DeterministicPlannerEngine()

    def run_scheduling(
        self,
        topics: List[Topic],
        calendar_days: List[CalendarDay],
        performance_records: Optional[List[PerformanceRecord]] = None,
        weights: Optional[AdaptiveWeights] = None
    ) -> ScheduleResult:
        """Invokes the deterministic planning engine and returns schedule result."""
        return self.engine.generate_plan(
            topics=topics,
            calendar_days=calendar_days,
            current_weights=weights,
            performance_history=performance_records or []
        )


scheduler_tool = SchedulerTool()
