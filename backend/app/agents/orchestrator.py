"""
Orchestrator Agent using LangGraph.
Wires Ingestion, Performance Analyst, Scheduler Tool, and Explainer Agent into a stateful workflow.
"""

from typing import Dict, Any, List, Optional, TypedDict
from langgraph.graph import StateGraph, END

from backend.app.agents.performance_analyst import performance_analyst_agent, AnswerSheetDiagnosis
from backend.app.agents.ingestion_agent import ingestion_agent, IngestionResult
from backend.app.agents.scheduler_tool import scheduler_tool
from backend.app.agents.model_client import model_client
from backend.app.core.schemas import Topic, CalendarDay, PerformanceRecord, ScheduleResult
import json


class AgentPipelineState(TypedDict):
    answer_sheet_image: Optional[str]
    doc_image: Optional[str]
    topics: List[Topic]
    calendar_days: List[CalendarDay]
    performance_records: List[PerformanceRecord]
    provider: Optional[str]
    api_key: Optional[str]
    model: Optional[str]
    diagnosis: Optional[Dict[str, Any]]
    schedule_result: Optional[ScheduleResult]
    final_explanation: Optional[str]


def analyze_performance_node(state: AgentPipelineState) -> Dict[str, Any]:
    """Node 1: Runs Performance Analyst Agent on uploaded answer sheet image."""
    img = state.get("answer_sheet_image")
    if not img:
        return {"diagnosis": None}

    diag = performance_analyst_agent.analyze_answer_sheet(
        image_input=img,
        provider=state.get("provider", "local"),
        api_key=state.get("api_key"),
        model=state.get("model")
    )
    return {"diagnosis": diag.model_dump() if hasattr(diag, 'model_dump') else diag.dict()}


def schedule_node(state: AgentPipelineState) -> Dict[str, Any]:
    """Node 2: Runs Scheduler Tool to generate deterministic schedule."""
    topics = state.get("topics", [])
    calendar = state.get("calendar_days", [])
    perf = state.get("performance_records", [])

    # If diagnosis created a new score, update performance records list
    diag = state.get("diagnosis")
    if diag:
        target_topic_id = topics[0].id if topics else "top_1"
        for t in topics:
            if t.name.lower() in diag.get("detected_topic", "").lower():
                target_topic_id = t.id
                break

        perf.append(
            PerformanceRecord(
                topic_id=target_topic_id,
                score=diag.get("overall_score", 0.35),
                test_date=state.get("calendar_days", [CalendarDay(date_val=None)])[0].date_val if state.get("calendar_days") else None
            )
        )

    res = scheduler_tool.run_scheduling(topics=topics, calendar_days=calendar, performance_records=perf)
    return {"schedule_result": res}


def generate_explanation_node(state: AgentPipelineState) -> Dict[str, Any]:
    """Node 3: Generates final natural language explanation combining diagnosis + schedule."""
    diag = state.get("diagnosis")
    sched: Optional[ScheduleResult] = state.get("schedule_result")

    prompt = (
        "Synthesize a natural language explanation for the teacher. "
        f"Answer Sheet Diagnosis: {json.dumps(diag or {})}. "
        f"Engine Schedule Summary: {sched.explanation_summary if sched else 'Schedule re-allocated.'}. "
        "Explain in clear terms why the schedule shifted and what revision focus was added."
    )

    explanation = model_client.generate(
        prompt=prompt,
        provider=state.get("provider", "local"),
        api_key=state.get("api_key"),
        model=state.get("model")
    )
    if not explanation or len(explanation) < 20:
        explanation = sched.explanation_summary if sched else "Schedule recomputed successfully."

    return {"final_explanation": explanation}


def create_agent_workflow():
    workflow = StateGraph(AgentPipelineState)

    workflow.add_node("analyze_performance", analyze_performance_node)
    workflow.add_node("schedule", schedule_node)
    workflow.add_node("generate_explanation", generate_explanation_node)

    workflow.set_entry_point("analyze_performance")
    workflow.add_edge("analyze_performance", "schedule")
    workflow.add_edge("schedule", "generate_explanation")
    workflow.add_edge("generate_explanation", END)

    return workflow.compile()


agent_app = create_agent_workflow()
