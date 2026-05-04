"""

Router: /api/v1/problems

"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy.orm import Session

from typing import Optional

from app.api.deps import get_db, get_current_user, require_instructor

from app.db.models import Problem, ProblemHint, ProblemOption, User

from app.schemas import (

    ProblemOut, ProblemListOut, HintOut,

    ProblemUpdate, ProblemInstructorOut, ProblemCreate,

)

router = APIRouter(prefix="/problems", tags=["problems"])

@router.post("/by-topic/{topic_id}", response_model=ProblemInstructorOut, status_code=201)

def create_problem(

    topic_id: str,

    body: ProblemCreate,

    db: Session = Depends(get_db),

    _: User = Depends(require_instructor),

):

    """Instructor: manually creates a new problem under a topic."""

    from app.db.models import Topic

    topic = db.get(Topic, topic_id)

    if not topic:

        from fastapi import HTTPException

        raise HTTPException(404, "Topic not found")

    problem_type = body.type if body.type in ("coding", "multiple_choice") else "multiple_choice"

    difficulty = body.difficulty if body.difficulty in ("easy", "medium", "hard") else "medium"

    import uuid as _uuid

    problem = Problem(

        id=str(_uuid.uuid4()),

        topic_id=topic_id,

        title=body.title,

        description=body.description,

        type=problem_type,

        difficulty=difficulty,

        correct_answer=body.correct_answer,

        points=10,

        is_published=True,

    )

    db.add(problem)

    db.flush()

    for i, opt in enumerate(body.options):

        db.add(ProblemOption(

            id=str(_uuid.uuid4()),

            problem_id=problem.id,

            text=opt.text,

            is_correct=opt.is_correct,

            display_order=i,

        ))

    db.commit()

    db.refresh(problem)

    return problem

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

    from sqlalchemy import case

    type_order = case(

        (Problem.type == 'multiple_choice', 1),

        (Problem.type == 'coding', 2),

        else_=3

    )

    q = q.order_by(type_order)

    return q.all()

@router.get("/by-topic/{topic_id}", response_model=list[ProblemInstructorOut])

def list_problems_instructor(

    topic_id: str,

    db: Session = Depends(get_db),

    _: User = Depends(require_instructor),

):

    """Instructor: return all problems for a topic, including is_correct flag."""

    return db.query(Problem).filter(Problem.topic_id == topic_id).all()

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

@router.patch("/{problem_id}", response_model=ProblemInstructorOut)

def update_problem(

    problem_id: str,

    body: ProblemUpdate,

    db: Session = Depends(get_db),

    _: User = Depends(require_instructor),

):

    """Instructor: update problem title, description, difficulty, and options."""

    problem = db.get(Problem, problem_id)

    if not problem:

        raise HTTPException(404, "Problem not found")

    if body.title is not None:

        problem.title = body.title

    if body.description is not None:

        problem.description = body.description

    if body.difficulty is not None:

        problem.difficulty = body.difficulty

    if body.correct_answer is not None:

        problem.correct_answer = body.correct_answer

    if body.options is not None:

        db.query(ProblemOption).filter(ProblemOption.problem_id == problem_id).delete()

        for i, opt in enumerate(body.options):

            db.add(ProblemOption(

                id=opt.id or str(uuid.uuid4()),

                problem_id=problem_id,

                text=opt.text,

                is_correct=opt.is_correct,

                display_order=i,

            ))

    db.commit()

    db.refresh(problem)

    return problem

@router.delete("/{problem_id}", status_code=204)

def delete_problem(

    problem_id: str,

    db: Session = Depends(get_db),

    _: User = Depends(require_instructor),

):

    """Instructor: delete a problem along with its options and hints."""

    problem = db.get(Problem, problem_id)

    if not problem:

        raise HTTPException(404, "Problem not found")

    db.query(ProblemHint).filter(ProblemHint.problem_id == problem_id).delete()

    db.query(ProblemOption).filter(ProblemOption.problem_id == problem_id).delete()

    db.delete(problem)

    db.commit()

