"""
grading.py — AI Tabanlı Cevap Notlandırma Modülü

submissions.py router tarafından kodlama ve açık uçlu sorularda çağrılır.
MCQ sorular burada notlandırılmaz (doğrudan is_correct kullanılır).

MİMARİ:
  LangGraph StateGraph → tek node "evaluate" → END

GradingState (durumlar):
  Girdi : problem_title, problem_description, grading_rubric, max_score, student_answer
  Çıktı : score (sayısal), is_correct (boolean), feedback (öğrenciye), reasoning (özel not)

evaluate_answer(state):
  → GPT-4o-mini'ye structured output (EvaluationResult Pydantic model) ile çağrı yapar.
  → Öğrenci cevabını rubric'e göre değerlendirir.
  → is_correct = rubric'in belirli bir eşiğini geçip geçmediği

grade_submission_sync(...):
  → Dışarıdan çağrılan PUBLIC fonksiyon (submissions.py router kullanır).
  → LangGraph çalıştırır, sonuç dict döner.
  → Langfuse yapılandırılmışsa tracing kaydı tutulur.
"""
import json
from typing import Annotated, TypedDict
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langfuse.langchain import CallbackHandler
from app.core.config import settings

class GradingState(TypedDict):
    """LangGraph State for Grading"""
    problem_title: str
    problem_description: str
    grading_rubric: str
    max_score: float
    student_answer: str
    
    # Outputs
    score: float
    is_correct: bool
    feedback: str
    reasoning: str


class EvaluationResult(BaseModel):
    score: float = Field(description="The numeric score given to the student based on max_score.")
    is_correct: bool = Field(description="Whether the answer is fundamentally correct (passing).")
    feedback: str = Field(description="Constructive and educational feedback to show the student.")
    reasoning: str = Field(description="Detailed private reasoning for the instructor explaining the grade.")


def evaluate_answer(state: GradingState) -> GradingState:
    """Uses LLM to evaluate the student answer."""
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.0,
        api_key=settings.OPENAI_API_KEY
    ).with_structured_output(EvaluationResult)

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert Computer Science professor teaching an Algorithms course based on Princeton's materials.\n"
                   "Your task is to grade a student's open-response answer to a problem.\n"
                   "Follow the rubric carefully. Be encouraging but rigorous. Provide constructive feedback.\n"
                   "Max score for this problem is {max_score}.\n"
                   "\n---\n"
                   "Problem Title: {problem_title}\n"
                   "Problem Description:\n{problem_description}\n"
                   "\n---\n"
                   "Grading Rubric / Correct Answer Guide:\n{grading_rubric}"),
        ("user", "Student Answer:\n{student_answer}\n\nPlease evaluate this answer according to the rubric.")
    ])

    chain = prompt | llm
    
    # Invoke chain
    result: EvaluationResult = chain.invoke({
        "problem_title": state["problem_title"],
        "problem_description": state["problem_description"],
        "grading_rubric": state.get("grading_rubric", "No strict rubric provided. Grade based on algorithmic correctness."),
        "max_score": state["max_score"],
        "student_answer": state["student_answer"]
    })

    return {
        "score": result.score,
        "is_correct": result.is_correct,
        "feedback": result.feedback,
        "reasoning": result.reasoning
    }

# Build Graph
builder = StateGraph(GradingState)
builder.add_node("evaluate", evaluate_answer)
builder.set_entry_point("evaluate")
builder.add_edge("evaluate", END)

grading_graph = builder.compile()


def grade_submission_sync(
    problem_title: str,
    problem_description: str,
    grading_rubric: str,
    max_score: float,
    student_answer: str,
    session_id: str = None,
    user_id: str = None
) -> dict:
    """
    Synchronously runs the grading graph.
    Injects Langfuse callback if trace tracking is desired.
    """
    callbacks = []
    
    # Setup Langfuse if configured
    import os
    if settings.LANGFUSE_SECRET_KEY and settings.LANGFUSE_PUBLIC_KEY:
        os.environ["LANGFUSE_SECRET_KEY"] = settings.LANGFUSE_SECRET_KEY
        os.environ["LANGFUSE_PUBLIC_KEY"] = settings.LANGFUSE_PUBLIC_KEY
        os.environ["LANGFUSE_HOST"] = settings.LANGFUSE_HOST

        langfuse_handler = CallbackHandler()
        callbacks.append(langfuse_handler)

    initial_state = {
        "problem_title": problem_title,
        "problem_description": problem_description,
        "grading_rubric": grading_rubric,
        "max_score": max_score,
        "student_answer": student_answer
    }

    final_state = grading_graph.invoke(initial_state, config={"callbacks": callbacks})
    
    trace_url = None
    if callbacks and hasattr(langfuse_handler, "get_trace_url"):
        trace_url = langfuse_handler.get_trace_url()

    return {
        "score": final_state.get("score", 0.0),
        "is_correct": final_state.get("is_correct", False),
        "feedback": final_state.get("feedback", "Error generating feedback."),
        "reasoning": final_state.get("reasoning", ""),
        "trace_id": trace_url
    }
