"""
Tutor router.

Handles student ↔ AI Tutor interactions. The dialog graph automatically
classifies intent and routes to the appropriate handler:
  1. classify_intent(message)
  2. hint request   → generate_hint (DB hints + AI)
  3. error explain  → explain_error
  4. general chat   → socratic_tutor
"""

from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

import uuid

from app.api.deps import get_db, get_current_user

from app.db.models import Problem, AiTutorSession, User, ProblemHint, HintRequest

from app.schemas import TutorChatRequest, TutorChatResponse

# Multi-node dialog graph (replaces the legacy process_tutor_message_sync)

from app.ai.dialog_graph import process_dialog_message

router = APIRouter(prefix="/tutor", tags=["tutor"])


# ── Session restore ────────────────────────────────────────────────────────────

@router.get("/session/{problem_id}", summary="Retrieve the student's saved conversation history for a problem")
def get_tutor_session(
    problem_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the persisted chat messages from the most recent AI Tutor session
    for the current student on the given problem.

    Used by the frontend to restore conversation state when a student
    revisits a problem they previously worked on.

    Returns:
        { messages: [{role, content}, ...], hint_count: int }
        Empty messages list if no prior session exists.
    """
    problem = db.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found.")

    session = (
        db.query(AiTutorSession)
        .filter_by(student_id=current_user.id, problem_id=problem_id)
        .order_by(AiTutorSession.started_at.desc())
        .first()
    )

    hint_count = db.query(HintRequest).filter_by(
        student_id=current_user.id, problem_id=problem_id
    ).count()

    if not session or not session.messages:
        return {"messages": [], "hint_count": hint_count}

    return {"messages": session.messages, "hint_count": hint_count}

@router.post("/chat", response_model=TutorChatResponse)

def chat_with_tutor(

    body: TutorChatRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    """
    Handle a student's chat message to the AI Tutor.

    The dialog graph classifies intent automatically:
    - hint request   → generate_hint (DB hints + AI enrichment)
    - error explain  → explain_error
    - general chat   → socratic_tutor
    """

    problem = db.get(Problem, body.problem_id)

    if not problem:

        raise HTTPException(status_code=404, detail="Problem not found")

    # Fetch any existing tutor session (to know how many hints were given)

    existing_session = db.query(AiTutorSession).filter_by(

        student_id=current_user.id, problem_id=problem.id

    ).order_by(AiTutorSession.started_at.desc()).first()

    # Load problem hints from the problem_hints table

    db_hints = db.query(ProblemHint).filter_by(

        problem_id=problem.id

    ).order_by(ProblemHint.level).all()

    available_hints = [h.content for h in db_hints]

    # Total hints already delivered to this student on this problem

    hint_count = db.query(HintRequest).filter_by(

        student_id=current_user.id, problem_id=problem.id

    ).count()

    # Convert chat history messages to plain dict format

    chat_history_dicts = [{"role": msg.role, "content": msg.content} for msg in body.chat_history]

    session_id = f"tutor-{current_user.id}-{problem.id}"

    # ── Fetch course context: topic → lessons → source resource ──────────────
    # Load the lesson(s) linked to this problem's topic so the AI can ground
    # its explanations in the actual course material instead of general knowledge.
    from app.db.models import Topic, Lesson, CourseResource

    topic = db.get(Topic, problem.topic_id) if problem.topic_id else None
    lesson_context = []
    resource_info = None

    if topic:
        lessons = (
            db.query(Lesson)
            .filter(Lesson.topic_id == topic.id)
            .order_by(Lesson.display_order)
            .limit(3)   # cap at 3 lessons to stay within token budget
            .all()
        )
        for lesson in lessons:
            lesson_context.append({
                "title":   lesson.title,
                "summary": (lesson.summary or "")[:300],
                # Include first 800 chars of content so AI has real material to cite
                "content_excerpt": (lesson.content_markdown or "")[:800],
            })

        # Resolve the source resource (PDF / video) linked to this topic
        if topic.source_resource_id:
            resource = db.get(CourseResource, topic.source_resource_id)
            if resource:
                resource_info = {
                    "name":         resource.filename,
                    "download_url": f"/api/v1/resources/{resource.id}/download",
                }

    # ── INPUT GUARDRAIL: check student message before hitting LLM ───────────
    from app.ai.guardrail import scan_input, scan_output

    input_check = scan_input(body.new_message, context="student/tutor")
    if input_check.blocked:
        return TutorChatResponse(
            response="I can't respond to that message. Let's focus on your programming problem!",
            chat_history=chat_history_dicts,
            trace_id=None,
        )

    # ── Run the dialog graph ─────────────────────────────────────────────────

    try:

        result = process_dialog_message(

            problem_title=problem.title,

            problem_description=problem.description,

            student_code_or_answer=body.student_code_or_answer or "",

            chat_history=chat_history_dicts,

            new_message=body.new_message,

            hint_level=hint_count,

            available_hints=available_hints,

            lesson_context=lesson_context,

            resource_info=resource_info,

            session_id=session_id,

            user_id=str(current_user.id)

        )

    except Exception as e:

        raise HTTPException(status_code=500, detail=f"AI Tutor error: {str(e)}")

    intent = result.get("intent", "socratic")

    # ── If intent is a hint request, persist it to hint_requests ────────────

    if intent == "hint":

        hint_request = HintRequest(

            student_id=current_user.id,

            problem_id=problem.id,

            hint_level=hint_count + 1,       # 1-indexed hint level

            hint_delivered=result["response"],

            trigger_reason="student_request",

        )

        db.add(hint_request)

    # ── Update or create the AI Tutor session ───────────────────────────────

    if existing_session:

        # Update existing session — persist full chat history

        existing_session.messages = result["chat_history"]

        existing_session.langfuse_trace_id = result.get("trace_id")

    else:

        # Create a new session

        db_session = AiTutorSession(

            student_id=current_user.id,

            problem_id=problem.id,

            messages=result["chat_history"],

            model_used="gpt-4.1-nano",

            langfuse_trace_id=result.get("trace_id")

        )

        db.add(db_session)

    db.commit()

    # ── OUTPUT GUARDRAIL: semantic relevance of AI response ─────────────────
    # Non-blocking — we still return the response, but log if it seems off-topic.
    if lesson_context:
        output_check = scan_output(
            generated_text=result["response"],
            lesson_context=lesson_context,
            item_label=f"tutor response for '{problem.title[:40]}'",
        )
        if not output_check.passed:
            import logging
            logging.getLogger(__name__).warning(
                f"[Guardrail/Tutor] Low relevance on response for problem={problem.id}"
            )

    return TutorChatResponse(

        response=result["response"],

        chat_history=result["chat_history"],

        trace_id=result.get("trace_id")

    )



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

    """Handle a free-form AI chat message in the code playground (no problem context required)."""

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

