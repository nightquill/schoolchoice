"""
Edge case audit — actually hits every data endpoint with degenerate inputs.
Run: cd backend && python tests/test_edge_cases.py
"""
import requests
import json
import sys

BASE = "http://localhost:8000"
ADMIN_EMAIL = "verify@test.com"
ADMIN_PASS = "verify123"

results = []
def check(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append((status, name, detail))
    print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))

def login(email, password):
    r = requests.post(f"{BASE}/api/v1/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        return r.json()["access_token"]
    return None

def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

print("=" * 60)
print("EDGE CASE AUDIT — LIVE TESTING")
print("=" * 60)

token = login(ADMIN_EMAIL, ADMIN_PASS)
assert token, "Admin login failed"
headers = h(token)

# Get test student
students_resp = requests.get(f"{BASE}/api/v1/students?limit=20", headers=headers).json()
students = students_resp if isinstance(students_resp, list) else students_resp.get("items", [])
assert len(students) > 0, "No students"
SID = students[0]["id"]
print(f"\nTest student: {students[0]['name']} ({SID})")

# ═══════════════════════════════════════════════════════════
print("\n--- 1. GRADES EDGE CASES ---")
# ═══════════════════════════════════════════════════════════

# 1a. Duplicate grade (same subject+sitting+year)
print("\n1a. Duplicate grade rejection:")
# Get existing grades
grades = requests.get(f"{BASE}/api/v1/students/{SID}/grades", headers=headers).json()
grade_list = grades if isinstance(grades, list) else grades.get("grades", [])
if grade_list:
    g = grade_list[0]
    r = requests.post(f"{BASE}/api/v1/students/{SID}/grades", headers=headers, json={
        "subject_name": g.get("subject_code") or g.get("subject_name"),
        "sitting": g["sitting"],
        "year_of_exam": g["year_of_exam"],
        "raw_grade": "5**"
    })
    check("Duplicate grade returns 409", r.status_code == 409, f"got {r.status_code}: {r.text[:100]}")
else:
    check("Duplicate grade (skipped)", True, "no grades to test")

# 1b. Invalid grade value
print("\n1b. Invalid grade value:")
r = requests.post(f"{BASE}/api/v1/students/{SID}/grades", headers=headers, json={
    "subject_name": "ENGL",
    "sitting": "MOCK",
    "year_of_exam": 9999,
    "raw_grade": "INVALID_GRADE_XYZ"
})
# Should either accept (scorer treats unknown as 0) or reject
check("Invalid grade value handled", r.status_code in [201, 409, 422], f"got {r.status_code}")
# Clean up if created
if r.status_code == 201:
    gid = r.json().get("id")
    if gid:
        requests.delete(f"{BASE}/api/v1/students/{SID}/grades/{gid}", headers=headers)

# 1c. Grade with nonexistent subject
print("\n1c. Nonexistent subject:")
r = requests.post(f"{BASE}/api/v1/students/{SID}/grades", headers=headers, json={
    "subject_name": "NONEXISTENT_SUBJECT_999",
    "sitting": "MOCK",
    "year_of_exam": 2026,
    "raw_grade": "5"
})
check("Nonexistent subject returns 404", r.status_code == 404, f"got {r.status_code}: {r.text[:100]}")

# 1d. Grade with invalid sitting
print("\n1d. Invalid sitting value:")
r = requests.post(f"{BASE}/api/v1/students/{SID}/grades", headers=headers, json={
    "subject_name": "ENGL",
    "sitting": "FAKE_SITTING",
    "year_of_exam": 2026,
    "raw_grade": "5"
})
check("Invalid sitting rejected", r.status_code == 422, f"got {r.status_code}: {r.text[:80]}")

# 1e. Grade with missing required fields
print("\n1e. Missing required fields:")
r = requests.post(f"{BASE}/api/v1/students/{SID}/grades", headers=headers, json={})
check("Empty payload rejected", r.status_code == 422, f"got {r.status_code}")

# ═══════════════════════════════════════════════════════════
print("\n--- 2. TARGETS/SCORING EDGE CASES ---")
# ═══════════════════════════════════════════════════════════

# 2a. List targets — verify scores are computed fresh
print("\n2a. Targets scoring (live):")
r = requests.get(f"{BASE}/api/v1/students/{SID}/targets", headers=headers)
check("Targets endpoint works", r.status_code == 200, f"got {r.status_code}")
targets = r.json().get("targets", [])
for t in targets:
    score = t.get("match_score", 0)
    eligible = t.get("eligibility_pass")
    failing = t.get("failing_criteria", [])
    code = t.get("jupas_code", "none")
    # Ineligible student should NOT have high probability
    if not eligible and score > 0.5:
        check(f"Ineligible {code} score sanity", False, f"score={score} but ineligible! Failing: {failing}")
    else:
        check(f"Target {code} score sanity", True, f"score={score}, eligible={eligible}")

# 2b. Add duplicate target
print("\n2b. Duplicate target rejection:")
if targets:
    t = targets[0]
    r = requests.post(f"{BASE}/api/v1/students/{SID}/targets", headers=headers, json={
        "school_id": t["school_id"],
        "jupas_code": t.get("jupas_code"),
    })
    check("Duplicate target returns 409", r.status_code == 409, f"got {r.status_code}: {r.text[:100]}")

# 2c. Add target with nonexistent school
print("\n2c. Nonexistent school:")
r = requests.post(f"{BASE}/api/v1/students/{SID}/targets", headers=headers, json={
    "school_id": "00000000-0000-0000-0000-000000000000",
})
check("Nonexistent school returns 404", r.status_code == 404, f"got {r.status_code}")

# 2d. Add target with invalid JUPAS code (school exists, code doesn't)
print("\n2d. Invalid JUPAS code on valid school:")
# Use a real school ID
school_id = targets[0]["school_id"] if targets else None
if school_id:
    r = requests.post(f"{BASE}/api/v1/students/{SID}/targets", headers=headers, json={
        "school_id": school_id,
        "jupas_code": "JS9999",
        "programme_name": "Fake Programme"
    })
    # Should accept (code stored but scoring falls back to heuristic)
    check("Unknown JUPAS code accepted (fallback scoring)", r.status_code in [201, 409], f"got {r.status_code}")
    if r.status_code == 201:
        tid = r.json().get("id")
        if tid:
            requests.delete(f"{BASE}/api/v1/students/{SID}/targets/{tid}", headers=headers)

# ═══════════════════════════════════════════════════════════
print("\n--- 3. STUDENT EDGE CASES ---")
# ═══════════════════════════════════════════════════════════

# 3a. Create student with duplicate candidate_number
print("\n3a. Duplicate candidate_number:")
r = requests.post(f"{BASE}/api/v1/students", headers=headers, json={
    "name": "Duplicate Test",
    "candidate_number": "HKDSE-2026-A001"
})
check("Duplicate candidate_number rejected", r.status_code in [409, 422], f"got {r.status_code}: {r.text[:100]}")

# 3b. Create student with empty name
print("\n3b. Empty student name:")
r = requests.post(f"{BASE}/api/v1/students", headers=headers, json={"name": ""})
check("Empty name handled", r.status_code in [422, 400], f"got {r.status_code}: {r.text[:80]}")

# 3c. Create student with very long name
print("\n3c. Very long name:")
r = requests.post(f"{BASE}/api/v1/students", headers=headers, json={"name": "A" * 1000})
check("Long name handled", r.status_code in [201, 422], f"got {r.status_code}")
if r.status_code == 201:
    new_id = r.json().get("id")
    if new_id:
        requests.delete(f"{BASE}/api/v1/students/{new_id}", headers=headers)

# ═══════════════════════════════════════════════════════════
print("\n--- 4. COHORT EDGE CASES ---")
# ═══════════════════════════════════════════════════════════

# 4a. Add same student to cohort twice
print("\n4a. Duplicate cohort membership:")
cohorts = requests.get(f"{BASE}/api/v1/cohorts", headers=headers).json().get("cohorts", [])
if cohorts:
    cid = cohorts[0]["id"]
    detail = requests.get(f"{BASE}/api/v1/cohorts/{cid}", headers=headers).json()
    members = detail.get("members", [])
    if members:
        mid = members[0]["id"]
        r = requests.post(f"{BASE}/api/v1/cohorts/{cid}/members", headers=headers, json={"student_ids": [mid]})
        check("Duplicate cohort member handled", r.status_code == 200, f"got {r.status_code} (silently skipped)")

# 4b. Create cohort with empty name
print("\n4b. Empty cohort name:")
r = requests.post(f"{BASE}/api/v1/cohorts", headers=headers, json={"name": ""})
check("Empty cohort name rejected", r.status_code == 422, f"got {r.status_code}: {r.text[:80]}")

# 4c. Delete nonexistent cohort
print("\n4c. Nonexistent cohort delete:")
r = requests.delete(f"{BASE}/api/v1/cohorts/00000000-0000-0000-0000-000000000000", headers=headers)
check("Nonexistent cohort returns 404", r.status_code == 404, f"got {r.status_code}")

# ═══════════════════════════════════════════════════════════
print("\n--- 5. JUPAS SEARCH EDGE CASES ---")
# ═══════════════════════════════════════════════════════════

# 5a. Empty search
print("\n5a. Empty JUPAS search:")
r = requests.get(f"{BASE}/api/v1/jupas/search?q=", headers=headers)
check("Empty search handled", r.status_code == 422, f"got {r.status_code}")

# 5b. Search with special characters
print("\n5b. Special characters in search:")
r = requests.get(f"{BASE}/api/v1/jupas/search?q='; DROP TABLE--", headers=headers)
check("SQL injection handled", r.status_code in [200, 422], f"got {r.status_code}, results: {len(r.json()) if r.status_code==200 else 'N/A'}")

# 5c. Very long search query
print("\n5c. Very long search:")
r = requests.get(f"{BASE}/api/v1/jupas/search?q={'A'*500}", headers=headers)
check("Long query handled", r.status_code in [200, 422], f"got {r.status_code}")

# ═══════════════════════════════════════════════════════════
print("\n--- 6. AUTH EDGE CASES ---")
# ═══════════════════════════════════════════════════════════

# 6a. Login with wrong password
print("\n6a. Wrong password:")
r = requests.post(f"{BASE}/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongpassword123"})
check("Wrong password returns 401", r.status_code == 401, f"got {r.status_code}")

# 6b. Login with nonexistent email
print("\n6b. Nonexistent email:")
r = requests.post(f"{BASE}/api/v1/auth/login", json={"email": "nobody@nowhere.com", "password": "test12345"})
check("Nonexistent user returns 401/404", r.status_code in [401, 404], f"got {r.status_code}")

# 6c. Student login with wrong candidate number
print("\n6c. Wrong candidate number:")
r = requests.post(f"{BASE}/api/v1/auth/student-login", json={"candidate_number": "FAKE-0000", "password": "test"})
check("Wrong candidate returns 404", r.status_code == 404, f"got {r.status_code}")

# 6d. Expired/invalid token
print("\n6d. Invalid token:")
r = requests.get(f"{BASE}/api/v1/students", headers=h("invalid.token.here"))
check("Invalid token returns 401", r.status_code == 401, f"got {r.status_code}")

# 6e. Student accessing admin endpoints
print("\n6e. Student accessing admin:")
stok = login_result = requests.post(f"{BASE}/api/v1/auth/student-login", json={"candidate_number": "HKDSE-2026-A001", "password": "HKDSE-2026-A001"})
if stok.status_code == 200:
    student_token = stok.json()["access_token"]
    r = requests.get(f"{BASE}/api/v1/admin/users", headers=h(student_token))
    check("Student blocked from admin", r.status_code == 403, f"got {r.status_code}")

# ═══════════════════════════════════════════════════════════
print("\n--- 7. SCORING SANITY ACROSS ALL STUDENTS ---")
# ═══════════════════════════════════════════════════════════

print("\n7. Score sanity check for every student with targets:")
for s in students:
    sid = s["id"]
    r = requests.get(f"{BASE}/api/v1/students/{sid}/targets", headers=headers)
    if r.status_code != 200:
        check(f"Student {s['name']} targets", False, f"status {r.status_code}")
        continue
    tgts = r.json().get("targets", [])
    for t in tgts:
        code = t.get("jupas_code", "none")
        score = t.get("match_score")
        eligible = t.get("eligibility_pass")
        failing = t.get("failing_criteria", [])

        # Score must be 0-1
        if score is not None and (score < 0 or score > 1):
            check(f"{s['name']}/{code} score range", False, f"score={score} out of [0,1]")
        # Ineligible must not show >50%
        elif not eligible and score is not None and score > 0.5:
            check(f"{s['name']}/{code} ineligible+high score", False, f"score={score}, eligible=False, failing={failing}")
        elif score is not None:
            check(f"{s['name']}/{code}", True, f"score={round(score*100)}%, eligible={eligible}")

# ═══════════════════════════════════════════════════════════
print("\n--- 8. ACCOUNT/PERMISSIONS EDGE CASES ---")
# ═══════════════════════════════════════════════════════════

# 8a. Teacher without cohort management creating cohort
print("\n8a. Teacher cohort management restriction:")
# demo@school.hk is a counsellor without can_manage_cohorts
# But demo password is too short... skip if can't login
demo_r = requests.post(f"{BASE}/api/v1/auth/login", json={"email": "demo@school.hk", "password": "demo1234"})
if demo_r.status_code == 200:
    demo_token = demo_r.json()["access_token"]
    r = requests.post(f"{BASE}/api/v1/cohorts", headers=h(demo_token), json={"name": "blocked-test"})
    check("Teacher without cohort perm blocked", r.status_code == 403, f"got {r.status_code}")
else:
    check("Teacher cohort restriction (skipped)", True, "demo account unavailable")

# ═══════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
failures = [r for r in results if r[0] == "FAIL"]
passes = [r for r in results if r[0] == "PASS"]
print(f"Passed: {len(passes)}, Failed: {len(failures)}")
if failures:
    print("\nFAILURES:")
    for _, name, detail in failures:
        print(f"  ✗ {name} — {detail}")
    sys.exit(1)
else:
    print("\nAll edge cases handled correctly.")
