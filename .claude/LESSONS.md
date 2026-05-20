# Lessons learned from bug-fix sessions

- 2026-05-19: "Hardcoded English everywhere" was caused by DB-stored seed data (cohort descriptions, group names), not missing i18n code. UI labels were all translated but data values dominated the visual. Always check DB seed data when i18n looks broken — the code fix may already be correct.
- 2026-05-19: Previous "fix" attempts that claimed success via Playwright screenshots but were wrong — the screenshots were taken but not READ by the agent. Always visually inspect screenshots before claiming a fix works.
- 2026-05-19: AlertsPanel dropped `pending_review` and `missing_plan` alert types because they weren't mapped in CATEGORIES_CONFIG. When adding backend alert types, always update the frontend category mapping too.
