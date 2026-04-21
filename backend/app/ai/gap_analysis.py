#Öğretmene özel. Sınıfın hangi konularda zorlandığını analiz eder.
import os
from typing import TypedDict, List, Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langfuse.langchain import CallbackHandler
from app.core.config import settings

PATTERN_LABELS = {
    "socratic_retry":   "Socratic Retry (yanlış cevapta ipucu + tekrar)",
    "mastery_gate":     "Mastery Gate (ardışık doğru sorularla ilerleme kapısı)",
    "spaced_retrieval": "Spaced Retrieval (aralıklı tekrar algoritması)",
    "adaptive_branch":  "Adaptive Branch (performansa göre yönlendirme)",
    "custom":           "Özel / Custom Flow",
}

class GapState(TypedDict):
    """LangGraph State for Gap Analysis Agent"""
    class_name: str
    gaps_data: List[dict]
    flow_data: Optional[dict]   # {"pattern": ..., "config": {...}}

    # Output
    analysis_summary: str

def generate_gap_analysis(state: GapState) -> GapState:
    """Uses LLM to analyze the provided knowledge gaps and suggest remedial actions."""
    llm = ChatOpenAI(
        model="gpt-4.1-nano",
        temperature=0.2,
        api_key=settings.OPENAI_API_KEY
    )

    gaps = state["gaps_data"]
    flow_data = state.get("flow_data")

    if not gaps:
        return {"analysis_summary": "No significant knowledge gaps detected at this time."}

    # Format the gaps into a readable string for the prompt
    gaps_text = ""
    for g in gaps:
        failures = g.get("failures", 0)
        rate = g.get("failure_rate_pct", 0)
        topic = g.get("topic", g.get("topic_name", "Unknown Topic"))
        title = g.get("title", g.get("problem_title", "Unknown Problem"))
        gaps_text += f"- Problem: '{title}' (Topic: {topic})\n  Failure Rate: {rate}%\n  Failed Attempts: {failures}\n"

    # Workflow bölümü
    flow_text = "No pedagogical workflow is currently deployed for this class."
    if flow_data:
        pattern_label = PATTERN_LABELS.get(flow_data.get("pattern", "custom"), flow_data.get("pattern", "custom"))
        config = flow_data.get("config", {})
        config_details = []
        if config.get("consecutive_correct"):
            config_details.append(f"consecutive_correct={config['consecutive_correct']}")
        if config.get("max_hints"):
            config_details.append(f"max_hints={config['max_hints']}")
        if config.get("review_days"):
            config_details.append(f"review_days={config['review_days']}")
        config_str = ", ".join(config_details) if config_details else "default settings"
        flow_text = f"Active workflow: {pattern_label} ({config_str})"

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are an expert educational data analyst and pedagogy specialist.\n"
         "You are analyzing the class '{class_name}' and have been given:\n"
         "1. The hardest problems where failure rate is >40%\n"
         "2. The active pedagogical workflow deployed by the instructor\n\n"
         "Your task is to write a concise, insightful instructor report (4-6 sentences) that covers:\n"
         "- The specific knowledge gaps and which topics/problems are struggling\n"
         "- An assessment of whether the current pedagogical workflow is appropriate for the observed weaknesses\n"
         "- Whether the workflow likely helped or may be insufficient given the gaps\n"
         "- 1-2 concrete, actionable recommendations for the next lecture\n\n"
         "Be direct, data-driven and constructive. Do not use bullet points — write flowing prose."),
        ("user",
         "Knowledge gaps:\n{gaps_text}\n\n"
         "Pedagogical workflow:\n{flow_text}\n\n"
         "Please write the instructor report.")
    ])

    chain = prompt | llm

    response = chain.invoke({
        "class_name": state["class_name"],
        "gaps_text": gaps_text,
        "flow_text": flow_text,
    })

    return {"analysis_summary": response.content}

# Build Graph
builder = StateGraph(GapState)
builder.add_node("analyze", generate_gap_analysis)
builder.set_entry_point("analyze")
builder.add_edge("analyze", END)

gap_graph = builder.compile()

def analyze_class_gaps_sync(class_name: str, gaps_data: List[dict], flow_data: Optional[dict] = None) -> str:
    """
    Synchronously runs the gap analysis graph.
    """
    callbacks = []

    # Setup Langfuse if configured
    if settings.LANGFUSE_SECRET_KEY and settings.LANGFUSE_PUBLIC_KEY:
        os.environ["LANGFUSE_SECRET_KEY"] = settings.LANGFUSE_SECRET_KEY
        os.environ["LANGFUSE_PUBLIC_KEY"] = settings.LANGFUSE_PUBLIC_KEY
        os.environ["LANGFUSE_HOST"] = settings.LANGFUSE_HOST

        langfuse_handler = CallbackHandler()
        callbacks.append(langfuse_handler)

    initial_state = {
        "class_name": class_name,
        "gaps_data": gaps_data,
        "flow_data": flow_data,
    }

    final_state = gap_graph.invoke(initial_state, config={"callbacks": callbacks})

    return final_state.get("analysis_summary", "")
