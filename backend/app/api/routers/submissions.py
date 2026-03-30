"""
submissions.py — Öğrenci Cevabı Kaydetme ve Otomatik Notlandırma

Bu router öğrencinin bir soruyu çözdüğünde çalışır.

POST /submissions  →  Yeni cevap kaydet
  İŞ AKIŞI:
  1. Soruyu ve soruya kayıtlı sınıfı veritabanından çek
  2. Cevap tipine göre notlandır:
     - multiple_choice  : Seçili seçeneğin is_correct alanına bak → anında doğru/yanlış
     - coding           : ai.grading modülü → GPT-4o-mini rubric + kod benzerliği
     - open_response    : ai.grading modülü → GPT-4o-mini açık uçlu değerlendirme
  3. student_topic_mastery tablosunu güncelle (upsert):
     - problems_attempted +1
     - problems_passed +1 (eğer doğruysa)
     - mastery_score = 100 * passed / attempted
  4. Submission nesnesini kaydet, SubmissionOut olarak dön

GET /submissions/me/solved-problem-ids
  → Öğrencinin doğru çözdüğü tüm problem ID'lerini döner.
    Frontend sidebar'daki yeşil ✓ işaretleri için kullanılır.

POST /submissions/{submission_id}/hint
  → Öğrenci ipucu istediğinde çalışır.
    ai.hint modülü (LangChain + GPT) kademeli hint üretir (level 1,2,3).
    hint_requests tablosuna kayıt eklenir.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.db.models import Submission, Problem, ProblemOption, HintRequest, User, StudentTopicMastery
from app.schemas import SubmissionCreate, SubmissionOut
from app.analytics.queries import recompute_mastery

router = APIRouter(prefix="/submissions", tags=["submissions"])


#Cevap gönder, not al
@router.post("", response_model=SubmissionOut)
def submit(
    body: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    problem = db.get(Problem, body.problem_id)
    if not problem or not problem.is_published:
        raise HTTPException(404, "Problem not found")

    # class_id: frontend'den gelirse kullan, gelmezse enrollment'dan al
    # Bu sayede frontend class_id'yi cekemese bile mastery guncellenir
    effective_class_id = body.class_id
    if not effective_class_id:
        from app.db.models import Enrollment
        enrollment = db.query(Enrollment).filter_by(student_id=current_user.id).first()
        effective_class_id = str(enrollment.class_id) if enrollment else None

    # Count previous attempts
    attempt_n = (
        db.query(Submission)
        .filter_by(student_id=current_user.id, problem_id=body.problem_id)
        .count()
    ) + 1

    submission = Submission(
        student_id=current_user.id,
        problem_id=body.problem_id,
        class_id=effective_class_id,  # Enrollment'dan alinan class_id'yi kullan
        submitted_code=body.submitted_code,
        submitted_answer=body.submitted_answer,
        selected_option_id=body.selected_option_id,
        time_spent_seconds=body.time_spent_seconds,
        attempt_number=attempt_n,
        max_score=float(problem.points),
    )

    feedback = None

    # ── MCQ: auto-grade ──────────────────────────────────────────────────────
    if problem.type == "multiple_choice" and body.selected_option_id:
        option = db.get(ProblemOption, body.selected_option_id)
        if not option or option.problem_id != problem.id:
            raise HTTPException(400, "Invalid option")
        submission.is_correct = option.is_correct
        submission.score = float(problem.points) if option.is_correct else 0.0
        submission.status = "passed" if option.is_correct else "failed"
        feedback = (
            "✓ Correct! Well done."
            if option.is_correct
            else f"Not quite. Hint: review the topic and try again."
        )

    # ── Open response: AI Auto-grading (LangGraph) ───────────────────────────
    elif problem.type == "open_response" and body.submitted_answer:
        from app.ai.grading import grade_submission_sync
        from app.db.models import AiGradingResult
        
        # Invoke LangGraph AI grading
        evaluation = grade_submission_sync(
            problem_title=problem.title,
            problem_description=problem.description,
            grading_rubric=problem.grading_rubric or problem.correct_answer or "Grade on algorithmic correctness.",
            max_score=float(problem.points),
            student_answer=body.submitted_answer,
            session_id=str(submission.id) if submission.id else None,
            user_id=str(current_user.id)
        )

        submission.is_correct = evaluation["is_correct"]
        submission.score = evaluation["score"]
        submission.status = "passed" if evaluation["is_correct"] else "failed"
        feedback = evaluation["feedback"]

        # Prepare AiGradingResult row
        grading_result = AiGradingResult(
            feedback=evaluation["feedback"],
            reasoning=evaluation["reasoning"],
            rubric_score=evaluation["score"],
            model_used="gpt-4.1-nano",
            langfuse_trace_id=evaluation.get("trace_id")
        )
        submission.grading_result = grading_result

    # ── Coding: pending (judge service Phase 4) ───────────────────────────────
    elif problem.type == "coding" and body.submitted_code:
        submission.status = "pending"
        submission.is_correct = None
        submission.score = None
        feedback = "Code submitted — evaluation pending."

    else:
        raise HTTPException(400, "Invalid submission body for this problem type")

    db.add(submission)
    db.flush()  # get submission.id

    # ── Mastery upsert via optimized SQL ─────────────────────────────────────
    # effective_class_id: body.class_id bossa enrollment'dan alindi (satir 26-31)
    if effective_class_id:
        recompute_mastery(db, current_user.id, effective_class_id, problem.topic_id)

    db.commit()
    db.refresh(submission)

    result = SubmissionOut.model_validate(submission)
    result.feedback = feedback
    return result


#Çözülmüş soruların ID'leri (sidebar yeşil ✓ için)
@router.get("/me/solved-problem-ids")
def get_solved_problem_ids(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kullanicinin daha once dogru cevapladigi (is_correct=True) problem_id listesini doner.
    ProblemsPage'de yeşil Solved status icin kullanilir.
    """
    rows = (
        db.query(Submission.problem_id)
        .filter(
            Submission.student_id == current_user.id,
            Submission.is_correct == True,
        )
        .distinct()
        .all()
    )
    return {"solved_problem_ids": [str(r[0]) for r in rows]}


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
    """Deliver a personalized hint for the submission's problem using LangGraph Agent."""
    from app.db.models import ProblemHint, Problem
    from app.ai.hint import process_hint_request_sync

    sub = db.get(Submission, submission_id)
    if not sub or sub.student_id != current_user.id:
        raise HTTPException(404, "Submission not found")

    problem = db.get(Problem, sub.problem_id)
    if not problem:
        raise HTTPException(404, "Problem not found")

    # Metrics for decision tree
    attempts = db.query(Submission).filter_by(
        student_id=current_user.id, problem_id=problem.id, is_correct=False
    ).count()

    hints_given = db.query(HintRequest).filter_by(
        student_id=current_user.id, problem_id=problem.id
    ).count()

    # Determine highest sequential level from DB
    last = (
        db.query(HintRequest)
        .filter_by(student_id=current_user.id, problem_id=problem.id)
        .order_by(HintRequest.hint_level.desc())
        .first()
    )
    db_level = (last.hint_level + 1) if last else 1
    if db_level > 3:
        db_level = 3

    # Fetch baseline hint from DB
    baseline_hint = (
        db.query(ProblemHint)
        .filter_by(problem_id=problem.id, level=db_level)
        .first()
    )

    db_hint_content = baseline_hint.content if baseline_hint else "Review the lesson material carefully."
    db_socratic_question = baseline_hint.socratic_question if baseline_hint else ""
    latest_submission_code = sub.submitted_code or sub.submitted_answer or "No content."

    # Intervene with AI Agent
    result = process_hint_request_sync(
        student_id=current_user.id,
        problem_id=problem.id,
        attempts=attempts,
        hints_given=hints_given,
        problem_title=problem.title,
        latest_submission=latest_submission_code,
        db_hint_content=db_hint_content,
        db_socratic_question=db_socratic_question,
        session_id=str(sub.id)
    )

    # Log HintRequest
    hr = HintRequest(
        student_id=current_user.id,
        problem_id=problem.id,
        submission_id=sub.id,
        hint_level=result["hint_level"],
        context_code=latest_submission_code,
        hint_delivered=result["generated_hint"],
        trigger_reason=f"attempts_{attempts}_history_{hints_given}",
        langfuse_trace_id=result.get("trace_id")
    )
    db.add(hr)

    # Penalize mastery slightly
    mastery = (
        db.query(StudentTopicMastery)
        .filter_by(
            student_id=current_user.id,
            topic_id=problem.topic_id,
            class_id=sub.class_id,
        )
        .first()
    )
    if mastery:
        mastery.total_hints_used += 1

    db.commit()

    return {
        "level": result["hint_level"],
        "content": result["generated_hint"],
        "max_level": 3,
        "trace_id": result.get("trace_id")
    }
