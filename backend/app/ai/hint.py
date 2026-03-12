from typing import TypedDict, Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langfuse.langchain import CallbackHandler
from app.core.config import settings

class HintState(TypedDict):
    student_id: str
    problem_id: str
    
    # Decision inputs
    attempts: int
    hints_given: int
    
    # Context
    problem_title: str
    latest_submission: str
    db_hint_content: str
    db_socratic_question: str
    
    # Outputs
    hint_level: int
    generated_hint: str

def decide_and_generate_hint(state: HintState) -> HintState:
    """Decision Tree + Hint Generation Agent"""
    # 1. Decision logic
    if state["attempts"] == 0:
        level = 1
    elif state["attempts"] < 3 or state["hints_given"] < 2:
        level = 2
    else:
        level = 3
        
    state["hint_level"] = level
    
    # 2. LLM Synthesis
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.3,
        api_key=settings.OPENAI_API_KEY
    )
    
    system_prompt = (
        "You are an encouraging AI Tutor providing a hint for the Algorithms problem: '{problem_title}'.\n"
        "You must generate a hint based on the required Hint Level ({hint_level}).\n\n"
        "Guidelines by Level:\n"
        "- Level 1: Ask a Socratic question to guide conceptual thinking.\n"
        "- Level 2: Provide a partial explanation of the flaw/concept, followed by a Socratic question.\n"
        "- Level 3: Give a much stronger, direct hint (a near-answer), but NEVER write the exact solution code or final answer.\n\n"
        "Base your hint mathematically and algorithmically on the following official hints:\n"
        "Content Nudge: {db_hint_content}\n"
        "Socratic Question Idea: {db_socratic_question}\n\n"
        "Make the hint feel conversational, brief, and directly relevant to the student's latest attempt.\n"
    )
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", "Student's current attempt:\n{latest_submission}\n\nPlease generate my hint.")
    ])
    
    chain = prompt | llm
    
    response = chain.invoke({
        "problem_title": state["problem_title"],
        "hint_level": level,
        "db_hint_content": state.get("db_hint_content", "Review the core algorithm."),
        "db_socratic_question": state.get("db_socratic_question", "What step are you missing?"),
        "latest_submission": state.get("latest_submission", "No submission provided.")
    })
    
    state["generated_hint"] = response.content
    return state

# Build Graph
builder = StateGraph(HintState)
builder.add_node("hint_agent", decide_and_generate_hint)
builder.set_entry_point("hint_agent")
builder.add_edge("hint_agent", END)
hint_graph = builder.compile()

def process_hint_request_sync(
    student_id: str,
    problem_id: str,
    attempts: int,
    hints_given: int,
    problem_title: str,
    latest_submission: str,
    db_hint_content: str,
    db_socratic_question: str,
    session_id: str = None
) -> dict:
    
    callbacks = []
    import os
    if settings.LANGFUSE_SECRET_KEY and settings.LANGFUSE_PUBLIC_KEY:
        os.environ["LANGFUSE_SECRET_KEY"] = settings.LANGFUSE_SECRET_KEY
        os.environ["LANGFUSE_PUBLIC_KEY"] = settings.LANGFUSE_PUBLIC_KEY
        os.environ["LANGFUSE_HOST"] = settings.LANGFUSE_HOST

        langfuse_handler = CallbackHandler()
        callbacks.append(langfuse_handler)

    initial_state: HintState = {
        "student_id": student_id,
        "problem_id": problem_id,
        "attempts": attempts,
        "hints_given": hints_given,
        "problem_title": problem_title,
        "latest_submission": latest_submission,
        "db_hint_content": db_hint_content,
        "db_socratic_question": db_socratic_question or "",
        "hint_level": 1,
        "generated_hint": ""
    }

    final_state = hint_graph.invoke(initial_state, config={"callbacks": callbacks})
    
    trace_url = None
    if callbacks and hasattr(langfuse_handler, "get_trace_url"):
        trace_url = langfuse_handler.get_trace_url()

    return {
        "hint_level": final_state["hint_level"],
        "generated_hint": final_state["generated_hint"],
        "trace_id": trace_url
    }
