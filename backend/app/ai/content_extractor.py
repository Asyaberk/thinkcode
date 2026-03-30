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

# Kullanilacak GPT modeli — gpt-4o-mini maliyet/kalite dengesi icin ideal
EXTRACTION_MODEL = "gpt-4o-mini"

# PDF metninin GPT'ye gonderilecek maksimum karakter sayisi
# GPT-4o-mini 128k token destekler; ~500k karakter guvenli sinir
MAX_TEXT_CHARS = 120_000


def extract_content_from_markdown(
    markdown_text: str,
    resource_id: str,
    db: Session,
    openai_client: Optional[OpenAI] = None,
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

    # DB'ye kaydet
    counts = _save_to_database(extracted_json, db)

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
    system_prompt = """Sen bir egitim icerik analisti ve pedagoji uzmanisin.
Sana bir ders notunun Markdown formatindaki metni verilecek.

Gorev:
1. Metni analiz ederek ana KONU BASLIKLARINI (topics) belirle
2. Her konu icin DERS ICERIGI (lessons) cikart — markdown formatini koru
3. Her konu icin SORULAR (questions) olustur:
   - Tercihen "multiple_choice" (4 secenekli, 1'i dogru)
   - Veya "open_response" (kisa yazili cevap)
   - Zorluk dengeli: easy/medium/hard karisik
4. Her soru icin ipuclari (hints) olustur (3 kademe, Sokrates yontemi)
5. Yaygin yanilgıları (misconceptions) belirle

ONEMLI KURALLAR:
- Metinde olmayan bilgileri URETME (hallusinasyon yapma)
- Her topicten en az 2, en fazla 5 soru olustur
- Turkce metinse Turkce, Ingilizce metinse Ingilizce cikti ver
- JSON disinda hicbir sey yazma

Istenen JSON formati:
{
  "course_title": "Ders adi",
  "topics": [
    {
      "name": "Konu adi",
      "description": "Kisaca aciklama",
      "lessons": [
        {
          "title": "Ders basligi",
          "summary": "Kisaca ozet",
          "content_markdown": "Tam ders icerigi (markdown)",
          "estimated_minutes": 20
        }
      ],
      "questions": [
        {
          "title": "Soru basligi",
          "description": "Tam soru metni",
          "type": "multiple_choice",
          "difficulty": "medium",
          "correct_answer": "Dogru cevap metni",
          "options": [
            {"text": "Secen A", "is_correct": true},
            {"text": "Secen B", "is_correct": false},
            {"text": "Secen C", "is_correct": false},
            {"text": "Secen D", "is_correct": false}
          ],
          "hints": [
            {"level": 1, "content": "Birinci ipucu", "socratic_question": "Sokrates sorusu"},
            {"level": 2, "content": "Ikinci ipucu", "socratic_question": "Daha detayli Sokrates sorusu"},
            {"level": 3, "content": "Ucuncu ipucu (neredeyse cevap)", "socratic_question": null}
          ],
          "misconception": "Bu soruyla ilgili yaygin yanlis anlama"
        }
      ]
    }
  ],
  "misconceptions": ["Genel yanlis anlama 1", "Genel yanlis anlama 2"]
}"""

    user_message = f"""Asagidaki ders notunu analiz et ve JSON cikti ver:

---
{markdown_text}
---"""

    logger.info(f"GPT-4o-mini'ye istek gonderiliyor ({len(markdown_text)} karakter)...")

    response = client.chat.completions.create(
        model=EXTRACTION_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
        response_format={"type": "json_object"},  # JSON modunu aktif et
        temperature=0.3,  # Dusuk temperature = daha tutarli/deterministic cikti
        max_tokens=4000,  # Cikti icin yeterli alan
    )

    raw_json_str = response.choices[0].message.content

    try:
        extracted = json.loads(raw_json_str)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"GPT gecersiz JSON donurdu: {e}\nHam cikti: {raw_json_str[:500]}")

    return extracted


def _save_to_database(extracted_json: dict, db: Session) -> dict:
    """
    GPT'nin urettigi JSON'i topics/lessons/problems tablolarina yazar.

    Not: Her topic icin display_order otomatik belirlenir.
    Mevcut topic'ler varsa yeni topic olarak eklenir (uzerine yazmaz).

    Returns:
        dict: {"topics_created": int, "lessons_created": int, "problems_created": int}
    """
    topics_created = 0
    lessons_created = 0
    problems_created = 0

    topics_data = extracted_json.get("topics", [])

    # Mevcut en yuksek display_order'i bul (yeni topic'ler arkaya eklensin)
    max_order_row = db.query(Topic.display_order).order_by(Topic.display_order.desc()).first()
    next_order = (max_order_row[0] + 1) if max_order_row else 0

    for topic_data in topics_data:
        # ── Yeni Topic olustur ────────────────────────────────────────────
        topic = Topic(
            id=str(uuid.uuid4()),
            name=topic_data.get("name", "Isimsiz Konu"),
            description=topic_data.get("description", ""),
            display_order=next_order,
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
                    title=q_data.get("title", "Basliksiz Soru"),
                    description=q_data.get("description", ""),
                    type=q_type,
                    difficulty=difficulty,
                    correct_answer=q_data.get("correct_answer", ""),
                    grading_rubric=q_data.get("misconception", ""),  # yanlis anlama rubric'te
                    points=10,       # Varsayilan puan
                    is_published=False,  # Hoca onaylayana kadar yayinlanmaz
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
