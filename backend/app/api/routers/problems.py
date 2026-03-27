"""
Router: /api/v1/problems
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_db, get_current_user
from app.db.models import Problem, ProblemHint, User
from app.schemas import ProblemOut, ProblemListOut, HintOut

router = APIRouter(prefix="/problems", tags=["problems"])


#Soruları filtrele: konu, zorluk, tip
@router.get("", response_model=list[ProblemListOut])
def list_problems(
    topic_id: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Problem).filter(Problem.is_published == True)
    if topic_id:
        q = q.filter(Problem.topic_id == topic_id)
    if difficulty:
        q = q.filter(Problem.difficulty == difficulty)
    if type:
        q = q.filter(Problem.type == type)
    # MCQ önce (öğrencinin Learning Path → Start Practice akışı için)
    # CASE WHEN ile öncelik: multiple_choice=1, coding=2, open_response=3
    from sqlalchemy import case
    type_order = case(
        (Problem.type == 'multiple_choice', 1),
        (Problem.type == 'coding', 2),
        else_=3
    )
    q = q.order_by(type_order)
    return q.all()



@router.get("/{problem_id}", response_model=ProblemOut)
def get_problem(
    problem_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    problem = db.get(Problem, problem_id)
    if not problem or not problem.is_published:
        raise HTTPException(404, "Problem not found")
    return problem


#DB'den basit ipucu çek (1, 2 veya 3. seviye)
@router.get("/{problem_id}/hint/{level}", response_model=HintOut)
def get_hint(
    problem_id: str,
    level: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    hint = (
        db.query(ProblemHint)
        .filter(ProblemHint.problem_id == problem_id, ProblemHint.level == level)
        .first()
    )
    if not hint:
        raise HTTPException(404, f"Hint level {level} not found for this problem")
    return hint
