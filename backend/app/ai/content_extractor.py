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
MAX_TEXT_CHARS = 120_000


def extract_content_from_markdown(
    markdown_text: str,
    resource_id: str,
    db: Session,
    openai_client: Optional[OpenAI] = None,
    week_name: Optional[str] = None,  # ör: "Week 1" — parent topic oluşturur
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
    counts = _save_to_database(extracted_json, db, week_name=week_name)

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
    system_prompt = """You are an expert CS education content designer.
You will receive lecture slides/notes from a university CS course (may include code examples).

Your job:
1. Identify the main TOPICS covered in the material
2. For each topic, write a COMPREHENSIVE LESSON EXPLANATION in content_markdown:
   - Write as if teaching a student from scratch
   - Include concept explanation, how it works, why it matters
   - Include code examples if present in the source material (preserve them)
   - Minimum 400 words per lesson, use Markdown headers, bullet points, code blocks
   - This is the actual study material the student will read — make it complete and educational
3. For each topic, create 3-5 PRACTICE QUESTIONS:
   - Mix of multiple_choice (4 options) and open_response
   - For code-related topics: create questions about code behavior, output, errors
   - Include fill-in-the-blank style questions when relevant (use ___ in description)
   - Balanced difficulty: at least 1 easy, 1 medium, 1 hard
4. For each question: 3-level Socratic hints (level 1 = gentle nudge, level 3 = near answer)
5. Identify common misconceptions students have about each topic

CRITICAL RULES:
- The source material may be lecture SLIDES with only bullet points — this is normal!
- Use the slides as a TOPIC GUIDE: expand each bullet point into full educational prose
- Use your expert CS knowledge to write complete, detailed lesson content
- content_markdown must be DETAILED and COMPLETE (400+ words) even if the slide is brief
- If the source has C++ code, reproduce it in content_markdown with ```cpp blocks
- Output ONLY valid JSON, nothing else
- Language: match the source material language (English if English)
- IMPORTANT: Slides show WHAT to teach — you write HOW to teach it properly

Required JSON format:
{
  "course_title": "Course name from material",
  "topics": [
    {
      "name": "Topic name",
      "description": "2-3 sentence description of what this topic covers",
      "lessons": [
        {
          "title": "Lesson title",
          "summary": "1-2 sentence summary",
          "content_markdown": "## Lesson Title\n\nFull detailed explanation here (400+ words). Include:\n- Concept explanation\n- How it works step by step\n- Code examples (if any)\n- Why it matters\n- Key takeaways",
          "estimated_minutes": 25
        }
      ],
      "questions": [
        {
          "title": "Short question title",
          "description": "Full question text. For fill-in-blank: 'The ___ directive includes a file.'",
          "type": "multiple_choice",
          "difficulty": "medium",
          "correct_answer": "The exact correct answer text",
          "options": [
            {"text": "Option A (correct)", "is_correct": true},
            {"text": "Option B", "is_correct": false},
            {"text": "Option C", "is_correct": false},
            {"text": "Option D", "is_correct": false}
          ],
          "hints": [
            {"level": 1, "content": "Think about what preprocessor directives do", "socratic_question": "What happens before compilation?"},
            {"level": 2, "content": "The directive starts with # and copies file content", "socratic_question": "Which # directive is for file inclusion?"},
            {"level": 3, "content": "It is #include", "socratic_question": null}
          ],
          "misconception": "Common mistake students make with this concept"
        }
      ]
    }
  ],
  "misconceptions": ["General misconception 1", "General misconception 2"]
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
        max_tokens=16000,  # 4000'den artırıldı — tam konu anlatımı için yeterli alan
    )

    raw_json_str = response.choices[0].message.content

    try:
        extracted = json.loads(raw_json_str)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"GPT gecersiz JSON donurdu: {e}\nHam cikti: {raw_json_str[:500]}")

    return extracted


def _save_to_database(extracted_json: dict, db: Session, week_name: Optional[str] = None) -> dict:
    """
    GPT'nin ürettiği JSON'i topics/lessons/problems tablolarına yazar.

    week_name verilirse (ör: "Week 1") önce bir parent topic oluşturulur,
    tüm alt konular o parent'ın altına yerleştirilir.

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
    parent_topic_id = None
    if week_name:
        parent_topic = Topic(
            id=str(uuid.uuid4()),
            name=week_name,
            description=extracted_json.get("course_title", ""),
            display_order=next_order,
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

            # ── Bu topic'e ait Problem'leri olustur ──────────────────────
            for q_data in topic_data.get("questions", []):
                q_type = q_data.get("type", "multiple_choice")
                # Tip dogrulama: sadece bilinen tipler kabul edilir
                if q_type not in ("coding", "multiple_choice", "open_response"):
                    q_type = "multiple_choice"

                difficulty = q_data.get("difficulty", "medium")
                if difficulty not in ("easy", "medium", "hard"):
                    difficulty = "medium"

                problem = Problem(
                    id=str(uuid.uuid4()),
                    topic_id=topic.id,
                    lesson_id=lesson.id,
                    title=q_data.get("title", "Untitled Question"),
                    description=q_data.get("description", ""),
                    type=q_type,
                    difficulty=difficulty,
                    correct_answer=q_data.get("correct_answer", ""),
                    grading_rubric=q_data.get("misconception", ""),
                    points=10,
                    is_published=True,   # Hemen yayınla — öğrenci görebilsin
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
