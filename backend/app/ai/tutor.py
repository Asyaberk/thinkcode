from typing import Annotated, Literal
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, MessagesState, START, END
from langfuse.langchain import CallbackHandler
from app.core.config import settings
from typing import TypedDict, List
import json

class TutorState(TypedDict):
    """LangGraph State for Socratic Tutor"""
    messages: Annotated[List[BaseMessage], "add_messages"]
    problem_title: str
    problem_description: str
    student_code_or_answer: str

def socratic_tutor_node(state: TutorState) -> TutorState:
    """Invokes LLM to provide a Socratic tutoring response."""
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.3,
        api_key=settings.OPENAI_API_KEY
    )

    system_prompt = (
        "You are an expert, encouraging Socratic AI tutor for an Algorithms course based on Princeton's material.\n"
        "Your goal is to guide the student to the correct answer without ever giving them the direct solution.\n"
        "Ask targeted, leading questions. Highlight logical flaws in their thought process.\n"
        "Keep your responses concise and focused on a single concept at a time.\n\n"
        "Context:\n"
        "- Problem Title: {problem_title}\n"
        "- Problem Description: {problem_description}\n"
    )

    if state.get("student_code_or_answer"):
        system_prompt += f"- Current Student Draft/Code:\n{state['student_code_or_answer']}\n"
    
    # Prepend the system prompt to the messages
    sys_msg = SystemMessage(content=system_prompt.format(
        problem_title=state["problem_title"],
        problem_description=state["problem_description"]
    ))

    # llm invoke
    response = llm.invoke([sys_msg] + state["messages"])
    
    return {"messages": [response]}


builder = StateGraph(TutorState)
builder.add_node("tutor", socratic_tutor_node)
builder.add_edge(START, "tutor")
builder.add_edge("tutor", END)
tutor_graph = builder.compile()


def process_tutor_message_sync(
    problem_title: str,
    problem_description: str,
    student_code_or_answer: str,
    chat_history: list[dict],
    new_message: str,
    session_id: str = None,
    user_id: str = None
) -> dict:
    """
    Synchronously runs the tutor graph.
    chat_history: [{'role': 'user'|'assistant', 'content': '...'}, ...]
    """
    callbacks = []
    
    import os
    if settings.LANGFUSE_SECRET_KEY and settings.LANGFUSE_PUBLIC_KEY:
        os.environ["LANGFUSE_SECRET_KEY"] = settings.LANGFUSE_SECRET_KEY
        os.environ["LANGFUSE_PUBLIC_KEY"] = settings.LANGFUSE_PUBLIC_KEY
        os.environ["LANGFUSE_HOST"] = settings.LANGFUSE_HOST

        langfuse_handler = CallbackHandler()
        callbacks.append(langfuse_handler)

    # Convert chat history to LangChain messages
    messages = []
    for msg in chat_history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))
            
    # Add the current new message
    messages.append(HumanMessage(content=new_message))

    initial_state = {
        "problem_title": problem_title,
        "problem_description": problem_description,
        "student_code_or_answer": student_code_or_answer,
        "messages": messages
    }

    final_state = tutor_graph.invoke(initial_state, config={"callbacks": callbacks})
    
    trace_url = None
    if callbacks and hasattr(langfuse_handler, "get_trace_url"):
        trace_url = langfuse_handler.get_trace_url()
        
    ai_response = final_state["messages"][-1].content
    
    # We update the chat history to return to the client
    updated_history = chat_history + [
        {"role": "user", "content": new_message},
        {"role": "assistant", "content": ai_response}
    ]

    return {
        "response": ai_response,
        "chat_history": updated_history,
        "trace_id": trace_url
    }
