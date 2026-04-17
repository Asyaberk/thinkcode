"""
Router: /api/v1/flows

Pedagogical Flow Designer — Flow kaydetme ve deploy etme.

Akış:
  POST /flows/                    → Yeni flow kaydet (draft)
  PUT  /flows/{id}                → Flow güncelle (canvas değişikliği)
  POST /flows/{id}/deploy         → Flow'u live yap (öğrenciler görür)
  GET  /flows/active?class_id=X   → Aktif (live) flow'u getir (öğrenci sayfası için)
  GET  /flows/?class_id=X         → Tüm flow'ları listele (instructor için)
  DELETE /flows/{id}              → Flow sil

Öğrenci sayfası GET /flows/active?class_id=X çekerek:
  - pattern: 'mastery_gate' → consecutive_correct sayacı gösterir
  - pattern: 'socratic_retry' → yanlış cevapta hint, Retry butonu
  - pattern: 'spaced_retrieval' → zamanlanmış review bildirimi
  - pattern: 'adaptive_branch' → başlangıçta seviye testi
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.db.models import User, CourseFlow, Class, Enrollment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/flows", tags=["flows"])


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class FlowNodeConfig(BaseModel):
    """Node'a özel konfigürasyon — tip bağımsız."""
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
        raise HTTPException(status_code=403, detail="Sadece instructor bu işlemi yapabilir.")


def _get_flow_or_404(flow_id: str, db: Session, user: User) -> CourseFlow:
    flow = db.query(CourseFlow).filter(
        CourseFlow.id == flow_id,
        CourseFlow.instructor_id == user.id,
    ).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow bulunamadı.")
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
    """
    Yeni bir flow oluştur (status: draft).
    Flow Designer'daki "Save Draft" butonuna bağlanır.
    """
    _check_instructor(current_user)

    # Class'ın bu instructor'a ait olup olmadığını doğrula
    cls = db.query(Class).filter(
        Class.id == body.class_id,
        Class.instructor_id == current_user.id,
    ).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Sınıf bulunamadı veya bu size ait değil.")

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

    logger.info(f"Flow oluşturuldu: {flow.id} (class={body.class_id}, pattern={body.pattern})")
    return _flow_response(flow)


@router.put("/{flow_id}")
def update_flow(
    flow_id: str,
    body: FlowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mevcut flow'u güncelle (canvas değişikliği, hala draft).
    """
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
    """
    Flow'u live yap. Aynı sınıf için mevcut live flow varsa draft'a çekil.
    Flow Designer'daki "Deploy to Students" butonuna bağlanır.

    Bu endpoint çağrıldıktan sonra öğrenciler GET /flows/active ile
    bu flow'u çekip deneyimlerini buna göre şekillendirirler.
    """
    _check_instructor(current_user)
    flow = _get_flow_or_404(flow_id, db, current_user)

    # Aynı sınıf için mevcut live flow'ları draft'a çek
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
        "message": f"Flow '{flow.pattern}' başarıyla öğrencilere deploy edildi.",
    }


@router.get("/active")
def get_active_flow(
    class_id: str = Query(..., description="Sınıf ID'si"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bir sınıfın aktif (live) flow'unu getir.

    Öğrenci sayfaları bu endpoint'i çekerek:
      - Mastery Gate → consecutive_correct sayacı gösterir
      - Socratic Retry → yanlış cevapta hint, Retry butonu
      - Spaced Retrieval → review_days'e göre bildirim
      - Adaptive Branch → başlangıçta seviye testi

    Öğrenci veya instructor çağırabilir.
    Eğer live flow yoksa 404 yerine boş config döner (varsayılan davranış).
    """
    flow = db.query(CourseFlow).filter(
        CourseFlow.class_id == class_id,
        CourseFlow.status == "live",
    ).order_by(CourseFlow.updated_at.desc()).first()

    if not flow:
        # Live flow yok → varsayılan davranış (kısıtlama olmadan ilerle)
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
    class_id: Optional[str] = Query(None, description="Belirli sınıfa göre filtrele"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Instructor'ın tüm flow'larını listeler (draft + live).
    Flow Designer'daki geçmiş flow'ları görmek için kullanılır.
    """
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
            detail="Live flow silinemez. Önce başka bir flow deploy edin."
        )

    db.delete(flow)
    db.commit()
    return
