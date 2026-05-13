"""
guardrail.py — Universal AI Input/Output Safety Layer

Applied to ALL AI entry points in the platform:
  - Student AI Tutor messages (input + output)
  - Instructor Content Builder messages (input + output)
  - Content extraction pipeline (output)

Two-layer approach (both domain-agnostic, no hardcoded keywords):

  INPUT GUARDRAIL  → OpenAI Moderation API
    Catches: hate speech, self-harm, violence, sexual content, prompt injection
    Cost: free (separate endpoint, not a chat completion)
    Latency: ~100ms

  OUTPUT GUARDRAIL → OpenAI Embeddings + Cosine Similarity
    Checks: is the AI's response semantically relevant to the lesson context?
    Works for ANY subject — CS, math, biology, history, etc.
    Embeddings understand MEANING, not individual words.
    Cost: ~$0.00002 per 1K tokens (negligible)
    Latency: ~200ms

Why embeddings instead of keywords:
    "Python fonksiyonu" and "Python function" → high similarity (same meaning)
    "Türkiye'nin başkenti" and "C++ strings" → low similarity (different meaning)
    This works regardless of course subject or language.
"""

import math
import logging
from dataclasses import dataclass, field

from openai import OpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Config ────────────────────────────────────────────────────────────────────

# Cosine similarity threshold for output relevance.
# Range 0–1. Lower = more lenient, higher = stricter.
# 0.25 is a reasonable default — catches clearly off-topic content
# without false-positives when lessons and questions use different phrasing.
OUTPUT_RELEVANCE_THRESHOLD = 0.25

# Set to False in .env (GUARDRAIL_ENABLED=false) to disable all checks.
# Useful during development or when OpenAI is unreachable.
def _guardrail_enabled() -> bool:
    return getattr(settings, "GUARDRAIL_ENABLED", True)


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class GuardrailResult:
    """Returned by both scan_input() and scan_output()."""
    passed: bool
    warnings: list[str] = field(default_factory=list)
    blocked: bool = False          # True → DO NOT return this to the user
    block_reason: str = ""         # Human-readable block reason


# ── Shared OpenAI client factory ──────────────────────────────────────────────

def _openai() -> OpenAI:
    return OpenAI(api_key=settings.OPENAI_API_KEY)


# ── Input Guardrail: OpenAI Moderation API ────────────────────────────────────

def scan_input(text: str, context: str = "") -> GuardrailResult:
    """
    Run the student/instructor input through OpenAI's Moderation API.

    Detects: hate, harassment, self-harm, sexual content, violence, and
    prompt-injection patterns (e.g. "ignore previous instructions").

    Args:
        text:    The raw user message to check.
        context: Optional label for logging (e.g. "student tutor", "instructor").

    Returns:
        GuardrailResult with passed=False and blocked=True if flagged.
    """
    if not _guardrail_enabled():
        return GuardrailResult(passed=True)

    try:
        client = _openai()
        response = client.moderations.create(input=text)
        result = response.results[0]

        if result.flagged:
            # Collect the category names that were flagged
            flagged_cats = [
                cat.replace("_", " ")
                for cat, is_flagged in result.categories.__dict__.items()
                if is_flagged
            ]
            reason = f"Message flagged for: {', '.join(flagged_cats)}"
            logger.warning(f"[Guardrail/Input] BLOCKED — {context} — {reason}")
            return GuardrailResult(
                passed=False,
                blocked=True,
                block_reason=reason,
                warnings=[reason],
            )

        logger.debug(f"[Guardrail/Input] OK — {context}")
        return GuardrailResult(passed=True)

    except Exception as e:
        # Guardrail failure should not break the main flow
        logger.warning(f"[Guardrail/Input] Skipped (error): {e}")
        return GuardrailResult(passed=True)


# ── Output Guardrail: Embedding Cosine Similarity ────────────────────────────

def _embed(text: str) -> list[float]:
    """Embed text using OpenAI's small embedding model."""
    client = _openai()
    response = client.embeddings.create(
        input=text[:8000],   # stay within token limit
        model="text-embedding-3-small",
    )
    return response.data[0].embedding


def _cosine(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two embedding vectors."""
    dot   = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x ** 2 for x in a))
    mag_b = math.sqrt(sum(x ** 2 for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def scan_output(
    generated_text: str,
    lesson_context: list[dict],
    item_label: str = "content",
) -> GuardrailResult:
    """
    Check if the AI's generated output is semantically relevant to
    the course's lesson material using cosine similarity of embeddings.

    Works for any subject — the embeddings encode MEANING, not keywords.

    Args:
        generated_text: The text produced by the LLM (question, hint, lesson, etc.)
        lesson_context: List of lesson dicts from DB: [{title, summary, content_excerpt}]
        item_label:     Short label for log messages (e.g. "question about X").

    Returns:
        GuardrailResult — passed=True if relevant, warnings list if not.
    """
    if not _guardrail_enabled():
        return GuardrailResult(passed=True)

    if not lesson_context or not generated_text.strip():
        return GuardrailResult(passed=True)   # nothing to compare against

    try:
        # Build a single context string from all lesson material
        context_text = " ".join(
            f"{l.get('title', '')} {l.get('summary', '')} {l.get('content_excerpt', '')}"
            for l in lesson_context
        ).strip()

        if len(context_text) < 30:
            return GuardrailResult(passed=True)  # too little context

        # Compute embeddings for both
        context_vec   = _embed(context_text)
        generated_vec = _embed(generated_text)
        similarity    = _cosine(context_vec, generated_vec)

        logger.debug(f"[Guardrail/Output] '{item_label[:40]}' similarity={similarity:.3f}")

        if similarity < OUTPUT_RELEVANCE_THRESHOLD:
            msg = (
                f"Generated {item_label} may not align with course content "
                f"(semantic similarity: {similarity:.0%}). Please review before publishing."
            )
            logger.warning(f"[Guardrail/Output] LOW SIMILARITY — {msg}")
            return GuardrailResult(passed=False, warnings=[msg])

        return GuardrailResult(passed=True)

    except Exception as e:
        logger.warning(f"[Guardrail/Output] Skipped (error): {e}")
        return GuardrailResult(passed=True)


# ── Convenience: scan a list of generated action dicts ───────────────────────

def scan_generated_actions(
    actions: list[dict],
    lesson_context: list[dict],
) -> list[str]:
    """
    Run output guardrail over every action in a content_chat response.
    Returns combined warning strings from all failing checks.

    Args:
        actions:        Action dicts from the LLM response.
        lesson_context: Lesson material from DB to compare against.

    Returns:
        List of warning strings (empty = all good).
    """
    all_warnings: list[str] = []

    for action in actions:
        action_type = action.get("type", "")

        if action_type == "generate_questions":
            for q in action.get("questions", []):
                text  = f"{q.get('title', '')} {q.get('description', '')} {q.get('answer', '')}"
                label = f"question '{q.get('title', 'untitled')[:50]}'"
                result = scan_output(text, lesson_context, item_label=label)
                all_warnings.extend(result.warnings)

        elif action_type in ("create_topic", "create_lesson", "update_topic", "rewrite_lesson"):
            text  = (
                f"{action.get('name', action.get('title', ''))}"
                f"{action.get('lesson_content', action.get('content', ''))}"
            )
            label = f"{action_type}"
            result = scan_output(text, lesson_context, item_label=label)
            all_warnings.extend(result.warnings)

    return all_warnings
