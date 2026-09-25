"""
Teaching Hours Allocation Module.
Allocates available teaching hours across topics proportionally based on priority scores
and remaining estimated hours needed, enforcing a guaranteed minimum-hour floor (e.g. 0.5h).
If total hours cannot cover the floor for every topic, surfaces excluded topics explicitly.
"""

from typing import List, Dict, Tuple, Optional
from backend.app.core.schemas import Topic


class AllocationResult(tuple):
    """
    Subclasses 2-tuple (allocations_map, unallocated_hours) for seamless backwards compatibility,
    while exposing detailed exclusion metadata.
    """
    def __new__(cls, allocations: Dict[str, float], unallocated: float, excluded_topics: Optional[List[Topic]] = None):
        return super().__new__(cls, (allocations, unallocated))

    def __init__(self, allocations: Dict[str, float], unallocated: float, excluded_topics: Optional[List[Topic]] = None):
        self.allocations = allocations
        self.unallocated = unallocated
        self.excluded_topics = excluded_topics or []
        self.excluded_topic_ids = [t.id for t in self.excluded_topics]
        self.excluded_topic_names = [t.name for t in self.excluded_topics]


def calculate_priority_shares(
    topics: List[Topic],
    priority_scores: Dict[str, float]
) -> Dict[str, float]:
    """Calculates each active topic's normalized proportional share of total priority (0.0 to 1.0)."""
    active_topics = [t for t in topics if not t.is_completed and t.remaining_hours > 0]
    if not active_topics:
        return {}
    total_priority = sum(max(0.0001, priority_scores.get(t.id, 0.0)) for t in active_topics)
    return {
        t.id: round(max(0.0001, priority_scores.get(t.id, 0.0)) / total_priority, 4)
        for t in active_topics
    }


def allocate_teaching_hours(
    topics: List[Topic],
    priority_scores: Dict[str, float],
    total_available_hours: float,
    min_session_block: float = 0.5,
    min_topic_floor: float = 0.5
) -> AllocationResult:
    """
    Allocates available teaching hours strictly proportional to priority shares,
    enforcing a guaranteed minimum floor (e.g. 0.5h) for every scheduled topic:
    1. Active topics are prioritized by priority score descending.
    2. If total available hours cannot cover min_floor for all topics, the engine
       explicitly excludes the lowest-priority excess topics rather than silently giving 0h.
    3. Every schedulable topic receives at least min_topic_floor (e.g. 0.5h).
    4. Schedulable topics receive hours proportional to (priority / sum_priorities) * total_hours.
    5. Allocations snap to min_session_block increments.
    """
    allocations: Dict[str, float] = {t.id: 0.0 for t in topics}
    active_topics = [t for t in topics if not t.is_completed and t.remaining_hours > 0]

    if not active_topics or total_available_hours <= 0:
        return AllocationResult(allocations, max(0.0, total_available_hours), excluded_topics=active_topics)

    # Sort active topics by priority score descending
    sorted_active = sorted(
        active_topics,
        key=lambda t: priority_scores.get(t.id, 0.0),
        reverse=True
    )

    floor_step = min_topic_floor if min_topic_floor > 0 else 0.5

    # Determine maximum number of topics that can be granted the minimum floor
    max_schedulable_count = int(total_available_hours // floor_step)
    
    if max_schedulable_count < len(sorted_active):
        schedulable_topics = sorted_active[:max_schedulable_count]
        excluded_topics = sorted_active[max_schedulable_count:]
    else:
        schedulable_topics = sorted_active
        excluded_topics = []

    if not schedulable_topics:
        return AllocationResult(allocations, total_available_hours, excluded_topics=excluded_topics)

    # Compute raw proportional hours among schedulable topics
    total_priority = sum(max(0.0001, priority_scores.get(t.id, 0.0)) for t in schedulable_topics)
    if total_priority <= 0:
        total_priority = float(len(schedulable_topics))

    proportional_raw: Dict[str, float] = {}
    for t in schedulable_topics:
        p_score = max(0.0001, priority_scores.get(t.id, 0.0))
        share = p_score / total_priority
        raw_hours = share * total_available_hours
        capped_hours = min(t.remaining_hours, raw_hours)
        
        # Snap to nearest min_session_block
        stepped = round(capped_hours / min_session_block) * min_session_block
        
        # Enforce minimum floor for all scheduled topics
        if stepped < floor_step and t.remaining_hours >= floor_step:
            stepped = floor_step
        
        proportional_raw[t.id] = min(t.remaining_hours, stepped)

    # Balance allocations if floor bumps caused sum to exceed available hours
    total_allocated = sum(proportional_raw.values())
    if total_allocated > total_available_hours:
        overage = round(total_allocated - total_available_hours, 2)
        # Reduce from lowest-priority topics that exceed floor_step
        for t in reversed(schedulable_topics):
            if overage <= 0:
                break
            excess = proportional_raw[t.id] - floor_step
            if excess > 0:
                reduction = min(excess, overage)
                reduction = round(reduction / min_session_block) * min_session_block if reduction >= min_session_block else reduction
                proportional_raw[t.id] = round(proportional_raw[t.id] - reduction, 2)
                overage = round(overage - reduction, 2)

    total_allocated = sum(proportional_raw.values())
    unallocated = max(0.0, round(total_available_hours - total_allocated, 2))

    # Top up highest priority topics that still have room if unallocated >= min_session_block
    if unallocated >= min_session_block:
        for t in schedulable_topics:
            if unallocated < min_session_block:
                break
            room = t.remaining_hours - proportional_raw[t.id]
            if room >= min_session_block:
                blocks = int(min(room, unallocated) // min_session_block)
                if blocks > 0:
                    add_hrs = blocks * min_session_block
                    proportional_raw[t.id] += add_hrs
                    unallocated = round(unallocated - add_hrs, 2)

    for t_id, hrs in proportional_raw.items():
        allocations[t_id] = hrs

    return AllocationResult(allocations, unallocated, excluded_topics=excluded_topics)
