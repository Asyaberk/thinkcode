"""
Router: /api/v1/tutor
AI Socratic Tutor Chat capabilities (LangGraph)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from app.api.deps import get_db, get_current_user
from app.db.models import Problem, AiTutorSession, User
from app.schemas import TutorChatRequest, TutorChatResponse
from app.ai.tutor import process_tutor_message_sync

router = APIRouter(prefix="/tutor", tags=["tutor"])


@router.post("/chat", response_model=TutorChatResponse)
def chat_with_tutor(
    body: TutorChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    problem = db.get(Problem, body.problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    # Find or create a session in DB for logging (optional, could be done via trace but good for local history)
    # For now, we just pass the info to the LangGraph node and let it run
    
    # We transform the chat_history to dicts:
    chat_history_dicts = [{"role": msg.role, "content": msg.content} for msg in body.chat_history]

    # Generate an ephemeral session id if not tracked in client (we use UUID here as a placeholder for langfuse session group)
    session_id = f"tutor-{current_user.id}-{problem.id}"

    # Invoke Tutor Graph
    try:
        result = process_tutor_message_sync(
            problem_title=problem.title,
            problem_description=problem.description,
            student_code_or_answer=body.student_code_or_answer or "",
            chat_history=chat_history_dicts,
            new_message=body.new_message,
            session_id=session_id,
            user_id=str(current_user.id)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Tutor error: {str(e)}")

    # Update/Increment DB session log if we want to track token usage locally here.
    # We will log a simple AiTutorSession if it's the first message!
    if not body.chat_history:
        db_session = AiTutorSession(
            student_id=current_user.id,
            problem_id=problem.id,
            messages=result["chat_history"],
            model_used="gpt-4o-mini",
            langfuse_trace_id=result.get("trace_id")
        )
        db.add(db_session)
    else:
        # Ideally, we find the active session and append, but Langfuse handles tracing thoroughly.
        # Simple local append for demo:
        existing_session = db.query(AiTutorSession).filter_by(
            student_id=current_user.id, problem_id=problem.id
        ).order_by(AiTutorSession.started_at.desc()).first()
        
        if existing_session:
            existing_session.messages = result["chat_history"]
    
    db.commit()

    return TutorChatResponse(
        response=result["response"],
        chat_history=result["chat_history"],
        trace_id=result.get("trace_id")
    )
