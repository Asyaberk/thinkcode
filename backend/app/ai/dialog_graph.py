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
    # Ogrencinin hint seviyeleri (kac kez hint istedi)
    hint_level: int
    # DB'den gelen ipuclari listesi (problem_hints table)
    available_hints: List[str]
    # Hangi node'a gidecegini classify_intent belirler
    intent: str


# ── LLM Factory ───────────────────────────────────────────────────────────────

def get_llm(temperature: float = 0.3):
    """GPT-4o-mini ile LLM olustur"""
    from app.core.config import settings
    return ChatOpenAI(
        model="gpt-4o-mini",
        temperature=temperature,
        api_key=settings.OPENAI_API_KEY
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
                     "correct", "doğru mu", "dogru mu", "verify", "kontrol", "am i right",
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
    DB'den gelen available_hints listesini kullanarak seviyeli ipucu verir.
    Hint yoksa AI uretir.
    """
    llm = get_llm(temperature=0.4)
    hint_level = state.get("hint_level", 0)
    hints = state.get("available_hints", [])

    if hints and hint_level < len(hints):
        # DB'den ipucu al (Sokrates sorusu formatinda)
        hint_text = hints[hint_level]
        system_prompt = (
            f"You are a Socratic AI tutor. The student asked for a hint on:\n"
            f"Problem: {state['problem_title']}\n\n"
            f"Give this hint naturally and encourage them to think:\n"
            f"HINT: {hint_text}\n\n"
            f"Do NOT reveal the answer directly. Ask a guiding question after the hint."
        )
    else:
        # DB'de ipucu yoksa AI uretir
        system_prompt = (
            f"You are a Socratic AI tutor for an Algorithms course.\n"
            f"Problem: {state['problem_title']}\n"
            f"Description: {state['problem_description']}\n"
            f"Student code/answer: {state.get('student_code_or_answer', 'Not provided')}\n\n"
            f"Give a helpful hint WITHOUT revealing the answer. "
            f"Ask a leading question to guide their thinking. Be concise."
        )

    msg = SystemMessage(content=system_prompt)
    response = llm.invoke([msg] + list(state["messages"]))

    return {
        "messages": [response],
        "hint_level": hint_level + 1  # Sonraki hint icin seviyeyi artir
    }


# ── Node 3: Explain Error ─────────────────────────────────────────────────────

def explain_error(state: DialogState) -> DialogState:
    """
    Hata mesajini veya anlasilmayan konuyu aciklar.
    Kavramsal aciklama yapar, direkt cevap vermez.
    """
    llm = get_llm(temperature=0.2)

    system_prompt = (
        f"You are an expert Algorithms tutor.\n"
        f"Problem: {state['problem_title']}\n"
        f"Description: {state['problem_description']}\n\n"
        f"The student seems confused or encountered an error. "
        f"Explain the underlying CONCEPT clearly and concisely. "
        f"Do NOT give the direct solution. "
        f"If there's an error message in their question, explain what it means "
        f"and ask them a question to guide their fix."
    )

    msg = SystemMessage(content=system_prompt)
    response = llm.invoke([msg] + list(state["messages"]))
    return {"messages": [response]}


# ── Node 4: Grade Response ────────────────────────────────────────────────────

def grade_response(state: DialogState) -> DialogState:
    """
    Ogrencinin cevabini degerlendirir.
    Dogru/yanlis geri bildirim verir, neden dogru/yanlis oldugunu aciklar.
    """
    llm = get_llm(temperature=0.1)

    system_prompt = (
        f"You are an expert Algorithms tutor grading a student response.\n"
        f"Problem: {state['problem_title']}\n"
        f"Description: {state['problem_description']}\n"
        f"Student's current code/answer: {state.get('student_code_or_answer', 'Not provided')}\n\n"
        f"Evaluate whether the student's understanding is correct. "
        f"Be encouraging but precise. If incorrect, use Socratic questioning "
        f"to guide them to the right answer instead of just saying 'wrong'."
    )

    msg = SystemMessage(content=system_prompt)
    response = llm.invoke([msg] + list(state["messages"]))
    return {"messages": [response]}


# ── Node 5: Socratic Tutor (default) ─────────────────────────────────────────

def socratic_tutor(state: DialogState) -> DialogState:
    """
    Varsayilan Sokrates yontemi node'u.
    Ogrenciyi yonlendiren sorular sorar, direkt cevap vermez.
    """
    llm = get_llm(temperature=0.3)

    system_prompt = (
        "You are an expert, encouraging Socratic AI tutor for an Algorithms "
        "course based on Princeton's Sedgewick textbook.\n"
        "Your goal is to guide the student to the correct answer WITHOUT giving it directly.\n"
        "Ask targeted, leading questions. Highlight logical flaws.\n"
        "Keep responses concise (2-3 sentences max).\n\n"
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
    session_id: str = None,
    user_id: str = None,
) -> dict:
    """
    Dialog graph'ini calistirir.

    Args:
        problem_title: Problem basligi
        problem_description: Problem aciklamasi
        student_code_or_answer: Ogrencinin mevcut kodu veya cevabi
        chat_history: Gecmis mesajlar [{'role': 'user'|'assistant', 'content': '...'}]
        new_message: Ogrencinin yeni mesaji
        hint_level: Kac kez hint istedi
        available_hints: DB'den gelen problem_hints listesi
        session_id: Tutor session ID (Langfuse icin)
        user_id: Ogrenci ID'si (Langfuse icin)

    Returns:
        {'response': str, 'chat_history': list, 'intent': str, 'trace_id': str|None}
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
        "intent": "",  # classify_intent tarafindan doldurulacak
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
