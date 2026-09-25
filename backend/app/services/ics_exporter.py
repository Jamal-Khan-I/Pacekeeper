"""
.ics iCalendar Exporter for Pacekeeper.
Converts Pacekeeper scheduled lesson and spaced-revision sessions into standard RFC 5545 .ics format
for import into Google Calendar, Microsoft Outlook, Apple Calendar, etc.
"""

from typing import Dict, Any, List
from datetime import datetime, date, timedelta, timezone


def generate_ics_calendar(schedule_data: Dict[str, Any]) -> str:
    """
    Generates RFC 5545 compliant .ics calendar content string from schedule data.
    """
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Pacekeeper//Adaptive Lesson & Spaced-Revision Planner//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Pacekeeper Academic Schedule",
        "X-WR-TIMEZONE:UTC"
    ]

    teaching_sessions = schedule_data.get("teaching_sessions", [])
    revision_sessions = schedule_data.get("revision_sessions", [])
    all_sessions = []

    for s in teaching_sessions:
        s["_type"] = "Teaching"
        all_sessions.append(s)

    for s in revision_sessions:
        s["_type"] = f"Revision Stage {s.get('revision_stage', 1)}"
        all_sessions.append(s)

    now_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    for idx, sess in enumerate(all_sessions):
        topic_name = sess.get("topic_name", "Lesson Session")
        subject = sess.get("subject", "General")
        session_type = sess.get("_type", "Teaching")
        hours = sess.get("allocated_hours", 1.0)
        date_str = str(sess.get("scheduled_date", date.today().isoformat()))
        notes = sess.get("notes", "")

        try:
            dt_obj = datetime.strptime(date_str, "%Y-%m-%d")
        except Exception:
            dt_obj = datetime.now(timezone.utc)

        # Start at 09:00 AM by default for teaching, 04:00 PM for revision
        if "Revision" in session_type:
            start_dt = dt_obj.replace(hour=16, minute=0, second=0)
        else:
            start_dt = dt_obj.replace(hour=9, minute=0, second=0)

        duration_mins = int(hours * 60)
        end_dt = start_dt + timedelta(minutes=duration_mins)

        dt_start_str = start_dt.strftime("%Y%m%dT%H%M%SZ")
        dt_end_str = end_dt.strftime("%Y%m%dT%H%M%SZ")
        uid = f"pacekeeper-{sess.get('session_id', idx)}-{dt_start_str}@pacekeeper.app"

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{now_stamp}",
            f"DTSTART:{dt_start_str}",
            f"DTEND:{dt_end_str}",
            f"SUMMARY:[{session_type}] {topic_name} ({subject})",
            f"DESCRIPTION:Pacekeeper Session: {session_type}\\nSubject: {subject}\\nAllocated Hours: {hours}h\\nNotes: {notes}",
            f"CATEGORIES:Pacekeeper,{subject}",
            "STATUS:CONFIRMED",
            "END:VEVENT"
        ])

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


if __name__ == "__main__":
    sample_data = {
        "teaching_sessions": [
            {"session_id": "s1", "topic_name": "Calculus Integration", "subject": "Math", "scheduled_date": "2026-09-26", "allocated_hours": 2.0}
        ],
        "revision_sessions": [
            {"session_id": "r1", "topic_name": "Quantum Mechanics", "subject": "Physics", "scheduled_date": "2026-09-27", "allocated_hours": 1.0, "revision_stage": 1}
        ]
    }
    ics_output = generate_ics_calendar(sample_data)
    print("Generated ICS Output Sample:\n", ics_output[:300])
