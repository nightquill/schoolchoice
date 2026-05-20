# Reproduction

## Bug 1: Can still delete students from All Students cohort
### Steps
1. Login as admin (verify@test.com / verify123)
2. Navigate to http://localhost:5177/cohorts/009b56ee-2b15-4a98-b660-8bea6d6c3d43
3. Look at the member table's "操作" (Actions) column
### Expected
No remove/delete buttons visible for members in the default cohort
### Actual
**FIXED** — 0 buttons in member table, 0 remove buttons visible. Actions column is empty.
### Reliability
100% deterministic
### How I confirmed
Playwright enumerated ALL buttons on the page: only 3 found (登出, 查看報告, 批量編輯成績). 0 buttons inside the member table.

## Bug 2: Hardcoded English everywhere
### Steps
1. Login as admin (verify@test.com, zh-HK locale)
2. Navigate to dashboard
3. Look at cohort cards
### Expected
All text in Chinese
### Actual
**PARTIALLY FIXED** — UI labels are Chinese. But cohort card descriptions show "Form 5 class 5E, academic year 2025-26" — these are **DB-stored descriptions**, not UI labels. The descriptions were seeded in English and never updated.
### Reliability
100% deterministic
### How I confirmed
Playwright extracted body text. Found "Form 5 class" and "academic year" as English leaks. All other text (headers, buttons, metrics, alert categories) is properly Chinese.

## Bug 3: Student grade sandbox not visible
### Steps
1. Login as student (HKDSE-2026-A001 / Student123)
2. Look at the full dashboard page
### Expected
Grade sandbox (grade builds) visible below programme choices
### Actual
**FIXED** — GradesTab renders below ProgrammeChoicesTab. Shows "Actual Grades" dropdown, grade table with MOCK/TRIAL tabs, "Add Grade" button, "Upload Transcript" section.
### Reliability
100% deterministic
### How I confirmed
Playwright found 9 grade-related text elements on the page. Screenshot shows full grade table with subjects, scores, and grade build selector.

## Remaining issue to fix
Bug 2 is the only one that still has a real problem: cohort descriptions stored in the DB are English. Need to either:
- Update the DB seed data to include Chinese descriptions, OR
- Don't show descriptions for cohorts (they're not essential), OR
- Add description_zh column and localize on the frontend
