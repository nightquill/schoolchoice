# Transferable Skills — By Function / Task
# Intelligent Academic Advisor
# Last updated: 2026-03-28

These skills are agent-agnostic and apply wherever the described task arises, regardless of which agent handles it.

---

## 1. ORM / Database Schema Management

**Task:** Add a column to an existing table without breaking running code.

**Pattern:**
1. Add `ALTER TABLE table_name ADD COLUMN IF NOT EXISTS ...` to the app startup block (`main.py` `_apply_migrations`).
2. **Also declare the column in the SQLAlchemy ORM class** (`models.py` or `models_v2.py`). SQLAlchemy reads columns from the Python class, not the live DB schema — missing declaration causes `AttributeError` at runtime even if the column exists in Postgres.
3. Add the field to every Pydantic schema that serializes this model (`response_model`, `BaseModel`).

**Applies to:** Backend Engineer, Database Engineer, Integration Engineer.

---

## 2. FastAPI Response Shape Consistency

**Task:** Ensure paginated list endpoints work with the frontend.

**Rule:** Always return `{"items": [...], "total": N}` for list endpoints used by a frontend with pagination. Never return a bare list — the frontend reads `.total` to compute page count; a missing key silently truncates to the current page size.

**Parameters:** Use `limit` / `offset` (not `page` / `page_size`) — this project's frontend API clients use `limit` and `offset`.

**Applies to:** Backend Engineer, Integration Engineer.

---

## 3. Pydantic Schema Completeness

**Task:** Ensure API responses include all expected fields.

**Rule:** When an ORM model has a column, it is NOT automatically included in the API response. Every field that the frontend needs must be explicitly declared in the Pydantic response schema. Missing fields cause silent omissions (the field is `null` or absent in JSON) rather than errors.

**Check:** When "content not available" or a field shows blank on the frontend, immediately check the response schema, not just the ORM model.

**Applies to:** Backend Engineer, Integration Engineer.

---

## 4. Async Background Job Pattern (FastAPI)

**Task:** Run a long task (plan generation, transcript parsing) without blocking the HTTP response.

**Pattern:**
1. Create a job record in the DB synchronously → commit → return 202 with `job_id`.
2. Register `background_tasks.add_task(fn, job_id, ...)` after commit.
3. Inside the background function, open a **new** `SessionLocal()` — never use the request's DB session.
4. Always close the new session in a `finally` block.
5. Frontend polls a status endpoint (every 2–3 seconds) until `status == "complete"` or `"failed"`.
6. Use `useRef` for the interval handle; clear it in the `useEffect` cleanup function.

**Applies to:** Backend Engineer, Frontend Engineer.

---

## 5. React Optimistic Update with Rollback

**Task:** Reorder or delete a list item with instant UI feedback and error recovery.

**Pattern:**
1. Store current state in `useRef` before the mutation: `prevRef.current = items`.
2. Apply the change to local state immediately (optimistic).
3. Await the API call.
4. On error, restore from `prevRef.current` and show a Toast error.

**Used in:** TargetSchools reorder, plan history delete, school directory delete.

**Applies to:** Frontend Engineer.

---

## 6. Modal Focus Management (Accessibility)

**Task:** Build a modal that traps focus and restores it on close.

**Pattern (Modal component):**
- On open: store `document.activeElement` in a ref; query all focusable elements in the dialog; focus the first one.
- `Tab` / `Shift+Tab`: cycle through focusable elements without leaving the dialog.
- `Escape`: close the dialog.
- Backdrop click: close (stop propagation on the dialog box).
- On close: restore focus to the stored trigger element.

**Applies to:** Frontend Engineer, UI Designer.

---

## 7. HKDSE Grade Calculation

**Task:** Compute aggregates and predictions from student grade records.

**Grade scale:** `5**`=7, `5*`=6, `5`=5, `4`=4, `3`=3, `2`=2, `1`=1, `U`/`X`=0.

**Best-5 aggregate:**
- Must include all 4 compulsory subjects (CHLA, ENGL, MATH, CSD); missing any → aggregate = 0.
- Add best 1 elective (or more to reach 5 subjects total).
- Applied Learning (ApL) grades are excluded from aggregate.
- Multiple sittings for the same subject → use the best score.

**Predicted grade:**
- Official sitting → no prediction.
- Non-official sitting(s) → use the most recent.
- If teacher_rating present: `blended = 0.7 × latest_numeric + 0.3 × teacher_numeric`.

**Applies to:** Backend Engineer, Data Agent.

---

## 8. Docker Rebuild Protocol

**Task:** Apply backend/schema changes in development.

**Rule:**
- Any Python dependency change → `docker compose build --no-cache backend`.
- Any ORM model / schema change → `docker compose down -v && docker compose up --build`.
  - `-v` removes the Postgres volume so the DB is recreated and `ALTER TABLE IF NOT EXISTS` blocks run fresh.
- Browser cache: `index.html` is served with `Cache-Control: no-store` to prevent stale JS bundles.

**Applies to:** Integration Engineer, Backend Engineer, Frontend Engineer.

---

## 9. Matchmaker Pipeline

**Task:** Score a student against all schools or compute auto-recommendations.

**Steps:**
1. Compute `best5_aggregate` from the student's grades.
2. For each school: check eligibility (`minimum_entry_score`, required subjects). Schools failing eligibility are filtered out.
3. Score eligible schools on 4 axes: academic fit (50%), extracurricular (20%), career alignment (15%), language (15%).
4. XGBoost SHAP model produces `final_score` (0.0–1.0) with graceful fallback to weighted sum if model unavailable.
5. Adjust by `student_rank` preference order.
6. Auto-recommendations endpoint (`GET /recommendations/auto`): run this pipeline with no existing target context; return top N sorted by `final_score` descending.

**Applies to:** Backend Engineer, Data Agent.

---

## 10. Graduation / Alumni Data Flow

**Task:** Mark a student as graduated and propagate data to analytics.

**Backend:** `POST /students/{id}/graduate` sets `is_graduated=True`, stores `final_school_id`, `final_major`, `graduation_year`.

**Analytics impact:**
- `GET /analytics/popular-majors` counts both `StudentSchoolTarget.intended_majors` AND graduated students' `final_major`.
- `GET /analytics/student-directory` includes `is_graduated`, `final_school`, `final_major`; supports `graduated_only` filter.

**Frontend:** Graduate modal on StudentProfile page; "Graduated YYYY" badge shown in profile header once graduated.

**Applies to:** Backend Engineer, Frontend Engineer, Data Agent.

---

## 11. Custom vs. Canonical Resource Guard

**Task:** Allow users to create and delete their own records without touching seeded/canonical data.

**Pattern:**
- Add `is_custom BOOLEAN DEFAULT FALSE` column to the model.
- Seeded/imported records have `is_custom=False` (default).
- User-created records set `is_custom=True` at creation time.
- DELETE endpoint checks `if not school.is_custom → 403 Forbidden`.
- Frontend shows delete affordance only when `school.is_custom === true`.

**Used in:** Custom schools.

**Applies to:** Backend Engineer, Frontend Engineer.

---

## 12. Analytics Grouping Pattern

**Task:** Present per-subject analytics without crowding a single table row.

**Pattern:**
1. Group data by subject_code into a summary card grid (name, category badge, total students, average grade, sitting count).
2. Each card is clickable and opens a detail modal.
3. Detail modal shows per-sitting breakdowns: grade distribution bar chart, grade rates (% achieving each grade or above), mean, variance.
4. Inline charts (bars, rate badges) live in the detail modal only — not in the summary list.

**Applies to:** Frontend Engineer, Data Agent.
