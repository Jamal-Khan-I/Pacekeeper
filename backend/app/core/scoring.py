"""
Topic Priority Scoring Module.
Calculates deterministic priority scores for syllabus topics using exam weightage,
difficulty rating, performance gap, and adaptive weights.
"""

from typing import List, Dict, Any
from backend.app.core.schemas import Topic, AdaptiveWeights


def normalize_val(val: float, max_val: float, floor: float = 0.01) -> float:
    """
    Normalizes a numerical value into (floor, 1.0] range using full precision.
    Avoids coarse bucketing or artificial min-subtraction so distinct topic inputs
    yield distinctly unique priority scores.
    """
    if max_val <= 0.0:
        return floor
    norm = val / max_val
    return max(floor, min(1.0, norm))


def calculate_topic_priority_details(
    topic: Topic,
    weights: AdaptiveWeights,
    max_exam_weightage: float = 100.0,
    max_difficulty: float = 5.0
) -> Dict[str, Any]:
    """
    Computes priority score for a single topic using actual per-topic values at full precision:
    Score = (w_weight * W_norm) * (w_diff * D_norm) * (w_gap * Gap)
    Untested topics use dynamic gap derived from that topic's individual target_score (target - 20%).
    """
    w_norm = normalize_val(topic.exam_weightage, max_exam_weightage)
    d_norm = normalize_val(topic.difficulty, max_difficulty)
    gap = topic.performance_gap
    is_untested = topic.is_untested
    target_score = getattr(topic, "target_score", 0.85)

    if not is_untested:
        gap_calc_str = f"Tested ({topic.performance_score*100:.0f}% score → Gap={gap:.4f})"
        assumed_perf = topic.performance_score
    else:
        assumed_perf = topic.assumed_performance
        gap_calc_str = f"Untested (Target {target_score*100:.0f}% − 20% = Assumed {assumed_perf*100:.0f}% → Gap={gap:.4f})"

    score = (
        (weights.weightage_weight * w_norm) *
        (weights.difficulty_weight * d_norm) *
        (weights.gap_weight * gap)
    )
    raw_priority = round(score, 4)

    math_str = (
        f"({weights.weightage_weight:.2f} × {w_norm:.4f}) × "
        f"({weights.difficulty_weight:.2f} × {d_norm:.4f}) × "
        f"({weights.gap_weight:.2f} × {gap:.4f}) = {raw_priority:.4f}"
    )

    return {
        "raw_priority": raw_priority,
        "w_norm": round(w_norm, 4),
        "d_norm": round(d_norm, 4),
        "gap": round(gap, 4),
        "target_score": round(target_score, 2),
        "assumed_perf": round(assumed_perf, 2) if assumed_perf is not None else None,
        "gap_calc_str": gap_calc_str,
        "is_untested": is_untested,
        "w_weight": round(weights.weightage_weight, 2),
        "w_diff": round(weights.difficulty_weight, 2),
        "w_gap": round(weights.gap_weight, 2),
        "math_str": math_str
    }


def calculate_topic_priority(
    topic: Topic,
    weights: AdaptiveWeights,
    max_exam_weightage: float = 100.0,
    max_difficulty: float = 5.0
) -> float:
    """Computes priority score for a single topic."""
    return calculate_topic_priority_details(
        topic, weights, max_exam_weightage, max_difficulty
    )["raw_priority"]


def compute_all_topic_scores(
    topics: List[Topic],
    weights: AdaptiveWeights
) -> Dict[str, float]:
    """
    Calculates priority scores for all topics in a list, automatically determining max bounds.
    """
    if not topics:
        return {}

    max_weightage = max((t.exam_weightage for t in topics), default=100.0)
    if max_weightage <= 0:
        max_weightage = 100.0

    max_diff = max((t.difficulty for t in topics), default=5.0)
    if max_diff <= 0:
        max_diff = 5.0

    scores = {}
    for topic in topics:
        scores[topic.id] = calculate_topic_priority(
            topic,
            weights,
            max_exam_weightage=max_weightage,
            max_difficulty=max_diff
        )

    return scores
