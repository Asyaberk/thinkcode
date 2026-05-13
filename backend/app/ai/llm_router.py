"""
llm_router.py — Hybrid LLM Router

Decides which LLM backend to use for a given task:
  - VLLM (self-hosted, free, fast) → simple natural-language responses
    e.g. AI Tutor hints, general Socratic questions
  - GPT (OpenAI)                   → complex or JSON-structured generation
    e.g. topic/lesson creation, question generation, grading

Routing strategy: rule-based (intent-driven).
This can be upgraded to RouteLLM or confidence-based cascading later.

Usage:
    from app.ai.llm_router import make_routed_client, Backend

    client, model = make_routed_client(backend=Backend.VLLM)
    response = client.chat.completions.create(model=model, ...)
"""

import logging
from enum import Enum
from openai import OpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Backend enum ──────────────────────────────────────────────────────────────

class Backend(str, Enum):
    GPT  = "gpt"    # OpenAI — complex reasoning, structured JSON
    VLLM = "vllm"   # Self-hosted — simple natural-language tasks


# ── Intent → Backend mapping (rule-based routing) ────────────────────────────
# Intents that only need natural-language output → VLLM is enough.
# Anything requiring strict JSON structure → GPT.

_VLLM_INTENTS = {
    "hint",           # AI Tutor: deliver a Socratic hint
    "general_chat",   # AI Tutor: Socratic guiding response
    "error_explain",  # AI Tutor: explain a runtime/logic error in plain English
}

_GPT_INTENTS = {
    "grade",          # AI Tutor: evaluate student answer (structured feedback)
    "create_topic",   # Content Builder: generate full lesson content (JSON)
    "create_lesson",  # Content Builder: generate lesson markdown (JSON)
    "generate_questions",  # Content Builder: generate fill-in-blank questions (JSON)
    "update_topic",   # Content Builder: edit existing lesson content (JSON)
}


def route_intent(intent: str) -> Backend:
    """
    Given a dialog intent string, return the appropriate backend.

    Rules:
      - Intents in _VLLM_INTENTS     → VLLM if enabled, else GPT
      - Everything else (JSON tasks) → GPT always

    Args:
        intent: One of the intent strings produced by classify_intent node.

    Returns:
        Backend.VLLM or Backend.GPT
    """
    if not settings.VLLM_ENABLED:
        return Backend.GPT

    if intent in _VLLM_INTENTS:
        logger.debug(f"[Router] intent='{intent}' → VLLM")
        return Backend.VLLM

    logger.debug(f"[Router] intent='{intent}' → GPT")
    return Backend.GPT


def make_routed_client(backend: Backend) -> tuple[OpenAI, str]:
    """
    Return an (OpenAI client, model_name) pair configured for the given backend.

    Both GPT and VLLM expose an OpenAI-compatible REST API, so we only need
    to change base_url and api_key — the call site stays identical.

    Args:
        backend: Backend.GPT or Backend.VLLM

    Returns:
        (client, model_name) — ready to call client.chat.completions.create(model=model_name, ...)
    """
    if backend == Backend.VLLM and settings.VLLM_ENABLED:
        token = settings.VLLM_TOKEN or settings.GLM_OCR_TOKEN
        client = OpenAI(
            api_key=token or "vllm-local",
            base_url=settings.VLLM_BASE_URL,
        )
        logger.info(f"[Router] Using VLLM — {settings.VLLM_BASE_URL} / {settings.VLLM_MODEL}")
        return client, settings.VLLM_MODEL

    # Default: GPT via OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    # Import here to avoid circular dependency
    from app.ai.content_chat import get_extraction_model
    model = get_extraction_model()
    logger.info(f"[Router] Using GPT — model={model}")
    return client, model


def make_vllm_client_with_fallback(intent: str) -> tuple[OpenAI, str, Backend]:
    """
    Convenience wrapper: routes by intent and returns (client, model, backend_used).

    If VLLM is unreachable, caller should catch the exception and retry with GPT.
    We don't do the retry here to keep the router stateless.

    Args:
        intent: Intent string from dialog graph classify_intent.

    Returns:
        (client, model_name, backend_used)
    """
    backend = route_intent(intent)
    client, model = make_routed_client(backend)
    return client, model, backend
