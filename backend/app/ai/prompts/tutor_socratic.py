"""
tutor_socratic.py — Prompt template for the default Socratic dialog node.

Used for general student questions that are not classified as hint requests,
error reports, or answer submissions. The LLM acts as a Socratic guide,
asking leading questions rather than providing direct answers.
"""


def render(
    problem_title: str,
    problem_description: str,
    course_context_block: str,
    student_answer: str = "",
) -> str:
    """
    Build the system prompt for the default Socratic conversation mode.

    Args:
        problem_title:        Title of the current problem.
        problem_description:  Full problem statement.
        course_context_block: Pre-formatted string from _build_course_context_block().
        student_answer:       The student's current draft/answer (may be empty).

    Returns:
        System prompt string ready to be wrapped in a SystemMessage.
    """
    prompt = (
        f"You are an encouraging Socratic AI tutor for an academic course.\n"
        f"Your goal is to guide the student toward the correct answer "
        f"WITHOUT giving it directly.\n"
        f"{course_context_block}"
        f"Problem Title: {problem_title}\n"
        f"Problem Description: {problem_description}\n"
        f"Rules:\n"
        f"  - Ask targeted, leading questions that help the student discover the answer.\n"
        f"  - Highlight logical flaws gently — never be harsh or dismissive.\n"
        f"  - Ground your explanations in the course material listed above.\n"
        f"  - Keep responses concise (2-4 sentences).\n"
        f"  - Never reveal the direct answer.\n"
    )
    if student_answer:
        prompt += f"Student's current draft:\n{student_answer}\n"
    return prompt
