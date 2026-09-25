"""
FastAPI Application Entrypoint for Pacekeeper.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.db.database import init_db
from backend.app.api.topics import router as topics_router
from backend.app.api.calendar import router as calendar_router
from backend.app.api.performance import router as performance_router
from backend.app.api.schedule import router as schedule_router
from backend.app.api.system import router as system_router
from backend.app.api.agents import router as agents_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup behavior: initialize empty database tables on first run
    init_db()
    yield


app = FastAPI(
    title="Pacekeeper API",
    description="AI Lesson Planner API with Deterministic Core & Multi-tier Architecture",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(topics_router)
app.include_router(calendar_router)
app.include_router(performance_router)
app.include_router(schedule_router)
app.include_router(system_router)
app.include_router(agents_router)


@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "Pacekeeper API",
        "docs": "/docs",
        "tier": "free",
    }
