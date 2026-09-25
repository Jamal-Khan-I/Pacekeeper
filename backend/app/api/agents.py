"""
API Router for Local Agent Operations (Ollama, Vision Diagnosis, Ingestion, Voice TTS).

Part A Fix: The exception-level fallback that returned hardcoded 'Calculus Integration' has been
replaced with a transparent error response. All real errors now surface clearly in the UI.

Part B: analyze-answer-sheet and demo-seed now accept class_id to scope topic lookup + perf records.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
import base64
import json
import os
import uuid
import datetime

from backend.app.db.database import get_db
from backend.app.db.models import TopicDB, PerformanceRecordDB, AdaptiveWeightsDB
from backend.app.agents.ollama_client import ollama_client
from backend.app.agents.performance_analyst import performance_analyst_agent, AnswerSheetDiagnosis
from backend.app.agents.ingestion_agent import ingestion_agent
from backend.app.agents.voice_tts import voice_tts
from backend.app.agents.logger_util import safe_print
from backend.app.api.performance import submit_performance
from backend.app.schemas.api_schemas import PerformanceCreate, ScheduleResponse

router = APIRouter(prefix="/api/agents", tags=["Local Agents"])


class SpeakRequest(BaseModel):
    text: str


@router.get("/ollama-status")
def get_ollama_status():
    return ollama_client.check_health()


from backend.app.api.system import get_current_system_settings


@router.post("/analyze-answer-sheet")
async def analyze_answer_sheet_api(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    filename: Optional[str] = Form(None),
    topic_hint: Optional[str] = Form(None),
    provider: Optional[str] = Form(None),
    api_key: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    class_id: Optional[str] = Form(None),
    source: Optional[str] = Form("live"),
    db: Session = Depends(get_db)
):
    """
    Analyzes an uploaded answer sheet image via the configured AI provider.
    Logs timestamp, provider, model, fallback status, and raw output to backend console.
    class_id scopes the topic lookup to the correct class.
    source='live' saves images to uploads/live/{class_id}/; source='demo' uses demo_data.
    """
    req_source = source or "live"
    effective_filename = filename or (file.filename if file else None)
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    safe_print(f"[{ts}] [analyze-answer-sheet] Received request | class_id={class_id} | topic_hint={topic_hint} | provider={provider} | source={req_source} | filename={effective_filename}")

    if not file and not image_base64:
        raise HTTPException(status_code=400, detail="No image provided. Supply 'file' or 'image_base64'.")

    image_input = None
    raw_content = None
    if file:
        raw_content = await file.read()
        image_input = base64.b64encode(raw_content).decode("utf-8")
        safe_print(f"[{ts}] [analyze-answer-sheet] File upload received | size={len(raw_content)} bytes | filename={file.filename}")
    elif image_base64:
        image_input = image_base64
        safe_print(f"[{ts}] [analyze-answer-sheet] Base64 image received | length={len(image_base64)} chars")

    # Storage Separation: If live upload, save permanently in uploads/live/{class_id}/
    saved_image_path = None
    if req_source == "live":
        try:
            project_root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
            live_dir = os.path.join(project_root, "uploads", "live", class_id or "class_a")
            os.makedirs(live_dir, exist_ok=True)
            file_ext = os.path.splitext(effective_filename)[1] if effective_filename and '.' in effective_filename else ".jpg"
            save_name = f"{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}{file_ext}"
            saved_file_abs = os.path.join(live_dir, save_name)
            if raw_content:
                with open(saved_file_abs, "wb") as f_out:
                    f_out.write(raw_content)
            elif image_base64:
                b64_clean = image_base64
                if "," in b64_clean:
                    b64_clean = b64_clean.split(",", 1)[1]
                with open(saved_file_abs, "wb") as f_out:
                    f_out.write(base64.b64decode(b64_clean))
            saved_image_path = os.path.relpath(saved_file_abs, project_root).replace("\\", "/")
            safe_print(f"[{ts}] [analyze-answer-sheet] Saved LIVE upload to {saved_image_path}")
        except Exception as save_err:
            safe_print(f"[{ts}] [analyze-answer-sheet] Warning saving live upload file: {save_err}")
    else:
        saved_image_path = f"demo_data/{effective_filename}" if effective_filename else "demo_data/sample.jpg"

    sys_settings = get_current_system_settings()

    req_provider = provider or (sys_settings["cloud_provider"] if sys_settings["active_tier"] == "cloud" else "local")

    if req_provider.lower() == "gemini":
        req_api_key = api_key or sys_settings.get("gemini_api_key")
        req_model = model or sys_settings.get("gemini_model", "gemini-1.5-flash")
    elif req_provider.lower() == "groq":
        req_api_key = api_key or sys_settings.get("groq_api_key")
        req_model = model or sys_settings.get("groq_model", "llama-3.2-11b-vision-preview")
    else:
        req_api_key = None
        req_model = model or sys_settings.get("local_model", "gemma4:latest")

    safe_print(f"[{ts}] [analyze-answer-sheet] Routing to provider='{req_provider}' | model='{req_model}'")

    # Fetch available topics scoped to class_id for context
    topic_query = db.query(TopicDB)
    if class_id:
        topic_query = topic_query.filter(TopicDB.class_id == class_id)
    topics_db = topic_query.all()
    available_topics = [
        {"name": t.name, "subject": t.subject, "exam_weightage": t.exam_weightage}
        for t in topics_db
    ] if topics_db else None

    # Run Performance Analyst Agent — returns AnswerSheetDiagnosis or pipeline error object
    diagnosis: AnswerSheetDiagnosis = performance_analyst_agent.analyze_answer_sheet(
        image_input=image_input,
        topic_hint=topic_hint,
        available_topics=available_topics,
        provider=req_provider,
        api_key=req_api_key,
        model=req_model,
        class_id=class_id,
        filename=effective_filename,
    )

    ts2 = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    safe_print(
        f"[{ts2}] [analyze-answer-sheet] Diagnosis complete | "
        f"Topic='{diagnosis.detected_topic}' | "
        f"Score={diagnosis.overall_score:.2f} | "
        f"WeakTypes={diagnosis.weak_question_types}"
    )

    # Match detected topic against DB, scoped to class
    target_topic = None
    if topics_db:
        if topic_hint:
            for t in topics_db:
                if topic_hint.lower() in t.name.lower() or t.name.lower() in topic_hint.lower():
                    target_topic = t
                    break
        if not target_topic:
            for t in topics_db:
                if (t.name.lower() in diagnosis.detected_topic.lower() or
                        diagnosis.detected_topic.lower() in t.name.lower()):
                    target_topic = t
                    break
        if not target_topic and topics_db:
            target_topic = topics_db[0]

    # Auto-submit score to trigger schedule re-plan only if diagnosis was successful
    updated_schedule_dict = None
    if target_topic and diagnosis.overall_score > 0.0:
        from datetime import date
        perf_payload = PerformanceCreate(
            topic_id=target_topic.id,
            score=diagnosis.overall_score,
            test_date=date.today(),
            max_score=100.0,
            raw_score=diagnosis.overall_score * 100.0,
            question_breakdown={q_id: q.score for q_id, q in diagnosis.question_breakdown.items()},
            source=req_source,
            image_path=saved_image_path,
        )
        try:
            updated_sched_obj = submit_performance(payload=perf_payload, db=db)
            if hasattr(updated_sched_obj, 'model_dump'):
                updated_schedule_dict = updated_sched_obj.model_dump(mode='json')
            elif hasattr(updated_sched_obj, 'dict'):
                updated_schedule_dict = updated_sched_obj.dict()
            else:
                updated_schedule_dict = updated_sched_obj
        except Exception as submit_err:
            safe_print(f"[{ts2}] Warning: submit_performance failed: {submit_err}")

        # TTS announcement
        try:
            voice_tts.speak_text(
                f"Answer sheet diagnosed for {target_topic.name}. "
                f"Student scored {diagnosis.overall_score * 100:.0f} percent."
            )
        except Exception as tts_err:
            safe_print(f"[{ts2}] TTS warning: {tts_err}")

    diag_dict = diagnosis.model_dump(mode='json') if hasattr(diagnosis, 'model_dump') else diagnosis.dict()

    return {
        "diagnosis": diag_dict,
        "target_topic_id": target_topic.id if target_topic else None,
        "updated_schedule": updated_schedule_dict,
        "provider_used": req_provider,
        "class_id": class_id or "default",
        "source": req_source,
        "image_path": saved_image_path
    }


@router.post("/ingest-syllabus")
async def ingest_syllabus_api(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    provider: Optional[str] = Form(None),
    api_key: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    class_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    safe_print(f"[{ts}] [ingest-syllabus] Received | class_id={class_id} | provider={provider}")

    if not file and not image_base64:
        raise HTTPException(status_code=400, detail="No document provided.")

    image_input = None
    if file:
        content = await file.read()
        image_input = base64.b64encode(content).decode("utf-8")
    elif image_base64:
        image_input = image_base64

    sys_settings = get_current_system_settings()
    req_provider = provider or (sys_settings["cloud_provider"] if sys_settings["active_tier"] == "cloud" else "local")

    if req_provider.lower() == "gemini":
        req_api_key = api_key or sys_settings.get("gemini_api_key")
        req_model = model or sys_settings.get("gemini_model", "gemini-1.5-flash")
    elif req_provider.lower() == "groq":
        req_api_key = api_key or sys_settings.get("groq_api_key")
        req_model = model or sys_settings.get("groq_model", "llama-3.2-11b-vision-preview")
    else:
        req_api_key = None
        req_model = model or sys_settings.get("local_model", "gemma4:latest")

    result = ingestion_agent.ingest_document(
        image_input=image_input,
        provider=req_provider,
        api_key=req_api_key,
        model=req_model
    )
    return result.model_dump(mode='json') if hasattr(result, 'model_dump') else result.dict()


# ─────────────────────────────────────────────
#  CLASSES REGISTRY (Part B)
# ─────────────────────────────────────────────

CLASSES_REGISTRY = [
    {
        "class_id": "class_a",
        "label": "Class 11-A",
        "subject": "Advanced Mathematics",
        "description": "Calculus, Algebra, Trigonometry & Vectors",
        "color": "#6366f1"
    },
    {
        "class_id": "class_b",
        "label": "Class 12-B",
        "subject": "Physics",
        "description": "Thermodynamics, Electromagnetism, Quantum Mechanics & Optics",
        "color": "#10b981"
    },
    {
        "class_id": "class_c",
        "label": "Class 10-C",
        "subject": "Chemistry",
        "description": "Organic Chemistry, Electrochemistry & Kinetics",
        "color": "#f59e0b"
    }
]


@router.get("/classes")
def get_classes():
    """Returns the list of registered classes with their subjects."""
    return {"classes": CLASSES_REGISTRY}


# ─────────────────────────────────────────────
#  DEMO DATASET SEED ENDPOINT (Part C)
# ─────────────────────────────────────────────

DEMO_TOPICS = {
    "class_a": [
        {"name": "Calculus Derivatives & Chain Rule", "subject": "Mathematics", "exam_weightage": 28.0, "difficulty": 4.5, "target_score": 0.90, "estimated_hours": 4.0, "performance_score": 0.55, "tags": ["calculus", "derivatives"]},
        {"name": "Basic Algebra & Polynomials", "subject": "Mathematics", "exam_weightage": 14.0, "difficulty": 2.5, "target_score": 0.80, "estimated_hours": 2.5, "performance_score": 0.40, "tags": ["algebra", "polynomials"]},
        {"name": "Integral Calculus & Area Under Curve", "subject": "Mathematics", "exam_weightage": 22.0, "difficulty": 4.2, "target_score": 0.85, "estimated_hours": 3.5, "performance_score": 0.90, "tags": ["calculus", "integration"]},
        {"name": "Trigonometry & Trigonometric Identities", "subject": "Mathematics", "exam_weightage": 16.0, "difficulty": 3.8, "target_score": 0.85, "estimated_hours": 3.0, "performance_score": None, "tags": ["trigonometry"]},
        {"name": "Limits & Continuity", "subject": "Mathematics", "exam_weightage": 12.0, "difficulty": 3.2, "target_score": 0.80, "estimated_hours": 2.0, "performance_score": None, "tags": ["limits"]},
        {"name": "Linear Algebra & Matrices", "subject": "Mathematics", "exam_weightage": 8.0, "difficulty": 2.8, "target_score": 0.75, "estimated_hours": 2.0, "performance_score": None, "tags": ["algebra", "matrices"]},
    ],
    "class_b": [
        {"name": "Electromagnetism & Faraday's Law", "subject": "Physics", "exam_weightage": 26.0, "difficulty": 4.6, "target_score": 0.90, "estimated_hours": 4.0, "performance_score": 0.50, "tags": ["electromagnetism"]},
        {"name": "Thermodynamics & Heat Engines", "subject": "Physics", "exam_weightage": 21.0, "difficulty": 4.1, "target_score": 0.85, "estimated_hours": 3.5, "performance_score": 0.88, "tags": ["thermodynamics"]},
        {"name": "Electric Circuits & Kirchhoff's Laws", "subject": "Physics", "exam_weightage": 17.0, "difficulty": 3.4, "target_score": 0.80, "estimated_hours": 2.5, "performance_score": 0.42, "tags": ["circuits"]},
        {"name": "Geometric & Wave Optics", "subject": "Physics", "exam_weightage": 15.0, "difficulty": 3.6, "target_score": 0.85, "estimated_hours": 2.5, "performance_score": None, "tags": ["optics"]},
        {"name": "Quantum Mechanics & Photoelectric Effect", "subject": "Physics", "exam_weightage": 13.0, "difficulty": 4.8, "target_score": 0.80, "estimated_hours": 2.5, "performance_score": None, "tags": ["quantum"]},
        {"name": "Rotational Motion & Torque", "subject": "Physics", "exam_weightage": 8.0, "difficulty": 2.9, "target_score": 0.75, "estimated_hours": 2.0, "performance_score": None, "tags": ["mechanics"]},
    ],
    "class_c": [
        {"name": "Organic Reaction Mechanisms (SN1/SN2)", "subject": "Chemistry", "exam_weightage": 27.0, "difficulty": 4.7, "target_score": 0.90, "estimated_hours": 4.0, "performance_score": 0.48, "tags": ["organic"]},
        {"name": "Electrochemistry & Nernst Equation", "subject": "Chemistry", "exam_weightage": 23.0, "difficulty": 4.1, "target_score": 0.85, "estimated_hours": 3.5, "performance_score": 0.92, "tags": ["electrochemistry"]},
        {"name": "Chemical Kinetics & Rate Laws", "subject": "Chemistry", "exam_weightage": 18.0, "difficulty": 3.7, "target_score": 0.85, "estimated_hours": 3.0, "performance_score": None, "tags": ["kinetics"]},
        {"name": "Thermochemistry & Hess's Law", "subject": "Chemistry", "exam_weightage": 14.0, "difficulty": 3.1, "target_score": 0.80, "estimated_hours": 2.5, "performance_score": 0.45, "tags": ["thermochemistry"]},
        {"name": "Coordination Compounds", "subject": "Chemistry", "exam_weightage": 11.0, "difficulty": 3.9, "target_score": 0.80, "estimated_hours": 2.0, "performance_score": None, "tags": ["inorganic"]},
        {"name": "Periodic Trends & Chemical Bonding", "subject": "Chemistry", "exam_weightage": 7.0, "difficulty": 2.6, "target_score": 0.75, "estimated_hours": 2.0, "performance_score": None, "tags": ["bonding"]},
    ]
}

DEMO_SAMPLE_IMAGES = {
    "class_a": [
        "class_a_math_calculus_chain_rule_error.jpg",
        "class_a_math_integration_perfect_100.jpg",
        "class_a_math_trig_mcq_errors.jpg",
        "class_a_math_limits_lhopital_error.jpg",
        "class_a_math_algebra_vectors_derivation_flaw.jpg",
    ],
    "class_b": [
        "class_b_physics_thermo_derivation_flaw.jpg",
        "class_b_physics_optics_snell_law_correct.jpg",
        "class_b_physics_em_faraday_mcq_errors.jpg",
        "class_b_physics_quantum_photoelectric_error.jpg",
        "class_b_physics_circuits_kirchhoff_loop_error.jpg",
    ],
    "class_c": [
        "class_c_chem_organic_reaction_mechanism_error.jpg",
        "class_c_chem_electrochem_nernst_perfect_100.jpg",
        "class_c_chem_kinetics_rate_law_derivation_error.jpg",
    ]
}


@router.post("/seed-demo-data")
def seed_demo_data(
    reset: bool = Query(True, description="Clear existing demo topics and re-seed cleanly"),
    db: Session = Depends(get_db)
):
    """
    Seeds the database with trimmed 6-topic demo datasets per class matching available hours.
    Resets stale/duplicate data and seeds full-precision target scores and tested baselines.
    """
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if reset:
        # Collect all demo topic names across all classes
        demo_names = set()
        for c_topics in DEMO_TOPICS.values():
            for t in c_topics:
                demo_names.add(t["name"])

        # Delete demo topics (either tagged source=='demo' or matching standard demo dataset names)
        db.query(TopicDB).filter(
            (TopicDB.source == "demo") | (TopicDB.name.in_(demo_names))
        ).delete(synchronize_session=False)

        db.query(PerformanceRecordDB).filter(PerformanceRecordDB.source == "demo").delete()

        # Clean any orphaned performance records that point to non-existent topics
        valid_topic_ids = [t[0] for t in db.query(TopicDB.id).all()]
        if valid_topic_ids:
            db.query(PerformanceRecordDB).filter(~PerformanceRecordDB.topic_id.in_(valid_topic_ids)).delete(synchronize_session=False)
        else:
            db.query(PerformanceRecordDB).delete()

        # Reset AdaptiveWeightsDB to standard baseline defaults (1.0, 1.0, 1.1)
        weights_db = db.query(AdaptiveWeightsDB).filter(AdaptiveWeightsDB.id == 1).first()
        if weights_db:
            weights_db.weightage_weight = 1.0
            weights_db.difficulty_weight = 1.0
            weights_db.gap_weight = 1.1
            weights_db.updated_at = datetime.datetime.now(datetime.timezone.utc)
        else:
            db.add(AdaptiveWeightsDB(
                id=1,
                weightage_weight=1.0,
                difficulty_weight=1.0,
                gap_weight=1.1,
                updated_at=datetime.datetime.now(datetime.timezone.utc)
            ))
        db.commit()

    created_count = 0
    skipped_count = 0

    for cid, topics in DEMO_TOPICS.items():
        for tdata in topics:
            exists = db.query(TopicDB).filter(
                TopicDB.class_id == cid,
                TopicDB.name == tdata["name"]
            ).first()
            if exists:
                skipped_count += 1
                continue

            topic_id = f"top_{uuid.uuid4().hex[:8]}"
            db_topic = TopicDB(
                id=topic_id,
                name=tdata["name"],
                subject=tdata["subject"],
                class_id=cid,
                exam_weightage=tdata["exam_weightage"],
                difficulty=tdata["difficulty"],
                target_score=tdata.get("target_score", 0.85),
                estimated_hours=tdata["estimated_hours"],
                completed_hours=0.0,
                performance_score=tdata.get("performance_score"),
                status="in_progress" if tdata.get("performance_score") is not None else "not_started",
                tags_json=json.dumps(tdata.get("tags", [])),
                source="demo"
            )
            db.add(db_topic)

            # If demo topic includes an initial tested score, create a baseline demo performance record
            if tdata.get("performance_score") is not None:
                p_rec = PerformanceRecordDB(
                    id=f"perf_demo_{uuid.uuid4().hex[:8]}",
                    topic_id=topic_id,
                    class_id=cid,
                    score=tdata["performance_score"],
                    test_date="2026-09-20",
                    max_score=100.0,
                    raw_score=tdata["performance_score"] * 100.0,
                    question_breakdown_json=json.dumps({"baseline": tdata["performance_score"]}),
                    source="demo",
                    image_path=None
                )
                db.add(p_rec)

            created_count += 1

    db.commit()
    safe_print(f"[{ts}] [seed-demo-data] Reset={reset} | Created={created_count} | Skipped={skipped_count}")

    # Return info about demo sample images
    # backend/app/api/ -> ../../../ = project root
    demo_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "demo_data")
    demo_dir = os.path.normpath(demo_dir)
    sample_images_info = {}
    for cid, files in DEMO_SAMPLE_IMAGES.items():
        sample_images_info[cid] = [
            {"filename": f, "path": os.path.join(demo_dir, f), "exists": os.path.exists(os.path.join(demo_dir, f))}
            for f in files
        ]

    return {
        "status": "ok",
        "topics_created": created_count,
        "topics_skipped": skipped_count,
        "classes_seeded": list(DEMO_TOPICS.keys()),
        "sample_images": sample_images_info
    }


@router.get("/demo-images/{class_id}")
def get_demo_images(class_id: str):
    """Returns the list of sample answer sheet images for a given class."""
    images = DEMO_SAMPLE_IMAGES.get(class_id, [])
    demo_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "demo_data")
    demo_dir = os.path.normpath(demo_dir)
    return {
        "class_id": class_id,
        "images": [
            {"filename": f, "exists": os.path.exists(os.path.join(demo_dir, f))}
            for f in images
        ]
    }


@router.post("/speak")
def speak_explanation(payload: SpeakRequest):
    voice_tts.speak_text(payload.text)
    return {"status": "speaking", "text": payload.text[:100]}


class CopilotChatRequest(BaseModel):
    message: str
    image_base64: Optional[str] = None
    filename: Optional[str] = None
    class_id: Optional[str] = "class_a"
    history: Optional[List[Dict[str, str]]] = None


@router.post("/copilot/chat")
def copilot_chat_endpoint(payload: CopilotChatRequest, db: Session = Depends(get_db)):
    """
    Teacher Copilot Interactive AI Agent endpoint.
    Handles multimodal voice/text messages, exam sheet images,
    auto-rescheduling, diagram generation, and notification triggering.
    """
    from backend.app.agents.copilot_service import copilot_service
    return copilot_service.process_copilot_request(
        message=payload.message,
        image_base64=payload.image_base64,
        class_id=payload.class_id or "class_a",
        db=db,
        history=payload.history,
        filename=payload.filename
    )

