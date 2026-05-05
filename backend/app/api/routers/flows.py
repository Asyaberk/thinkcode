"""

Router: /api/v1/flows

Pedagogical Flow Designer — Flow kaydetme ve deploy etme.

  POST /flows/                    → Yeni flow kaydet (draft)

  DELETE /flows/{id}              → Flow sil

"""

import logging

from datetime import datetime, timezone, timedelta

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from pydantic import BaseModel

from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user

from app.db.models import (

    User, CourseFlow, Class, Enrollment,

    SpacedReview, AdaptiveBranchState, Problem, Topic,

)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/flows", tags=["flows"])

# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class FlowNodeConfig(BaseModel):

    """Node-level configuration (type-agnostic)."""

    consecutive_correct: Optional[int] = None

    max_hints: Optional[int] = None

    review_days: Optional[list[int]] = None

    difficulty: Optional[str] = None

    source_url: Optional[str] = None

    threshold_score: Optional[int] = None

class FlowCreate(BaseModel):

    class_id: str

    pattern: str = "custom"           # socratic_retry | mastery_gate | spaced_retrieval | adaptive_branch | custom

    flow_json: dict                   # {nodes: [...], connections: [...]}

    config: dict = {}                 # pattern-level config

class FlowUpdate(BaseModel):

    pattern: Optional[str] = None

    flow_json: Optional[dict] = None

    config: Optional[dict] = None

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _check_instructor(user: User):

    if user.role not in ("instructor", "admin"):

        raise HTTPException(status_code=403, detail="Instructor access required.")

def _get_flow_or_404(flow_id: str, db: Session, user: User) -> CourseFlow:

    flow = db.query(CourseFlow).filter(

        CourseFlow.id == flow_id,

        CourseFlow.instructor_id == user.id,

    ).first()

    if not flow:

        raise HTTPException(status_code=404, detail="Flow not found.")

    return flow

def _flow_response(flow: CourseFlow) -> dict:

    return {

        "id":           flow.id,

        "class_id":     flow.class_id,

        "instructor_id": flow.instructor_id,

        "pattern":      flow.pattern,

        "flow_json":    flow.flow_json,

        "config":       flow.config,

        "status":       flow.status,

        "created_at":   flow.created_at,

        "updated_at":   flow.updated_at,

    }

# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/", status_code=201)

def create_flow(

    body: FlowCreate,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Create a new pedagogical flow (draft status) and associate it with the given class."""

    _check_instructor(current_user)

    cls = db.query(Class).filter(

        Class.id == body.class_id,

        Class.instructor_id == current_user.id,

    ).first()

    if not cls:

        raise HTTPException(status_code=404, detail="Class not found or not owned by current user.")

    flow = CourseFlow(

        class_id=body.class_id,

        instructor_id=current_user.id,

        pattern=body.pattern,

        flow_json=body.flow_json,

        config=body.config,

        status="draft",

        created_at=datetime.now(timezone.utc),

        updated_at=datetime.now(timezone.utc),

    )

    db.add(flow)

    db.commit()

    db.refresh(flow)

    logger.info(f"Flow created: {flow.id} (class={body.class_id}, pattern={body.pattern})")

    return _flow_response(flow)

@router.put("/{flow_id}")

def update_flow(

    flow_id: str,

    body: FlowUpdate,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Update a flow's pattern, configuration, or status. Activating a flow sets all others in the same class to 'draft'."""

    _check_instructor(current_user)

    flow = _get_flow_or_404(flow_id, db, current_user)

    if body.pattern is not None:

        flow.pattern = body.pattern

    if body.flow_json is not None:

        flow.flow_json = body.flow_json

    if body.config is not None:

        flow.config = body.config

    flow.updated_at = datetime.now(timezone.utc)

    db.commit()

    db.refresh(flow)

    return _flow_response(flow)

@router.post("/{flow_id}/deploy")

def deploy_flow(

    flow_id: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Permanently delete a pedagogical flow. Instructor must own the flow."""

    _check_instructor(current_user)

    flow = _get_flow_or_404(flow_id, db, current_user)

    db.query(CourseFlow).filter(

        CourseFlow.class_id == flow.class_id,

        CourseFlow.status == "live",

        CourseFlow.id != flow_id,

    ).update({"status": "draft", "updated_at": datetime.now(timezone.utc)})

    flow.status = "live"

    flow.updated_at = datetime.now(timezone.utc)

    db.commit()

    db.refresh(flow)

    logger.info(f"Flow deploy edildi: {flow.id} (class={flow.class_id}, pattern={flow.pattern})")

    return {

        **_flow_response(flow),

        "message": f"Flow '{flow.pattern}' successfully deployed to students.",

    }

@router.get("/active")

def get_active_flow(

    class_id: str = Query(..., description="Class UUID"),

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Return the currently live (active) flow for the given class, or null if none is active."""

    flow = db.query(CourseFlow).filter(

        CourseFlow.class_id == class_id,

        CourseFlow.status == "live",

    ).order_by(CourseFlow.updated_at.desc()).first()

    if not flow:

        return {

            "has_active_flow": False,

            "pattern": "default",

            "config": {},

            "flow_json": {},

        }

    return {

        "has_active_flow": True,

        **_flow_response(flow),

    }

@router.get("/")

def list_flows(

    class_id: Optional[str] = Query(None, description="Filter by class UUID"),

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Return all pedagogical flows created by the current instructor, optionally filtered by class."""

    _check_instructor(current_user)

    query = db.query(CourseFlow).filter(CourseFlow.instructor_id == current_user.id)

    if class_id:

        query = query.filter(CourseFlow.class_id == class_id)

    flows = query.order_by(CourseFlow.updated_at.desc()).all()

    return [_flow_response(f) for f in flows]

@router.delete("/{flow_id}", status_code=204)

def delete_flow(

    flow_id: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Flow sil. Sadece draft flow'lar silinebilir."""

    _check_instructor(current_user)

    flow = _get_flow_or_404(flow_id, db, current_user)

    if flow.status == "live":

        raise HTTPException(

            status_code=400,

            detail="Cannot delete a live flow. Deploy a different flow first."

        )

    db.delete(flow)

    db.commit()

    return

@router.post("/{flow_id}/summary")

def generate_flow_summary(

    flow_id: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Generate an AI summary for the pedagogical flow (triggered by the Sparkles button)."""

    _check_instructor(current_user)

    flow = _get_flow_or_404(flow_id, db, current_user)

    nodes = flow.flow_json.get("nodes", []) if flow.flow_json else []

    node_types = [n.get("type", "UNKNOWN") for n in nodes]

    pattern = flow.pattern or "custom"

    prompt = f"""You are an expert educational technologist analyzing a pedagogical flow.

Pattern: {pattern.replace('_', ' ').title()} | Nodes: {', '.join(node_types[:10])} | Config: {flow.config or '{}'}

Write 2-3 sentences: how students experience this flow, what happens on wrong vs right answers, and the pedagogical goal. Be concise and specific."""

    try:

        import os

        from openai import OpenAI

        api_key = os.getenv("OPENAI_API_KEY", "")

        if not api_key:

            raise ValueError("No OPENAI_API_KEY")

        client = OpenAI(api_key=api_key)

        resp = client.chat.completions.create(

            model="gpt-4.1-nano",

            messages=[{"role": "user", "content": prompt}],

            max_tokens=150,

            temperature=0.7,

        )

        summary = resp.choices[0].message.content.strip()

    except Exception as e:

        logger.warning(f"AI summary failed: {e}, using rule-based fallback")

        fallbacks = {

            "mastery_gate":    "Students must answer 3 consecutive questions correctly before advancing — wrong answers reset the streak, ensuring true mastery.",

            "socratic_retry":  "Wrong answers trigger Socratic hints that guide students without revealing the answer; they retry the same question until they succeed.",

            "spaced_retrieval":"Questions appear at spaced intervals (day 1, 3, 7) to leverage the spacing effect and maximize long-term retention.",

            "adaptive_branch": "Students face a question before any lesson content — wrong answers unlock introductory material, correct answers unlock advanced content, then the section concludes.",

        }

        summary = fallbacks.get(pattern, f"A {pattern.replace('_',' ')} flow with {len(nodes)} pedagogical nodes designed to maximize student engagement.")

    return {"summary": summary, "flow_id": flow_id, "pattern": pattern}

# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────

@router.get("/spaced-reviews")

def get_due_spaced_reviews(

    class_id: str = Query(..., description="Class UUID"),

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Return spaced-retrieval review items due today or earlier for the current student in the given class."""

    today = datetime.now(timezone.utc)

    reviews = (

        db.query(SpacedReview)

        .filter(

            SpacedReview.student_id == current_user.id,

            SpacedReview.class_id   == class_id,

            SpacedReview.completed  == False,

            SpacedReview.scheduled_at <= today,

        )

        .all()

    )

    return [

        {

            "id":           r.id,

            "topic_id":     r.topic_id,

            "topic_name":   r.topic.name if r.topic else None,

            "problem_id":   r.problem_id,

            "review_day":   r.review_day,

            "scheduled_at": r.scheduled_at,

        }

        for r in reviews

    ]

@router.post("/spaced-reviews/{review_id}/complete")

def complete_spaced_review(

    review_id: str,

    body: dict = {},

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """

    body: { is_correct: bool }

    """

    review = db.query(SpacedReview).filter(

        SpacedReview.id         == review_id,

        SpacedReview.student_id == current_user.id,

    ).first()

    if not review:

        raise HTTPException(status_code=404, detail="Review not found.")

    review.completed    = True

    review.completed_at = datetime.now(timezone.utc)

    review.is_correct   = body.get("is_correct")

    db.commit()

    return {"ok": True, "review_id": review_id}

# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────

@router.get("/adaptive-state")

def get_adaptive_state(

    class_id: str  = Query(..., description="Class UUID"),

    topic_id: str  = Query(..., description="Topic UUID"),

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Return the student's current adaptive diagnostic state (mastery level and recommended topic) for the given class."""

    state = db.query(AdaptiveBranchState).filter(

        AdaptiveBranchState.student_id == current_user.id,

        AdaptiveBranchState.class_id   == class_id,

        AdaptiveBranchState.topic_id   == topic_id,

    ).first()

    if state:

        return {

            "diagnostic_done":  state.diagnostic_done,

            "assigned_path":    state.assigned_path,

            "diagnostic_score": state.diagnostic_score,

            "diagnostic_problems": [],

        }

    diag_problems = (

        db.query(Problem)

        .filter(Problem.topic_id == topic_id, Problem.is_published == True)

        .order_by(Problem.created_at)

        .limit(3)

        .all()

    )

    return {

        "diagnostic_done":  False,

        "assigned_path":    None,

        "diagnostic_score": None,

        "diagnostic_problems": [

            {

                "id":          p.id,

                "title":       p.title,

                "description": p.description,

                "type":        p.type,

                "difficulty":  p.difficulty,

                "options": [

                    {"id": o.id, "text": o.text, "is_correct": o.is_correct}

                    for o in (p.options or [])

                ],

            }

            for p in diag_problems

        ],

    }

class AdaptiveCompleteBody(BaseModel):

    class_id:      str

    topic_id:      str

    correct_count: int

    total_count:   int

@router.post("/adaptive-complete")

def complete_adaptive_diagnostic(

    body: AdaptiveCompleteBody,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Record the student's completion of an adaptive diagnostic topic and advance their branch state."""

    active_flow = (

        db.query(CourseFlow)

        .filter(CourseFlow.class_id == body.class_id, CourseFlow.status == "live")

        .first()

    )

    threshold = 70

    if active_flow and active_flow.config:

        threshold = active_flow.config.get("threshold_score", 70)

    score = (body.correct_count / max(body.total_count, 1)) * 100

    path  = "advanced" if score >= threshold else "basic"

    state = db.query(AdaptiveBranchState).filter(

        AdaptiveBranchState.student_id == current_user.id,

        AdaptiveBranchState.class_id   == body.class_id,

        AdaptiveBranchState.topic_id   == body.topic_id,

    ).first()

    if state:

        state.diagnostic_score  = score

        state.assigned_path     = path

        state.diagnostic_done   = True

        state.problems_answered = body.total_count

        state.updated_at        = datetime.now(timezone.utc)

    else:

        state = AdaptiveBranchState(

            student_id        = current_user.id,

            class_id          = body.class_id,

            topic_id          = body.topic_id,

            diagnostic_score  = score,

            assigned_path     = path,

            diagnostic_done   = True,

            problems_answered = body.total_count,

        )

        db.add(state)

    db.commit()

    logger.info(

        f"Adaptive diagnostic complete: student={current_user.id} "

        f"topic={body.topic_id} score={score:.1f} path={path}"

    )

    return {

        "assigned_path":    path,

        "diagnostic_score": score,

        "threshold":        threshold,

    }

