"""
Teacher Copilot Agent Service for Pacekeeper.
Provides an interactive, multimodal AI assistant for teachers:
- Captures voice and text prompts
- Analyzes student answer sheet images (Vision)
- Auto-reschedules curriculum on command (Tool Calling)
- Generates interactive Mermaid schedule diagrams
- Dispatches classroom revision notifications
- Generates concise spoken voice responses
"""

import json
import re
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.agents.model_client import model_client
from backend.app.agents.performance_analyst import performance_analyst_agent
from backend.app.api.system import get_current_system_settings
from backend.app.api.schedule import execute_and_persist_schedule
from backend.app.services.notifications import notify_upcoming_revisions
from backend.app.db.models import TopicDB, PerformanceRecordDB, ScheduleStateDB, CalendarDayDB


class TeacherCopilotService:

    def _build_mermaid_diagram(self, schedule_dict: Dict[str, Any], class_title: str) -> str:
        """Constructs a clean Mermaid Gantt / Timeline diagram from schedule sessions."""
        teaching_sessions = schedule_dict.get("teaching_sessions", [])
        revision_sessions = schedule_dict.get("revision_sessions", [])

        lines = [
            "gantt",
            f"    title {class_title} Curriculum & Revision Roadmap",
            "    dateFormat YYYY-MM-DD",
            "    axisFormat %b %d",
        ]

        if teaching_sessions:
            lines.append("    section Teaching Lessons")
            for idx, sess in enumerate(teaching_sessions[:6]):
                t_name = sess.get("topic_name", f"Lesson {idx+1}").replace(":", " -")
                d_str = sess.get("scheduled_date", "2026-09-28")
                dur = max(1, int(round(sess.get("allocated_hours", 2.0) / 2.0)))
                lines.append(f"    {t_name} :{d_str}, {dur}d")

        if revision_sessions:
            lines.append("    section Spaced Revisions")
            for idx, sess in enumerate(revision_sessions[:6]):
                t_name = sess.get("topic_name", f"Revision {idx+1}").replace(":", " -")
                stage = sess.get("revision_stage", 1)
                d_str = sess.get("scheduled_date", "2026-09-29")
                lines.append(f"    Stage {stage}: {t_name} :{d_str}, 1d")

        return "\n".join(lines)

    def process_copilot_request(
        self,
        message: str,
        image_base64: Optional[str],
        class_id: str,
        db: Session,
        history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Processes a teacher's conversational prompt with multimodal image and tool execution.
        """
        settings = get_current_system_settings()
        active_tier = settings.get("active_tier", "free")
        cloud_prov = settings.get("cloud_provider", "gemini")
        provider = "local" if active_tier == "local" else cloud_prov if active_tier == "cloud" else "rule_based"
        api_key = settings.get(f"{cloud_prov}_api_key") if active_tier == "cloud" else None
        model = settings.get("local_model") if active_tier == "local" else settings.get(f"{cloud_prov}_model")

        target_class = class_id or "class_a"
        class_label = {
            "class_a": "Class 11-A (Mathematics)",
            "class_b": "Class 12-B (Physics)",
            "class_c": "Class 10-C (Chemistry)"
        }.get(target_class, f"Class {target_class.upper()}")

        # 1. Fetch current class topics & schedule context
        topics_db = db.query(TopicDB).filter(TopicDB.class_id == target_class).all()
        topic_names = [t.name for t in topics_db]

        sched_obj = execute_and_persist_schedule(db, class_id=target_class)
        schedule_dict = sched_obj.model_dump(mode="json") if hasattr(sched_obj, "model_dump") else sched_obj.dict()

        actions_taken = []
        diagnosis_result = None
        updated_schedule = None
        diagram_code = None

        msg_lower = (message or "").lower()

        # -------------------------------------------------------------
        # TOOL 1: Student Exam Paper Diagnosis (Vision)
        # -------------------------------------------------------------
        if image_base64:
            actions_taken.append("diagnose_answer_sheet")
            try:
                diag = performance_analyst_agent.analyze_answer_sheet(
                    image_input=image_base64,
                    provider=provider if active_tier != "free" else "rule_based",
                    api_key=api_key,
                    model=model,
                    class_id=target_class,
                    source="copilot"
                )
                diagnosis_result = diag.model_dump(mode="json") if hasattr(diag, "model_dump") else diag.dict()

                # Automatically log performance record for this class
                matched_topic_id = topics_db[0].id if topics_db else "top_1"
                for t in topics_db:
                    if t.name.lower() in (diagnosis_result.get("detected_topic") or "").lower():
                        matched_topic_id = t.id
                        break

                rec = PerformanceRecordDB(
                    student_name=diagnosis_result.get("student_name") or "Student Exam",
                    topic_id=matched_topic_id,
                    score=float(diagnosis_result.get("overall_score") or 0.40),
                    error_type=diagnosis_result.get("error_type") or "conceptual",
                    class_id=target_class
                )
                db.add(rec)
                db.commit()

                # Auto-reschedule because student performance changed
                actions_taken.append("auto_reschedule")
                sched_obj = execute_and_persist_schedule(db, class_id=target_class, adjust_weights=True)
                schedule_dict = sched_obj.model_dump(mode="json") if hasattr(sched_obj, "model_dump") else sched_obj.dict()
                updated_schedule = schedule_dict

            except Exception as e:
                print(f"[Copilot Error] Image diagnosis failed: {e}")

        # -------------------------------------------------------------
        # TOOL 2: Reschedule Curriculum On Command
        # -------------------------------------------------------------
        is_reschedule_requested = any(w in msg_lower for w in [
            "reschedule", "replan", "recalculate", "adjust schedule", "add revision",
            "more revision", "shift schedule", "update schedule", "rebalance"
        ])

        if is_reschedule_requested and "auto_reschedule" not in actions_taken:
            actions_taken.append("reschedule_curriculum")
            sched_obj = execute_and_persist_schedule(db, class_id=target_class, adjust_weights=True)
            schedule_dict = sched_obj.model_dump(mode="json") if hasattr(sched_obj, "model_dump") else sched_obj.dict()
            updated_schedule = schedule_dict

        # -------------------------------------------------------------
        # TOOL 3: Trigger Classroom Revision Notifications
        # -------------------------------------------------------------
        is_notify_requested = any(w in msg_lower for w in [
            "notify", "notification", "send alert", "fire notification", "remind", "reminder"
        ])

        notifications_sent = []
        if is_notify_requested:
            actions_taken.append("send_notifications")
            notifications_sent = notify_upcoming_revisions(schedule_dict)

        # -------------------------------------------------------------
        # TOOL 4: Generate Interactive Schedule Diagram
        # -------------------------------------------------------------
        is_diagram_requested = any(w in msg_lower for w in [
            "diagram", "draw", "visualize", "roadmap", "timeline", "gantt", "chart", "map"
        ])

        if is_diagram_requested or "reschedule_curriculum" in actions_taken or "auto_reschedule" in actions_taken:
            diagram_code = self._build_mermaid_diagram(schedule_dict, class_label)
            if is_diagram_requested:
                actions_taken.append("generate_diagram")

        # -------------------------------------------------------------
        # RESPONSE SYNTHESIS (LLM or Intelligent Heuristic)
        # -------------------------------------------------------------
        if active_tier == "free":
            # Free Tier: Pure deterministic pedagogical response
            summary_parts = [f"**Pacekeeper Copilot [Free Tier - Rule-Based Engine]** for {class_label}:"]

            if diagnosis_result:
                summary_parts.append(
                    f"\n• **Exam Diagnosis**: Analyzed student `{diagnosis_result.get('student_name', 'Student')}` on topic **{diagnosis_result.get('detected_topic', 'Topic')}** with score **{round(float(diagnosis_result.get('overall_score', 0))*100)}%**."
                    f"\n  *Identified Issue*: {diagnosis_result.get('diagnostic_summary', 'Errors found.')}"
                )

            if "reschedule_curriculum" in actions_taken or "auto_reschedule" in actions_taken:
                summary_parts.append(
                    f"\n• **Schedule Re-balanced**: The curriculum optimizer re-computed topic priority weights to protect against forgetting curve decay. "
                    f"Allocated {len(schedule_dict.get('teaching_sessions', []))} teaching blocks and {len(schedule_dict.get('revision_sessions', []))} spaced-revision periods."
                )

            if "send_notifications" in actions_taken:
                summary_parts.append(
                    f"\n• **Revision Alerts Dispatched**: Sent {len(notifications_sent)} revision reminders to Windows OS and notification tray for upcoming class periods."
                )

            if not actions_taken:
                summary_parts.append(
                    f"\n• **Classroom Status**: {class_label} has {len(topics_db)} registered syllabus topics: {', '.join(topic_names[:4])}. "
                    "You can ask me to reschedule periods, analyze exam sheets, draw curriculum diagrams, or fire notifications."
                )

            reply_text = "\n".join(summary_parts)
            spoken_text = f"Pacekeeper Copilot updated {class_label}. Curriculum and revision roadmap are in sync."

        else:
            # Local LLM (Ollama) or Cloud Tier (Gemini / OpenAI)
            system_prompt = (
                "You are 'Pacekeeper Teacher Copilot', an expert pedagogical assistant helping teachers manage "
                "classroom curriculum pacing, spaced repetition, student exam diagnostics, and school timetable allocation.\n"
                "Speak directly to the teacher in a supportive, professional, and actionable tone.\n"
                "Explain schedule trade-offs, highlight prerequisite topics, and recommend concrete classroom interventions (e.g. 15-minute starter quizzes, homework focus)."
            )

            user_prompt = (
                f"Class: {class_label}\n"
                f"Current Topics: {', '.join(topic_names)}\n"
                f"Actions Executed by Tools: {', '.join(actions_taken) if actions_taken else 'None'}\n"
                f"Diagnosis Data: {json.dumps(diagnosis_result or {})}\n"
                f"Schedule Summary: {len(schedule_dict.get('teaching_sessions', []))} teaching blocks, {len(schedule_dict.get('revision_sessions', []))} revision blocks.\n"
                f"Teacher's Message: {message}\n\n"
                "Provide a concise, helpful response addressing the teacher's request and explaining any actions taken."
            )

            try:
                reply_text = model_client.generate(
                    prompt=user_prompt,
                    system_prompt=system_prompt,
                    images=[image_base64] if image_base64 else None,
                    provider=provider,
                    api_key=api_key,
                    model=model
                )
            except Exception as e:
                reply_text = (
                    f"**Teacher Copilot [{provider.capitalize()} Mode]**\n\n"
                    f"I processed your request for **{class_label}**.\n"
                    f"• Actions completed: {', '.join(actions_taken) if actions_taken else 'Schedule verified'}.\n"
                    f"• Status: {len(schedule_dict.get('revision_sessions', []))} spaced revision blocks active.\n\n"
                    f"*(AI Note: {str(e)})*"
                )

            # Generate punchy spoken text (strip markdown and keep 1-2 sentences)
            clean_speech = re.sub(r'[*#_`\[\]]', '', reply_text)
            clean_speech = clean_speech.split('\n')[0][:180].strip()
            spoken_text = clean_speech if clean_speech else f"Pacekeeper Copilot updated {class_label}."

        return {
            "status": "success",
            "reply": reply_text,
            "spoken_text": spoken_text,
            "actions_taken": actions_taken,
            "diagram_code": diagram_code,
            "diagnosis": diagnosis_result,
            "updated_schedule": updated_schedule,
            "notifications_count": len(notifications_sent),
            "tier_used": active_tier,
            "provider_used": provider if active_tier != "free" else "rule_based"
        }


copilot_service = TeacherCopilotService()
