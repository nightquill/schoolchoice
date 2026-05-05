"""
scripts/create_test_students.py

Create 3 distinct test students under verify@test.com with full profiles:
- Student A: STEM high-achiever aiming for engineering
- Student B: Arts/humanities student with strong language skills
- Student C: Average all-rounder exploring options

Each has: grades, extracurricular, teacher evaluations, personal statement, awards.
"""
import json
import os
import urllib.request
import urllib.error

os.environ["no_proxy"] = "localhost,127.0.0.1"

BASE = "http://localhost:8000"


def api(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        raw = resp.read()
        return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


# Login
_, login = api("POST", "/api/v1/auth/login", {"email": "verify@test.com", "password": "Verify123!"})
TOKEN = login["access_token"]

# ─────────────────────────────────────────────────────────────
# STUDENT A: STEM High-Achiever — Chan Siu Ming
# ─────────────────────────────────────────────────────────────
print("Creating Student A: Chan Siu Ming (STEM high-achiever)...")
_, student_a = api("POST", "/api/v1/students", {
    "name": "Chan Siu Ming",
    "grades": {},
    "interests": ["engineering", "computer science", "robotics", "mathematics"],
    "strengths_weaknesses": "Exceptional in STEM subjects, particularly mathematics and physics. Needs improvement in Chinese writing and liberal studies essay skills.",
    "target_region": "local",
}, TOKEN)
sid_a = student_a["id"]
print(f"  ID: {sid_a}")

# Update profile
api("PUT", f"/api/v1/students/{sid_a}/profile", {
    "year_of_study": 6,
    "gender": "Male",
    "class_name": "6A",
    "candidate_number": "HKDSE-2026-A001",
    "personal_statement": "I have been fascinated by how things work since I was a child — taking apart electronics, building simple circuits, and eventually programming my first robot in Form 3. My goal is to study Electrical Engineering or Computer Science at a top Hong Kong university. Through Math Olympiad training, I developed strong problem-solving skills and learned to approach complex challenges systematically. I led our school's robotics team to the regional finals in 2025, where we built an autonomous line-following robot. I want to use my engineering skills to contribute to Hong Kong's development in smart city technology and sustainable energy systems.",
}, TOKEN)

# Add grades: strong STEM, weaker humanities
for g in [
    {"subject_name": "Chinese Language", "raw_grade": "4", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "English Language", "raw_grade": "5", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "Mathematics", "raw_grade": "5**", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "CSD", "raw_grade": "A", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "Physics", "raw_grade": "5*", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "Chemistry", "raw_grade": "5", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "M2", "raw_grade": "5*", "sitting": "MOCK", "year_of_exam": 2026},
]:
    s, r = api("POST", f"/api/v1/students/{sid_a}/grades", g, TOKEN)
    code = r.get("subject_code", "?") if isinstance(r, dict) else "ERR"
    print(f"  Grade: {code} = {g['raw_grade']} ({s})")

# Extracurricular
api("POST", f"/api/v1/students/{sid_a}/extracurricular", [
    {"activity": "Robotics Club Captain", "role": "Captain", "years": "2023-2026", "description": "Led team of 8 to HKSAR Regional Robotics Finals 2025. Designed autonomous navigation system."},
    {"activity": "Math Olympiad Team", "role": "Member", "years": "2022-2026", "description": "Represented school in inter-school competitions. Achieved Silver medal in 2025 HK Math Olympiad."},
    {"activity": "Coding Workshop Volunteer", "role": "Instructor", "years": "2024-2025", "description": "Taught Python programming to F.1-F.3 students every Saturday morning."},
    {"activity": "Physics Laboratory Assistant", "role": "Assistant", "years": "2025-2026", "description": "Help set up and maintain physics lab equipment. Assist in demonstrations."},
], TOKEN)

# Awards
api("POST", f"/api/v1/students/{sid_a}/awards", [
    {"title": "Silver Medal — Hong Kong Mathematics Olympiad 2025", "year": 2025, "level": "Territory"},
    {"title": "2nd Place — HKSAR Regional Robotics Competition 2025", "year": 2025, "level": "Regional"},
    {"title": "Best Project Award — School Science Fair 2024", "year": 2024, "level": "School"},
], TOKEN)

# Teacher evaluations
api("PUT", f"/api/v1/students/{sid_a}/teacher-evaluations", [
    {"subject_code": "MATH", "teacher_name": "Mr. Wong", "rating": 5, "comments": "Siu Ming is the strongest mathematics student I have taught in 15 years. He regularly solves problems beyond the syllabus and helps classmates during tutorials. His analytical thinking is exceptional. He consistently scores top marks in assessments and shows genuine passion for the subject."},
    {"subject_code": "PHYS", "teacher_name": "Ms. Lam", "rating": 5, "comments": "Outstanding student with deep intuition for physical concepts. Excellent lab skills — his experimental reports are thorough and show mature scientific reasoning. He asks thoughtful questions that push beyond the curriculum. Highly recommended for engineering or physics programmes."},
    {"subject_code": "CHLA", "teacher_name": "Ms. Chan", "rating": 3, "comments": "Siu Ming's Chinese reading comprehension is satisfactory but his essay writing needs significant improvement. He struggles with classical Chinese texts and argumentative essay structure. He is diligent but this is clearly not his strongest subject. I recommend extra tutoring before the DSE."},
    {"subject_code": "ENGL", "teacher_name": "Mr. Smith", "rating": 4, "comments": "Strong English skills, particularly in technical and scientific writing. His vocabulary is advanced and he reads widely in English. Oral presentations are confident. Creative writing could be more expressive."},
], TOKEN)

print(f"  Student A complete\n")

# ─────────────────────────────────────────────────────────────
# STUDENT B: Arts & Humanities — Wong Mei Ling
# ─────────────────────────────────────────────────────────────
print("Creating Student B: Wong Mei Ling (Arts & Humanities)...")
_, student_b = api("POST", "/api/v1/students", {
    "name": "Wong Mei Ling",
    "grades": {},
    "interests": ["journalism", "creative writing", "film studies", "social issues", "photography"],
    "strengths_weaknesses": "Excellent writer in both Chinese and English. Strong critical thinking and communication skills. Weak in mathematics and science subjects. Very active in school media and community service.",
    "target_region": "local",
}, TOKEN)
sid_b = student_b["id"]
print(f"  ID: {sid_b}")

api("PUT", f"/api/v1/students/{sid_b}/profile", {
    "year_of_study": 6,
    "gender": "Female",
    "class_name": "6C",
    "candidate_number": "HKDSE-2026-C015",
    "personal_statement": "Words have the power to change minds and shape society. As editor-in-chief of our school newspaper for two years, I have learned that responsible journalism requires both courage and compassion. I covered stories ranging from student mental health to local environmental issues, and I discovered that giving voice to underrepresented perspectives is what drives me. I spent my summer volunteering at a refugee support centre in Jordan, where I documented families' stories through photography and writing. This experience solidified my desire to study Journalism or Communication at university. I want to become a journalist who bridges cultures and tells stories that matter — stories that Hong Kong and the world need to hear.",
}, TOKEN)

# Grades: strong humanities, weak STEM
for g in [
    {"subject_name": "Chinese Language", "raw_grade": "5*", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "English Language", "raw_grade": "5*", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "Mathematics", "raw_grade": "3", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "CSD", "raw_grade": "AD", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "History", "raw_grade": "5*", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "Economics", "raw_grade": "4", "sitting": "MOCK", "year_of_exam": 2026},
]:
    s, r = api("POST", f"/api/v1/students/{sid_b}/grades", g, TOKEN)
    code = r.get("subject_code", "?") if isinstance(r, dict) else "ERR"
    print(f"  Grade: {code} = {g['raw_grade']} ({s})")

api("POST", f"/api/v1/students/{sid_b}/extracurricular", [
    {"activity": "School Newspaper Editor-in-Chief", "role": "Editor-in-Chief", "years": "2024-2026", "description": "Lead team of 12 student journalists. Publish bi-monthly print edition and weekly online articles. Won Best School Publication Award 2025."},
    {"activity": "Debate Team", "role": "Team Captain", "years": "2023-2026", "description": "Competed in inter-school English and Chinese debates. Reached territory semi-finals in 2025 HKSSDC."},
    {"activity": "Community Service — Refugee Support Centre", "role": "Volunteer Photographer/Writer", "years": "Summer 2025", "description": "Documented refugee families' stories in Jordan through photography and written profiles. Published photo essay in school newspaper."},
    {"activity": "Drama Club", "role": "Scriptwriter", "years": "2022-2025", "description": "Wrote original scripts for annual school drama productions. 2024 production 'Voices Unheard' won Best Script at inter-school drama festival."},
    {"activity": "Photography Society", "role": "Vice President", "years": "2023-2026", "description": "Organised school photography exhibition. Won 2nd place in HKYPA Youth Photography Competition 2025."},
], TOKEN)

api("POST", f"/api/v1/students/{sid_b}/awards", [
    {"title": "Best School Publication Award 2025 — HKJEA", "year": 2025, "level": "Territory"},
    {"title": "Semi-finalist — Hong Kong Schools Debating Championship 2025", "year": 2025, "level": "Territory"},
    {"title": "2nd Place — HKYPA Youth Photography Competition 2025", "year": 2025, "level": "Territory"},
    {"title": "Best Original Script — Inter-school Drama Festival 2024", "year": 2024, "level": "Regional"},
], TOKEN)

api("PUT", f"/api/v1/students/{sid_b}/teacher-evaluations", [
    {"subject_code": "CHLA", "teacher_name": "Ms. Ho", "rating": 5, "comments": "Mei Ling is an exceptionally talented writer. Her Chinese essays are eloquent, well-structured, and show sophisticated understanding of classical and modern literature. She regularly scores top marks and her work has been selected for the school literary anthology. Her classical Chinese reading is outstanding."},
    {"subject_code": "ENGL", "teacher_name": "Ms. Thompson", "rating": 5, "comments": "One of the best English students I have taught. Her writing style is mature and compelling — both in creative and analytical contexts. She reads voraciously in English and her vocabulary range is impressive. Her oral presentations are engaging and well-researched. Highly recommended for any language or media programme."},
    {"subject_code": "HIST", "teacher_name": "Mr. Lee", "rating": 5, "comments": "Mei Ling combines strong analytical skills with excellent writing ability. Her history essays are well-argued with good use of primary sources. She shows genuine intellectual curiosity about social and political history. She would excel in any humanities programme."},
    {"subject_code": "MATH", "teacher_name": "Mr. Cheung", "rating": 2, "comments": "Mei Ling struggles significantly with mathematics. Despite attending all tutorial sessions, she finds algebraic manipulation and geometry challenging. Her grade 3 reflects consistent effort but limited aptitude in this area. I recommend she focus her university choices on programmes without heavy maths requirements."},
], TOKEN)

# Add IELTS score for Mei Ling
api("POST", f"/api/v1/students/{sid_b}/language-scores", {
    "ielts_score": 7.5,
    "ielts_listening": 8.0,
    "ielts_reading": 7.5,
    "ielts_writing": 7.0,
    "ielts_speaking": 7.5,
    "ielts_date": "2025-11",
}, TOKEN)

print(f"  Student B complete\n")

# ─────────────────────────────────────────────────────────────
# STUDENT C: Average All-Rounder — Li Ka Ho
# ─────────────────────────────────────────────────────────────
print("Creating Student C: Li Ka Ho (Average all-rounder, undecided)...")
_, student_c = api("POST", "/api/v1/students", {
    "name": "Li Ka Ho",
    "grades": {},
    "interests": ["business", "sports", "music"],
    "strengths_weaknesses": "Consistent but not outstanding in any particular subject. Good social skills and well-liked by peers. Struggles with exam pressure. Has not yet decided on a clear university direction.",
    "target_region": "local",
}, TOKEN)
sid_c = student_c["id"]
print(f"  ID: {sid_c}")

api("PUT", f"/api/v1/students/{sid_c}/profile", {
    "year_of_study": 6,
    "gender": "Male",
    "class_name": "6B",
    "candidate_number": "HKDSE-2026-B022",
    "personal_statement": "I am still exploring what I want to study at university, but I know I want a career where I can work with people. I have always enjoyed team activities — whether it is playing in the school basketball team or organising events for the student council. My part-time job at my uncle's trading company taught me about business operations and customer relationships, which sparked my interest in commerce. I also play guitar in a band with my friends, and music has taught me discipline and creativity. I am looking for a university programme that combines practical business skills with opportunities for personal growth. I am open to different paths and want to find the right fit.",
}, TOKEN)

# Grades: middle-of-the-road, BAFS as elective
for g in [
    {"subject_name": "Chinese Language", "raw_grade": "4", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "English Language", "raw_grade": "3", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "Mathematics", "raw_grade": "4", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "CSD", "raw_grade": "A", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "BAFS", "raw_grade": "4", "sitting": "MOCK", "year_of_exam": 2026},
    {"subject_name": "Geography", "raw_grade": "3", "sitting": "MOCK", "year_of_exam": 2026},
]:
    s, r = api("POST", f"/api/v1/students/{sid_c}/grades", g, TOKEN)
    code = r.get("subject_code", "?") if isinstance(r, dict) else "ERR"
    print(f"  Grade: {code} = {g['raw_grade']} ({s})")

api("POST", f"/api/v1/students/{sid_c}/extracurricular", [
    {"activity": "School Basketball Team", "role": "Point Guard", "years": "2022-2026", "description": "Regular starter for school team. Competed in inter-school basketball league. Team reached quarter-finals in 2025."},
    {"activity": "Student Council", "role": "Events Coordinator", "years": "2025-2026", "description": "Organised school carnival, sports day, and graduation ceremony. Managed budgets and coordinated with vendors."},
    {"activity": "Part-time Work — Uncle's Trading Company", "role": "Office Assistant", "years": "Summers 2024-2025", "description": "Handled customer inquiries, basic bookkeeping, inventory management. Gained practical business experience."},
    {"activity": "Guitar Band", "role": "Guitarist", "years": "2023-2026", "description": "Performed at school events and local community gatherings. Self-taught guitarist for 4 years."},
], TOKEN)

api("POST", f"/api/v1/students/{sid_c}/awards", [
    {"title": "Best Events Coordinator — Student Council 2025", "year": 2025, "level": "School"},
    {"title": "Most Improved Player — School Basketball 2024", "year": 2024, "level": "School"},
], TOKEN)

api("PUT", f"/api/v1/students/{sid_c}/teacher-evaluations", [
    {"subject_code": "BAFS", "teacher_name": "Mr. Tam", "rating": 4, "comments": "Ka Ho shows good practical understanding of business concepts and enjoys case studies. His assignment work is consistently good though not outstanding. He participates actively in class discussions and brings real-world examples from his part-time work. He would benefit from a more applied, practical business programme."},
    {"subject_code": "MATH", "teacher_name": "Ms. Ng", "rating": 3, "comments": "Ka Ho is a capable student who works steadily but lacks confidence in mathematics. He performs well on routine problems but struggles under exam pressure, which affects his grade. With consistent practice, he could reach grade 5. He needs to work on time management during exams."},
    {"subject_code": "ENGL", "teacher_name": "Mr. Roberts", "rating": 3, "comments": "Ka Ho communicates well orally but his written English needs improvement, particularly grammar and essay structure. He is enthusiastic in class but his written work does not match his spoken ability. Regular writing practice would help significantly."},
    {"subject_code": "CHLA", "teacher_name": "Ms. Yip", "rating": 3, "comments": "Steady performance. Ka Ho understands the content but his essays lack depth and analytical sophistication. His reading comprehension is adequate. He is a pleasant student who tries hard but needs to push himself to go beyond surface-level analysis."},
], TOKEN)

print(f"  Student C complete\n")

# Summary
print("=" * 60)
print("TEST STUDENTS CREATED")
print("=" * 60)
print(f"Login: verify@test.com / Verify123!")
print()
print(f"A) Chan Siu Ming  — STEM high-achiever (ID: {sid_a})")
print(f"   MATH 5**, PHYS 5*, CHEM 5, M2 5*, ENGL 5, CHLA 4")
print(f"   Robotics captain, Math Olympiad silver, coding volunteer")
print()
print(f"B) Wong Mei Ling  — Arts & Humanities (ID: {sid_b})")
print(f"   CHLA 5*, ENGL 5*, HIST 5*, ECON 4, MATH 3")
print(f"   Newspaper editor, debate captain, IELTS 7.5, refugee volunteer")
print()
print(f"C) Li Ka Ho       — Average all-rounder (ID: {sid_c})")
print(f"   CHLA 4, MATH 4, BAFS 4, ENGL 3, GEOG 3")
print(f"   Basketball, student council, part-time business, guitarist")
