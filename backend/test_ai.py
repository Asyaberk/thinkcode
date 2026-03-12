import requests
import sys

# Login
res = requests.post("http://127.0.0.1:8000/api/v1/auth/login", json={"email": "instructor@thinkcode.edu", "password": "Instructor123!"})
if res.status_code != 200:
    print("Login failed:", res.text)
    sys.exit(1)

token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Find problem
probs = requests.get("http://127.0.0.1:8000/api/v1/problems", headers=headers).json()
open_response_probs = [p for p in probs if p['type'] == 'open_response']
if not open_response_probs:
    print("No open response problems found.")
    sys.exit(1)

target_prob = open_response_probs[0]
print(f"Testing on Problem: {target_prob['title']}")

# 1. Tutor Session
print("\n--- Testing AI Tutor ---")
chat_payload = {
    "problem_id": target_prob['id'],
    "new_message": "I don't understand how to approach this.",
    "chat_history": []
}
chat_res = requests.post("http://127.0.0.1:8000/api/v1/tutor/chat", headers=headers, json=chat_payload)
if chat_res.status_code == 200:
    print("Tutor Response:", chat_res.json()["response"])
else:
    print("Tutor Error:", chat_res.text)

# 2. Open-Response Grading Session
print("\n--- Testing AI Grading ---")
sub_payload = {
    "problem_id": target_prob['id'],
    "class_id": "00000000-0000-0000-0000-000000000000", # Using dummy class_id or proper class
}

# we need a real class id to update mastery successfully without DB FK constraint error, 
# let's grab dashboard to get class
db_res = requests.get("http://127.0.0.1:8000/api/v1/analytics/me/dashboard", headers=headers).json()
sub_payload["class_id"] = db_res.get("class_id")

if not sub_payload["class_id"]:
    print("Instructor doesn't have a class enrollment to submit against. Testing with student.")
    # Fetch student from DB
    from app.db.session import SessionLocal
    from app.db.models import User
    db = SessionLocal()
    st = db.query(User).filter_by(role='student').first()
    student_email = st.email
    db.close()
    
    # Login as student
    student_res = requests.post("http://127.0.0.1:8000/api/v1/auth/login", json={"email": student_email, "password": "Student123!"})
    stoken = student_res.json()["access_token"]
    sheaders = {"Authorization": f"Bearer {stoken}"}
    sdb_res = requests.get("http://127.0.0.1:8000/api/v1/analytics/me/dashboard", headers=sheaders).json()
    sub_payload["class_id"] = sdb_res.get("class_id")
    headers = sheaders

sub_payload["submitted_answer"] = "I believe the algorithmic order of growth is O(N log N) because we must divide the array into halves until the base case, taking log N steps, and then merge them which takes N steps at each level."

grading_res = requests.post("http://127.0.0.1:8000/api/v1/submissions", headers=headers, json=sub_payload)
if grading_res.status_code == 200:
    data = grading_res.json()
    print("Grade Score:", data.get("score"))
    print("Is Correct:", data.get("is_correct"))
    print("Feedback:", data.get("feedback"))
    
    sub_id = data.get("id")
    if sub_id:
        print("\n--- Testing AI Hint Agent ---")
        hint_res = requests.post(f"http://127.0.0.1:8000/api/v1/submissions/{sub_id}/hint", headers=headers)
        if hint_res.status_code == 200:
            hdata = hint_res.json()
            print("Hint Level:", hdata.get("level"))
            print("Generated Hint:", hdata.get("content"))
            print("Trace ID:", hdata.get("trace_id"))
        else:
            print("Hint Error:", hint_res.text)

else:
    print("Grading Error:", grading_res.text)
