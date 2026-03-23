"""
Router: /api/v1/analytics
Öğrenci ve sınıf düzeyi öğrenme analitiği.
- /me/dashboard    → öğrenci özet paneli
- /me/mastery      → konu bazlı ustalık puanları
- /me/progress     → haftalık ilerleme (grafik için)
- /me/ai-insight   → OpenAI ile kişiselleştirilmiş performans yorumu
- /me/submissions  → geçmiş cevaplama listesi
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional

from app.api.deps import get_db, get_current_user
from app.db.models import User, Enrollment, Submission
from app.analytics.queries import (
    get_student_mastery_summary,
    get_class_percentile_rank,
    get_weekly_progress,
    get_topic_breakdown,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _get_class_id(db: Session, student_id: str) -> Optional[str]:
    """Get the first active enrollment's class_id for a student."""
    enrollment = (
        db.query(Enrollment)
        .filter_by(student_id=student_id, status="active")
        .first()
    )
    return enrollment.class_id if enrollment else None


# ─────────────────────────────────────────────────────────────────────────────
# Student Dashboard
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me/dashboard")
def my_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    class_id = _get_class_id(db, current_user.id)

    # Mastery summary — SQL aggregation, no loops
    mastery_rows = get_student_mastery_summary(db, current_user.id)

    # Percentile — window function
    percentile_data = {"percentile": 50.0, "rank": None, "total_students": 0, "avg_mastery": 0.0}
    if class_id:
        percentile_data = get_class_percentile_rank(db, current_user.id, class_id)

    # Derive overall score from mastery rows
    scored = [r for r in mastery_rows if r["problems_attempted"] > 0]
    overall = (
        sum(float(r["mastery_score"] or 0) for r in scored) / len(scored)
        if scored else 0.0
    )

    # Submission totals
    subs = db.query(Submission).filter_by(student_id=current_user.id).all()

    # Hint usage — hint_requests tablosundan problem bazinda toplam hint sayisi
    hint_sql = text("""
        WITH problem_hints AS (
            SELECT
                s.problem_id,
                COALESCE(hr.hint_count, 0) AS hint_count
            FROM (
                SELECT DISTINCT problem_id
                FROM submissions
                WHERE student_id = :student_id
            ) s
            LEFT JOIN (
                SELECT problem_id, COUNT(*) AS hint_count
                FROM hint_requests
                WHERE student_id = :student_id
                GROUP BY problem_id
            ) hr ON hr.problem_id = s.problem_id
        )
        SELECT
            COUNT(CASE WHEN hint_count = 0 THEN 1 END)   AS no_hint,
            COUNT(CASE WHEN hint_count = 1 THEN 1 END)   AS one_hint,
            COUNT(CASE WHEN hint_count > 1  THEN 1 END)  AS multi_hint,
            COUNT(*)                                      AS total_problems
        FROM problem_hints
    """)
    hint_row = db.execute(hint_sql, {"student_id": current_user.id}).mappings().first()
    hint_stats = {
        "no_hint": int(hint_row["no_hint"] or 0) if hint_row else 0,
        "one_hint": int(hint_row["one_hint"] or 0) if hint_row else 0,
        "multi_hint": int(hint_row["multi_hint"] or 0) if hint_row else 0,
        "total_problems": int(hint_row["total_problems"] or 0) if hint_row else 0,
    }

    # Ortalama sure — sadece time_spent_seconds > 0 olan submission'lardan
    avg_time_row = db.execute(text("""
        SELECT ROUND(AVG(time_spent_seconds)::numeric, 0) AS avg_sec
        FROM submissions
        WHERE student_id = :student_id
          AND time_spent_seconds > 0
    """), {"student_id": current_user.id}).mappings().first()
    avg_time_minutes = round(int(avg_time_row["avg_sec"] or 0) / 60, 1) if avg_time_row else 0

    # Streak — peş peşe aktif gün sayısı (en son gruptan)
    streak_row = db.execute(text("""
        WITH daily AS (
            SELECT DATE(submitted_at AT TIME ZONE 'UTC') AS day
            FROM submissions
            WHERE student_id = :student_id
            GROUP BY DATE(submitted_at AT TIME ZONE 'UTC')
        ),
        grp AS (
            SELECT day,
                   day - (ROW_NUMBER() OVER (ORDER BY day) || ' days')::interval AS grp_key
            FROM daily
        ),
        last_grp AS (
            SELECT grp_key FROM grp ORDER BY day DESC LIMIT 1
        )
        SELECT COUNT(*) AS streak_days
        FROM grp
        WHERE grp_key = (SELECT grp_key FROM last_grp)
    """), {"student_id": current_user.id}).mappings().first()
    streak_days = int(streak_row["streak_days"] or 0) if streak_row else 0

    # Sinif istatistikleri — class_id varsa diger ogrencilerle karsilastirma
    class_stats = {
        "class_avg_score": None,
        "top_performer_score": None,
        "avg_hint_usage": None,
    }
    if class_id:
        cs_row = db.execute(text("""
            WITH enrolled AS (
                SELECT e.student_id
                FROM enrollments e
                WHERE e.class_id = :class_id AND e.status = 'active'
            ),
            student_scores AS (
                SELECT
                    stm.student_id,
                    AVG(stm.mastery_score) AS avg_score
                FROM student_topic_mastery stm
                JOIN enrolled en ON en.student_id = stm.student_id
                GROUP BY stm.student_id
            ),
            hint_counts AS (
                SELECT
                    en.student_id,
                    COUNT(hr.id) AS total_hints
                FROM enrolled en
                LEFT JOIN hint_requests hr ON hr.student_id = en.student_id
                GROUP BY en.student_id
            )
            SELECT
                ROUND(AVG(ss.avg_score)::numeric, 0)  AS class_avg_score,
                ROUND(MAX(ss.avg_score)::numeric, 0)  AS top_performer_score,
                ROUND(AVG(hc.total_hints)::numeric, 1) AS avg_hint_usage
            FROM student_scores ss
            JOIN hint_counts hc ON hc.student_id = ss.student_id
        """), {"class_id": class_id}).mappings().first()
        if cs_row:
            class_stats = {
                "class_avg_score": float(cs_row["class_avg_score"] or 0),
                "top_performer_score": float(cs_row["top_performer_score"] or 0),
                "avg_hint_usage": float(cs_row["avg_hint_usage"] or 0),
            }

    # Sinif zorluk analizi — en cok fail alan sorular
    class_difficulty: list = []
    if class_id:
        diff_rows = db.execute(text("""
            SELECT
                p.title                                      AS question,
                t.name                                       AS topic,
                COUNT(*)                                     AS total_attempts,
                SUM(CASE WHEN NOT s.is_correct THEN 1 ELSE 0 END) AS failed_attempts,
                ROUND(
                    SUM(CASE WHEN NOT s.is_correct THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
                    0
                )                                            AS fail_rate
            FROM submissions s
            JOIN problems p ON p.id = s.problem_id
            JOIN topics t ON t.id = p.topic_id
            JOIN enrollments e ON e.student_id = s.student_id
            WHERE e.class_id = :class_id AND e.status = 'active'
            GROUP BY p.id, p.title, t.name
            HAVING COUNT(*) >= 3
            ORDER BY fail_rate DESC
            LIMIT 4
        """), {"class_id": class_id}).mappings().all()
        class_difficulty = [
            {
                "question": row["question"],
                "topic": row["topic"],
                "failRate": int(row["fail_rate"] or 0),
            }
            for row in diff_rows
        ]

    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "role": current_user.role,
        },
        "class_id": class_id,
        "total_problems_attempted": len(subs),
        "total_problems_passed": sum(1 for s in subs if s.is_correct),
        "overall_mastery_score": round(overall, 2),
        "percentile": float(percentile_data.get("percentile", 50.0)),
        "rank": percentile_data.get("rank"),
        "total_students_in_class": percentile_data.get("total_students", 0),
        "hint_stats": hint_stats,
        "avg_time_minutes": avg_time_minutes,
        "streak_days": streak_days,
        "class_stats": class_stats,
        "class_difficulty": class_difficulty,
        # Weak topics = lowest mastery, attempted
        "weak_topics": sorted(
            [r for r in mastery_rows if int(r.get("problems_attempted") or 0) > 0],
            key=lambda x: float(x.get("mastery_score") or 0),
        )[:3],
        # Strong topics = highest mastery
        "strong_topics": sorted(
            [r for r in mastery_rows if int(r.get("problems_attempted") or 0) > 0],
            key=lambda x: float(x.get("mastery_score") or 0),
            reverse=True,
        )[:3],
        "all_topics": mastery_rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Mastery List
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me/mastery")
def my_mastery(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_student_mastery_summary(db, current_user.id)


# ─────────────────────────────────────────────────────────────────────────────
# Per-topic breakdown with badge level + completion %
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me/topic-breakdown")
def my_topic_breakdown(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    class_id = _get_class_id(db, current_user.id)
    if not class_id:
        raise HTTPException(404, "No active class enrollment found")
    return get_topic_breakdown(db, current_user.id, class_id)


# ─────────────────────────────────────────────────────────────────────────────
# Weekly progress (time series for charts)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me/progress")
def my_progress(
    days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_weekly_progress(db, current_user.id, days=days)


# ─────────────────────────────────────────────────────────────────────────────
# AI Performance Insight — Analytics sayfasındaki "AI Insight" paneli için.
# Öğrencinin gerçek mastery verisini okuyup OpenAI ile 2-3 cümle yorum üretir.
# Frontend'deki AnalyticsPage.tsx doğrudan Gemini çağırıyordu; artık buradan çağırır.
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me/ai-insight")
def my_ai_insight(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Öğrencinin konu bazlı mastery skorlarını alarak OpenAI'dan
    kişiselleştirilmiş bir performans yorumu üretir.
    Döndürdüğü alanlar: { "insight": "...", "percentile", "rank", "total_students" }
    """
    import os
    from openai import OpenAI

    # Mastery özetini al
    mastery_rows = get_student_mastery_summary(db, current_user.id)

    # Percentile / rank bilgisi
    class_id = _get_class_id(db, current_user.id)
    percentile_data = {"percentile": 50.0, "rank": None, "total_students": 0}
    if class_id:
        percentile_data = get_class_percentile_rank(db, current_user.id, class_id)

    rank = percentile_data.get("rank_desc")    # SQL: RANK() ... AS rank_desc
    total_students = percentile_data.get("total_students", 0)
    percentile = round(float(percentile_data.get("percentile", 50.0)), 1)


    # Veri yoksa genel bir mesaj dön
    if not mastery_rows:
        return {
            "insight": (
                "You haven't solved any problems yet. "
                "Start practicing to see your personalized AI insights!"
            ),
            "percentile": percentile,
            "rank": rank,
            "total_students": total_students,
        }

    # En güçlü ve en zayıf konuları belirle
    attempted = [r for r in mastery_rows if int(r.get("problems_attempted") or 0) > 0]
    sorted_topics = sorted(attempted, key=lambda r: float(r.get("mastery_score") or 0))
    weak = sorted_topics[:2]
    strong = sorted_topics[-2:]

    # Sınıf konumu
    class_context = (
        f"Class standing: ranked #{rank} out of {total_students} students "
        f"(top {round(100 - percentile)}%)."
        if rank else ""
    )

    # OpenAI'a gönderilecek özet veri
    data_summary = (
        f"Strong topics: {', '.join(r['topic_name'] + ' (' + str(round(float(r.get('mastery_score',0)),0)) + '%)' for r in strong)}\n"
        f"Weak topics: {', '.join(r['topic_name'] + ' (' + str(round(float(r.get('mastery_score',0)),0)) + '%)' for r in weak)}\n"
        f"{class_context}"
    )

    prompt = (
        f"Analyze this student's performance data and give a concise, encouraging "
        f"2-3 sentence recommendation. Be specific about what to improve and acknowledge their class standing.\n\n"
        f"Data:\n{data_summary}\n\n"
        f"Keep the tone motivational but honest."
    )

    try:
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.7,
        )
        insight_text = resp.choices[0].message.content.strip()
    except Exception:
        weak_name = weak[0]["topic_name"] if weak else "some topics"
        standing_msg = (f"You're ranked #{rank} out of {total_students}. " if rank else "")
        insight_text = (
            f"{standing_msg}Focus on {weak_name} to improve your mastery score. "
            f"Keep up the great work on your stronger topics!"
        )

    return {
        "insight": insight_text,
        "percentile": percentile,
        "rank": rank,
        "total_students": total_students,
    }




# ─────────────────────────────────────────────────────────────────────────────
# Any student's mastery (instructors can see any, students only themselves)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/students/{student_id}/mastery")
def student_mastery(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(403, "Access denied")
    return get_student_mastery_summary(db, student_id)


# ─────────────────────────────────────────────────────────────────────────────
# Recent submissions list
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me/submissions")
def my_submissions(
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subs = (
        db.query(Submission)
        .filter_by(student_id=current_user.id)
        .order_by(Submission.submitted_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": s.id,
            "problem_id": s.problem_id,
            "status": s.status,
            "score": s.score,
            "max_score": s.max_score,
            "is_correct": s.is_correct,
            "attempt_number": s.attempt_number,
            "time_spent_seconds": s.time_spent_seconds,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
        }
        for s in subs
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Class Score Distribution — sınıf puan dağılımı (grafik için)
# Her öğrencinin ortalama mastery skorunu hesaplar, bucket'lara böler.
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me/class-distribution")
def class_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Öğrencinin sınıfındaki tüm öğrencilerin ortalama mastery puanlarını
    0-100 arasında 10'ar puanlık bucket'lara bölerek döndürür.

    Frontend'de distribution grafiği için kullanılır.
    Returns: [{ bucket: 0, label: "0-10", count: 3 }, ...]
    """
    from sqlalchemy import text as sql_text

    class_id = _get_class_id(db, current_user.id)
    if not class_id:
        # Sınıf yoksa boş dağılım
        return [{"bucket": i * 10, "label": f"{i*10}-{i*10+10}", "count": 0} for i in range(10)]

    # Her öğrencinin ortalama mastery skoru
    rows = db.execute(sql_text("""
        SELECT
            FLOOR(AVG(mastery_score) / 10) * 10 AS bucket,
            COUNT(DISTINCT student_id) AS student_count
        FROM student_topic_mastery
        WHERE class_id = :class_id
        GROUP BY FLOOR(AVG(mastery_score) / 10) * 10
        ORDER BY bucket
    """).bindparams(class_id=class_id)).fetchall()

    # Boş bucket'ları da dahil et (0-90 arası 10'ar)
    bucket_map = {int(r[0]): int(r[1]) for r in rows}
    result = []
    for i in range(10):
        b = i * 10
        result.append({
            "bucket": b,
            "label": f"{b}-{b + 10}",
            "count": bucket_map.get(b, 0),
        })

    return result




# ─────────────────────────────────────────────────────────────────────────────
# Streak — Ardışık aktif gün sayısı
# Submission geçmişindeki tarihlere göre bugünden geriye doğru art arda
# submission olan günleri sayar.
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/me/streak")
def my_streak(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Öğrencinin ardışık çalışma günü serisini hesaplar.
    Returns: { streak_days: int, last_active: str | null }

    Mantık:
    1. Tüm submission tarihlerini gün olarak normalize et (UTC, saat yok).
    2. Bugünden geriye giderek submission olan ardışık günleri say.
    3. Dün veya bugün aktivite yoksa streak = 0.
    """
    from datetime import date, timedelta

    # Tüm submission tarihlerini al (sadece tarih, saat değil)
    subs = (
        db.query(Submission.submitted_at)
        .filter(
            Submission.student_id == current_user.id,
            Submission.submitted_at.isnot(None),
        )
        .all()
    )

    if not subs:
        return {"streak_days": 0, "last_active": None}

    # Benzersiz aktif günler (set — UTC date)
    active_days = {s.submitted_at.date() for s in subs}
    last_active = max(active_days)

    today = date.today()
    yesterday = today - timedelta(days=1)

    # Bugün veya dün aktif değilse streak kopmuş
    if last_active < yesterday:
        return {
            "streak_days": 0,
            "last_active": last_active.isoformat(),
        }

    # Bugünden geriye ardışık günleri say
    streak = 0
    check_day = today
    while check_day in active_days:
        streak += 1
        check_day -= timedelta(days=1)

    # Eğer bugün yoksa dünden başla
    if streak == 0:
        check_day = yesterday
        while check_day in active_days:
            streak += 1
            check_day -= timedelta(days=1)

    return {
        "streak_days": streak,
        "last_active": last_active.isoformat(),
    }

