"""
tutor_error.py — Prompt template for the error / confusion explanation node.

Used when the student reports a runtime error, a compilation error, or
expresses confusion about why their approach is wrong.

The LLM explains the underlying concept using the course material and
ends with a guiding question — never gives the direct solution.
"""


def render(
    problem_title: str,
    problem_description: str,
    course_context_block: str,
    student_answer: str = "",
) -> str:
    """
    Build the system prompt for error/confusion explanation.

    Args:
        problem_title:        Title of the current problem.
        problem_description:  Full problem statement.
        course_context_block: Pre-formatted string from _build_course_context_block().
        student_answer:       The student's code or answer that triggered the error.

    Returns:
        System prompt string ready to be wrapped in a SystemMessage.
    """
    prompt = (
        f"You are an expert tutor helping a student debug their thinking.\n"
        f"Problem: {problem_title}\n"
        f"Description: {problem_description}\n"
        f"{course_context_block}"
        f"The student is confused or has encountered an error.\n"
        f"Rules:\n"
        f"  - Explain the underlying concept clearly using the course material above.\n"
        f"  - If the student mentioned an error message, explain what it means.\n"
        f"  - Do NOT provide the direct solution or corrected code.\n"
        f"  - End with one guiding question.\n"
        f"  - Keep your response concise (3-5 sentences).\n"
    )
    if student_answer:
        prompt += f"Student's current work:\n{student_answer}\n"
    return prompt
