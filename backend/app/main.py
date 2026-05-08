"""
ThinkCode Learning Analytics Platform — FastAPI Backend Entry Point

All API routes are mounted under /api/v1.
Run locally: uvicorn app.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import (
    auth, topics, problems, submissions, analytics,
    instructor, tutor, lessons, resources, flows, classes,
)
from app.api.routers import content_chat

_TAGS_METADATA = [
    {
        "name": "auth",
        "description": "User registration and authentication. Returns a JWT bearer token.",
    },
    {
        "name": "classes",
        "description": "Class (course) management: create, update, delete classes and manage student enrollment requests.",
    },
    {
        "name": "topics",
        "description": "Topic CRUD within a class. Topics are the top-level content units that contain lessons and problems.",
    },
    {
        "name": "lessons",
        "description": "Lesson content management. Instructors can generate AI lesson summaries from URLs or raw text.",
    },
    {
        "name": "problems",
        "description": "Problem (question) CRUD. Supports multiple-choice, open-response, and coding problem types.",
    },
    {
        "name": "submissions",
        "description": "Student answer submissions. Auto-grades MCQ; uses LangGraph AI for open-response. Also handles AI hint delivery.",
    },
    {
        "name": "analytics",
        "description": "Student-facing analytics: mastery scores, weekly progress, topic breakdown, streak, AI insight, and class distribution.",
    },
    {
        "name": "instructor",
        "description": "Instructor-facing analytics: class dashboard, student rankings, topic heatmap, knowledge gaps, and hint analytics.",
    },
    {
        "name": "tutor",
        "description": "AI Tutor chat endpoints. The dialog graph classifies intent (hint / error-explain / general) and routes accordingly.",
    },
    {
        "name": "resources",
        "description": "Course resource management: upload PDFs, add YouTube/Drive links, trigger AI content extraction, and download files.",
    },
    {
        "name": "flows",
        "description": "Pedagogical flow designer: create, update, deploy, and query adaptive learning flows (Socratic retry, mastery gate, spaced retrieval, adaptive branch).",
    },
    {
        "name": "Content Chat",
        "description": "AI-assisted content editing chat. Instructors can send free-form messages to generate questions, create topics, or rewrite lessons.",
    },
]

app = FastAPI(
    title="ThinkCode Learning Analytics API",
    description=(
        "REST API for the **ThinkCode** algorithms learning platform.\n\n"
        "- Students practice problems, receive AI hints and tutor chat, and track mastery.\n"
        "- Instructors manage course content, design pedagogical flows, and view class analytics.\n"
        "- All endpoints require a `Bearer` JWT token except `/auth/login` and `/auth/register`.\n"
    ),
    version="1.0.0",
    openapi_tags=_TAGS_METADATA,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://localhost:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
PREFIX = "/api/v1"

app.include_router(auth.router,        prefix=PREFIX)
app.include_router(topics.router,      prefix=PREFIX)
app.include_router(problems.router,    prefix=PREFIX)
app.include_router(submissions.router, prefix=PREFIX)
app.include_router(analytics.router,   prefix=PREFIX)
app.include_router(instructor.router,  prefix=PREFIX)
app.include_router(tutor.router,       prefix=PREFIX)
app.include_router(lessons.router,     prefix=PREFIX)
app.include_router(resources.router,     prefix=PREFIX)  # PDF upload + AI extraction
app.include_router(flows.router,         prefix=PREFIX)  # Pedagogical flow designer
app.include_router(classes.router,       prefix=PREFIX)  # Class & enrollment management
app.include_router(content_chat.router,  prefix=PREFIX)  # AI content chat


@app.get("/health")
def health():
    """Simple liveness probe."""
    return {"status": "ok", "service": "thinkcode-api"}
