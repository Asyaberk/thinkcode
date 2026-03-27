#Öğretmene özel. Sınıfın hangi konularda zorlandığını analiz eder.
import os
from typing import TypedDict, List
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langfuse.langchain import CallbackHandler
from app.core.config import settings

class GapState(TypedDict):
    """LangGraph State for Gap Analysis Agent"""
    class_name: str
    gaps_data: List[dict]
    
    # Output
    analysis_summary: str

def generate_gap_analysis(state: GapState) -> GapState:
    """Uses LLM to analyze the provided knowledge gaps and suggest remedial actions."""
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0.2,
        api_key=settings.OPENAI_API_KEY
    )

    gaps = state["gaps_data"]
    
    if not gaps:
        return {"analysis_summary": "No significant knowledge gaps detected at this time."}

    # Format the gaps into a readable string for the prompt
    gaps_text = ""
    for g in gaps:
        failures = g.get("failures", 0)
        total = failures + g.get("passes", 0) if "passes" in g else "unknown"
        rate = g.get("failure_rate_pct", 0)
        topic = g.get("topic", g.get("topic_name", "Unknown Topic"))
        title = g.get("title", g.get("problem_title", "Unknown Problem"))
        gaps_text += f"- Problem: '{title}' (Topic: {topic})\n  Failure Rate: {rate}%\n  Failed Attempts: {failures}\n"

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert Algorithms Professor and Data Analyst.\n"
                   "You will be provided with a list of the hardest problems for a class ({class_name}), where the failure rate is exceptionally high (>40%).\n"
                   "Your goal is to briefly summarize the class's weaknesses based on these specific problems and suggest 1-2 concrete, pedagogical remedial actions the instructor should take in the next lecture.\n"
                   "Keep the analysis concise, insightful, and actionable (max 3-4 sentences)."),
        ("user", "Here are the top knowledge gaps detected:\n{gaps_text}\n\nPlease provide your analysis.")
    ])

    chain = prompt | llm
    
    response = chain.invoke({
        "class_name": state["class_name"],
        "gaps_text": gaps_text
    })

    return {"analysis_summary": response.content}

# Build Graph
builder = StateGraph(GapState)
builder.add_node("analyze", generate_gap_analysis)
builder.set_entry_point("analyze")
builder.add_edge("analyze", END)

gap_graph = builder.compile()

def analyze_class_gaps_sync(class_name: str, gaps_data: List[dict]) -> str:
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
        "gaps_data": gaps_data
    }

    final_state = gap_graph.invoke(initial_state, config={"callbacks": callbacks})
    
    return final_state.get("analysis_summary", "")
