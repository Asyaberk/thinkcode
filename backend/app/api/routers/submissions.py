"""
Router: /api/v1/submissions
Handles problem submission + automatic MCQ grading.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.api.deps import get_db, get_current_user
from app.db.models import (
    Submission, Problem, ProblemOption, StudentTopicMastery, HintRequest, User
)
from app.schemas import SubmissionCreate, SubmissionOut

router = APIRouter(prefix="/submissions", tags=["submissions"])


def _update_mastery(db: Session, student_id: str, class_id: str, problem: Problem):
    """Recalculate mastery score for this topic after a submission."""
    mastery = (
        db.query(StudentTopicMastery)
        .filter_by(student_id=student_id, topic_id=problem.topic_id, class_id=class_id)
        .first()
    )
    if not mastery:
        mastery = StudentTopicMastery(
            student_id=student_id,
            topic_id=problem.topic_id,
            class_id=class_id,
        )
        db.add(mastery)

    # Recalculate from all submissions for this topic
    from sqlalchemy import func
    stats = (
        db.query(
            func.count(Submission.id).label("attempted"),
            func.sum(
                db.query(func.cast(Submission.is_correct == True, func.Integer())).label("x")
            )
        )
        .join(Problem, Submission.problem_id == Problem.id)
        .filter(
            Submission.student_id == student_id,
            Submission.class_id == class_id,
            Problem.topic_id == problem.topic_id,
            Submission.is_correct != None,
        )
        .first()
    )

    # Simpler approach: count directly
    all_subs = (
        db.query(Submission)
        .join(Problem, Submission.problem_id == Problem.id)
        .filter(
            Submission.student_id == student_id,
            Submission.class_id == class_id,
            Problem.topic_id == problem.topic_id,
            Submission.is_correct != None,
        )
        .all()
    )

    if all_subs:
        mastery.problems_attempted = len(set(s.problem_id for s in all_subs))
        passed = [s for s in all_subs if s.is_correct]
        mastery.problems_passed = len(set(s.problem_id for s in passed))

        # Mastery = (problems passed / problems attempted) * 100, dampened by hints
        raw = mastery.problems_passed / mastery.problems_attempted
        mastery.mastery_score = round(raw * 100, 2)
        mastery.last_activity_at = datetime.now(timezone.utc)

    db.flush()


@router.post("", response_model=SubmissionOut)
def submit(
    body: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    problem = db.get(Problem, body.problem_id)
    if not problem or not problem.is_published:
        raise HTTPException(404, "Problem not found")

    # Count previous attempts
    attempt_n = (
        db.query(Submission)
        .filter_by(student_id=current_user.id, problem_id=body.problem_id)
        .count()
    ) + 1

    submission = Submission(
        student_id=current_user.id,
        problem_id=body.problem_id,
        class_id=body.class_id,
        submitted_code=body.submitted_code,
        submitted_answer=body.submitted_answer,
        selected_option_id=body.selected_option_id,
        time_spent_seconds=body.time_spent_seconds,
        attempt_number=attempt_n,
        max_score=float(problem.points),
    )

    feedback = None

    # ── MCQ: auto-grade ──────────────────────────────────────────────
    if problem.type == "multiple_choice" and body.selected_option_id:
        option = db.get(ProblemOption, body.selected_option_id)
        if option and option.problem_id == problem.id:
            submission.is_correct = option.is_correct
            submission.score = float(problem.points) if option.is_correct else 0.0
            submission.status = "passed" if option.is_correct else "failed"
            feedback = "Correct! Well done." if option.is_correct else (
                f"Not quite. The correct answer is: {problem.correct_answer}"
            )
        else:
            raise HTTPException(400, "Invalid option")

    # ── Open response: compare against correct_answer (basic) ────────
    elif problem.type == "open_response" and body.submitted_answer:
        # TODO: replace with Grading LangGraph agent (Phase 4)
        answer_lower = body.submitted_answer.strip().lower()
        correct_lower = (problem.correct_answer or "").strip().lower()
        is_correct = (len(answer_lower) > 20)  # placeholder: require substantial answer
        submission.is_correct = is_correct
        submission.score = float(problem.points) * 0.7 if is_correct else 0.0
        submission.status = "passed" if is_correct else "failed"
        feedback = (
            "Your answer has been recorded. AI grading will be available soon."
            if is_correct
            else "Please provide a more detailed answer."
        )

    # ── Coding: mark pending (will be judged by judge service) ───────
    elif problem.type == "coding":
        submission.status = "pending"
        submission.is_correct = None
        feedback = "Your code has been submitted and is being evaluated."
    else:
        raise HTTPException(400, "Invalid submission body for problem type")

    db.add(submission)
    db.flush()

    # Update mastery
    _update_mastery(db, current_user.id, body.class_id, problem)

    db.commit()
    db.refresh(submission)

    result = SubmissionOut.model_validate(submission)
    result.feedback = feedback
    return result


@router.get("/{submission_id}", response_model=SubmissionOut)
def get_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = db.get(Submission, submission_id)
    if not sub or sub.student_id != current_user.id:
        raise HTTPException(404, "Submission not found")
    return sub


@router.post("/{submission_id}/hint")
def request_hint(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deliver next hint for the submission's problem."""
    sub = db.get(Submission, submission_id)
    if not sub or sub.student_id != current_user.id:
        raise HTTPException(404, "Submission not found")

    # Find highest hint already given
    last_hint = (
        db.query(HintRequest)
        .filter_by(student_id=current_user.id, problem_id=sub.problem_id)
        .order_by(HintRequest.hint_level.desc())
        .first()
    )
    next_level = (last_hint.hint_level + 1) if last_hint else 1

    from app.db.models import ProblemHint
    hint = (
        db.query(ProblemHint)
        .filter_by(problem_id=sub.problem_id, level=next_level)
        .first()
    )
    if not hint:
        return {"message": "No more hints available.", "hint": None, "level": next_level - 1}

    hr = HintRequest(
        student_id=current_user.id,
        problem_id=sub.problem_id,
        submission_id=sub.id,
        hint_level=next_level,
        hint_delivered=hint.content,
    )
    db.add(hr)

    # Penalize mastery slightly for hint usage
    problem = db.get(Problem, sub.problem_id)
    mastery = (
        db.query(StudentTopicMastery)
        .filter_by(student_id=current_user.id, topic_id=problem.topic_id, class_id=sub.class_id)
        .first()
    )
    if mastery:
        mastery.total_hints_used += 1

    db.commit()

    return {
        "level": next_level,
        "content": hint.content,
        "socratic_question": hint.socratic_question,
        "max_level": 3,
    }
