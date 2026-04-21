"""
content_extractor.py — Markdown metninden kurs icerigi cikartma modulu

Kamer Hoca'nin istedigi pipeline'in ikinci adimi:
  pdfplumber/Chandra → Markdown metin → (bu modul) → topics/lessons/problems DB'ye

Bu modul:
  1. Markdown metni GPT-4o-mini'ye gonderir
  2. GPT yapilandirilmis JSON dondurur (topics, lessons, questions, misconceptions)
  3. Her bir topic/lesson/problem DB'ye kaydedilir
  4. ai_extracted_content tablosuna ozet kaydedilir

Neden GPT-4o-mini?
  - Uzun metin islemek icin uygun (128k context)
  - Structured output destegi var (hallusinasyon riski dusuk)
  - Dusuk maliyet (gpt-4o'ya kiyasla ~10x ucuz)
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from openai import OpenAI

from app.db.models import (
    Topic,
    Lesson,
    Problem,
    ProblemOption,
    ProblemHint,
    CourseResource,
    AiExtractedContent,
)

logger = logging.getLogger(__name__)

# Kullanilacak GPT modeli
EXTRACTION_MODEL = "gpt-4.1-nano"

# PDF metninin GPT'ye gonderilecek maksimum karakter sayisi
# Artirildi: tum PDF'i tek seferde gondermek icin
MAX_TEXT_CHARS = 200_000


def extract_content_from_markdown(
    markdown_text: str,
    resource_id: str,
    db: Session,
    openai_client: Optional[OpenAI] = None,
    week_name: Optional[str] = None,  # ör: "Week 1" — parent topic oluşturur
    class_id: Optional[str] = None,   # Hangi sınıfa ait topic'ler oluşturulsun
) -> dict:
    """
    Markdown metninden AI ile kurs icerigi cikarir ve DB'ye kaydeder.

    Args:
        markdown_text: pdfplumber/Chandra'nin urettigi ham Markdown
        resource_id:   Kaynak course_resources.id (hangi PDF'den uretildi)
        db:            SQLAlchemy oturumu
        openai_client: Opsiyonel; None ise yeni client olusturulur

    Returns:
        dict: {
            "topics_created": int,
            "lessons_created": int,
            "problems_created": int,
            "extracted_json": {...}  # GPT'nin ham JSON ciktisi
        }

    Raises:
        RuntimeError: GPT hatasi veya JSON parse hatasi durumunda
    """
    if not openai_client:
        openai_client = OpenAI()  # OPENAI_API_KEY env'den okunur

    # Cok uzun metinleri kes (GPT context limitini asmasin)
    if len(markdown_text) > MAX_TEXT_CHARS:
        logger.warning(
            f"Metin cok uzun ({len(markdown_text)} karakter), "
            f"ilk {MAX_TEXT_CHARS} karakter isleniyor."
        )
        markdown_text = markdown_text[:MAX_TEXT_CHARS]

    # GPT'ye gonderilecek prompt
    extracted_json = _call_gpt_extraction(markdown_text, openai_client)

    # DB'ye kaydet — week_name verilmisse parent topic altına
    counts = _save_to_database(extracted_json, db, week_name=week_name, class_id=class_id, source_resource_id=resource_id)

    # ai_extracted_content tablosuna ozet kaydet
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
        f"Extraction tamamlandi: "
        f"{counts['topics_created']} topic, "
        f"{counts['lessons_created']} lesson, "
        f"{counts['problems_created']} problem olusturuldu."
    )

    return {**counts, "extracted_json": extracted_json}


def _call_gpt_extraction(markdown_text: str, client: OpenAI) -> dict:
    """
    Markdown metni GPT-4o-mini'ye gonderir ve yapilandirilmis JSON alir.

    Prompt tasarimi:
      - Sistem mesaji: AI'nin rolunu ve JSON formatini tanimlar
      - Kullanici mesaji: PDF'den alinan Markdown metin
      - JSON modu: Hallusinasyonu azaltir, okunabilir cikti saglar

    Dondurduğu JSON formati:
    {
      "course_title": str,
      "topics": [
        {
          "name": str,
          "description": str,
          "lessons": [
            {
              "title": str,
              "summary": str,
              "content_markdown": str,
              "estimated_minutes": int
            }
          ],
          "questions": [
            {
              "title": str,
              "description": str,
              "type": "multiple_choice" | "open_response",
              "difficulty": "easy" | "medium" | "hard",
              "correct_answer": str,
              "options": [{"text": str, "is_correct": bool}],
              "hints": [{"level": int, "content": str, "socratic_question": str}],
              "misconception": str
            }
          ]
        }
      ],
      "misconceptions": [str]
    }
    """
    system_prompt = """You are an expert CS professor and curriculum designer.
You will receive the COMPLETE text of a university CS course lecture document (slides, notes, or handout).

== STEP 1: HOLISTIC ANALYSIS ==
First, read the ENTIRE document as a whole.
Identify the overall course structure, learning objectives, and how topics build on each other.
Do NOT process page by page — understand the document as a unified curriculum.

== STEP 2: LEARNING PATH DESIGN ==
Design a coherent learning path from this material:
- Group related content into logical TOPICS (typically 3-6 per document)
- Order them so each topic builds on the previous
- Each topic should have clear prerequisites and outcomes

== STEP 3: LESSON WRITING ==
For each topic, write ONE comprehensive lesson (content_markdown):
- MINIMUM 800 words — this is the actual textbook the student will study
- Structure: ## Title → ### Introduction → ### Core Concepts → ### Deep Dive → ### Code Examples → ### Why It Matters → ### Summary
- Expand EVERY bullet point from the slides into full explanatory paragraphs
- Include ALL code from the source material in ```cpp / ```python blocks
- Write as if the student has never seen this topic — explain everything from first principles
- estimated_minutes: honest estimate (800 words ≈ 30-40 min)

== STEP 4: PRACTICE QUESTIONS ==
For each topic, create EXACTLY 4 fill-in-the-blank multiple choice questions:

MANDATORY QUESTION FORMAT — follow exactly:
- type: ALWAYS "multiple_choice" (never open_response)
- description: Use ___ (blank) in the question. Examples:
    "In C++, the ___ directive is processed before compilation begins."
    "The statement `int arr[___];` declares an array of 10 integers."
    "When we write #include <stdio.h>, the ___ is responsible for inserting the file content."
    "The command `g++ -o output ___` compiles all .cpp files."
- The blank must be fillable from the material — not a generic question
- options: exactly 4 choices, only 1 correct
- difficulty distribution: 1 easy, 2 medium, 1 hard
- hints: 3-level Socratic (level1=gentle nudge, level2=partial answer, level3=near answer)

BAD question (DO NOT DO THIS): "What does the preprocessor do?"
GOOD question: "The preprocessor handles the ___ directive by replacing it with the file contents before compilation."

== OUTPUT FORMAT ==
Return ONLY valid JSON:
{
  "course_title": "Exact course title from material",
  "topics": [
    {
      "name": "Topic Name",
      "description": "2-3 sentences: what this topic covers, why it matters, what student will learn",
      "lessons": [
        {
          "title": "Lesson Title",
          "summary": "2-sentence summary of what is taught",
          "content_markdown": "## Topic Title\n\n### Introduction\nFull paragraph (100+ words)...\n\n### Core Concepts\nFull explanation (200+ words)...\n\n### How It Works\n```cpp\n// code from slides\n```\nExplanation...\n\n### Why It Matters\nParagraph...\n\n### Summary\nKey takeaways as bullet list.",
          "estimated_minutes": 35
        }
      ],
      "questions": [
        {
          "title": "Fill-in-blank question title",
          "description": "Complete the statement: The ___ phase converts source code into object files.",
          "type": "multiple_choice",
          "difficulty": "easy",
          "correct_answer": "compiler",
          "options": [
            {"text": "compiler", "is_correct": true},
            {"text": "preprocessor", "is_correct": false},
            {"text": "linker", "is_correct": false},
            {"text": "loader", "is_correct": false}
          ],
          "hints": [
            {"level": 1, "content": "Think about the three stages: preprocess → compile → link", "socratic_question": "Which stage comes after preprocessing?"},
            {"level": 2, "content": "The object file (.o) is produced by this stage", "socratic_question": "What tool produces .o files from .cpp files?"},
            {"level": 3, "content": "g++ invokes the compiler (cc1) which produces object code", "socratic_question": null}
          ],
          "misconception": "Students often confuse the compiler with the linker — the linker combines object files, it does not translate source code."
        }
      ]
    }
  ],
  "misconceptions": ["Common misconception about the whole course topic 1", "Common misconception 2"]
}"""

    user_message = f"""Analyze the following CS lecture material and produce the JSON output:

---
{markdown_text}
---"""

    logger.info(f"GPT isteği gönderiliyor ({len(markdown_text)} karakter)...")

    response = client.chat.completions.create(
        model=EXTRACTION_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
        max_tokens=32000,  # 800+ kelime ders * 4-6 topic + sorular için yeterli
    )

    raw_json_str = response.choices[0].message.content

    try:
        extracted = json.loads(raw_json_str)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"GPT gecersiz JSON donurdu: {e}\nHam cikti: {raw_json_str[:500]}")

    return extracted


def _save_to_database(extracted_json: dict, db: Session, week_name: Optional[str] = None, class_id: Optional[str] = None, source_resource_id: Optional[str] = None) -> dict:
    """
    GPT'nin ürettiği JSON'i topics/lessons/problems tablolarına yazar.

    week_name verilirse (ör: "Week 1") önce bir parent topic oluşturulur,
    tüm alt konular o parent'ın altına yerleştirilir.

    source_resource_id: hangi PDF/video'dan üretildiği — öğrenci kaynağa gidebilsin.
    is_published=True — içerik DB'ye yazılır yazılmaz öğrenci görebilir.
    """
    topics_created = 0
    lessons_created = 0
    problems_created = 0

    topics_data = extracted_json.get("topics", [])

    # Mevcut en yüksek display_order'i bul
    max_order_row = db.query(Topic.display_order).order_by(Topic.display_order.desc()).first()
    next_order = (max_order_row[0] + 1) if max_order_row else 0

    # Week parent topic oluştur (ör: "Week 1: Introduction")
    # Aynı isimde mevcut topic varsa yeniden kullan (duplikat önleme)
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

    for topic_data in topics_data:
        topic = Topic(
            id=str(uuid.uuid4()),
            name=topic_data.get("name", "Unnamed Topic"),
            description=topic_data.get("description", ""),
            display_order=next_order,
            parent_topic_id=parent_topic_id,  # Week altına bağla
            class_id=class_id,                # Sınıf etiketi
            source_resource_id=source_resource_id,  # Kaynak PDF/video
        )
        db.add(topic)
        db.flush()  # ID'yi hemen al (lesson/problem icin gerekli)
        topics_created += 1
        next_order += 1

        # ── Bu topic'e ait Lesson'lari olustur ───────────────────────────
        for lesson_order, lesson_data in enumerate(topic_data.get("lessons", [])):
            lesson = Lesson(
                id=str(uuid.uuid4()),
                topic_id=topic.id,
                title=lesson_data.get("title", "Basliksiz Ders"),
                summary=lesson_data.get("summary", ""),
                content_markdown=lesson_data.get("content_markdown", ""),
                estimated_minutes=lesson_data.get("estimated_minutes", 20),
                display_order=lesson_order,
            )
            db.add(lesson)
            db.flush()
            lessons_created += 1

        # ── Bu topic'e ait Problem'leri olustur (lesson loop DIŞINDA) ──────
        # BUG FIX: Sorular lesson bazında değil topic bazında — her lesson'da
        # tekrar yaratılmaması için döngü lesson loop'un dışında.
        first_lesson_id = None
        if topic_data.get("lessons"):
            # İlk lesson ID'sini al (problem.lesson_id için)
            first_lesson_id = db.query(Lesson.id).filter(
                Lesson.topic_id == topic.id
            ).order_by(Lesson.display_order).first()[0]

        for q_data in topic_data.get("questions", []):
            # Tip dogrulama — open_response'u multiple_choice'a ceviriyoruz
            q_type = q_data.get("type", "multiple_choice")
            if q_type not in ("coding", "multiple_choice"):
                q_type = "multiple_choice"  # open_response kabul edilmez

            difficulty = q_data.get("difficulty", "medium")
            if difficulty not in ("easy", "medium", "hard"):
                difficulty = "medium"

            problem = Problem(
                id=str(uuid.uuid4()),
                topic_id=topic.id,
                lesson_id=first_lesson_id,
                title=q_data.get("title", "Untitled Question"),
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

            # MCQ seceneklerini kaydet
            for opt_order, opt_data in enumerate(q_data.get("options", [])):
                option = ProblemOption(
                    id=str(uuid.uuid4()),
                    problem_id=problem.id,
                    text=opt_data.get("text", ""),
                    is_correct=opt_data.get("is_correct", False),
                    display_order=opt_order,
                )
                db.add(option)

            # Hint'leri kaydet (Sokrates yontemi)
            for hint_data in q_data.get("hints", []):
                hint = ProblemHint(
                    id=str(uuid.uuid4()),
                    problem_id=problem.id,
                    level=hint_data.get("level", 1),
                    content=hint_data.get("content", ""),
                    socratic_question=hint_data.get("socratic_question"),
                )
                db.add(hint)

    # Tum degisiklikleri tek seferde commit et
    db.commit()

    return {
        "topics_created": topics_created,
        "lessons_created": lessons_created,
        "problems_created": problems_created,
    }
