"""
content_chat.py — AI-powered instructor chat for post-extraction content refinement.

Handles free-form instructor messages like:
  - "Write 5 more hard questions about binary trees"
  - "Create a new topic on recursion with a full lesson"
  - "Rewrite the heap lesson more concisely"
  - "Make all questions fill-in-the-blank"

Pipeline:
  1. Build context (existing topics, lessons, problems for the class)
  2. Send context + instructor message to GPT
  3. GPT returns structured JSON with actions
  4. Execute actions against the DB
  5. Return summary of what was created/changed
"""

import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from openai import OpenAI

from app.db.models import Topic, Lesson, Problem, ProblemOption, ProblemHint
from app.ai.content_extractor import make_llm_client, get_extraction_model

logger = logging.getLogger(__name__)

# ── Context builder ───────────────────────────────────────────────────────────

def _build_class_context(class_id: str, db: Session) -> dict:
    """
    Fetch a compact summary of existing topics, lessons, and problems for a class.
    Deliberately lightweight — omits full lesson content to stay well within token limits.
    """

    topics = (
        db.query(Topic)
        .filter(Topic.class_id == class_id)
        .order_by(Topic.display_order)
        .limit(50)   # hard cap — prevents runaway token usage on large classes
        .all()
    )

    context = {"topics": []}

    for t in topics:
        lessons  = db.query(Lesson).filter(Lesson.topic_id == t.id).order_by(Lesson.display_order).all()
        problems = db.query(Problem).filter(Problem.topic_id == t.id).all()

        context["topics"].append({
            "id":          t.id,
            "name":        t.name,
            # Truncate description — GPT only needs a hint, not the full paragraph
            "description": (t.description or "")[:200],
            "lessons": [
                {
                    "id":    l.id,
                    "title": l.title,
                    # summary only, no full content_markdown (that can be 5k chars per lesson)
                    "summary": (l.summary or l.title)[:150],
                }
                for l in lessons
            ],
            "problems": [
                {
                    "id":         p.id,
                    "title":      p.title,
                    "difficulty": p.difficulty,
                    "type":       p.type,
                }
                for p in problems
            ],
        })

    return context


# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert CS curriculum assistant helping an instructor refine their course content.

The instructor will give you free-form instructions. You must:
1. Understand their intent
2. Return a JSON object with an "actions" array describing what to do
3. Each action must have a "type" field

Available action types:

--- generate_questions ---
Create new practice questions for an existing topic.
{
  "type": "generate_questions",
  "topic_id": "<existing topic id>",
  "topic_name": "<for reference>",
  "questions": [
    {
      "title": "Question title",
      "description": "Complete the statement: The ___ operation...",
      "type": "multiple_choice",
      "difficulty": "easy|medium|hard",
      "correct_answer": "the correct answer text",
      "options": [
        {"text": "correct answer", "is_correct": true},
        {"text": "wrong 1", "is_correct": false},
        {"text": "wrong 2", "is_correct": false},
        {"text": "wrong 3", "is_correct": false}
      ],
      "hints": [
        {"level": 1, "content": "hint text", "socratic_question": "question?"},
        {"level": 2, "content": "hint text", "socratic_question": "question?"},
        {"level": 3, "content": "hint text", "socratic_question": null}
      ]
    }
  ]
}

--- create_topic ---
Create a completely new topic with lessons and questions.
{
  "type": "create_topic",
  "name": "Topic Name",
  "description": "2-3 sentence description",
  "lessons": [
    {
      "title": "Lesson Title",
      "summary": "2-sentence summary",
      "content_markdown": "## Title\\n\\n### Introduction\\n...(full lesson, min 500 words)...",
      "estimated_minutes": 30
    }
  ],
  "questions": [ ...same format as generate_questions... ]
}

--- rewrite_lesson ---
Rewrite or update an existing lesson's content.
{
  "type": "rewrite_lesson",
  "lesson_id": "<existing lesson id>",
  "lesson_title": "<for reference>",
  "new_content_markdown": "## Title\\n\\n...(full rewritten lesson)...",
  "new_summary": "Updated 2-sentence summary",
  "new_estimated_minutes": 35
}

--- update_topic ---
Update an existing topic's name or description.
{
  "type": "update_topic",
  "topic_id": "<existing topic id>",
  "new_name": "New Name (optional)",
  "new_description": "New description (optional)"
}

RULES:
- Always return valid JSON: { "actions": [...], "summary": "Human-readable summary of what you did" }
- For generate_questions: always create fill-in-the-blank style (use ___ in description)
- For create_topic: write comprehensive lessons (min 500 words)
- If the instructor's request is ambiguous, make reasonable assumptions
- Always include a "summary" field at the top level explaining what you did in plain language

CONSTRAINTS — these override everything else, never violate them:
- You MUST only generate content that is directly related to the topics listed in CURRENT COURSE CONTENT.
- If the instructor asks about a subject that has NO connection to the listed course topics
  (e.g. animals, cooking, politics, sports, or any field unrelated to the course),
  return exactly: {"actions": [], "summary": "Rejected: request is not related to this course's content."}
- When generating questions, base them on concepts explicitly present in the listed lessons and topics.
  Do NOT invent new algorithms, data structures, or terminology that the course does not cover.
- If a lesson already exists on the requested topic, your questions MUST reflect the vocabulary
  and concepts from that lesson's summary — not just general internet knowledge.
- You are a curriculum assistant for THIS specific course only. You have no authority to produce
  content outside the scope of what is listed in CURRENT COURSE CONTENT.
"""




def handle_chat_command(
    message: str,
    class_id: str,
    db: Session,
    client: Optional[OpenAI] = None,
) -> dict:
    """
    Process an instructor chat message, execute the resulting actions,
    and return a summary of what was created/changed.
    """
    if not client:
        client = make_llm_client()

    # Build context
    context = _build_class_context(class_id, db)
    context_json = json.dumps(context, indent=2, ensure_ascii=False)

    from app.db.models import Topic as TopicModel, Lesson as LessonModel
    from app.ai.guardrail import scan_input, scan_generated_actions

    # ── INPUT GUARDRAIL: check instructor message before hitting LLM ──────────
    input_check = scan_input(message, context="instructor/content-builder")
    if input_check.blocked:
        return {
            "summary": f"Message blocked: {input_check.block_reason}",
            "actions_executed": [],
            "warnings": input_check.warnings,
        }

    # Collect lesson summaries for post-generation semantic relevance check.
    lesson_context_for_guard: list[dict] = []
    for topic_dict in context.get("topics", []):
        topic_id = topic_dict.get("id") or topic_dict.get("topic_id", "")
        if not topic_id:
            continue
        lessons = (
            db.query(LessonModel)
            .filter(LessonModel.topic_id == topic_id)
            .limit(2)
            .all()
        )
        for lesson in lessons:
            lesson_context_for_guard.append({
                "title":   lesson.title,
                "summary": (lesson.summary or "")[:300],
                "content_excerpt": (lesson.content_markdown or "")[:600],
            })

    user_message = (
        f"== CURRENT COURSE CONTENT ==\n{context_json}\n\n"
        f"== INSTRUCTOR REQUEST ==\n{message}"
    )

    logger.info(f"[ContentChat] Processing: '{message[:100]}' for class={class_id}")

    # Call LLM
    response = client.chat.completions.create(
        model=get_extraction_model(),
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
        ],
        response_format={"type": "json_object"},
        temperature=0.4,
        max_tokens=8000,
    )

    raw = response.choices[0].message.content
    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"LLM returned invalid JSON: {e}")

    actions = result.get("actions", [])
    summary = result.get("summary", "Done.")
    executed = []

    for action in actions:
        action_type = action.get("type")
        try:
            if action_type == "generate_questions":
                ids = _execute_generate_questions(action, class_id, db)
                executed.append({"type": action_type, "created": len(ids), "ids": ids})

            elif action_type == "create_topic":
                topic_id = _execute_create_topic(action, class_id, db)
                executed.append({"type": action_type, "topic_id": topic_id})

            elif action_type == "rewrite_lesson":
                _execute_rewrite_lesson(action, db)
                executed.append({"type": action_type, "lesson_id": action.get("lesson_id")})

            elif action_type == "update_topic":
                _execute_update_topic(action, db)
                executed.append({"type": action_type, "topic_id": action.get("topic_id")})

            else:
                logger.warning(f"[ContentChat] Unknown action type: {action_type}")

        except Exception as e:
            logger.error(f"[ContentChat] Action '{action_type}' failed: {e}")
            executed.append({"type": action_type, "error": str(e)})

    db.commit()
    logger.info(f"[ContentChat] Executed {len(executed)} actions. Summary: {summary[:100]}")

    # ── OUTPUT GUARDRAIL: semantic relevance check via embeddings ────────────
    warnings: list[str] = []
    if lesson_context_for_guard and actions:
        warnings = scan_generated_actions(actions, lesson_context_for_guard)
        if warnings:
            logger.warning(
                f"[Guardrail] {len(warnings)} semantic warning(s) for class={class_id}"
            )

    return {"summary": summary, "actions_executed": executed, "warnings": warnings}


# ── Action executors ──────────────────────────────────────────────────────────

def _execute_generate_questions(action: dict, class_id: str, db: Session) -> list[str]:
    topic_id = action.get("topic_id")
    if not topic_id:
        raise ValueError("generate_questions action missing topic_id")

    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.class_id == class_id).first()
    if not topic:
        raise ValueError(f"Topic {topic_id} not found in class {class_id}")

    first_lesson = (
        db.query(Lesson).filter(Lesson.topic_id == topic_id)
        .order_by(Lesson.display_order).first()
    )

    created_ids = []
    for q in action.get("questions", []):
        difficulty = q.get("difficulty", "medium")
        if difficulty not in ("easy", "medium", "hard"):
            difficulty = "medium"

        problem = Problem(
            id=str(uuid.uuid4()),
            topic_id=topic_id,
            lesson_id=first_lesson.id if first_lesson else None,
            title=q.get("title", "Untitled Question"),
            description=q.get("description", ""),
            type="multiple_choice",
            difficulty=difficulty,
            correct_answer=q.get("correct_answer", ""),
            points=10,
            is_published=True,
        )
        db.add(problem)
        db.flush()

        for i, opt in enumerate(q.get("options", [])):
            db.add(ProblemOption(
                id=str(uuid.uuid4()),
                problem_id=problem.id,
                text=opt.get("text", ""),
                is_correct=bool(opt.get("is_correct", False)),
                display_order=i,
            ))

        for hint in q.get("hints", []):
            db.add(ProblemHint(
                id=str(uuid.uuid4()),
                problem_id=problem.id,
                level=hint.get("level", 1),
                content=hint.get("content", ""),
                socratic_question=hint.get("socratic_question"),
            ))

        created_ids.append(problem.id)

    return created_ids


def _execute_create_topic(action: dict, class_id: str, db: Session) -> str:
    max_order = db.query(Topic.display_order).order_by(Topic.display_order.desc()).first()
    next_order = (max_order[0] + 1) if max_order else 0

    topic = Topic(
        id=str(uuid.uuid4()),
        name=action.get("name", "New Topic"),
        description=action.get("description", ""),
        display_order=next_order,
        class_id=class_id,
    )
    db.add(topic)
    db.flush()

    for i, l in enumerate(action.get("lessons", [])):
        lesson = Lesson(
            id=str(uuid.uuid4()),
            topic_id=topic.id,
            title=l.get("title", "Untitled Lesson"),
            summary=l.get("summary", ""),
            content_markdown=l.get("content_markdown", ""),
            estimated_minutes=l.get("estimated_minutes", 20),
            display_order=i,
        )
        db.add(lesson)
        db.flush()

    for q in action.get("questions", []):
        first_lesson = (
            db.query(Lesson).filter(Lesson.topic_id == topic.id)
            .order_by(Lesson.display_order).first()
        )
        difficulty = q.get("difficulty", "medium")
        if difficulty not in ("easy", "medium", "hard"):
            difficulty = "medium"
        problem = Problem(
            id=str(uuid.uuid4()),
            topic_id=topic.id,
            lesson_id=first_lesson.id if first_lesson else None,
            title=q.get("title", "Question"),
            description=q.get("description", ""),
            type="multiple_choice",
            difficulty=difficulty,
            correct_answer=q.get("correct_answer", ""),
            points=10,
            is_published=True,
        )
        db.add(problem)
        db.flush()
        for i, opt in enumerate(q.get("options", [])):
            db.add(ProblemOption(
                id=str(uuid.uuid4()),
                problem_id=problem.id,
                text=opt.get("text", ""),
                is_correct=bool(opt.get("is_correct", False)),
                display_order=i,
            ))
        for hint in q.get("hints", []):
            db.add(ProblemHint(
                id=str(uuid.uuid4()),
                problem_id=problem.id,
                level=hint.get("level", 1),
                content=hint.get("content", ""),
                socratic_question=hint.get("socratic_question"),
            ))

    return topic.id


def _execute_rewrite_lesson(action: dict, db: Session) -> None:
    lesson_id = action.get("lesson_id")
    if not lesson_id:
        raise ValueError("rewrite_lesson missing lesson_id")

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise ValueError(f"Lesson {lesson_id} not found")

    if action.get("new_content_markdown"):
        lesson.content_markdown = action["new_content_markdown"]
    if action.get("new_summary"):
        lesson.summary = action["new_summary"]
    if action.get("new_estimated_minutes"):
        lesson.estimated_minutes = action["new_estimated_minutes"]


def _execute_update_topic(action: dict, db: Session) -> None:
    topic_id = action.get("topic_id")
    if not topic_id:
        raise ValueError("update_topic missing topic_id")

    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise ValueError(f"Topic {topic_id} not found")

    if action.get("new_name"):
        topic.name = action["new_name"]
    if action.get("new_description"):
        topic.description = action["new_description"]
