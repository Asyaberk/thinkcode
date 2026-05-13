"""
dialog_graph.py — LangGraph multi-node decision tree for AI Tutor

Mimari:
  START → classify_intent → 
      [hint]     → generate_hint     → END
      [explain]  → explain_error     → END
      [grade]    → grade_response    → END
      [socratic] → socratic_tutor    → END

classify_intent: Ogrencinin mesajini analiz eder, hangi node'a gidecegini belirler.
- "hint" : "ipucu ver", "hint", "can't figure out" gibi ifadeler
- "explain": hata mesaji veya "why", "explain" iceriyorsa
- "grade": "check my answer", "is this right" iceriyorsa  
- "socratic": genel sohbet, soru sorma
"""
from typing import Annotated, Literal
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, MessagesState, START, END
from typing import TypedDict, List


# ── State Definition ──────────────────────────────────────────────────────────

class DialogState(TypedDict):
    """LangGraph state for multi-node dialog tree"""
    messages: Annotated[List[BaseMessage], "add_messages"]
    problem_title: str
    problem_description: str
    student_code_or_answer: str
    # Number of hints the student has already received
    hint_level: int
    # Pre-authored hints from the problem_hints table
    available_hints: List[str]
    # Intent determined by classify_intent node
    intent: str
    # Course material context fetched from DB (topic lessons + source resource)
    lesson_context: List[dict]   # [{title, summary, content_excerpt}, ...]
    resource_info: dict          # {name, download_url} or {}


# ── Course context builder ────────────────────────────────────────────────────

def _build_course_context_block(lesson_context: list, resource_info: dict) -> str:
    """
    Formats lesson summaries and the source resource reference into a concise
    block that is prepended to every node's system prompt.
    """
    if not lesson_context and not resource_info:
        return ""

    lines = ["\n--- COURSE MATERIAL CONTEXT ---"]

    for lesson in lesson_context:
        lines.append(f"Lesson: {lesson['title']}")
        if lesson.get("summary"):
            lines.append(f"Summary: {lesson['summary']}")
        if lesson.get("content_excerpt"):
            lines.append(f"Content excerpt:\n{lesson['content_excerpt']}")
        lines.append("")

    if resource_info:
        lines.append(
            f"Source material: '{resource_info['name']}'\n"
            f"Students can access it at: {resource_info['download_url']}"
        )

    lines.append(
        "\nIMPORTANT: Base your explanations on the course material above. "
        "When it helps the student, mention the source material by name and "
        "tell them they can access it via the link above."
    )
    lines.append("--- END COURSE MATERIAL CONTEXT ---\n")
    return "\n".join(lines)


# ── LLM Factory (router-aware) ────────────────────────────────────────────────

def get_llm(temperature: float = 0.3, intent: str = ""):
    """
    Return a LangChain ChatOpenAI instance pointed at the appropriate backend.

    Routes simple natural-language tasks (hints, chat) to the self-hosted model
    and complex/structured tasks (grading, JSON generation) to the cloud API.
    Falls back to the cloud API silently if the self-hosted endpoint is unavailable.

    The max_tokens value is read from the router so thinking-style local models
    receive a large enough budget to complete their internal reasoning phase.
    """
    from app.ai.llm_router import route_intent, Backend, make_routed_client

    backend = route_intent(intent) if intent else Backend.GPT
    client, model, max_tokens = make_routed_client(backend)

    return ChatOpenAI(
        model=model,
        temperature=temperature,
        api_key=client.api_key,
        base_url=str(client.base_url) if backend == Backend.VLLM else None,
        max_tokens=max_tokens,
    )


# ── Node 1: Classify Intent ───────────────────────────────────────────────────

def classify_intent(state: DialogState) -> DialogState:
    """
    Ogrencinin son mesajini analiz eder ve intent belirler.
    Intent: 'hint' | 'explain' | 'grade' | 'socratic'
    LLM kullanmadan kural tabanli (hizli ve tutarli).
    """
    # Son mesaji al
    last_msg = ""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            last_msg = msg.content.lower()
            break

    # Kural tabanli siniflandirma (LLM cagrisi yapmadan hizli)
    hint_keywords = ["hint", "ipucu", "can't figure", "stuck", "help me", 
                     "yardim", "nasil", "how do i", "show me", "give me a hint"]
    explain_keywords = ["explain", "why", "error", "exception", "traceback",
                       "neden", "acikla", "anlat", "what does", "ne demek"]
    grade_keywords = ["check my answer", "is this right", "correct?", "is this correct",
                     "correct", "verify", "am i right", "right?", "is this right", "check this",
                     "am i on the right track", "is my answer"]

    if any(k in last_msg for k in hint_keywords):
        intent = "hint"
    elif any(k in last_msg for k in explain_keywords):
        intent = "explain"
    elif any(k in last_msg for k in grade_keywords):
        intent = "grade"
    else:
        intent = "socratic"  # varsayilan: Sokrates yontemi

    return {"intent": intent}


# ── Node 2: Generate Hint ─────────────────────────────────────────────────────

def generate_hint(state: DialogState) -> DialogState:
    """
    Delivers a levelled hint using pre-authored DB hints when available,
    falling back to AI generation. Grounds the response in course material.
    """
    llm = get_llm(temperature=0.4, intent="hint")
    hint_level = state.get("hint_level", 0)
    hints = state.get("available_hints", [])
    ctx = _build_course_context_block(
        state.get("lesson_context", []),
        state.get("resource_info") or {},
    )

    if hints and hint_level < len(hints):
        hint_text = hints[hint_level]
        system_prompt = (
            f"You are a Socratic AI tutor. The student asked for a hint on:\n"
            f"Problem: {state['problem_title']}\n"
            f"{ctx}"
            f"Deliver this hint naturally, encourage them to think:\n"
            f"HINT: {hint_text}\n\n"
            f"Do NOT reveal the full answer. Ask one guiding question after the hint. "
            f"Keep your response under 4 sentences."
        )
    else:
        system_prompt = (
            f"You are a Socratic AI tutor for a programming course.\n"
            f"Problem: {state['problem_title']}\n"
            f"Description: {state['problem_description']}\n"
            f"Student's answer: {state.get('student_code_or_answer', 'Not provided')}\n"
            f"{ctx}"
            f"Give a helpful hint grounded in the course material WITHOUT revealing the answer. "
            f"Ask one leading question. Keep your response under 4 sentences."
        )

    msg = SystemMessage(content=system_prompt)
    response = llm.invoke([msg] + list(state["messages"]))
    return {"messages": [response], "hint_level": hint_level + 1}


# ── Node 3: Explain Error ─────────────────────────────────────────────────────

def explain_error(state: DialogState) -> DialogState:
    """
    Explains an error or confusion using course-grounded context.
    Avoids giving the direct solution; asks a guiding question instead.
    """
    llm = get_llm(temperature=0.2, intent="error_explain")
    ctx = _build_course_context_block(
        state.get("lesson_context", []),
        state.get("resource_info") or {},
    )

    system_prompt = (
        f"You are an expert programming tutor.\n"
        f"Problem: {state['problem_title']}\n"
        f"Description: {state['problem_description']}\n"
        f"{ctx}"
        f"The student is confused or encountered an error. "
        f"Explain the underlying concept clearly using the course material above. "
        f"Do NOT give the direct solution. "
        f"If there is an error message in their question, explain what it means. "
        f"End with one guiding question. Keep your response concise (3-5 sentences)."
    )

    msg = SystemMessage(content=system_prompt)
    response = llm.invoke([msg] + list(state["messages"]))
    return {"messages": [response]}


# ── Node 4: Grade Response ────────────────────────────────────────────────────

def grade_response(state: DialogState) -> DialogState:
    """
    Evaluates the student's answer, gives precise feedback grounded in course
    material, and uses Socratic questioning when the answer is incorrect.
    """
    llm = get_llm(temperature=0.1, intent="grade")
    ctx = _build_course_context_block(
        state.get("lesson_context", []),
        state.get("resource_info") or {},
    )

    system_prompt = (
        f"You are an expert programming tutor grading a student response.\n"
        f"Problem: {state['problem_title']}\n"
        f"Description: {state['problem_description']}\n"
        f"Student's answer: {state.get('student_code_or_answer', 'Not provided')}\n"
        f"{ctx}"
        f"Evaluate whether the student's understanding is correct based on the course material above. "
        f"Be encouraging but precise. "
        f"If incorrect, use Socratic questioning to guide them — do not just say 'wrong'. "
        f"Keep your response under 5 sentences."
    )

    msg = SystemMessage(content=system_prompt)
    response = llm.invoke([msg] + list(state["messages"]))
    return {"messages": [response]}


# ── Node 5: Socratic Tutor (default) ─────────────────────────────────────────

def socratic_tutor(state: DialogState) -> DialogState:
    """
    Default Socratic mode: guides the student with questions grounded in course
    material. Does not give direct answers.
    """
    llm = get_llm(temperature=0.3, intent="general_chat")
    ctx = _build_course_context_block(
        state.get("lesson_context", []),
        state.get("resource_info") or {},
    )

    system_prompt = (
        "You are an encouraging Socratic AI tutor for a programming course.\n"
        "Your goal is to guide the student to the correct answer WITHOUT giving it directly.\n"
        "Ask targeted, leading questions. Highlight logical flaws gently.\n"
        "Keep responses concise (2-4 sentences). Ground your explanations in the course material below.\n"
        f"{ctx}"
        f"Problem Title: {state['problem_title']}\n"
        f"Problem Description: {state['problem_description']}\n"
    )
    if state.get("student_code_or_answer"):
        system_prompt += f"Student's current draft:\n{state['student_code_or_answer']}"

    msg = SystemMessage(content=system_prompt)
    response = llm.invoke([msg] + list(state["messages"]))
    return {"messages": [response]}


# ── Router: intent → node ─────────────────────────────────────────────────────

def route_by_intent(state: DialogState) -> Literal["hint", "explain", "grade", "socratic"]:
    """classify_intent'ten gelen intent'e gore yonlendir"""
    return state.get("intent", "socratic")


# ── Graph Assembly ────────────────────────────────────────────────────────────

builder = StateGraph(DialogState)

# Node'lari ekle
builder.add_node("classify_intent", classify_intent)
builder.add_node("hint", generate_hint)
builder.add_node("explain", explain_error)
builder.add_node("grade", grade_response)
builder.add_node("socratic", socratic_tutor)

# Edge'leri bagla
builder.add_edge(START, "classify_intent")
builder.add_conditional_edges(
    "classify_intent",
    route_by_intent,
    {
        "hint":     "hint",
        "explain":  "explain",
        "grade":    "grade",
        "socratic": "socratic",
    }
)
builder.add_edge("hint",     END)
builder.add_edge("explain",  END)
builder.add_edge("grade",    END)
builder.add_edge("socratic", END)

# Graph'i derle
dialog_graph = builder.compile()


# ── Public API ────────────────────────────────────────────────────────────────

def process_dialog_message(
    problem_title: str,
    problem_description: str,
    student_code_or_answer: str,
    chat_history: list[dict],
    new_message: str,
    hint_level: int = 0,
    available_hints: list[str] = None,
    lesson_context: list[dict] = None,
    resource_info: dict = None,
    session_id: str = None,
    user_id: str = None,
) -> dict:
    """
    Runs the dialog graph for one student message.

    Args:
        problem_title:          Problem title shown in the UI.
        problem_description:    Full problem description text.
        student_code_or_answer: Student's current code or written answer.
        chat_history:           Previous messages [{role, content}, ...].
        new_message:            The student's latest message.
        hint_level:             How many hints have already been delivered.
        available_hints:        Pre-authored hints from the DB (problem_hints table).
        lesson_context:         Lesson summaries/excerpts fetched from DB for grounding.
        resource_info:          {name, download_url} of the source PDF/resource.
        session_id:             Identifier for Langfuse tracing.
        user_id:                Student's user ID for Langfuse tracing.

    Returns:
        {response, chat_history, intent, trace_id}
    """
    from app.core.config import settings

    callbacks = []
    # Langfuse tracing (opsiyonel)
    if settings.LANGFUSE_SECRET_KEY and settings.LANGFUSE_PUBLIC_KEY:
        import os
        os.environ["LANGFUSE_SECRET_KEY"] = settings.LANGFUSE_SECRET_KEY
        os.environ["LANGFUSE_PUBLIC_KEY"] = settings.LANGFUSE_PUBLIC_KEY
        os.environ["LANGFUSE_HOST"] = settings.LANGFUSE_HOST
        try:
            from langfuse.langchain import CallbackHandler
            langfuse_handler = CallbackHandler()
            callbacks.append(langfuse_handler)
        except Exception:
            pass

    # Chat history'yi LangChain mesajlarina cevir
    messages = []
    for msg in chat_history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=new_message))

    initial_state = {
        "messages": messages,
        "problem_title": problem_title,
        "problem_description": problem_description,
        "student_code_or_answer": student_code_or_answer or "",
        "hint_level": hint_level,
        "available_hints": available_hints or [],
        "intent": "",
        "lesson_context": lesson_context or [],
        "resource_info": resource_info or {},
    }

    config = {"callbacks": callbacks} if callbacks else {}
    final_state = dialog_graph.invoke(initial_state, config=config)

    # Langfuse trace URL
    trace_url = None
    if callbacks:
        langfuse_handler = callbacks[0]
        trace_id = getattr(langfuse_handler, "last_trace_id", None)
        if trace_id:
            host = settings.LANGFUSE_HOST.rstrip("/")
            trace_url = f"{host}/trace/{trace_id}"
        try:
            if hasattr(langfuse_handler, "_langfuse_client"):
                langfuse_handler._langfuse_client.flush()
        except Exception:
            pass

    ai_response = final_state["messages"][-1].content

    updated_history = chat_history + [
        {"role": "user",      "content": new_message},
        {"role": "assistant", "content": ai_response},
    ]

    return {
        "response":     ai_response,
        "chat_history": updated_history,
        "intent":       final_state.get("intent", "socratic"),
        "trace_id":     trace_url,
    }
