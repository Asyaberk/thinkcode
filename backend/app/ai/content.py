#ders içeriğini özetleme ve markdowna çevirme
#URL → Web'den metin çek → GPT'ye ver → Özet + Markdown ders üret
import os
from typing import TypedDict
import requests
from bs4 import BeautifulSoup

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langfuse.langchain import CallbackHandler

from app.core.config import settings

class ContentState(TypedDict):
    """LangGraph State for Content Summarization Agent"""
    source_url: str
    raw_text: str
    
    # Outputs
    summary: str
    markdown_content: str

def fetch_content(state: ContentState) -> ContentState:
    """Fetches text from a given Princeton Algorithms URL."""
    url = state.get("source_url")
    raw_text = state.get("raw_text", "")
    
    if url and not raw_text:
        try:
            # Simple scrape for Princeton Algs site
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, 'html.parser')
            # Extract text from main content blocks or just text in general
            raw_text = soup.get_text(separator="\n", strip=True)
            # Truncate to avoid massive token usage (just for our mock implementation)
            raw_text = raw_text[:15000]
        except Exception as e:
            raw_text = f"Error fetching content: {e}"
            
    state["raw_text"] = raw_text
    return state

def summarize_content(state: ContentState) -> ContentState:
    """Uses LLM to summarize and format the raw text into lesson markdown."""
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.1,
        api_key=settings.OPENAI_API_KEY
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert computer science professor creating standard lesson material.\n"
                   "You will be given raw text scraped from a textbook or article (e.g., Princeton Algorithms).\n"
                   "Your task is to produce two parts separated by a recognizable delimiter `---SUMMARY_END---`:\n"
                   "1. A short, 2-3 sentence summary of the lesson.\n"
                   "2. Clean, well-formatted Markdown content that can be shown to students as a lesson body. Include headers, bullet points, and code blocks if relevant. Keep it under 500 words."),
        ("user", "Here is the raw text:\n{raw_text}\n\nPlease generate the summary and markdown content.")
    ])

    chain = prompt | llm
    
    response = chain.invoke({"raw_text": state["raw_text"]})
    content = response.content
    
    parts = content.split("---SUMMARY_END---")
    if len(parts) == 2:
        state["summary"] = parts[0].strip()
        state["markdown_content"] = parts[1].strip()
    else:
        state["summary"] = "Could not parse summary."
        state["markdown_content"] = content.strip()

    return state

# Build Graph
builder = StateGraph(ContentState)
builder.add_node("fetch", fetch_content)
builder.add_node("summarize", summarize_content)

builder.set_entry_point("fetch")
builder.add_edge("fetch", "summarize")
builder.add_edge("summarize", END)

content_graph = builder.compile()

def generate_lesson_content_sync(source_url: str = None, raw_text: str = None) -> dict:
    """
    Synchronously runs the content summarization graph.
    """
    callbacks = []
    
    if settings.LANGFUSE_SECRET_KEY and settings.LANGFUSE_PUBLIC_KEY:
        os.environ["LANGFUSE_SECRET_KEY"] = settings.LANGFUSE_SECRET_KEY
        os.environ["LANGFUSE_PUBLIC_KEY"] = settings.LANGFUSE_PUBLIC_KEY
        os.environ["LANGFUSE_HOST"] = settings.LANGFUSE_HOST

        langfuse_handler = CallbackHandler()
        callbacks.append(langfuse_handler)

    initial_state = {
        "source_url": source_url or "",
        "raw_text": raw_text or "",
        "summary": "",
        "markdown_content": ""
    }

    final_state = content_graph.invoke(initial_state, config={"callbacks": callbacks})
    
    return {
        "summary": final_state.get("summary", ""),
        "markdown_content": final_state.get("markdown_content", "")
    }
