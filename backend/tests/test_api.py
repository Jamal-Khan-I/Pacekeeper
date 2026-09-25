"""
Integration & Endpoint Tests for Pacekeeper FastAPI Application.
"""

import pytest
import os
from datetime import date, timedelta
from fastapi.testclient import TestClient

# Ensure test DB is used
TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test_pacekeeper.db")
if os.path.exists(TEST_DB_PATH):
    try:
        os.remove(TEST_DB_PATH)
    except OSError:
        pass

os.environ["SQLALCHEMY_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from backend.app.main import app
from backend.app.db.database import init_db

# Initialize test database
init_db()

client = TestClient(app)


def test_system_tier_info():
    response = client.get("/api/system/tier-info")
    assert response.status_code == 200
    data = response.json()
    assert data["tier"] == "free"
    assert "local" in data["available_tiers"]


def test_topics_crud_and_schedule():
    # 1. Create Topic
    topic_payload = {
        "name": "Calculus Integration",
        "subject": "Mathematics",
        "exam_weightage": 25.0,
        "difficulty": 4.0,
        "estimated_hours": 6.0,
        "tags": ["math", "calculus"]
    }
    create_res = client.post("/api/topics", json=topic_payload)
    assert create_res.status_code == 201
    topic_data = create_res.json()
    topic_id = topic_data["id"]
    assert topic_data["name"] == "Calculus Integration"
    assert topic_data["remaining_hours"] == 6.0

    # 2. Get All Topics
    get_res = client.get("/api/topics")
    assert get_res.status_code == 200
    topics_list = get_res.json()
    assert len(topics_list) >= 1
    assert any(t["id"] == topic_id for t in topics_list)

    # 3. Update Topic
    update_payload = {"estimated_hours": 8.0, "status": "in_progress"}
    put_res = client.put(f"/api/topics/{topic_id}", json=update_payload)
    assert put_res.status_code == 200
    updated_topic = put_res.json()
    assert updated_topic["estimated_hours"] == 8.0
    assert updated_topic["status"] == "in_progress"

    # 4. Bulk Setup Calendar
    today = date.today()
    calendar_days = [
        {
            "date_val": (today + timedelta(days=i)).isoformat(),
            "is_holiday": (i == 2), # Day 2 is holiday
            "available_teaching_hours": 0.0 if (i == 2) else 3.0,
            "available_revision_hours": 0.0 if (i == 2) else 1.5,
            "note": "Holiday" if (i == 2) else None
        }
        for i in range(5)
    ]
    cal_res = client.post("/api/calendar/bulk", json={"days": calendar_days})
    assert cal_res.status_code == 200
    assert len(cal_res.json()) == 5

    # 5. Generate Schedule
    gen_res = client.post("/api/schedule/generate")
    assert gen_res.status_code == 200
    sched_data = gen_res.json()
    assert "teaching_sessions" in sched_data
    assert "explanation_summary" in sched_data

    # 6. Fetch Current Schedule
    curr_res = client.get("/api/schedule/current")
    assert curr_res.status_code == 200
    assert curr_res.json()["explanation_summary"] == sched_data["explanation_summary"]

    # 7. Submit Performance Record (trigging re-plan)
    perf_payload = {
        "topic_id": topic_id,
        "score": 0.35, # Weak score -> should increase priority score
        "test_date": today.isoformat(),
        "max_score": 100,
        "raw_score": 35,
        "question_breakdown": {"mcq": 0.5, "long_answer": 0.2}
    }
    perf_res = client.post("/api/performance", json=perf_payload)
    assert perf_res.status_code == 201
    replanned_schedule = perf_res.json()
    assert replanned_schedule["topic_scores"][topic_id] > 0.0

    # 8. Delete Topic
    del_res = client.delete(f"/api/topics/{topic_id}")
    assert del_res.status_code == 204
