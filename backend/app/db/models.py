"""

SQLAlchemy ORM models — ThinkCode Learning Analytics Platform

Matches the PostgreSQL schema defined in backend_architecture.md

"""

import uuid

from datetime import datetime, timezone

from sqlalchemy import (

    Boolean, Column, DateTime, Enum, Float, ForeignKey,

    Integer, String, Text, UniqueConstraint, CheckConstraint,

    Index,

)

from sqlalchemy.dialects.postgresql import UUID, JSONB

from sqlalchemy.orm import DeclarativeBase, relationship

# ─────────────────────────────────────────────────────────────

# Base

# ─────────────────────────────────────────────────────────────

class Base(DeclarativeBase):

    pass

def _uuid():

    return str(uuid.uuid4())

def _now():

    return datetime.now(timezone.utc)

# ─────────────────────────────────────────────────────────────

# ENUMS

# ─────────────────────────────────────────────────────────────

UserRoleEnum         = Enum("student", "instructor", "admin",       name="user_role")

EnrollmentStatusEnum = Enum("pending", "active", "dropped", "completed", "rejected", name="enrollment_status")

ProblemTypeEnum      = Enum("coding", "multiple_choice", "open_response", name="problem_type")

DifficultyEnum       = Enum("easy", "medium", "hard",               name="difficulty_level")

SubmissionStatusEnum = Enum("pending", "passed", "failed", "grading", name="submission_status")

MaterialTypeEnum     = Enum("pdf", "video", "link", "visualization", name="material_type")

ResourceStatusEnum   = Enum("uploaded", "processing", "done", "failed", name="resource_status")

EventTypeEnum        = Enum(

    "lesson_opened", "material_viewed", "problem_started",

    "problem_submitted", "hint_requested", "video_played",

    "coding_session_started", "coding_session_ended", "page_visit",

    name="event_type",

)

# ─────────────────────────────────────────────────────────────

# USERS

# ─────────────────────────────────────────────────────────────

class User(Base):

    __tablename__ = "users"

    id            = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    email         = Column(String(255), unique=True, nullable=False, index=True)

    password_hash = Column(String(255), nullable=False)

    first_name    = Column(String(100), nullable=False)

    last_name     = Column(String(100), nullable=False)

    role          = Column(UserRoleEnum, nullable=False, default="student")

    is_active     = Column(Boolean, nullable=False, default=True)

    last_login_at = Column(DateTime(timezone=True))

    created_at    = Column(DateTime(timezone=True), default=_now)

    # relationships

    classes             = relationship("Class", back_populates="instructor")

    enrollments         = relationship("Enrollment", back_populates="student")

    submissions         = relationship("Submission", back_populates="student")

    hint_requests       = relationship("HintRequest", back_populates="student")

    topic_mastery       = relationship("StudentTopicMastery", back_populates="student")

    learning_events     = relationship("LearningEvent", back_populates="student")

    ai_tutor_sessions   = relationship("AiTutorSession", back_populates="student")

# ─────────────────────────────────────────────────────────────

# CLASSES & ENROLLMENTS

# ─────────────────────────────────────────────────────────────

class Class(Base):

    __tablename__ = "classes"

    id            = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    instructor_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)

    name          = Column(String(255), nullable=False)

    code          = Column(String(50), unique=True, nullable=False)     # e.g. "CMPE211"

    semester      = Column(String(50))

    academic_year = Column(Integer)

    is_active     = Column(Boolean, nullable=False, default=True)

    created_at    = Column(DateTime(timezone=True), default=_now)

    description   = Column(Text, nullable=True)

    color         = Column(String(20), nullable=True, default="#10b981")   # hex color code

    thumbnail_url = Column(String(500), nullable=True)

    tags          = Column(Text, nullable=True, default="")

    instructor    = relationship("User", back_populates="classes")

    enrollments   = relationship("Enrollment", back_populates="cls")

    submissions   = relationship("Submission", back_populates="cls")

    knowledge_gaps= relationship("KnowledgeGap", back_populates="cls")

class Enrollment(Base):

    __tablename__ = "enrollments"

    __table_args__ = (UniqueConstraint("student_id", "class_id"),)

    id          = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    student_id  = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    class_id    = Column(UUID(as_uuid=False), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)

    status       = Column(EnrollmentStatusEnum, nullable=False, default="pending")

    enrolled_at  = Column(DateTime(timezone=True), default=_now)

    requested_at = Column(DateTime(timezone=True), default=_now)

    student     = relationship("User", back_populates="enrollments")

    cls         = relationship("Class", back_populates="enrollments")

# ─────────────────────────────────────────────────────────────

# COURSE STRUCTURE

# ─────────────────────────────────────────────────────────────

class Topic(Base):

    __tablename__ = "topics"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    name            = Column(String(255), nullable=False)

    description     = Column(Text)

    book_chapter    = Column(String(100))

    book_url        = Column(String(500))

    display_order   = Column(Integer, nullable=False, default=0)

    parent_topic_id = Column(UUID(as_uuid=False), ForeignKey("topics.id", ondelete="SET NULL"))

    class_id        = Column(UUID(as_uuid=False), ForeignKey("classes.id", ondelete="CASCADE"), nullable=True)

    source_resource_id = Column(UUID(as_uuid=False), ForeignKey("course_resources.id", ondelete="SET NULL"), nullable=True)

    children      = relationship("Topic", back_populates="parent")

    parent        = relationship("Topic", back_populates="children", remote_side="Topic.id")

    lessons       = relationship("Lesson", back_populates="topic")

    problems      = relationship("Problem", back_populates="topic")

    topic_mastery = relationship("StudentTopicMastery", back_populates="topic")

    knowledge_gaps= relationship("KnowledgeGap", back_populates="topic")

    source_resource = relationship("CourseResource", foreign_keys=[source_resource_id])

class Lesson(Base):

    __tablename__ = "lessons"

    id                = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    topic_id          = Column(UUID(as_uuid=False), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)

    title             = Column(String(255), nullable=False)

    summary           = Column(Text)

    content_markdown  = Column(Text)

    estimated_minutes = Column(Integer, default=15)

    display_order     = Column(Integer, nullable=False, default=0)

    princeton_section = Column(String(100))   # e.g. "2.1 Elementary Sorts"

    topic     = relationship("Topic", back_populates="lessons")

    materials = relationship("Material", back_populates="lesson")

    problems  = relationship("Problem", back_populates="lesson")

class Material(Base):

    __tablename__ = "materials"

    id            = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    lesson_id     = Column(UUID(as_uuid=False), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)

    title         = Column(String(255), nullable=False)

    type          = Column(MaterialTypeEnum, nullable=False)

    url           = Column(String(1000), nullable=False)

    description   = Column(Text)

    display_order = Column(Integer, nullable=False, default=0)

    lesson = relationship("Lesson", back_populates="materials")

# ─────────────────────────────────────────────────────────────

# PROBLEMS

# ─────────────────────────────────────────────────────────────

class Problem(Base):

    __tablename__ = "problems"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    topic_id        = Column(UUID(as_uuid=False), ForeignKey("topics.id", ondelete="RESTRICT"), nullable=False)

    lesson_id       = Column(UUID(as_uuid=False), ForeignKey("lessons.id", ondelete="SET NULL"))

    title           = Column(String(255), nullable=False)

    description     = Column(Text, nullable=False)

    type            = Column(ProblemTypeEnum, nullable=False)

    difficulty      = Column(DifficultyEnum, nullable=False, default="medium")

    starter_code    = Column(Text)

    solution_code   = Column(Text)       # NEVER sent to frontend

    grading_rubric  = Column(Text)       # for Grading Agent

    correct_answer  = Column(Text)       # MCQ / open response ground truth

    points          = Column(Integer, nullable=False, default=10)

    book_reference  = Column(String(500))

    is_published    = Column(Boolean, nullable=False, default=False)

    created_at      = Column(DateTime(timezone=True), default=_now)

    topic        = relationship("Topic", back_populates="problems")

    lesson       = relationship("Lesson", back_populates="problems")

    options      = relationship("ProblemOption", back_populates="problem", cascade="all, delete-orphan")

    hints        = relationship("ProblemHint", back_populates="problem", cascade="all, delete-orphan",

                                order_by="ProblemHint.level")

    test_cases   = relationship("ProblemTestCase", back_populates="problem", cascade="all, delete-orphan")

    submissions  = relationship("Submission", back_populates="problem")

    hint_requests= relationship("HintRequest", back_populates="problem")

class ProblemOption(Base):

    __tablename__ = "problem_options"

    id            = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    problem_id    = Column(UUID(as_uuid=False), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False)

    text          = Column(Text, nullable=False)

    is_correct    = Column(Boolean, nullable=False, default=False)

    display_order = Column(Integer, nullable=False, default=0)

    problem = relationship("Problem", back_populates="options")

class ProblemHint(Base):

    __tablename__ = "problem_hints"

    __table_args__ = (UniqueConstraint("problem_id", "level"),)

    id                = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    problem_id        = Column(UUID(as_uuid=False), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False)

    level             = Column(Integer, nullable=False)

    content           = Column(Text, nullable=False)

    socratic_question = Column(Text)

    problem = relationship("Problem", back_populates="hints")

class ProblemTestCase(Base):

    __tablename__ = "problem_test_cases"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    problem_id      = Column(UUID(as_uuid=False), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False)

    input           = Column(Text, nullable=False)

    expected_output = Column(Text, nullable=False)

    is_hidden       = Column(Boolean, nullable=False, default=False)

    display_order   = Column(Integer, nullable=False, default=0)

    problem = relationship("Problem", back_populates="test_cases")

# ─────────────────────────────────────────────────────────────

# SUBMISSIONS

# ─────────────────────────────────────────────────────────────

class Submission(Base):

    __tablename__ = "submissions"

    id                 = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    student_id         = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    problem_id         = Column(UUID(as_uuid=False), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False)

    class_id           = Column(UUID(as_uuid=False), ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)

    submitted_code     = Column(Text)

    submitted_answer   = Column(Text)

    selected_option_id = Column(UUID(as_uuid=False), ForeignKey("problem_options.id", ondelete="SET NULL"))

    status             = Column(SubmissionStatusEnum, nullable=False, default="pending")

    score              = Column(Float, default=0)

    max_score          = Column(Float)

    is_correct         = Column(Boolean)

    attempt_number     = Column(Integer, nullable=False, default=1)

    time_spent_seconds = Column(Integer, default=0)

    submitted_at       = Column(DateTime(timezone=True), default=_now)

    student         = relationship("User", back_populates="submissions")

    problem         = relationship("Problem", back_populates="submissions")

    cls             = relationship("Class", back_populates="submissions")

    selected_option = relationship("ProblemOption")

    grading_result  = relationship("AiGradingResult", back_populates="submission", uselist=False)

    hint_requests   = relationship("HintRequest", back_populates="submission")

class AiGradingResult(Base):

    __tablename__ = "ai_grading_results"

    id                = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    submission_id     = Column(UUID(as_uuid=False), ForeignKey("submissions.id", ondelete="CASCADE"),

                               nullable=False, unique=True)

    similarity_score  = Column(Float)

    rubric_score      = Column(Float)

    feedback          = Column(Text, nullable=False)

    reasoning         = Column(Text)

    model_used        = Column(String(100))

    langfuse_trace_id = Column(String(255))

    graded_at         = Column(DateTime(timezone=True), default=_now)

    submission = relationship("Submission", back_populates="grading_result")

# ─────────────────────────────────────────────────────────────

# AI INTERACTIONS

# ─────────────────────────────────────────────────────────────

class HintRequest(Base):

    __tablename__ = "hint_requests"

    id                = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    student_id        = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    problem_id        = Column(UUID(as_uuid=False), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False)

    submission_id     = Column(UUID(as_uuid=False), ForeignKey("submissions.id", ondelete="SET NULL"))

    hint_level        = Column(Integer, nullable=False)

    context_code      = Column(Text)

    hint_delivered    = Column(Text, nullable=False)

    trigger_reason    = Column(String(255))

    langfuse_trace_id = Column(String(255))

    requested_at      = Column(DateTime(timezone=True), default=_now)

    student    = relationship("User", back_populates="hint_requests")

    problem    = relationship("Problem", back_populates="hint_requests")

    submission = relationship("Submission", back_populates="hint_requests")

class AiTutorSession(Base):

    __tablename__ = "ai_tutor_sessions"

    id                = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    student_id        = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    problem_id        = Column(UUID(as_uuid=False), ForeignKey("problems.id", ondelete="SET NULL"))

    messages          = Column(JSONB, nullable=False, default=list)

    total_tokens_used = Column(Integer, default=0)

    model_used        = Column(String(100))

    langfuse_trace_id = Column(String(255))

    started_at        = Column(DateTime(timezone=True), default=_now)

    ended_at          = Column(DateTime(timezone=True))

    student = relationship("User", back_populates="ai_tutor_sessions")

# ─────────────────────────────────────────────────────────────

# ANALYTICS

# ─────────────────────────────────────────────────────────────

class StudentTopicMastery(Base):

    __tablename__ = "student_topic_mastery"

    __table_args__ = (UniqueConstraint("student_id", "topic_id", "class_id"),)

    id                 = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    student_id         = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    topic_id           = Column(UUID(as_uuid=False), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)

    class_id           = Column(UUID(as_uuid=False), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)

    mastery_score      = Column(Float, nullable=False, default=0)

    problems_attempted = Column(Integer, nullable=False, default=0)

    problems_passed    = Column(Integer, nullable=False, default=0)

    total_hints_used   = Column(Integer, nullable=False, default=0)

    last_activity_at   = Column(DateTime(timezone=True))

    updated_at         = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    student = relationship("User", back_populates="topic_mastery")

    topic   = relationship("Topic", back_populates="topic_mastery")

class KnowledgeGap(Base):

    __tablename__ = "knowledge_gaps"

    id                = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    class_id          = Column(UUID(as_uuid=False), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)

    topic_id          = Column(UUID(as_uuid=False), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)

    problem_id        = Column(UUID(as_uuid=False), ForeignKey("problems.id", ondelete="SET NULL"))

    failure_rate      = Column(Float, nullable=False)

    student_count     = Column(Integer, nullable=False)

    failure_count     = Column(Integer, nullable=False)

    ai_analysis       = Column(Text)

    langfuse_trace_id = Column(String(255))

    detected_at       = Column(DateTime(timezone=True), default=_now)

    updated_at        = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    cls     = relationship("Class", back_populates="knowledge_gaps")

    topic   = relationship("Topic", back_populates="knowledge_gaps")

# ─────────────────────────────────────────────────────────────

# LEARNING EVENTS (append-only research log)

# ─────────────────────────────────────────────────────────────

class LearningEvent(Base):

    __tablename__ = "learning_events"

    id               = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    student_id       = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    class_id         = Column(UUID(as_uuid=False), ForeignKey("classes.id", ondelete="SET NULL"))

    topic_id         = Column(UUID(as_uuid=False), ForeignKey("topics.id", ondelete="SET NULL"))

    lesson_id        = Column(UUID(as_uuid=False), ForeignKey("lessons.id", ondelete="SET NULL"))

    problem_id       = Column(UUID(as_uuid=False), ForeignKey("problems.id", ondelete="SET NULL"))

    material_id      = Column(UUID(as_uuid=False), ForeignKey("materials.id", ondelete="SET NULL"))

    event_type       = Column(EventTypeEnum, nullable=False)

    event_metadata   = Column("metadata", JSONB, default=dict)

    duration_seconds = Column(Integer)

    occurred_at      = Column(DateTime(timezone=True), default=_now, nullable=False)

    student = relationship("User", back_populates="learning_events")

# ─────────────────────────────────────────────────────────────

# ANALYTICS INDEXES (created after table creation)

# ─────────────────────────────────────────────────────────────

Index("idx_submissions_student",         Submission.student_id)

Index("idx_submissions_problem",         Submission.problem_id)

Index("idx_submissions_class",           Submission.class_id)

Index("idx_submissions_student_problem", Submission.student_id, Submission.problem_id)

Index("idx_submissions_class_date",      Submission.class_id, Submission.submitted_at)

Index("idx_submissions_correctness",     Submission.problem_id, Submission.is_correct)

Index("idx_mastery_student_class",  StudentTopicMastery.student_id, StudentTopicMastery.class_id)

Index("idx_mastery_topic_score",    StudentTopicMastery.topic_id, StudentTopicMastery.mastery_score)

Index("idx_gaps_class",  KnowledgeGap.class_id, KnowledgeGap.failure_rate)

Index("idx_gaps_topic",  KnowledgeGap.topic_id)

Index("idx_events_student",    LearningEvent.student_id, LearningEvent.occurred_at)

Index("idx_events_class_type", LearningEvent.class_id, LearningEvent.event_type)

Index("idx_problems_topic",            Problem.topic_id)

Index("idx_problems_type_difficulty",  Problem.type, Problem.difficulty)

Index("idx_problems_published",        Problem.is_published)

# ─────────────────────────────────────────────────────────────
# CONTENT BUILDER — Course Resources
# ─────────────────────────────────────────────────────────────

class CourseResource(Base):

    """

    Instructor-uploaded course material (PDF, image, code, text, etc.).

    Pipeline:

      1. File is uploaded → status = 'uploaded'
      2. GLM-OCR or pdfplumber extracts text → raw_markdown is populated
      3. GPT extraction completes → status = 'done'
    """

    __tablename__ = "course_resources"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    instructor_id   = Column(

        UUID(as_uuid=False),

        ForeignKey("users.id", ondelete="CASCADE"),

        nullable=False,

    )

    class_id        = Column(

        UUID(as_uuid=False),

        ForeignKey("classes.id", ondelete="SET NULL"),

        nullable=True,

    )

    filename        = Column(String(500), nullable=False)

    file_path       = Column(String(1000), nullable=False)  # local path or object storage URL  # local path or object storage URL

    file_type       = Column(String(50), nullable=False, default="pdf")

    week_name       = Column(String(100), nullable=True)

    raw_markdown    = Column(Text, nullable=True)

    source_url      = Column(String(2000), nullable=True)  # external URL: Google Drive, YouTube, etc.

    status          = Column(ResourceStatusEnum, nullable=False, default="uploaded")

    error_message   = Column(Text, nullable=True)

    created_at      = Column(DateTime(timezone=True), default=_now)

    updated_at      = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    extractions     = relationship("AiExtractedContent", back_populates="resource",

                                   cascade="all, delete-orphan")

class AiExtractedContent(Base):

    """

    Summary of content extracted by GPT from a CourseResource.

    Actual content is written to topics/lessons/problems tables.
    This table tracks which content was generated from which source.
    Enables the instructor to see what changed when re-processing a file.
    """

    __tablename__ = "ai_extracted_content"

    id                = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    resource_id       = Column(

        UUID(as_uuid=False),

        ForeignKey("course_resources.id", ondelete="CASCADE"),

        nullable=False,

    )

    # Format: {"topics": [...], "lessons": [...], "questions": [...], "misconceptions": [...]}

    extracted_json    = Column(JSONB, nullable=False, default=dict)

    topics_created    = Column(Integer, default=0)

    lessons_created   = Column(Integer, default=0)

    problems_created  = Column(Integer, default=0)

    model_used        = Column(String(100), default="gpt-4.1-nano")

    created_at        = Column(DateTime(timezone=True), default=_now)

    resource          = relationship("CourseResource", back_populates="extractions")

Index("idx_resources_instructor", CourseResource.instructor_id)

Index("idx_resources_status",     CourseResource.status)

# ─────────────────────────────────────────────────────────────
# COURSE FLOWS — Pedagogical Flow Designer
#   flow_json = { nodes: [{id, type, x, y, label, config}], connections: [{from, to}] }
#   status: draft | live  (only one live flow per class)
# ─────────────────────────────────────────────────────────────

FlowStatusEnum = Enum("draft", "live", name="flow_status")

class CourseFlow(Base):

    """

    Pedagogical flow created by the instructor in Flow Designer.

    Only one flow per class can have status='live' at a time.
    Student pages fetch the active flow to adapt their learning behavior.
    """

    __tablename__ = "course_flows"

    id            = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    class_id      = Column(UUID(as_uuid=False), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)

    instructor_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    pattern       = Column(String(100), nullable=False, default="custom")

    flow_json     = Column(JSONB, nullable=False, default=dict)

    config        = Column(JSONB, nullable=False, default=dict)

    status        = Column(FlowStatusEnum, nullable=False, default="draft")  # draft | live

    created_at    = Column(DateTime(timezone=True), default=_now)

    updated_at    = Column(DateTime(timezone=True), default=_now, onupdate=_now)

Index("idx_flows_class",   CourseFlow.class_id)

Index("idx_flows_status",  CourseFlow.class_id, CourseFlow.status)

# ─────────────────────────────────────────────────────────────
# SPACED RETRIEVAL
# ─────────────────────────────────────────────────────────────

class SpacedReview(Base):

    """

    Auto-generated review record for the Spaced Retrieval flow pattern.
    Created when a student completes a topic; reviews scheduled on days 1, 3, and 7.
    """

    __tablename__ = "spaced_reviews"

    __table_args__ = (

        UniqueConstraint("student_id", "topic_id", "class_id", "review_day"),

    )

    id           = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    student_id   = Column(UUID(as_uuid=False), ForeignKey("users.id",   ondelete="CASCADE"),   nullable=False)

    class_id     = Column(UUID(as_uuid=False), ForeignKey("classes.id", ondelete="CASCADE"),   nullable=False)

    topic_id     = Column(UUID(as_uuid=False), ForeignKey("topics.id",  ondelete="CASCADE"),   nullable=False)

    problem_id   = Column(UUID(as_uuid=False), ForeignKey("problems.id",ondelete="SET NULL"))

    review_day   = Column(Integer, nullable=False)           # 1 | 3 | 7

    scheduled_at = Column(DateTime(timezone=True), nullable=False)

    completed    = Column(Boolean, nullable=False, default=False)

    completed_at = Column(DateTime(timezone=True))

    is_correct   = Column(Boolean)

    created_at   = Column(DateTime(timezone=True), default=_now)

    student = relationship("User",    foreign_keys=[student_id])

    topic   = relationship("Topic",   foreign_keys=[topic_id])

    problem = relationship("Problem", foreign_keys=[problem_id])

Index("idx_spaced_reviews_student_class", SpacedReview.student_id, SpacedReview.class_id)

Index("idx_spaced_reviews_scheduled",     SpacedReview.scheduled_at, SpacedReview.completed)

# ─────────────────────────────────────────────────────────────
# ADAPTIVE BRANCH — diagnostic state per student/topic
# ─────────────────────────────────────────────────────────────

class AdaptiveBranchState(Base):

    """

    Stores the diagnostic test result for the Adaptive Branch flow pattern.
    Records the assigned learning path (basic or advanced) per student/topic.
    """

    __tablename__ = "adaptive_branch_states"

    __table_args__ = (

        UniqueConstraint("student_id", "class_id", "topic_id"),

    )

    id                = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    student_id        = Column(UUID(as_uuid=False), ForeignKey("users.id",   ondelete="CASCADE"), nullable=False)

    class_id          = Column(UUID(as_uuid=False), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)

    topic_id          = Column(UUID(as_uuid=False), ForeignKey("topics.id",  ondelete="CASCADE"), nullable=False)

    diagnostic_score  = Column(Float)              # 0-100

    assigned_path     = Column(String(20))         # 'basic' | 'advanced'

    diagnostic_done   = Column(Boolean, nullable=False, default=False)

    problems_answered = Column(Integer, default=0)

    created_at        = Column(DateTime(timezone=True), default=_now)

    updated_at        = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    student = relationship("User",  foreign_keys=[student_id])

    topic   = relationship("Topic", foreign_keys=[topic_id])

Index("idx_adaptive_state_student", AdaptiveBranchState.student_id, AdaptiveBranchState.class_id)

