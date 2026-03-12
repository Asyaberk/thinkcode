"""
ThinkCode Learning Analytics Platform — FastAPI Backend
Run: uvicorn app.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import auth, topics, problems, submissions, analytics, instructor, events, tutor, lessons

app = FastAPI(
    title="ThinkCode Learning Analytics API",
    description="Backend for the ThinkCode Algorithms Learning Platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
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
app.include_router(events.router,      prefix=PREFIX)
app.include_router(tutor.router,       prefix=PREFIX)
app.include_router(lessons.router,     prefix=PREFIX)


@app.get("/health")
def health():
    return {"status": "ok", "service": "thinkcode-api"}
