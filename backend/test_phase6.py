import requests
import sys
import json

# Login as Instructor
res = requests.post("http://127.0.0.1:8000/api/v1/auth/login", json={"email": "instructor@thinkcode.edu", "password": "Instructor123!"})
if res.status_code != 200:
    print("Login failed:", res.text)
    sys.exit(1)

token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Get class_id via DB
from app.db.session import SessionLocal
from app.db.models import Class
db = SessionLocal()
cls = db.query(Class).first()
class_id = str(cls.id) if cls else None
db.close()

if not class_id:
    print("No class found in DB.")
    sys.exit(1)

print("\n--- Testing Knowledge Gap Analysis Agent (Phase 6) ---")
gap_res = requests.post(f"http://127.0.0.1:8000/api/v1/instructor/{class_id}/analyze-gaps", headers=headers)
if gap_res.status_code == 200:
    data = gap_res.json()
    print(f"Gaps Detected:     {data.get('gaps_detected')}")
    print(f"New Persisted Gaps: {data.get('new_gaps_persisted')}")
    print(f"\nAI Analysis Output:\n{data.get('ai_analysis')}")
else:
    print("Gap Analysis Error:", gap_res.text)

print("\n--- Testing Content Summarization Agent (Phase 6) ---")
topics = requests.get("http://127.0.0.1:8000/api/v1/topics", headers=headers).json()
target_lesson = None

for t in topics:
    lessons = requests.get(f"http://127.0.0.1:8000/api/v1/topics/{t['id']}/lessons", headers=headers).json()
    if lessons:
        target_lesson = lessons[0]['id']
        break

if target_lesson:
    test_content = (
        "Princeton Algorithms: QuickSort.\n"
        "Quicksort is a divide-and-conquer method for sorting. "
        "It works by partitioning an array into two subarrays, then sorting the subarrays independently. "
        "The performance of quicksort depends on the pivot selection, and in the worst case it can run in O(N^2) time if the array is already sorted and we pick the first element. "
        "But typically, quicksort takes O(N log N) time and is faster in practice than mergesort."
    )
    lesson_res = requests.post(
        f"http://127.0.0.1:8000/api/v1/lessons/{target_lesson}/generate-content?raw_text={test_content}",
        headers=headers
    )
    if lesson_res.status_code == 200:
        print("Content Summarization Response:", lesson_res.json())
    else:
        print("Content Generation Error:", lesson_res.text)
else:
    print("No lessons found to test Content Generation.")
