"""
Analytics query functions.

Public API:
  get_student_mastery_summary(db, student_id)
  get_class_percentile_rank(db, student_id, class_id)
  get_weekly_progress(db, student_id, days)
  get_topic_breakdown(db, student_id, class_id)
  get_streak_days(db, student_id)
  detect_knowledge_gaps(db, class_id, ...)
  get_class_student_ranking(db, class_id)

SQL conventions used:
  - COALESCE(expr, 0)         → replace NULL with 0
  - DISTINCT ON (col)         → keep only the latest row per group
  - PERCENT_RANK() OVER (...)  → percentile window function
"""
from __future__ import annotations
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timezone, timedelta

# ─────────────────────────────────────────────────────────────────────────────
# 1. MASTERY SUMMARY  (replaces the buggy Python loop in submissions.py)
# Single query: all topic masteries for a student
# ─────────────────────────────────────────────────────────────────────────────
def get_student_mastery_summary(db: Session, student_id: str, class_id: str | None = None) -> list[dict]:
    """
    Returns per-topic mastery aggregated directly in SQL.
    If class_id is given, only returns topics belonging to that class.
    """
    class_filter = "AND t.class_id = :class_id" if class_id else ""
    params: dict = {"student_id": student_id}
    if class_id:
        params["class_id"] = class_id

    sql = text(f"""
        WITH latest_per_problem AS (
            SELECT DISTINCT ON (s.problem_id)
                s.problem_id,
                s.student_id,
                p.topic_id,
                s.is_correct   AS last_correct,
                s.submitted_at
            FROM submissions s
            JOIN problems p ON p.id = s.problem_id AND p.is_published = true
            WHERE s.student_id = :student_id
              AND s.is_correct IS NOT NULL
            ORDER BY s.problem_id, s.submitted_at DESC
        )
        SELECT
            t.id                                            AS topic_id,
            t.name                                          AS topic_name,
            t.book_chapter,
            COUNT(DISTINCT p.id)                            AS problems_in_topic,
            COUNT(DISTINCT lpp.problem_id)                  AS problems_attempted,
            COUNT(DISTINCT CASE WHEN lpp.last_correct THEN lpp.problem_id END) AS problems_passed,
            ROUND(
                100.0 * COUNT(DISTINCT CASE WHEN lpp.last_correct THEN lpp.problem_id END)
                      / NULLIF(COUNT(DISTINCT lpp.problem_id), 0)
            , 2)                                            AS mastery_score,
            COALESCE(SUM(hr.hint_count), 0)                 AS total_hints_used,
            MAX(lpp.submitted_at)                           AS last_activity_at
        FROM topics t
        JOIN problems p ON p.topic_id = t.id AND p.is_published = true
        LEFT JOIN latest_per_problem lpp ON lpp.problem_id = p.id
        LEFT JOIN (
            SELECT problem_id, COUNT(*) AS hint_count
            FROM hint_requests
            WHERE student_id = :student_id
            GROUP BY problem_id
        ) hr ON hr.problem_id = p.id
        WHERE 1=1 {class_filter}
        GROUP BY t.id, t.name, t.book_chapter, t.display_order
        ORDER BY t.display_order
    """)
    rows = db.execute(sql, params).mappings().all()
    return [dict(r) for r in rows]

# ─────────────────────────────────────────────────────────────────────────────
# 2. CLASS PERCENTILE  (window function — one query for all students)
# ─────────────────────────────────────────────────────────────────────────────
def get_class_percentile_rank(db: Session, student_id: str, class_id: str) -> dict:
    """
    Returns percentile rank of a student within their class.
    Uses PERCENT_RANK() window function over average mastery.
    """
    sql = text("""
        WITH student_avgs AS (
            SELECT
                stm.student_id,
                AVG(stm.mastery_score) AS avg_mastery
            FROM student_topic_mastery stm
            WHERE stm.class_id = :class_id
            GROUP BY stm.student_id
        ),
        ranked AS (
            SELECT
                student_id,
                avg_mastery,
                PERCENT_RANK() OVER (ORDER BY avg_mastery) AS percentile_rank,
                RANK()         OVER (ORDER BY avg_mastery DESC) AS rank_desc,
                COUNT(*) OVER ()  AS total_students
            FROM student_avgs
        )
        SELECT
            student_id,
            COALESCE(avg_mastery, 0)                           AS avg_mastery,
            ROUND((percentile_rank * 100)::numeric, 1)         AS percentile,
            rank_desc,
            total_students
        FROM ranked
        WHERE student_id = :student_id
    """)
    row = db.execute(sql, {
        "student_id": student_id,
        "class_id": class_id,
    }).mappings().first()

    if not row:
        return {"avg_mastery": 0.0, "percentile": 50.0, "rank": None, "total_students": 0}
    return dict(row)

# ─────────────────────────────────────────────────────────────────────────────
# 3. WEEKLY PROGRESS  (time series for progress chart)
# ─────────────────────────────────────────────────────────────────────────────
def get_weekly_progress(db: Session, student_id: str, days: int = 30) -> list[dict]:
    """
    Returns daily submission stats for the last N days.
    Suitable for a line chart on the student dashboard.
    """
    sql = text("""
        SELECT
            DATE(s.submitted_at AT TIME ZONE 'UTC')  AS day,
            COUNT(*)                                  AS submissions_count,
            COUNT(CASE WHEN s.is_correct THEN 1 END)  AS correct_count,
            ROUND(AVG(s.score)::numeric, 2)            AS avg_score,
            SUM(s.time_spent_seconds)                  AS time_spent_seconds
        FROM submissions s
        WHERE s.student_id = :student_id
          AND s.submitted_at >= NOW() - INTERVAL ':days days'
        GROUP BY DATE(s.submitted_at AT TIME ZONE 'UTC')
        ORDER BY day
    """.replace(":days days", f"{days} days"))
    rows = db.execute(sql, {"student_id": student_id}).mappings().all()
    return [dict(r) for r in rows]

# ─────────────────────────────────────────────────────────────────────────────
# 4. TOPIC BREAKDOWN  (per topic stats + badges for student UI)
# ─────────────────────────────────────────────────────────────────────────────
def get_topic_breakdown(db: Session, student_id: str, class_id: str) -> list[dict]:
    """
    Comprehensive per-topic stats: mastery, attempts, hints, time, badge level.

    IMPORTANT: 'passed' count uses the LATEST attempt per problem.
    Old formula: COUNT(DISTINCT CASE WHEN is_correct THEN problem_id) —
      a problem answered correctly once would always be counted as passed.
    New formula: only the most recent submission per problem counts.
      A problem where the last attempt was wrong does NOT count as passed —
      consistent with recompute_mastery logic.
    """
    sql = text("""
        WITH latest_submissions AS (
            -- Latest submission per (student, class, problem)
            SELECT DISTINCT ON (s.problem_id)
                s.problem_id,
                s.student_id,
                s.class_id,
                s.is_correct   AS last_correct,
                s.submitted_at
            FROM submissions s
            WHERE s.student_id = :student_id
              AND s.class_id   = :class_id
              AND s.is_correct IS NOT NULL
            ORDER BY s.problem_id, s.submitted_at DESC
        ),
        topic_stats AS (
            SELECT
                t.id           AS topic_id,
                t.name         AS topic_name,
                t.book_chapter,
                t.display_order,
                -- problems in topic
                COUNT(DISTINCT p.id)                                               AS total_problems,
                -- student's latest-attempt stats
                COUNT(DISTINCT ls.problem_id)                                      AS attempted,
                COUNT(DISTINCT CASE WHEN ls.last_correct THEN ls.problem_id END)   AS passed,
                -- hints
                COALESCE(SUM(hr.total_hints), 0)                                   AS hints_used,
                -- earned / max points from latest attempts
                COALESCE(SUM(CASE WHEN ls.last_correct THEN p.points ELSE 0 END), 0) AS earned_points,
                COALESCE(SUM(CASE WHEN ls.problem_id IS NOT NULL THEN p.points ELSE 0 END), 0) AS max_points,
                -- last activity
                MAX(ls.submitted_at)                                               AS last_activity_at
            FROM topics t
            JOIN problems p ON p.topic_id = t.id AND p.is_published = true
            LEFT JOIN latest_submissions ls ON ls.problem_id = p.id
            LEFT JOIN (
                SELECT problem_id, COUNT(*) AS total_hints
                FROM hint_requests
                WHERE student_id = :student_id
                GROUP BY problem_id
            ) hr ON hr.problem_id = p.id
            GROUP BY t.id, t.name, t.book_chapter, t.display_order
        )
        SELECT
            topic_id,
            topic_name,
            book_chapter,
            total_problems,
            attempted,
            passed,
            hints_used,
            earned_points,
            max_points,
            last_activity_at,
            -- mastery 0-100 (latest-attempt based)
            CASE
                WHEN attempted = 0 THEN 0
                ELSE ROUND(100.0 * passed / attempted, 1)
            END AS mastery_score,
            -- completion 0-100
            CASE
                WHEN total_problems = 0 THEN 0
                ELSE ROUND(100.0 * attempted / total_problems, 1)
            END AS completion_pct,
            -- badge
            CASE
                WHEN attempted = 0 THEN 'locked'
                WHEN ROUND(100.0 * passed / NULLIF(attempted,0), 1) >= 80 THEN 'gold'
                WHEN ROUND(100.0 * passed / NULLIF(attempted,0), 1) >= 50 THEN 'silver'
                ELSE 'bronze'
            END AS badge
        FROM topic_stats
        ORDER BY display_order
    """)
    rows = db.execute(sql, {"student_id": student_id, "class_id": class_id}).mappings().all()
    return [dict(r) for r in rows]

# ─────────────────────────────────────────────────────────────────────────────
# 5. CLASS OVERVIEW  (instructor: all students ranked + class stats)
# ─────────────────────────────────────────────────────────────────────────────
def get_class_student_ranking(db: Session, class_id: str) -> list[dict]:
    """
    All students in a class ranked by average mastery score.
    Includes percentile rank as a window function.
    """
    sql = text("""
        WITH student_scores AS (
            SELECT
                u.id           AS student_id,
                u.first_name,
                u.last_name,
                u.email,
                COALESCE(AVG(stm.mastery_score), 0)     AS avg_mastery,
                COALESCE(SUM(stm.problems_attempted), 0) AS total_attempted,
                COALESCE(SUM(stm.problems_passed), 0)    AS total_passed,
                COALESCE(SUM(stm.total_hints_used), 0)   AS total_hints
            FROM users u
            JOIN enrollments e ON e.student_id = u.id
               AND e.class_id = :class_id AND e.status = 'active'
            LEFT JOIN student_topic_mastery stm
                ON stm.student_id = u.id AND stm.class_id = :class_id
            GROUP BY u.id, u.first_name, u.last_name, u.email
        )
        SELECT
            ss.student_id,
            ss.first_name,
            ss.last_name,
            ss.email,
            ROUND(ss.avg_mastery::numeric, 2)              AS avg_mastery,
            ss.total_attempted,
            ss.total_passed,
            ss.total_hints,
            RANK()         OVER (ORDER BY ss.avg_mastery DESC)  AS rank,
            ROUND(
                (PERCENT_RANK() OVER (ORDER BY ss.avg_mastery) * 100)::numeric
            , 1)                                              AS percentile,
            (
                SELECT t.name
                FROM student_topic_mastery stm2
                JOIN topics t ON t.id = stm2.topic_id
                WHERE stm2.student_id = ss.student_id
                  AND stm2.class_id   = :class_id
                  AND stm2.problems_attempted > 0
                ORDER BY stm2.mastery_score ASC NULLS LAST
                LIMIT 1
            ) AS weak_topic
        FROM student_scores ss
        ORDER BY ss.avg_mastery DESC
    """)
    rows = db.execute(sql, {"class_id": class_id}).mappings().all()
    return [dict(r) for r in rows]

def get_class_topic_heatmap(db: Session, class_id: str) -> list[dict]:
    """
    Class-level mastery per topic: for instructor heatmap chart.
    Returns avg_mastery, pass_rate, attempt_rate per topic across all students.
    """
    sql = text("""
        SELECT
            t.id            AS topic_id,
            t.name          AS topic_name,
            t.display_order,
            COUNT(DISTINCT stm.student_id)                  AS students_attempted,
            ROUND(AVG(stm.mastery_score)::numeric, 2)       AS avg_mastery,
            ROUND(
                100.0 * SUM(stm.problems_passed) /
                NULLIF(SUM(stm.problems_attempted), 0)
            , 2)                                            AS class_pass_rate,
            ROUND(AVG(stm.total_hints_used)::numeric, 2)   AS avg_hints_per_student
        FROM topics t
        LEFT JOIN student_topic_mastery stm
            ON stm.topic_id = t.id AND stm.class_id = :class_id
        WHERE t.class_id = :class_id
        GROUP BY t.id, t.name, t.display_order
        ORDER BY t.display_order
    """)
    rows = db.execute(sql, {"class_id": class_id}).mappings().all()
    return [dict(r) for r in rows]

# ─────────────────────────────────────────────────────────────────────────────
# 6. KNOWLEDGE GAP  (refined: per-problem failure rates)
# ─────────────────────────────────────────────────────────────────────────────
def detect_knowledge_gaps(db: Session, class_id: str, min_attempts: int = 3) -> list[dict]:
    """
    Finds problems with ≥ min_attempts where failure_rate > 40%.
    Returns ranked by failure_rate desc with topic context.
    """
    sql = text("""
        SELECT
            p.id          AS problem_id,
            p.title       AS problem_title,
            p.type        AS problem_type,
            p.difficulty,
            t.id          AS topic_id,
            t.name        AS topic_name,
            COUNT(s.id)                         AS total_attempts,
            COUNT(CASE WHEN NOT s.is_correct THEN 1 END) AS failures,
            ROUND(
                100.0 * COUNT(CASE WHEN NOT s.is_correct THEN 1 END) /
                NULLIF(COUNT(s.id), 0)
            , 2)                                AS failure_rate_pct,
            COUNT(DISTINCT s.student_id)        AS unique_students,
            COALESCE(hr.total_hints, 0)         AS total_hints,
            COALESCE(
                ROUND(hr.total_hints::numeric /
                      NULLIF(hr.students_hinted, 0), 2),
                0
            )                                   AS avg_hints_per_student
        FROM problems p
        JOIN topics t ON t.id = p.topic_id
        JOIN submissions s ON s.problem_id = p.id
            AND s.class_id = :class_id
            AND s.is_correct IS NOT NULL
        LEFT JOIN (
            SELECT
                problem_id,
                COUNT(*)                    AS total_hints,
                COUNT(DISTINCT student_id)  AS students_hinted
            FROM hint_requests
            WHERE requested_at > NOW() - INTERVAL '90 days'
            GROUP BY problem_id
        ) hr ON hr.problem_id = p.id
        GROUP BY p.id, p.title, p.type, p.difficulty, t.id, t.name,
                 hr.total_hints, hr.students_hinted
        HAVING COUNT(s.id) >= :min_attempts
           AND (
               COUNT(CASE WHEN NOT s.is_correct THEN 1 END) * 100.0 /
               NULLIF(COUNT(s.id), 0)
           ) > 40
        ORDER BY failure_rate_pct DESC
    """)
    rows = db.execute(sql, {
        "class_id": class_id,
        "min_attempts": min_attempts,
    }).mappings().all()
    return [dict(r) for r in rows]

# ─────────────────────────────────────────────────────────────────────────────
# 7. HINT USAGE ANALYTICS
# ─────────────────────────────────────────────────────────────────────────────
def get_hint_analytics(db: Session, class_id: str) -> dict:
    """
    Class-level hint usage: which levels are most requested, which problems.
    """
    sql = text("""
        SELECT
            hr.hint_level,
            COUNT(*)                            AS requests,
            COUNT(DISTINCT hr.student_id)       AS unique_students,
            COUNT(DISTINCT hr.problem_id)       AS unique_problems
        FROM hint_requests hr
        JOIN submissions s ON s.id = hr.submission_id
        WHERE s.class_id = :class_id
        GROUP BY hr.hint_level
        ORDER BY hr.hint_level
    """)
    by_level = [dict(r) for r in db.execute(sql, {"class_id": class_id}).mappings().all()]

    sql2 = text("""
        SELECT
            p.id    AS problem_id,
            p.title AS problem_title,
            t.name  AS topic_name,
            COUNT(hr.id)                        AS total_hints,
            COUNT(DISTINCT hr.student_id)       AS students_needing_hints,
            ROUND(AVG(hr.hint_level)::numeric,1) AS avg_hint_level
        FROM hint_requests hr
        JOIN problems p ON p.id = hr.problem_id
        JOIN topics t ON t.id = p.topic_id
        JOIN submissions s ON s.id = hr.submission_id
        WHERE s.class_id = :class_id
        GROUP BY p.id, p.title, t.name
        ORDER BY total_hints DESC
        LIMIT 10
    """)
    top_problems = [dict(r) for r in db.execute(sql2, {"class_id": class_id}).mappings().all()]

    return {"by_level": by_level, "top_struggling_problems": top_problems}

# ─────────────────────────────────────────────────────────────────────────────
# 8. MASTERY UPSERT  (replaces the broken Python function in submissions.py)
# ─────────────────────────────────────────────────────────────────────────────
def recompute_mastery(db: Session, student_id: str, class_id: str, topic_id: str) -> None:
    """
    Upserts StudentTopicMastery in a single SQL statement after a submission.

    Mastery formula (per-problem LATEST ATTEMPT, points-weighted):
      Last attempt correct  → earned_points increases.
      Last attempt wrong    → earned_points = 0 (even if previously correct).
      mastery = earned_points / max_points * 100 - hint_penalty

    Rationale: when a student's last attempt is wrong, their mastery should
    decrease — "correct then wrong" must count as wrong.
    """
    sql = text("""
        INSERT INTO student_topic_mastery
            (id, student_id, topic_id, class_id,
             mastery_score, problems_attempted, problems_passed, total_hints_used,
             last_activity_at, updated_at)

        WITH latest_per_problem AS (
            -- Latest submission per problem
            SELECT DISTINCT ON (s.problem_id)
                s.problem_id,
                p.points,
                s.is_correct AS last_correct
            FROM submissions s
            JOIN problems p ON p.id = s.problem_id
            WHERE s.student_id = :student_id
              AND s.class_id   = :class_id
              AND p.topic_id   = :topic_id
              AND s.is_correct IS NOT NULL
            ORDER BY s.problem_id, s.submitted_at DESC
        )
        SELECT
            gen_random_uuid(),
            :student_id,
            :topic_id,
            :class_id,
            -- Points-weighted mastery: sum of points for last-correct attempts / total attempted points
            GREATEST(
                0,
                COALESCE(
                    ROUND(
                        100.0
                        * SUM(CASE WHEN last_correct THEN points ELSE 0 END)::numeric
                        / NULLIF(SUM(points), 0)
                    , 2)
                , 0)
                - LEAST(
                    COALESCE((
                        SELECT COUNT(*) FROM hint_requests
                        WHERE student_id = :student_id
                          AND problem_id IN (
                              SELECT id FROM problems WHERE topic_id = :topic_id
                          )
                    ), 0) * 5,
                    20
                )
            )                                                       AS mastery_score,
            COUNT(*)                                                AS problems_attempted,
            COUNT(*) FILTER (WHERE last_correct = true)            AS problems_passed,
            COALESCE((
                SELECT COUNT(*) FROM hint_requests
                WHERE student_id = :student_id
                  AND problem_id IN (
                      SELECT id FROM problems WHERE topic_id = :topic_id
                  )
            ), 0)                                                   AS total_hints_used,
            NOW()                                                   AS last_activity_at,
            NOW()                                                   AS updated_at
        FROM latest_per_problem

        ON CONFLICT (student_id, topic_id, class_id)
        DO UPDATE SET
            mastery_score      = EXCLUDED.mastery_score,
            problems_attempted = EXCLUDED.problems_attempted,
            problems_passed    = EXCLUDED.problems_passed,
            total_hints_used   = EXCLUDED.total_hints_used,
            last_activity_at   = EXCLUDED.last_activity_at,
            updated_at         = NOW()
    """)
    db.execute(sql, {
        "student_id": student_id,
        "class_id": class_id,
        "topic_id": topic_id,
    })

