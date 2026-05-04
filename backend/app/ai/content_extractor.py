"""

content_extractor.py — Markdown metninden kurs icerigi cikartma

Pipeline:

  PDF metin → GPT extraction (topics/lessons/problems JSON) → DB upsert

  

Yeni: Smart Deduplication

"""

import json

import logging

import uuid

from datetime import datetime, timezone

from typing import Optional, List

from sqlalchemy.orm import Session

from openai import OpenAI

from app.db.models import (

    Topic, Lesson, Problem, ProblemOption, ProblemHint,

    AiExtractedContent,

)

logger = logging.getLogger(__name__)

EXTRACTION_MODEL = "gpt-4.1-nano"

MAX_TEXT_CHARS = 200_000

# ── Public API ─────────────────────────────────────────────────────────────────

def extract_content_from_markdown(

    markdown_text: str,

    resource_id: str,

    db: Session,

    openai_client: Optional[OpenAI] = None,

    week_name: Optional[str] = None,

    class_id: Optional[str] = None,

) -> dict:

    if not openai_client:

        openai_client = OpenAI()

    if len(markdown_text) > MAX_TEXT_CHARS:

        logger.warning(f"Text too long ({len(markdown_text)} chars), truncating to {MAX_TEXT_CHARS}.")

        markdown_text = markdown_text[:MAX_TEXT_CHARS]

    existing_topics: List[Topic] = []

    if class_id:

        existing_topics = (

            db.query(Topic)

            .filter(Topic.class_id == class_id, Topic.parent_topic_id == None)

            .order_by(Topic.display_order)

            .all()

        )

    extracted_json = _call_gpt_extraction(markdown_text, openai_client, existing_topics)

    counts = _save_to_database(

        extracted_json, db,

        week_name=week_name,

        class_id=class_id,

        source_resource_id=resource_id,

        existing_topics=existing_topics,

    )

    extraction_record = AiExtractedContent(

        id=str(uuid.uuid4()),

        resource_id=resource_id,

        extracted_json=extracted_json,

        topics_created=counts["topics_created"],

        lessons_created=counts["lessons_created"],

        problems_created=counts["problems_created"],

        model_used=EXTRACTION_MODEL,

        created_at=datetime.now(timezone.utc),

    )

    db.add(extraction_record)

    db.commit()

    logger.info(

        f"Extraction complete: "

        f"{counts['topics_created']} topic (yeni), "

        f"{counts['topics_merged']} topics (updated), "

        f"{counts['lessons_created']} lesson, "

        f"{counts['problems_created']} problem"

    )

    return {**counts, "extracted_json": extracted_json}

# ── GPT Extraction ─────────────────────────────────────────────────────────────

def _call_gpt_extraction(

    markdown_text: str,

    client: OpenAI,

    existing_topics: List[Topic],

) -> dict:

    # Mevcut topic listesini prompt'a ekle

    existing_block = ""

    if existing_topics:

        lines = [

            f'  - id="{t.id}" name="{t.name}" description="{(t.description or "")[:120]}"'

            for t in existing_topics

        ]

        existing_block = (

            "\n\n== EXISTING TOPICS IN THIS COURSE ==\n"

            "These topics already exist in the database for this class.\n"

            + "\n".join(lines)

            + "\n\nDEDUPLICATION RULES:\n"

            "- If a topic from the new material covers the SAME subject as an existing topic "

            "(even if the name is slightly different), set \"merge_with_topic_id\" to the existing topic's id.\n"

            "- Only create a truly new topic when the subject is NOT covered by any existing topic.\n"

            "- Semantic similarity matters: 'Linked Lists' and 'Singly Linked List Operations' "

            "should MERGE if an existing 'Linked Lists' topic exists.\n"

            "- When merging, still provide full lessons and questions — they will be added to the existing topic."

        )

    system_prompt = f"""You are an expert CS professor and curriculum designer.

You will receive the COMPLETE text of a university CS course lecture document (slides, notes, or handout).

{existing_block}

== STEP 1: HOLISTIC ANALYSIS ==

Read the ENTIRE document as a unified whole. Identify overall structure, learning objectives, topic relationships.

Do NOT process page by page.

== STEP 2: TOPIC MAPPING ==

For each topic in the material:

- Check if it matches an existing topic (see EXISTING TOPICS above if present)

- If yes: set merge_with_topic_id to the existing topic's id

- If no: set merge_with_topic_id to null (will create new topic)

Group related slides/pages into 3-6 logical topics maximum.

== STEP 3: LESSON WRITING ==

For each topic, write ONE comprehensive lesson (content_markdown):

- MINIMUM 800 words — this is the actual textbook the student will study

- Structure: ## Title → ### Introduction → ### Core Concepts → ### Deep Dive → ### Code Examples → ### Why It Matters → ### Summary

- Expand EVERY bullet point into full explanatory paragraphs

- Include ALL code from source material in ```java / ```python / ```cpp blocks

- estimated_minutes: honest estimate (800 words ≈ 30-40 min)

== STEP 4: PRACTICE QUESTIONS ==

For each topic, create EXACTLY 4 fill-in-the-blank multiple choice questions:

- type: ALWAYS "multiple_choice"

- description: Use ___ (blank). Example: "In binary search, the midpoint is calculated as lo + ___ / 2."

- options: exactly 4 choices, only 1 correct

- difficulty: 1 easy, 2 medium, 1 hard

- hints: 3-level Socratic

== OUTPUT FORMAT ==

Return ONLY valid JSON:

{{

  "course_title": "Exact course title from material",

  "topics": [

    {{

      "merge_with_topic_id": "<existing_topic_id or null>",

      "name": "Topic Name",

      "description": "2-3 sentences about what this topic covers and why it matters",

      "lessons": [

        {{

          "title": "Lesson Title",

          "summary": "2-sentence summary",

          "content_markdown": "## Title\\n\\n### Introduction\\nFull paragraph...\\n\\n### Core Concepts\\n...\\n\\n### Code Examples\\n```java\\n// code\\n```\\n\\n### Summary\\n- key point 1\\n- key point 2",

          "estimated_minutes": 35

        }}

      ],

      "questions": [

        {{

          "title": "Fill-in-blank question title",

          "description": "Complete the statement: The ___ operation restores heap order after insertion.",

          "type": "multiple_choice",

          "difficulty": "easy",

          "correct_answer": "swim-up",

          "options": [

            {{"text": "swim-up", "is_correct": true}},

            {{"text": "sink-down", "is_correct": false}},

            {{"text": "heapify", "is_correct": false}},

            {{"text": "rotate", "is_correct": false}}

          ],

          "hints": [

            {{"level": 1, "content": "Think about direction: insert goes to bottom, then moves...", "socratic_question": "Which direction does a newly inserted element travel?"}},

            {{"level": 2, "content": "The element compares with its parent and swaps if larger (max-heap)", "socratic_question": "What triggers the swap with the parent?"}},

            {{"level": 3, "content": "swim-up (also called sift-up or bubble-up) repeatedly swaps with parent", "socratic_question": null}}

          ],

          "misconception": "Students confuse swim-up (insert) with sink-down (delete-max)."

        }}

      ]

    }}

  ],

  "misconceptions": ["Common misconception 1", "Common misconception 2"]

}}"""

    user_message = f"Analyze the following CS lecture material and produce the JSON output:\n\n---\n{markdown_text}\n---"

    logger.info(f"GPT request ({len(markdown_text)} chars, {len(existing_topics)} existing topics)...")

    response = client.chat.completions.create(

        model=EXTRACTION_MODEL,

        messages=[

            {"role": "system", "content": system_prompt},

            {"role": "user",   "content": user_message},

        ],

        response_format={"type": "json_object"},

        temperature=0.3,

        max_tokens=32000,

    )

    raw = response.choices[0].message.content

    try:

        return json.loads(raw)

    except json.JSONDecodeError as e:

        raise RuntimeError(f"GPT returned invalid JSON: {e}\nRaw output: {raw[:500]}")

# ── DB Save with Smart Merge ───────────────────────────────────────────────────

def _save_to_database(

    extracted_json: dict,

    db: Session,

    week_name: Optional[str] = None,

    class_id: Optional[str] = None,

    source_resource_id: Optional[str] = None,

    existing_topics: Optional[List[Topic]] = None,

) -> dict:

    topics_created = 0

    topics_merged  = 0

    lessons_created = 0

    problems_created = 0

    existing_topics = existing_topics or []

    existing_by_id = {t.id: t for t in existing_topics}

    max_order_row = db.query(Topic.display_order).order_by(Topic.display_order.desc()).first()

    next_order = (max_order_row[0] + 1) if max_order_row else 0

    # Week parent topic (opsiyonel)

    parent_topic_id = None

    if week_name:

        existing_parent = (

            db.query(Topic)

            .filter(Topic.name == week_name, Topic.class_id == class_id, Topic.parent_topic_id == None)

            .first()

        )

        if existing_parent:

            parent_topic_id = existing_parent.id

        else:

            parent_topic = Topic(

                id=str(uuid.uuid4()),

                name=week_name,

                description=extracted_json.get("course_title", ""),

                display_order=next_order,

                class_id=class_id,

            )

            db.add(parent_topic)

            db.flush()

            parent_topic_id = parent_topic.id

            topics_created += 1

            next_order += 1

    for topic_data in extracted_json.get("topics", []):

        merge_id = topic_data.get("merge_with_topic_id")

        if merge_id and merge_id in existing_by_id:

            topic = existing_by_id[merge_id]

            logger.info(f"Topic MERGE: '{topic.name}' (id={topic.id[:8]}...)")

            new_desc = topic_data.get("description", "")

            if new_desc and len(new_desc) > len(topic.description or ""):

                topic.description = new_desc

            topics_merged += 1

        # ── CREATE: yeni topic ────────────────────────────────────────────────

        else:

            topic = Topic(

                id=str(uuid.uuid4()),

                name=topic_data.get("name", "Unnamed Topic"),

                description=topic_data.get("description", ""),

                display_order=next_order,

                parent_topic_id=parent_topic_id,

                class_id=class_id,

                source_resource_id=source_resource_id,

            )

            db.add(topic)

            db.flush()

            topics_created += 1

            next_order += 1

        existing_lesson_titles = {

            l.title.lower().strip()

            for l in db.query(Lesson).filter(Lesson.topic_id == topic.id).all()

        }

        lesson_order_start = db.query(Lesson).filter(Lesson.topic_id == topic.id).count()

        for i, lesson_data in enumerate(topic_data.get("lessons", [])):

            title = lesson_data.get("title", "Untitled Lesson")

            if title.lower().strip() in existing_lesson_titles:

                existing_lesson = (

                    db.query(Lesson)

                    .filter(Lesson.topic_id == topic.id, Lesson.title == title)

                    .first()

                )

                if existing_lesson:

                    new_md = lesson_data.get("content_markdown", "")

                    if new_md and len(new_md) > len(existing_lesson.content_markdown or ""):

                        existing_lesson.content_markdown = new_md

                        existing_lesson.estimated_minutes = lesson_data.get(

                            "estimated_minutes", existing_lesson.estimated_minutes

                        )

                logger.info(f"  Lesson UPDATED: '{title}'")

            else:

                lesson = Lesson(

                    id=str(uuid.uuid4()),

                    topic_id=topic.id,

                    title=title,

                    summary=lesson_data.get("summary", ""),

                    content_markdown=lesson_data.get("content_markdown", ""),

                    estimated_minutes=lesson_data.get("estimated_minutes", 20),

                    display_order=lesson_order_start + i,

                )

                db.add(lesson)

                db.flush()

                lessons_created += 1

                logger.info(f"  Lesson CREATED: '{title}'")

        existing_problem_titles = {

            p.title.lower().strip()

            for p in db.query(Problem).filter(Problem.topic_id == topic.id).all()

        }

        first_lesson = (

            db.query(Lesson).filter(Lesson.topic_id == topic.id)

            .order_by(Lesson.display_order).first()

        )

        first_lesson_id = first_lesson.id if first_lesson else None

        for q_data in topic_data.get("questions", []):

            q_title = q_data.get("title", "Untitled Question")

            if q_title.lower().strip() in existing_problem_titles:

                logger.info(f"  Problem ATLANITDI (zaten var): '{q_title}'")

                continue

            q_type = q_data.get("type", "multiple_choice")

            if q_type not in ("coding", "multiple_choice"):

                q_type = "multiple_choice"

            difficulty = q_data.get("difficulty", "medium")

            if difficulty not in ("easy", "medium", "hard"):

                difficulty = "medium"

            problem = Problem(

                id=str(uuid.uuid4()),

                topic_id=topic.id,

                lesson_id=first_lesson_id,

                title=q_title,

                description=q_data.get("description", ""),

                type=q_type,

                difficulty=difficulty,

                correct_answer=q_data.get("correct_answer", ""),

                grading_rubric=q_data.get("misconception", ""),

                points=10,

                is_published=True,

            )

            db.add(problem)

            db.flush()

            problems_created += 1

            for opt_order, opt in enumerate(q_data.get("options", [])):

                db.add(ProblemOption(

                    id=str(uuid.uuid4()),

                    problem_id=problem.id,

                    text=opt.get("text", ""),

                    is_correct=opt.get("is_correct", False),

                    display_order=opt_order,

                ))

            for hint_data in q_data.get("hints", []):

                db.add(ProblemHint(

                    id=str(uuid.uuid4()),

                    problem_id=problem.id,

                    level=hint_data.get("level", 1),

                    content=hint_data.get("content", ""),

                    socratic_question=hint_data.get("socratic_question"),

                ))

    db.commit()

    return {

        "topics_created":  topics_created,

        "topics_merged":   topics_merged,

        "lessons_created": lessons_created,

        "problems_created": problems_created,

    }

