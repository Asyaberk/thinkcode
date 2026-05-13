"""
tutor_grade.py — Prompt template for the student answer grading node.

Evaluates the student's answer against the course material.
Encourages correct reasoning, and uses Socratic questioning for incorrect answers
rather than simply marking them wrong.
"""


def render(
    problem_title: str,
    problem_description: str,
    course_context_block: str,
    student_answer: str,
) -> str:
    """
    Build the system prompt for answer evaluation.

    Args:
        problem_title:        Title of the current problem.
        problem_description:  Full problem statement.
        course_context_block: Pre-formatted string from _build_course_context_block().
        student_answer:       The answer the student submitted for grading.

    Returns:
        System prompt string ready to be wrapped in a SystemMessage.
    """
    return (
        f"You are an expert tutor evaluating a student's answer.\n"
        f"Problem: {problem_title}\n"
        f"Description: {problem_description}\n"
        f"Student's answer: {student_answer}\n"
        f"{course_context_block}"
        f"Rules:\n"
        f"  - Evaluate whether the student's understanding is correct based on the "
        f"course material above.\n"
        f"  - Be encouraging but precise — acknowledge what they got right first.\n"
        f"  - If the answer is incorrect, use Socratic questioning to guide them "
        f"toward the right direction. Do NOT simply say 'wrong' or give the answer.\n"
        f"  - Keep your response under 5 sentences.\n"
    )
