"""
Unit tests for Pacekeeper's Phase 1 Deterministic Core Algorithm.
"""

import pytest
from datetime import date, timedelta
from backend.app.core.schemas import (
    Topic,
    TopicStatus,
    AdaptiveWeights,
    CalendarDay,
    PerformanceRecord,
)
from backend.app.core.scoring import calculate_topic_priority, compute_all_topic_scores
from backend.app.core.allocation import allocate_teaching_hours
from backend.app.core.spaced_repetition import (
    calculate_initial_revision_interval,
    calculate_ease_factor,
    generate_revision_dates,
    schedule_revision_sessions,
)
from backend.app.core.adaptive_weights import adjust_adaptive_weights
from backend.app.core.planner import DeterministicPlannerEngine


def test_topic_priority_scoring():
    weights = AdaptiveWeights(weightage_weight=1.0, difficulty_weight=1.0, gap_weight=1.2)
    
    # Topic A: High weightage, high diff, untested (gap 0.5)
    topic_a = Topic(id="t1", name="Calculus Derivatives", subject="Math", exam_weightage=20.0, difficulty=5.0, estimated_hours=10.0)
    # Topic B: Low weightage, low diff, good score (gap 0.1)
    topic_b = Topic(id="t2", name="Basic Algebra", subject="Math", exam_weightage=5.0, difficulty=2.0, estimated_hours=4.0, performance_score=0.9)
    
    scores = compute_all_topic_scores([topic_a, topic_b], weights)
    
    assert scores["t1"] > scores["t2"], "High weightage + difficult topic must score higher priority than easy + high score topic"


def test_teaching_hours_allocation():
    topics = [
        Topic(id="t1", name="Physics Mechanics", subject="Physics", exam_weightage=30.0, difficulty=4.0, estimated_hours=10.0),
        Topic(id="t2", name="Optics", subject="Physics", exam_weightage=15.0, difficulty=2.0, estimated_hours=5.0),
    ]
    scores = {"t1": 2.0, "t2": 1.0} # 2:1 priority ratio
    
    allocations, unallocated = allocate_teaching_hours(topics, scores, total_available_hours=12.0, min_session_block=1.0)
    
    assert allocations["t1"] == 8.0, "Topic t1 should receive 8 hours (2/3 of 12)"
    assert allocations["t2"] == 4.0, "Topic t2 should receive 4 hours (1/3 of 12)"
    assert unallocated == 0.0


test_today = date(2026, 9, 25)

def test_spaced_repetition_intervals():
    # Weak student (0.2 score) -> short interval
    int_weak = calculate_initial_revision_interval(0.2)
    # Mastered student (0.9 score) -> long interval
    int_strong = calculate_initial_revision_interval(0.9)
    
    assert int_weak < int_strong
    assert int_weak == 1 or int_weak == 2
    assert int_strong >= 8

    rev_dates = generate_revision_dates(start_date=test_today, performance_score=0.3, stages=3)
    assert len(rev_dates) == 3
    assert rev_dates[0] > test_today
    assert rev_dates[1] > rev_dates[0]
    assert rev_dates[2] > rev_dates[1]


def test_adaptive_weight_adjustment():
    initial_weights = AdaptiveWeights(weightage_weight=1.0, difficulty_weight=1.0, gap_weight=1.2)
    
    topics = [
        Topic(id="t1", name="Quantum Physics", subject="Physics", exam_weightage=20, difficulty=5.0, estimated_hours=10),
        Topic(id="t2", name="Kinematics", subject="Physics", exam_weightage=10, difficulty=2.0, estimated_hours=5),
    ]
    
    # Empirical test showing severe failure on high difficulty topic t1
    records = [
        PerformanceRecord(topic_id="t1", score=0.3, test_date=test_today),
        PerformanceRecord(topic_id="t2", score=0.85, test_date=test_today),
    ]
    
    new_weights = adjust_adaptive_weights(initial_weights, topics, records)
    
    assert new_weights.difficulty_weight > initial_weights.difficulty_weight, "Difficulty weight must increase when hard topics lag"


def test_full_planner_engine_and_calendar_disruption():
    planner = DeterministicPlannerEngine()
    
    topics = [
        Topic(id="t1", name="Organic Chemistry", subject="Chemistry", exam_weightage=25, difficulty=4.0, estimated_hours=8.0),
        Topic(id="t2", name="Periodic Table", subject="Chemistry", exam_weightage=10, difficulty=2.0, estimated_hours=4.0),
    ]
    
    # 5-day calendar with 2 hours teaching + 1 hour revision each
    calendar = [
        CalendarDay(date_val=test_today + timedelta(days=i), available_teaching_hours=2.0, available_revision_hours=1.0)
        for i in range(5)
    ]
    
    # Case 1: Initial Plan
    res1 = planner.generate_plan(topics, calendar, start_date=test_today)
    assert len(res1.teaching_sessions) > 0
    assert len(res1.revision_sessions) > 0
    assert res1.unallocated_hours >= 0.0
    assert res1.allocated_hours_per_topic["t1"] == 8.0 # Capped at t1.estimated_hours
    assert res1.allocated_hours_per_topic["t2"] == 2.0 # Proportional allocation of remaining hours

    # Case 2: Calendar Disruption (Day 2 becomes a Holiday, reducing available hours)
    calendar[1].is_holiday = True
    calendar[1].available_teaching_hours = 0.0
    calendar[1].available_revision_hours = 0.0
    
    res2 = planner.generate_plan(topics, calendar, start_date=test_today)
    
    # Verify no sessions are scheduled on the holiday
    holiday_sessions = [s for s in res2.teaching_sessions if s.scheduled_date == calendar[1].date_val]
    assert len(holiday_sessions) == 0, "No teaching sessions should be scheduled on a holiday"

    # Case 3: Performance test entered (Topic 1 score drops to 30%)
    perf_record = PerformanceRecord(topic_id="t1", score=0.3, test_date=test_today)
    res3 = planner.generate_plan(topics, calendar, performance_history=[perf_record], start_date=test_today)
    
    assert res3.topic_scores["t1"] > res1.topic_scores["t1"], "Topic score for t1 should rise after low test performance"


def test_minimum_hour_floor_and_weak_topic_allocation():
    """Tested weak topic (Basic Algebra at 40%) must receive at least 0.5h floor, never 0h."""
    topics = [
        Topic(id="t_calc", name="Calculus Derivatives", subject="Math", exam_weightage=28.0, difficulty=4.5, target_score=0.90, estimated_hours=5.0, performance_score=0.85),
        Topic(id="t_alg", name="Basic Algebra", subject="Math", exam_weightage=10.0, difficulty=2.0, target_score=0.80, estimated_hours=3.0, performance_score=0.40),
        Topic(id="t_trig", name="Trigonometry", subject="Math", exam_weightage=15.0, difficulty=3.0, target_score=0.85, estimated_hours=4.0),
    ]
    scores = {"t_calc": 1.5, "t_alg": 0.3, "t_trig": 0.6}
    
    allocations, unallocated = allocate_teaching_hours(topics, scores, total_available_hours=6.0, min_session_block=0.5, min_topic_floor=0.5)
    
    assert allocations["t_alg"] >= 0.5, "Basic Algebra at 40% weak score must receive at least the 0.5h floor"
    assert allocations["t_calc"] >= 0.5
    assert allocations["t_trig"] >= 0.5
    assert unallocated == 0.0


def test_insufficient_hours_explicit_exclusion():
    """If total hours cannot cover the 0.5h floor for all topics, excess topics must be surfaced in excluded_topics."""
    topics = [
        Topic(id="t1", name="Topic 1", subject="Math", exam_weightage=25.0, difficulty=4.0, estimated_hours=5.0),
        Topic(id="t2", name="Topic 2", subject="Math", exam_weightage=20.0, difficulty=3.5, estimated_hours=5.0),
        Topic(id="t3", name="Topic 3", subject="Math", exam_weightage=15.0, difficulty=3.0, estimated_hours=5.0),
        Topic(id="t4", name="Topic 4", subject="Math", exam_weightage=10.0, difficulty=2.5, estimated_hours=5.0),
    ]
    scores = {"t1": 1.2, "t2": 0.9, "t3": 0.6, "t4": 0.3}
    
    # 1.0 hour available with 0.5h floor can only cover 2 topics
    res = allocate_teaching_hours(topics, scores, total_available_hours=1.0, min_session_block=0.5, min_topic_floor=0.5)
    allocations, unallocated = res
    
    assert len(res.excluded_topics) == 2, "2 topics should be explicitly excluded due to insufficient hours"
    assert "t4" in res.excluded_topic_ids
    assert "t3" in res.excluded_topic_ids
    assert allocations["t1"] >= 0.5
    assert allocations["t2"] >= 0.5
    assert allocations["t3"] == 0.0
    assert allocations["t4"] == 0.0


def test_dynamic_untested_gap_calculation():
    """Untested topics must derive gap from individual target_score (target - 20%), not a flat constant."""
    topic_high_target = Topic(id="t_hi", name="High Target", subject="Math", exam_weightage=20.0, difficulty=3.0, target_score=0.90, estimated_hours=5.0)
    topic_low_target = Topic(id="t_lo", name="Low Target", subject="Math", exam_weightage=20.0, difficulty=3.0, target_score=0.70, estimated_hours=5.0)
    
    # High target 90%: assumed = 90% - 20% = 70% -> gap = 1.0 - 0.70 = 0.30
    assert round(topic_high_target.assumed_performance, 2) == 0.70
    assert round(topic_high_target.performance_gap, 2) == 0.30
    
    # Low target 70%: assumed = 70% - 20% = 50% -> gap = 1.0 - 0.50 = 0.50
    assert round(topic_low_target.assumed_performance, 2) == 0.50
    assert round(topic_low_target.performance_gap, 2) == 0.50
    
    # Gap must differ between topics with different targets!
    assert topic_high_target.performance_gap != topic_low_target.performance_gap


def test_full_precision_no_duplicate_priorities():
    """Topics with distinct weightages and difficulties must have distinct priority scores without coarse bucketing."""
    weights = AdaptiveWeights(weightage_weight=1.0, difficulty_weight=1.0, gap_weight=1.0)
    topics = [
        Topic(id="t1", name="Topic 1", subject="Math", exam_weightage=24.5, difficulty=4.2, target_score=0.85, estimated_hours=5.0),
        Topic(id="t2", name="Topic 2", subject="Math", exam_weightage=22.0, difficulty=4.0, target_score=0.85, estimated_hours=5.0),
        Topic(id="t3", name="Topic 3", subject="Math", exam_weightage=18.5, difficulty=3.6, target_score=0.80, estimated_hours=5.0),
    ]
    scores = compute_all_topic_scores(topics, weights)
    score_values = list(scores.values())
    assert len(score_values) == len(set(score_values)), "No duplicate priority scores should exist across distinct topics"
