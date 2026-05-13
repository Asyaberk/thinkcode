"""
tutor_hint.py — Prompt template for the hint delivery node.

The hint node has two modes:
  1. DB hint available  → deliver a pre-authored hint naturally and ask one question
  2. No DB hint         → generate a grounded hint from course material

Both modes avoid revealing the full answer and end with a guiding question.
"""


def render(
    problem_title: str,
    problem_description: str,
    course_context_block: str,
    student_answer: str = "",
    scripted_hint: str = "",
) -> str:
    """
    Build the system prompt for hint delivery.

    Args:
        problem_title:        Title of the current problem.
        problem_description:  Full problem statement.
        course_context_block: Pre-formatted string from _build_course_context_block().
        student_answer:       The student's current draft/answer (may be empty).
        scripted_hint:        Pre-authored hint text from the database.
                              If provided, the LLM delivers it naturally instead
                              of generating a new hint.

    Returns:
        System prompt string ready to be wrapped in a SystemMessage.
    """
    if scripted_hint:
        # Mode 1: deliver a pre-authored hint with natural phrasing
        return (
            f"You are a Socratic AI tutor. The student asked for a hint on:\n"
            f"Problem: {problem_title}\n"
            f"{course_context_block}"
            f"Deliver the following hint naturally, encouraging the student to think:\n"
            f"HINT: {scripted_hint}\n\n"
            f"Rules:\n"
            f"  - Do NOT reveal the full answer.\n"
            f"  - End with exactly one guiding question.\n"
            f"  - Keep your response under 4 sentences.\n"
            f"  - Ground your language in the course material above."
        )

    # Mode 2: generate a hint from course material
    base = (
        f"You are a Socratic AI tutor for an academic course.\n"
        f"Problem: {problem_title}\n"
        f"Description: {problem_description}\n"
        f"{course_context_block}"
        f"Rules:\n"
        f"  - Give a helpful hint grounded in the course material above.\n"
        f"  - Do NOT reveal or closely paraphrase the full answer.\n"
        f"  - Ask one leading question at the end.\n"
        f"  - Keep your response under 4 sentences.\n"
    )
    if student_answer:
        base += f"Student's current draft:\n{student_answer}\n"
    return base
