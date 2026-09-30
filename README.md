# Pacekeeper

An AI-driven Lesson Planner with a Deterministic Core, Adaptive Spaced Repetition, and Multi-tier Architecture.

## Features
- **Deterministic Scheduling Engine**: Allocates curriculum hours with zero AI hallucinations.
- **Adaptive Spaced Repetition**: Dynamic revision pacing based on actual student performance.
- **Teacher Copilot**: Intelligent assistant for curriculum insights and autonomous schedule adjustment.
- **Multi-Class Support**: Manage distinct class cohorts and gradebooks.
- **Offline First**: Offline TTS and local model support.

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend Setup
```bash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Unix:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Author
**Jamal Khan** ([@Jamal-Khan-I](https://github.com/Jamal-Khan-I))
