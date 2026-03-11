"""
Pydantic schemas — request/response validation
"""
from __future__ import annotations
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Auth ────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    first_name: str
    last_name: str


# ── User ─────────────────────────────────────────────────────────────────────
class UserOut(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str

    class Config:
        from_attributes = True


# ── Topic ────────────────────────────────────────────────────────────────────
class TopicOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    book_chapter: Optional[str]
    book_url: Optional[str]
    display_order: int
    parent_topic_id: Optional[str]

    class Config:
        from_attributes = True


# ── Material ─────────────────────────────────────────────────────────────────
class MaterialOut(BaseModel):
    id: str
    title: str
    type: str
    url: str
    description: Optional[str]
    display_order: int

    class Config:
        from_attributes = True


# ── Lesson ───────────────────────────────────────────────────────────────────
class LessonOut(BaseModel):
    id: str
    topic_id: str
    title: str
    summary: Optional[str]
    content_markdown: Optional[str]
    estimated_minutes: Optional[int]
    display_order: int
    princeton_section: Optional[str]
    materials: list[MaterialOut] = []

    class Config:
        from_attributes = True


# ── Problem ──────────────────────────────────────────────────────────────────
class OptionOut(BaseModel):
    id: str
    text: str
    display_order: int
    # is_correct is NOT exposed to students

    class Config:
        from_attributes = True


class HintOut(BaseModel):
    id: str
    level: int
    content: str
    socratic_question: Optional[str]

    class Config:
        from_attributes = True


class ProblemOut(BaseModel):
    id: str
    topic_id: str
    lesson_id: Optional[str]
    title: str
    description: str
    type: str
    difficulty: str
    starter_code: Optional[str]
    points: int
    book_reference: Optional[str]
    options: list[OptionOut] = []
    # solution_code intentionally excluded

    class Config:
        from_attributes = True


class ProblemListOut(BaseModel):
    id: str
    title: str
    type: str
    difficulty: str
    points: int
    topic_id: str

    class Config:
        from_attributes = True


# ── Submission ───────────────────────────────────────────────────────────────
class SubmissionCreate(BaseModel):
    problem_id: str
    class_id: str
    submitted_code: Optional[str] = None
    submitted_answer: Optional[str] = None
    selected_option_id: Optional[str] = None
    time_spent_seconds: int = 0


class SubmissionOut(BaseModel):
    id: str
    problem_id: str
    status: str
    score: Optional[float]
    max_score: Optional[float]
    is_correct: Optional[bool]
    attempt_number: int
    submitted_at: datetime
    feedback: Optional[str] = None

    class Config:
        from_attributes = True


# ── Learning Event ────────────────────────────────────────────────────────────
class EventCreate(BaseModel):
    class_id: Optional[str] = None
    topic_id: Optional[str] = None
    lesson_id: Optional[str] = None
    problem_id: Optional[str] = None
    material_id: Optional[str] = None
    event_type: str
    event_metadata: dict = {}
    duration_seconds: Optional[int] = None


# ── Analytics ────────────────────────────────────────────────────────────────
class MasteryOut(BaseModel):
    topic_id: str
    topic_name: str
    mastery_score: float
    problems_attempted: int
    problems_passed: int
    total_hints_used: int

class StudentDashboardOut(BaseModel):
    user: UserOut
    total_problems_attempted: int
    total_problems_passed: int
    overall_score: float
    percentile: float
    weak_topics: list[MasteryOut]
    recent_mastery: list[MasteryOut]

class KnowledgeGapOut(BaseModel):
    topic_id: str
    topic_name: str
    problem_id: Optional[str]
    problem_title: Optional[str]
    failure_rate: float
    student_count: int
    failure_count: int

class StudentRankOut(BaseModel):
    student_id: str
    first_name: str
    last_name: str
    total_score: float
    percentile: float
    problems_passed: int

class InstructorDashboardOut(BaseModel):
    class_id: str
    class_name: str
    total_students: int
    average_score: float
    median_score: float
    knowledge_gaps: list[KnowledgeGapOut]
    student_ranking: list[StudentRankOut]
