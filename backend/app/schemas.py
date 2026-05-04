"""
models.py
 → veritabanı tablosu (SQLAlchemy)

schemas.py
 → API'nin giriş/çıkış formatı (Pydantic)


schemas.py — Pydantic Veri Modelleri (Request/Response Doğrulama)

Bu dosya backend API'sinin giriş (request) ve çıkış (response) verilerini
tanımlar. FastAPI her endpoint'e gelen veriyi bu şemalar aracılığıyla
doğrular ve dönüştürür.

GENEL AKIŞ:
  Frontend → HTTP isteği → Router → Schema doğrulama → İş mantığı → Schema response

SCHEMA GRUPLARI:
  - Auth:        Login ve JWT token için girdi/çıktı
  - User:        Kullanıcı bilgisi (frontend'e dönülen açık veri)
  - Topic:       Konu listesi için
  - Lesson:      Ders içeriği (markdown + materyaller)
  - Problem:     Soru detayı, seçenekler, ipuçları
  - Submission:  Öğrencinin cevabı kaydederken gönderdiği/aldığı veri
  - Event:       Öğrenme olaylarını kaydetmek için (sayfa ziyareti, video izleme vb.)
  - AI Tutor:    /tutor/chat endpoint'i için mesaj formatı
"""
from __future__ import annotations
from pydantic import BaseModel
from typing import Optional
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
    # MCQ seçenekleri — is_correct dahil (frontend doğru cevap belirleme için gerekli)
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
    id: Optional[str] = None          # dolu → mevcut option güncelle; boş → yeni ekle
    text: str
    is_correct: bool

class ProblemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[str] = None
    correct_answer: Optional[str] = None
    options: Optional[list[OptionIn]] = None  # verilirse tüm seçenekler değiştirilir

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
