"""

  1. classify_intent(mesaj)

"""

from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

import uuid

from app.api.deps import get_db, get_current_user

from app.db.models import Problem, AiTutorSession, User, ProblemHint, HintRequest

from app.schemas import TutorChatRequest, TutorChatResponse

# Yeni multi-node dialog graph — eski process_tutor_message_sync yerine

from app.ai.dialog_graph import process_dialog_message

router = APIRouter(prefix="/tutor", tags=["tutor"])

@router.post("/chat", response_model=TutorChatResponse)

def chat_with_tutor(

    body: TutorChatRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    """

    Ogrencinin AI Tutor ile konusmasi.

    Dialog graph intent'i otomatik classify eder:

    - hint istegi     → generate_hint (DB hints + AI)

    - hata aciklama   → explain_error

    - genel sohbet    → socratic_tutor

    """

    problem = db.get(Problem, body.problem_id)

    if not problem:

        raise HTTPException(status_code=404, detail="Problem not found")

    # Mevcut hint session bilgisini al (kac kez hint istedi?)

    existing_session = db.query(AiTutorSession).filter_by(

        student_id=current_user.id, problem_id=problem.id

    ).order_by(AiTutorSession.started_at.desc()).first()

    # DB'den problem hint'lerini al (problem_hints tablosu)

    db_hints = db.query(ProblemHint).filter_by(

        problem_id=problem.id

    ).order_by(ProblemHint.level).all()

    available_hints = [h.content for h in db_hints]

    # Kac kez hint istendigi (hint_requests tablosundan)

    hint_count = db.query(HintRequest).filter_by(

        student_id=current_user.id, problem_id=problem.id

    ).count()

    # Chat history dict formatina cevir

    chat_history_dicts = [{"role": msg.role, "content": msg.content} for msg in body.chat_history]

    session_id = f"tutor-{current_user.id}-{problem.id}"

    # ── Dialog graph'i calistir ───────────────────────────────────────────────

    try:

        result = process_dialog_message(

            problem_title=problem.title,

            problem_description=problem.description,

            student_code_or_answer=body.student_code_or_answer or "",

            chat_history=chat_history_dicts,

            new_message=body.new_message,

            hint_level=hint_count,

            available_hints=available_hints,

            session_id=session_id,

            user_id=str(current_user.id)

        )

    except Exception as e:

        raise HTTPException(status_code=500, detail=f"AI Tutor error: {str(e)}")

    intent = result.get("intent", "socratic")

    # ── Hint istegi ise hint_requests tablosuna kaydet ─────────────────────────

    if intent == "hint":

        hint_request = HintRequest(

            student_id=current_user.id,

            problem_id=problem.id,

            hint_level=hint_count + 1,       # 1-indexed hint level

            hint_delivered=result["response"],

            trigger_reason="student_request",

        )

        db.add(hint_request)

    # ── AI Tutor session'i guncelle / olustur ────────────────────────────────

    if existing_session:

        # Mevcut session'i guncelle — tam chat history'yi kaydet

        existing_session.messages = result["chat_history"]

        existing_session.langfuse_trace_id = result.get("trace_id")

    else:

        # Yeni session olustur

        db_session = AiTutorSession(

            student_id=current_user.id,

            problem_id=problem.id,

            messages=result["chat_history"],

            model_used="gpt-4.1-nano",

            langfuse_trace_id=result.get("trace_id")

        )

        db.add(db_session)

    db.commit()

    return TutorChatResponse(

        response=result["response"],

        chat_history=result["chat_history"],

        trace_id=result.get("trace_id")

    )

# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────

from pydantic import BaseModel

from typing import List

class PlaygroundChatRequest(BaseModel):

    """Free-form AI chat request without a specific problem context."""

    language: str           # "cpp", "python", "javascript"

    code: str

    new_message: str

    chat_history: List[dict] = []

class PlaygroundChatResponse(BaseModel):

    """Free-form AI chat response."""

    response: str

    chat_history: List[dict]

    trace_id: str | None = None

@router.post("/playground-chat", response_model=PlaygroundChatResponse)

def playground_chat(

    body: PlaygroundChatRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """

    """

    import os

    from openai import OpenAI

    messages = []

    system_prompt = (

        f"You are a helpful coding assistant in ThinkCode, a learning platform. "

        f"The user is working in the {body.language.upper()} playground.\n\n"

        f"Current code:\n```{body.language}\n{body.code}\n```\n\n"

        f"Help the student learn and understand their code. "

        f"Be encouraging, concise, and use markdown for code snippets."

    )

    messages.append({"role": "system", "content": system_prompt})

    for msg in body.chat_history[-10:]:

        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": body.new_message})

    try:

        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

        resp = client.chat.completions.create(

            model="gpt-4.1-nano",

            messages=messages,

            max_tokens=500,

            temperature=0.7,

        )

        assistant_reply = resp.choices[0].message.content.strip()

    except Exception as e:

        assistant_reply = (

            "I'm having trouble connecting to the AI service right now. "

            "Please check your internet connection and try again."

        )

    updated_history = list(body.chat_history) + [

        {"role": "user", "content": body.new_message},

        {"role": "assistant", "content": assistant_reply},

    ]

    return PlaygroundChatResponse(

        response=assistant_reply,

        chat_history=updated_history,

    )

