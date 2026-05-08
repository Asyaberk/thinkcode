"""
content_chat.py — REST router for instructor AI chat in Course Builder.

POST /api/v1/content/chat
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User
from app.ai.content_chat import handle_chat_command
from app.ai.content_extractor import make_llm_client

router = APIRouter(prefix="/content", tags=["Content Chat"])


class ChatRequest(BaseModel):
    message: str
    class_id: str


class ChatResponse(BaseModel):
    summary: str
    actions_executed: list


@router.post("/chat", response_model=ChatResponse, summary="AI-assisted content editing chat")
def content_chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Instructor sends a free-form message; the AI modifies course content accordingly.

    Examples:
    - "Write 5 hard questions about binary trees in topic X"
    - "Create a new topic on recursion with a full lesson"
    - "Rewrite the heap lesson more concisely"
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="message cannot be empty")
    if not body.class_id.strip():
        raise HTTPException(status_code=400, detail="class_id is required")

    try:
        client = make_llm_client()
        result = handle_chat_command(
            message=body.message,
            class_id=body.class_id,
            db=db,
            client=client,
        )
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
