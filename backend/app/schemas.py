"""
Pydantic schemas for request validation and Swagger response documentation.

Groups:
  - Auth
  - User
  - Topic / Lesson / Problem / Hint
  - Submission
  - AI Tutor
  - Instructor CRUD
  - Analytics (student)
  - Instructor Analytics
  - Flows (pedagogical)
  - Classes & Enrollment
  - Resources
"""

from __future__ import annotations

from pydantic import BaseModel

from typing import Optional, List, Any

from datetime import datetime

# ── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):

    email: str

    password: str

class RegisterRequest(BaseModel):

    email: str

    password: str

    first_name: str

    last_name: str

    role: str = "student"   # 'student' | 'instructor'

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

    lesson_count: int = 0    # Kac lesson var (sidebar icon icin)

    problem_count: int = 0   # Kac soru var

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

    description: str          # Soru metni — QuestionPage description icin

    type: str

    difficulty: str

    points: int

    topic_id: str

    starter_code: Optional[str] = None   # Kod snippet icin baslangic kodu

    grading_rubric: Optional[str] = None # Rubric (grading icin)

    correct_answer: Optional[str] = None

    # explanation: grading_rubric'ten otomatik doldurulur — QuestionPage icin gosterilecek

    explanation: Optional[str] = None

    options: list[OptionInstructorOut] = []

    class Config:

        from_attributes = True

    from pydantic import model_validator

    @model_validator(mode="after")

    def fill_explanation(self):

        """explanation bossa grading_rubric'ten doldur"""

        if not self.explanation and self.grading_rubric:

            self.explanation = self.grading_rubric

        return self

# ── Submission ───────────────────────────────────────────────────────────────

class SubmissionCreate(BaseModel):

    problem_id: str

    # class_id optional — backend enrollment'dan otomatik alir

    class_id: Optional[str] = None

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

# ── AI Tutor ──────────────────────────────────────────────────────────────

class TutorMessage(BaseModel):

    role: str

    content: str

class TutorChatRequest(BaseModel):

    problem_id: str

    new_message: str

    chat_history: list[TutorMessage] = []

    student_code_or_answer: Optional[str] = None

class TutorChatResponse(BaseModel):

    response: str

    chat_history: list[TutorMessage]

    trace_id: Optional[str] = None

# ── Instructor CRUD — Create Schemas ─────────────────────────────────────────

class TopicCreate(BaseModel):

    name: str

    description: Optional[str] = None

    class_id: Optional[str] = None

class LessonCreate(BaseModel):

    title: str

    summary: Optional[str] = None

    content_markdown: Optional[str] = None

    estimated_minutes: Optional[int] = 15

class OptionInCreate(BaseModel):

    text: str

    is_correct: bool

class ProblemCreate(BaseModel):

    title: str

    description: str

    type: str = "multiple_choice"

    difficulty: str = "medium"

    correct_answer: Optional[str] = None

    options: list[OptionInCreate] = []

# ── Instructor CRUD — Update & Output Schemas ─────────────────────────────────

class TopicUpdate(BaseModel):

    name: Optional[str] = None

    description: Optional[str] = None

class LessonUpdate(BaseModel):

    title: Optional[str] = None

    summary: Optional[str] = None

    content_markdown: Optional[str] = None

    estimated_minutes: Optional[int] = None

class OptionIn(BaseModel):

    id: Optional[str] = None

    text: str

    is_correct: bool

class ProblemUpdate(BaseModel):

    title: Optional[str] = None

    description: Optional[str] = None

    difficulty: Optional[str] = None

    correct_answer: Optional[str] = None

    options: Optional[list[OptionIn]] = None

class OptionInstructorOut(BaseModel):

    id: str

    text: str

    is_correct: bool

    display_order: int

    class Config:

        from_attributes = True

class ProblemInstructorOut(BaseModel):

    id: str

    topic_id: str

    lesson_id: Optional[str] = None

    title: str

    description: str

    type: str

    difficulty: str

    correct_answer: Optional[str] = None

    points: int

    options: list[OptionInstructorOut] = []

    class Config:

        from_attributes = True


# ── Generic ────────────────────────────────────────────────────────────────────

class GenericMessageOut(BaseModel):
    """Generic success/detail message response."""
    detail: str

class EnrollStatusOut(BaseModel):
    """Returned after enroll / unenroll actions."""
    detail: str
    status: Optional[str] = None

# ── Classes ────────────────────────────────────────────────────────────────────

class ClassOut(BaseModel):
    """A course class with enrollment metadata."""
    class_id: str
    class_name: str
    class_code: str
    semester: Optional[str] = None
    instructor_name: str
    total_students: int
    is_enrolled: bool
    enrollment_status: Optional[str] = None
    description: Optional[str] = None
    color: str
    thumbnail_url: Optional[str] = None
    tags: Optional[str] = None

class EnrollmentOut(BaseModel):
    """An enrollment record for a student in a class."""
    enrollment_id: str
    student_id: str
    first_name: str
    last_name: str
    email: str
    status: str
    requested_at: Optional[datetime] = None
    enrolled_at: Optional[datetime] = None

class EnrollmentActionOut(BaseModel):
    """Returned after approve / reject enrollment."""
    detail: str
    enrollment_id: str

# ── Flows ──────────────────────────────────────────────────────────────────────

class FlowOut(BaseModel):
    """A pedagogical flow definition."""
    id: str
    class_id: str
    instructor_id: str
    pattern: str
    flow_json: dict
    config: dict
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ActiveFlowOut(BaseModel):
    """Active (live) flow for a class, or default fallback if none deployed."""
    has_active_flow: bool
    id: Optional[str] = None
    class_id: Optional[str] = None
    instructor_id: Optional[str] = None
    pattern: Optional[str] = None
    flow_json: Optional[dict] = None
    config: Optional[dict] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class FlowSummaryOut(BaseModel):
    """AI-generated natural-language summary for a pedagogical flow."""
    summary: str
    flow_id: str
    pattern: str

class SpacedReviewOut(BaseModel):
    """A spaced-retrieval review item due today or earlier."""
    id: str
    topic_id: str
    topic_name: Optional[str] = None
    problem_id: str
    review_day: int
    scheduled_at: datetime

class SpacedReviewCompleteOut(BaseModel):
    ok: bool
    review_id: str

class AdaptiveStateOut(BaseModel):
    """Student adaptive branch state and diagnostic problems for a topic."""
    diagnostic_done: bool
    assigned_path: Optional[str] = None
    diagnostic_score: Optional[float] = None
    diagnostic_problems: List[Any] = []

class AdaptiveCompleteOut(BaseModel):
    """Result after completing an adaptive diagnostic."""
    assigned_path: str
    diagnostic_score: float
    threshold: int

# ── Resources ─────────────────────────────────────────────────────────────────

class UploadResponseOut(BaseModel):
    """Returned after uploading a resource file."""
    resource_id: str
    filename: str
    status: str
    message: str

class ResourceListItemOut(BaseModel):
    """A resource summary item in the instructor resource list."""
    resource_id: str
    filename: str
    file_type: str
    week_name: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    source_url: Optional[str] = None
    has_file: bool
    download_url: Optional[str] = None
    created_at: Optional[datetime] = None

class ResourceResultOut(BaseModel):
    """Processing status and counts for an uploaded resource."""
    resource_id: str
    filename: str
    status: str
    error_message: Optional[str] = None
    topics_created: int
    lessons_created: int
    problems_created: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ResourceContentOut(BaseModel):
    """AI-extracted structured content from a resource."""
    course_title: Optional[str] = ""
    topics: List[Any] = []
    misconceptions: List[Any] = []

class LinkResourceOut(BaseModel):
    """Returned after adding a resource link (YouTube, Drive, URL)."""
    resource_id: str
    title: str
    source_url: str
    link_type: str
    status: str
    message: str

# ── Analytics — Student ────────────────────────────────────────────────────────

class HintStatsOut(BaseModel):
    no_hint: int
    one_hint: int
    multi_hint: int
    total_problems: int

class ClassStatsOut(BaseModel):
    class_avg_score: Optional[float] = None
    top_performer_score: Optional[float] = None
    avg_hint_usage: Optional[float] = None

class ClassDifficultyItemOut(BaseModel):
    question: str
    topic: str
    failRate: int

class StudentDashboardOut(BaseModel):
    """Full student analytics dashboard."""
    user: Any
    class_id: Optional[str] = None
    class_code: Optional[str] = None
    class_name: Optional[str] = None
    total_problems_attempted: int
    total_problems_passed: int
    overall_mastery_score: float
    percentile: float
    rank: Optional[Any] = None
    total_students_in_class: int
    hint_stats: HintStatsOut
    avg_time_minutes: float
    streak_days: int
    class_stats: ClassStatsOut
    class_difficulty: List[ClassDifficultyItemOut]
    weak_topics: List[Any]
    strong_topics: List[Any]
    all_topics: List[Any]

class AiInsightOut(BaseModel):
    """AI-generated personalized learning insight for the student."""
    insight: str
    percentile: float
    rank: Optional[Any] = None
    total_students: int

class ClassDistributionItemOut(BaseModel):
    bucket: int
    label: str
    count: int

class StreakOut(BaseModel):
    streak_days: int
    last_active: Optional[str] = None

class SubmissionHistoryItemOut(BaseModel):
    id: str
    problem_id: str
    status: str
    score: Optional[float] = None
    max_score: Optional[float] = None
    is_correct: Optional[bool] = None
    attempt_number: int
    time_spent_seconds: Optional[int] = None
    submitted_at: Optional[str] = None

class SolvedProblemIdsOut(BaseModel):
    solved_problem_ids: List[str]

# ── Analytics — Instructor ────────────────────────────────────────────────────

class GapAnalysisOut(BaseModel):
    """Result of the AI knowledge-gap analysis run for a class."""
    gaps_detected: int
    new_gaps_persisted: int
    ai_analysis: Optional[str] = None
    top_gap: Optional[Any] = None

class InstructorClassSummaryOut(BaseModel):
    """Class summary item in the instructor's class list."""
    class_id: str
    class_name: str
    class_code: str
    semester: Optional[str] = None
    total_students: int
    has_live_flow: bool
    active_pattern: Optional[str] = None

class ClassDashboardOut(BaseModel):
    """Full instructor analytics dashboard for a class."""
    class_id: str
    class_name: str
    class_code: str
    total_students: int
    average_mastery: float
    median_mastery: float
    students_with_activity: int
    knowledge_gaps: List[Any]
    topic_heatmap: List[Any]
    top_students: List[Any]
    bottom_students: List[Any]

class InstructorPrimaryClassOut(BaseModel):
    """Summary of the instructor's primary active class."""
    class_id: str
    class_name: str
    class_code: str
    semester: Optional[str] = None
    total_students: int

# ── Topic Resources ────────────────────────────────────────────────────────────

class TopicResourceItemOut(BaseModel):
    """A resource linked to a topic (for student view)."""
    resource_id: str
    title: str
    source_url: Optional[str] = None
    file_type: Optional[str] = None
    week_name: Optional[str] = None
    has_file: bool
    download_url: Optional[str] = None

# ── Hint Request ───────────────────────────────────────────────────────────────

class HintResponseOut(BaseModel):
    """Hint delivered by the AI hint agent for a submission."""
    level: int
    content: str
    max_level: int
    trace_id: Optional[str] = None
