"""
Adaptive Weighting Engine.
Self-adjusts topic priority scoring weights (exam_weightage, difficulty, performance_gap)
based on observed performance feedback loops.
"""

from typing import List, Dict
from backend.app.core.schemas import Topic, AdaptiveWeights, PerformanceRecord


def adjust_adaptive_weights(
    current_weights: AdaptiveWeights,
    topics: List[Topic],
    performance_records: List[PerformanceRecord],
    learning_rate: float = 0.05
) -> AdaptiveWeights:
    """
    Adjusts weights based on empirical student performance data:
    - If high difficulty topics show severe score gaps, difficulty_weight increases.
    - If high weightage topics suffer, weightage_weight increases.
    - If performance gaps persist across many topics, gap_weight increases.
    """
    if not topics or not performance_records:
        return current_weights

    # 1. Map latest score strictly per topic in the active topic set
    topic_map = {t.id: t for t in topics}
    latest_scores: Dict[str, float] = {}

    # Seed with existing topic performance_score if present
    for t in topics:
        if t.performance_score is not None:
            latest_scores[t.id] = float(t.performance_score)

    # Overlay verified test records belonging strictly to this active topic set
    for rec in sorted(performance_records, key=lambda r: r.test_date):
        if rec.topic_id in topic_map:
            latest_scores[rec.topic_id] = float(rec.score)

    if not latest_scores:
        return current_weights

    # Calculate metrics exclusively on active topics
    diff_scores = []
    weightage_scores = []
    all_scores = list(latest_scores.values())

    max_diff = max((t.difficulty for t in topics), default=5.0)
    max_weightage = max((t.exam_weightage for t in topics), default=100.0)

    for topic_id, score in latest_scores.items():
        t = topic_map.get(topic_id)
        if not t:
            continue
        if t.difficulty >= max_diff * 0.7:
            diff_scores.append(score)
        if t.exam_weightage >= max_weightage * 0.7:
            weightage_scores.append(score)

    avg_all = sum(all_scores) / len(all_scores)
    avg_diff = sum(diff_scores) / len(diff_scores) if diff_scores else avg_all
    avg_weightage = sum(weightage_scores) / len(weightage_scores) if weightage_scores else avg_all

    # Initial clamp to ensure current weights are bounded [0.5, 2.0]
    w_weight = min(2.0, max(0.5, current_weights.weightage_weight))
    w_diff = min(2.0, max(0.5, current_weights.difficulty_weight))
    w_gap = min(2.0, max(0.5, current_weights.gap_weight))

    # Symmetric, bidirectional adjustment logic with responsive step size [-0.15, +0.15]
    # 1. Difficulty Weight: responds when difficult topics lag behind
    delta_diff = 0.0
    if avg_diff < avg_all - 0.05:
        raw_delta = (avg_all - avg_diff) * 0.40
        delta_diff = min(0.15, max(0.04, raw_delta))
    elif avg_diff > avg_all + 0.05:
        raw_delta = (avg_diff - avg_all) * 0.40
        delta_diff = -min(0.15, max(0.04, raw_delta))
    else:
        # Gentle mean-reversion towards 1.0 to prevent freeze
        if w_diff > 1.04:
            delta_diff = -0.04
        elif w_diff < 0.96:
            delta_diff = 0.04

    # 2. Weightage Weight: responds when high exam-weightage topics lag behind
    delta_weight = 0.0
    if avg_weightage < 0.70:
        raw_delta = (0.70 - avg_weightage) * 0.45
        delta_weight = min(0.15, max(0.05, raw_delta))
    elif avg_weightage >= 0.75:
        raw_delta = (avg_weightage - 0.75) * 0.45
        delta_weight = -min(0.15, max(0.05, raw_delta))
    else:
        if w_weight > 1.04:
            delta_weight = -0.04
        elif w_weight < 0.96:
            delta_weight = 0.04

    # 3. Gap Weight: responds when class-wide performance is lagging
    delta_gap = 0.0
    if avg_all < 0.65:
        raw_delta = (0.65 - avg_all) * 0.45
        delta_gap = min(0.15, max(0.05, raw_delta))
    elif avg_all >= 0.75:
        raw_delta = (avg_all - 0.75) * 0.45
        delta_gap = -min(0.15, max(0.05, raw_delta))
    else:
        if w_gap > 1.04:
            delta_gap = -0.04
        elif w_gap < 0.96:
            delta_gap = 0.04

    # Strict clamping within fixed range [0.50, 2.00]
    new_weights = AdaptiveWeights(
        weightage_weight=round(min(2.0, max(0.5, w_weight + delta_weight)), 2),
        difficulty_weight=round(min(2.0, max(0.5, w_diff + delta_diff)), 2),
        gap_weight=round(min(2.0, max(0.5, w_gap + delta_gap)), 2),
    )

    return new_weights
