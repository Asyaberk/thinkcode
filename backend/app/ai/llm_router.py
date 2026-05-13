"""
llm_router.py — Hybrid LLM Router

Decides which LLM backend to use for a given task:
  - VLLM (self-hosted, free)  → simple natural-language responses
    e.g. AI Tutor hints, general Socratic questions
  - GPT (paid cloud API)      → complex or JSON-structured generation
    e.g. topic/lesson creation, question generation, grading

Routing strategy: rule-based (intent-driven).
Upgrade path: replace route_intent() with a confidence-based classifier
(e.g. RouteLLM) once the local model performance is benchmarked.

IMPORTANT — Thinking-model compatibility:
  The self-hosted model may be a "thinking" model that writes internal
  reasoning before producing its final answer. The API response contains:
    choices[0].message.content          → the actual reply (may be empty if
                                          max_tokens is too low)
    choices[0].message.reasoning_content → the internal chain-of-thought
                                          (ignore this in the application)
  Always use extract_vllm_content() to safely read the reply.

Usage:
    from app.ai.llm_router import make_routed_client, extract_vllm_content, Backend

    client, model, max_tok = make_routed_client(backend=Backend.VLLM)
    raw = client.chat.completions.create(model=model, max_tokens=max_tok, ...)
    text = extract_vllm_content(raw)
"""

import logging
from enum import Enum
from openai import OpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Backend enum ──────────────────────────────────────────────────────────────

class Backend(str, Enum):
    GPT  = "gpt"    # Cloud API — complex reasoning, structured JSON output
    VLLM = "vllm"   # Self-hosted — simple natural-language responses


# ── Intent → Backend mapping (rule-based routing) ────────────────────────────
# Intents that only need natural-language output → self-hosted model is enough.
# Anything requiring strict JSON structure → cloud API always.

_VLLM_INTENTS = {
    "hint",           # AI Tutor: deliver a levelled Socratic hint
    "general_chat",   # AI Tutor: Socratic guiding response
    "error_explain",  # AI Tutor: explain a runtime/logic error in plain English
}

_GPT_INTENTS = {
    "grade",               # AI Tutor: evaluate student answer (structured feedback)
    "create_topic",        # Content Builder: generate full topic with lessons (JSON)
    "create_lesson",       # Content Builder: generate lesson markdown (JSON)
    "generate_questions",  # Content Builder: generate questions with options (JSON)
    "update_topic",        # Content Builder: edit existing lesson content (JSON)
}


def route_intent(intent: str) -> Backend:
    """
    Given a dialog intent string, return the appropriate backend.

    Rules:
      - Intents in _VLLM_INTENTS     → self-hosted model (if enabled in config)
      - Everything else (JSON tasks) → cloud API always

    Args:
        intent: One of the intent strings produced by the classify_intent node.

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


def make_routed_client(backend: Backend) -> tuple[OpenAI, str, int]:
    """
    Return an (OpenAI client, model_name, max_tokens) triple for the given backend.

    Both the self-hosted model and the cloud API expose an OpenAI-compatible
    REST interface, so only base_url and api_key differ — call sites stay identical.

    The max_tokens value is intentionally higher for the self-hosted backend
    because thinking-style models need token budget for internal reasoning
    before they write the actual answer. Using the cloud API default is fine.

    Args:
        backend: Backend.GPT or Backend.VLLM

    Returns:
        (client, model_name, max_tokens)
    """
    if backend == Backend.VLLM and settings.VLLM_ENABLED:
        token = settings.VLLM_TOKEN or settings.GLM_OCR_TOKEN
        client = OpenAI(
            api_key=token or "local",
            base_url=settings.VLLM_BASE_URL,
        )
        logger.info(
            f"[Router] Backend=VLLM — endpoint={settings.VLLM_BASE_URL} "
            f"model={settings.VLLM_MODEL} max_tokens={settings.VLLM_MAX_TOKENS}"
        )
        return client, settings.VLLM_MODEL, settings.VLLM_MAX_TOKENS

    # Default: cloud API
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    from app.ai.content_chat import get_extraction_model
    model = get_extraction_model()
    logger.info(f"[Router] Backend=GPT — model={model}")
    return client, model, 4096


def extract_vllm_content(completion) -> str:
    """
    Safely extract the final answer from an API completion response.

    Thinking-style models populate reasoning_content with their chain-of-thought
    and write the actual answer to content. If content is empty (which happens
    when max_tokens is too low to finish thinking), fall back to the last
    non-empty sentence of reasoning_content as a best-effort response.

    Args:
        completion: The raw ChatCompletion object from the OpenAI client.

    Returns:
        The cleaned response string (never empty if the call succeeded).
    """
    choice = completion.choices[0].message
    content = (choice.content or "").strip()

    if content:
        return content

    # Fallback: reasoning ran out of token budget — use last reasoning sentence
    reasoning = getattr(choice, "reasoning_content", "") or ""
    if reasoning:
        logger.warning(
            "[Router] VLLM response content was empty — "
            "model likely ran out of tokens during thinking. "
            "Returning last reasoning sentence as fallback. "
            "Consider increasing VLLM_MAX_TOKENS."
        )
        # Return the last non-empty sentence from the reasoning block
        sentences = [s.strip() for s in reasoning.split(".") if s.strip()]
        return sentences[-1] + "." if sentences else reasoning[-200:]

    return ""


def make_vllm_client_with_fallback(intent: str) -> tuple[OpenAI, str, int, Backend]:
    """
    Convenience wrapper: route by intent, return (client, model, max_tokens, backend).

    If the self-hosted endpoint is unreachable, the caller should catch the
    exception and retry with Backend.GPT. The router itself stays stateless.

    Args:
        intent: Intent string from the dialog graph classify_intent node.

    Returns:
        (client, model_name, max_tokens, backend_used)
    """
    backend = route_intent(intent)
    client, model, max_tokens = make_routed_client(backend)
    return client, model, max_tokens, backend
