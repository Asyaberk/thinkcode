"""
demo_langfuse.py — Langfuse / LangGraph Demo

Bir MCQ sorusu (Merge Sort) bağlamında öğrencinin 4 farklı modda
AI tutorla konuşmasını simüle eder. Her tur farklı bir dialog node'u tetikler:
  Tur 1 → classify: socratic  (öğrenci soruyla tanışıyor)
  Tur 2 → classify: explain   ("why" → explain_error node)
  Tur 3 → classify: grade     ("is this correct?" → grade_response node)
  Tur 4 → classify: hint      ("can you give me a hint?" → generate_hint node)

Çalıştırma:
  docker exec -it thinkcode-backend python demo_langfuse.py
"""

import sys, os

# Docker içinde PYTHONPATH ayarla
sys.path.insert(0, "/app")

from app.ai.dialog_graph import process_dialog_message

# ─────────────────────────────────────────────────────────────
# Demo Sorusu: Merge Sort — MCQ
# ─────────────────────────────────────────────────────────────
PROBLEM_TITLE = "Merge Sort Time Complexity"
PROBLEM_DESCRIPTION = (
    "What is the time complexity of Merge Sort in the worst case?\n\n"
    "A) O(n²)\n"
    "B) O(n log n)  ← correct\n"
    "C) O(n)\n"
    "D) O(log n)\n\n"
    "The student selected: A) O(n²)  ← WRONG"
)
STUDENT_SELECTION = "I selected A) O(n²) because sorting seems like it would compare every element."

AVAILABLE_HINTS = [
    "Think about how many times Merge Sort divides the array in half.",
    "If you have n elements and you divide by 2 each time, how many levels does the recursion tree have?",
    "The recursion tree has log n levels, and each level does O(n) work. What does that give you?",
]

# ─────────────────────────────────────────────────────────────
# Renk yardımcıları
# ─────────────────────────────────────────────────────────────
C = {"reset":"\033[0m","bold":"\033[1m","cyan":"\033[96m","yellow":"\033[93m","green":"\033[92m","red":"\033[91m","magenta":"\033[95m"}
def header(text): print(f"\n{C['bold']}{C['cyan']}{'═'*60}{C['reset']}\n{C['bold']}{text}{C['reset']}")
def intent_badge(intent):
    colours = {"hint": C["yellow"], "explain": C["magenta"], "grade": C["green"], "socratic": C["cyan"]}
    c = colours.get(intent, C["reset"])
    return f"{c}[intent: {intent.upper()}]{C['reset']}"

chat_history = []

# ─────────────────────────────────────────────────────────────
# TUR 1 — socratic node
# Öğrenci soruyu yanlış yanıtladıktan sonra kafa karışıklığını belirtir
# ─────────────────────────────────────────────────────────────
header("TUR 1 — Öğrenci soruya yaklaşımını anlatıyor")
msg1 = "I answered O(n²) because sorting seems to compare all pairs. Was I thinking about it correctly?"
print(f"{C['yellow']}Öğrenci:{C['reset']} {msg1}")

r1 = process_dialog_message(
    problem_title=PROBLEM_TITLE,
    problem_description=PROBLEM_DESCRIPTION,
    student_code_or_answer=STUDENT_SELECTION,
    chat_history=chat_history,
    new_message=msg1,
    hint_level=0,
    available_hints=AVAILABLE_HINTS,
    session_id="demo-session-001",
    user_id="demo-student-001",
)
chat_history = r1["chat_history"]
print(f"{C['green']}AI Tutor {intent_badge(r1['intent'])}:{C['reset']}\n{r1['response']}")

# ─────────────────────────────────────────────────────────────
# TUR 2 — explain node
# "why" keyword → explain_error tetiklenir
# ─────────────────────────────────────────────────────────────
header("TUR 2 — Öğrenci neden yanlış olduğunu soruyor")
msg2 = "Can you explain why O(n²) is wrong for merge sort?"
print(f"{C['yellow']}Öğrenci:{C['reset']} {msg2}")

r2 = process_dialog_message(
    problem_title=PROBLEM_TITLE,
    problem_description=PROBLEM_DESCRIPTION,
    student_code_or_answer=STUDENT_SELECTION,
    chat_history=chat_history,
    new_message=msg2,
    hint_level=r1.get("hint_level", 0),
    available_hints=AVAILABLE_HINTS,
    session_id="demo-session-001",
    user_id="demo-student-001",
)
chat_history = r2["chat_history"]
print(f"{C['green']}AI Tutor {intent_badge(r2['intent'])}:{C['reset']}\n{r2['response']}")

# ─────────────────────────────────────────────────────────────
# TUR 3 — grade node
# "is this correct" keyword → grade_response tetiklenir
# ─────────────────────────────────────────────────────────────
header("TUR 3 — Öğrenci cevabını doğrulamak istiyor")
msg3 = "Oh, I think I understand now. Is this correct: merge sort has O(n log n) because of the recursion tree having log n levels?"
print(f"{C['yellow']}Öğrenci:{C['reset']} {msg3}")

r3 = process_dialog_message(
    problem_title=PROBLEM_TITLE,
    problem_description=PROBLEM_DESCRIPTION,
    student_code_or_answer="O(n log n) — log n levels × O(n) work per level",
    chat_history=chat_history,
    new_message=msg3,
    hint_level=r2.get("hint_level", 0),
    available_hints=AVAILABLE_HINTS,
    session_id="demo-session-001",
    user_id="demo-student-001",
)
chat_history = r3["chat_history"]
print(f"{C['green']}AI Tutor {intent_badge(r3['intent'])}:{C['reset']}\n{r3['response']}")

# ─────────────────────────────────────────────────────────────
# TUR 4 — hint node
# "give me a hint" keyword → generate_hint tetiklenir
# ─────────────────────────────────────────────────────────────
header("TUR 4 — Öğrenci ipucu istiyor")
msg4 = "Can you give me a hint on how the recursion depth connects to log n?"
print(f"{C['yellow']}Öğrenci:{C['reset']} {msg4}")

r4 = process_dialog_message(
    problem_title=PROBLEM_TITLE,
    problem_description=PROBLEM_DESCRIPTION,
    student_code_or_answer="O(n log n) — still not sure about the log n part",
    chat_history=chat_history,
    new_message=msg4,
    hint_level=r3.get("hint_level", 0),
    available_hints=AVAILABLE_HINTS,
    session_id="demo-session-001",
    user_id="demo-student-001",
)
chat_history = r4["chat_history"]
print(f"{C['green']}AI Tutor {intent_badge(r4['intent'])}:{C['reset']}\n{r4['response']}")

# ─────────────────────────────────────────────────────────────
# ÖZET
# ─────────────────────────────────────────────────────────────
print(f"\n{C['bold']}{C['green']}{'═'*60}{C['reset']}")
print(f"{C['bold']}DEMO TAMAMLANDI — Dialog Tree Özeti:{C['reset']}")
print(f"  Tur 1 → {intent_badge(r1['intent'])}")
print(f"  Tur 2 → {intent_badge(r2['intent'])}")
print(f"  Tur 3 → {intent_badge(r3['intent'])}")
print(f"  Tur 4 → {intent_badge(r4['intent'])}")
if r4.get("trace_id"):
    print(f"\n{C['cyan']}Langfuse trace URL:{C['reset']} {r4['trace_id']}")
else:
    print(f"\n{C['yellow']}Not: Langfuse key yoksa trace kaydedilmedi (ama AI çalıştı).{C['reset']}")
print()
