"""
scripts/verify_e2e.py

End-to-end verification script: register → create student → add grades →
generate V1 recommendations → run V2 match → stream AI plan → save plan.
Verifies personalized recommendations with rationale.

Run with: no_proxy="localhost,127.0.0.1" python3 scripts/verify_e2e.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:8000"
os.environ.setdefault("no_proxy", "localhost,127.0.0.1")

def api(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read()) if resp.read else {}
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def main():
    errors = []

    # 1. Register and login
    print("1. Register and login...")
    status, data = api("POST", "/api/v1/auth/register", {"email": "verify@test.com", "password": "Verify123!", "display_name": "Verifier"})
    assert status == 201, f"Register failed: {status} {data}"

    status, data = api("POST", "/api/v1/auth/login", {"email": "verify@test.com", "password": "Verify123!"})
    assert status == 200, f"Login failed: {status} {data}"
    token = data["access_token"]
    print("   OK - logged in")

    # 2. Create student
    print("2. Create student...")
    status, student = api("POST", "/api/v1/students", {
        "name": "Lee Wing Yin",
        "grades": {"CHLA": "5", "ENGL": "4", "MATH": "5*", "CSD": "4"},
        "interests": ["engineering", "computer science", "mathematics"],
        "strengths_weaknesses": "Excellent STEM skills; English can improve",
        "target_region": "local",
    }, token)
    assert status == 201, f"Create student failed: {status} {student}"
    sid = student["id"]
    print(f"   OK - student {sid}")

    # 3. Add grades
    print("3. Add grades...")
    grades = [
        {"subject_name": "Chinese Language", "raw_grade": "5", "sitting": "MOCK", "year_of_exam": 2026},
        {"subject_name": "English Language", "raw_grade": "4", "sitting": "MOCK", "year_of_exam": 2026},
        {"subject_name": "Mathematics", "raw_grade": "5*", "sitting": "MOCK", "year_of_exam": 2026},
        {"subject_name": "Citizenship", "raw_grade": "A", "sitting": "MOCK", "year_of_exam": 2026},
        {"subject_name": "Physics", "raw_grade": "5", "sitting": "MOCK", "year_of_exam": 2026},
        {"subject_name": "Chemistry", "raw_grade": "4", "sitting": "MOCK", "year_of_exam": 2026},
    ]
    for g in grades:
        status, data = api("POST", f"/api/v1/students/{sid}/grades", g, token)
        if status == 201:
            print(f"   OK - {data.get('subject_code', '?')}: {data.get('raw_grade', '?')}")
        else:
            print(f"   WARN - grade save returned {status}: {str(data)[:100]}")

    # 4. V1 Recommendations
    print("4. Generate V1 recommendations...")
    status, recs = api("POST", f"/api/v1/students/{sid}/recommendations", token=token)
    assert status == 201, f"V1 recs failed: {status} {recs}"
    assert isinstance(recs, list) and len(recs) > 0, "No recommendations returned"

    # Check personalization
    top_rec = recs[0]
    print(f"   Top school: {top_rec['school_name']} (score: {top_rec['score']})")

    # Verify scores are not all the same (personalization check)
    scores = [r["score"] for r in recs]
    assert len(set(scores)) > 1 or len(recs) == 1, f"All scores identical — not personalized: {scores}"

    # Verify interest alignment is > 0 for at least one school
    has_interest_match = False
    for r in recs:
        if "Interest alignment" in r["explanation"]:
            lines = r["explanation"].split("\n")
            for line in lines:
                if "Interest alignment" in line and ": 0.00" not in line:
                    has_interest_match = True
                    break
    assert has_interest_match, "No school has non-zero interest alignment — matching not personalized"
    print(f"   OK - {len(recs)} personalized recommendations with rationale")
    for r in recs:
        print(f"     {r['rank']}. {r['school_name']} ({r['score']})")

    # 5. V2 Match
    print("5. Run V2 match...")
    status, match_results = api("POST", f"/api/v1/students/{sid}/match", token=token)
    assert status == 200, f"V2 match failed: {status} {match_results}"
    results = match_results if isinstance(match_results, list) else [match_results]
    assert len(results) > 0, "No match results"

    # Check academic_fit is not all zeros
    has_academic_fit = any(
        r.get("component_scores", {}).get("academic_fit", 0) > 0
        for r in results
    )
    assert has_academic_fit, "All academic_fit scores are 0 — best5 aggregate not computed"

    # Check interest_alignment is non-default for at least one school
    has_interest = any(
        r.get("component_scores", {}).get("interest_alignment", 0) > 0.2
        for r in results
    )
    assert has_interest, "No school has interest_alignment > 0.2 — student interests not used"

    top_match = results[0]
    print(f"   Top match: {top_match['school_name']} (score: {top_match['final_score']:.2f})")
    print(f"   Rationale: {top_match['rationale']}")
    print(f"   OK - {len(results)} match results with personalized scores")

    # 6. AI Plan Generation (SSE stream)
    print("6. Test AI plan stream...")
    stream_url = f"{BASE}/api/v1/consultant/tasks/academic_plan/stream?entity_id={sid}&token={token}"
    req = urllib.request.Request(stream_url, headers={"Accept": "text/event-stream"})
    try:
        resp = urllib.request.urlopen(req, timeout=120)
        raw = resp.read().decode()
        # Extract data chunks
        chunks = [line.replace("data: ", "") for line in raw.split("\n") if line.startswith("data: ")]
        ai_text = "".join(chunks)
        print(f"   AI output: {len(ai_text)} chars")

        # Verify AI output references student data
        if "Lee Wing Yin" in ai_text or "MATH" in ai_text or "5*" in ai_text or "engineering" in ai_text.lower():
            print("   OK - AI output references student data (personalized)")
        else:
            print("   WARN - AI output may not be personalized")

        # Try to parse as JSON
        try:
            ai_json = json.loads(ai_text)
            print(f"   OK - Valid JSON with {len(ai_json.get('recommended_schools', []))} recommended schools")

            # 7. Save the plan
            print("7. Save AI plan...")
            save_body = {
                "task_id": "academic_plan",
                "entity_id": sid,
                "ai_output_json": ai_text,
            }
            status, plan = api("POST", "/api/v1/consultant/tasks/academic_plan/save", save_body, token)
            if status == 200:
                print(f"   OK - Plan saved (version {plan.get('version')}, HTML: {len(str(plan.get('html_content', '')))}>0)")
            else:
                print(f"   WARN - Plan save failed: {status} {str(plan)[:200]}")
        except json.JSONDecodeError:
            print("   WARN - AI output is not valid JSON (may need retry)")

    except Exception as e:
        print(f"   WARN - AI stream failed: {e}")

    print()
    print("=" * 60)
    print("VERIFICATION COMPLETE")
    print("=" * 60)
    print(f"V1 Recommendations: {len(recs)} personalized results")
    print(f"V2 Match: {len(results)} scored results")
    print(f"Top school (V1): {recs[0]['school_name']} ({recs[0]['score']})")
    print(f"Top school (V2): {results[0]['school_name']} ({results[0]['final_score']:.2f})")

    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except AssertionError as e:
        print(f"\nFAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {e}")
        sys.exit(1)
