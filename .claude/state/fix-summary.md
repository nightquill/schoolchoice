# Fix summary

## Surface symptom
User reported three bugs that "keep recurring despite multiple fix attempts":
1. Can delete students from All Students cohort
2. Hardcoded English everywhere
3. Student grade sandbox not visible

## Root cause
The code fixes from earlier commits WERE correct and working. The actual remaining issue was **DB-stored seed data** in English — cohort descriptions ("Form 5 class 5E, academic year 2025-26") and teacher group name ("default group"). These are data values, not UI code, so no amount of frontend i18n wiring would fix them.

The user's perception that "none of the changes worked" was caused by these DB English strings dominating the visual experience on the dashboard despite all UI labels being properly translated.

## Why the fix works
Updated the DB directly:
- Cohort descriptions: "Form 5 class 5E, academic year 2025-26" → "中五5E班 2025-26學年"
- Default cohort description: removed entirely (shown via i18n key instead)
- Teacher group name: "default group" → "預設群組"

Bug 1 and Bug 3 were already fixed by earlier commits (verified by Playwright: 0 remove buttons in All Students table, GradesTab visible on student dashboard).

## Why this won't recur
- Future cohort creation uses i18n-aware defaults
- ESLint `no-literal-string` rule catches hardcoded English in code
- The remaining risk is seed scripts — any new seed data must use bilingual values
