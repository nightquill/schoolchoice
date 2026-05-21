# Bilingual Student Names Design

**Date:** 2026-05-20
**Status:** Approved
**Scope:** Add `name_zh` column to Student model, update display/import/search/export/profile

## Context

Students in Hong Kong have both Chinese and English names. The app currently has a single `name` field on the Student model. Org1 stores English romanized names ("Chan Siu Ming"), Org2 stores Chinese names ("陳美玲"). Need separate fields so both names are available, with locale-driven display.

## Data Model

Add `name_zh` column to Student model:
```python
name_zh = Column(String(255), nullable=True, comment="Chinese name (e.g. 陳美玲)")
```

- `name` stays as-is — English/romanized name, required, NOT NULL
- `name_zh` — Chinese name, optional (nullable)
- Auto-patched on startup by main.py column patcher (no migration needed)
- Account generation (`_generate_username`) always uses `name` (English) since usernames must be ASCII

## API Changes

### Schemas
- `StudentFullResponse`: add `name_zh: Optional[str] = None`
- `StudentListItem`: add `name_zh: Optional[str] = None`
- `StudentProfileUpdate`: add `name_zh: Optional[str] = None`

### Response building
- `_build_full_response()` in students.py: add `"name_zh": student.name_zh`
- Student list endpoint: add `item_dict["name_zh"] = s.name_zh`
- Cohort member responses: add `name_zh`
- Submission responses: add `student_name_zh`
- Alert service: include `name_zh` in alert data

### Search
- `student_service.get_students()`: add `Student.name_zh.ilike(pattern)` to the existing `or_` search clause

### Export
- Student CSV export: add "Name (Chinese)" column after "Name"

## Frontend Display

Uses existing `useLocalizedName` hook — `ln(student, 'name')` returns `name_zh` in zh-HK locale, `name` in en locale.

### Student Profile header
- Primary: `ln(student, 'name')` — localized
- Subtitle: the other name, smaller text, secondary color
- zh-HK: 陳美玲 (primary), Chan Mei Ling (subtitle)
- en: Chan Mei Ling (primary), 陳美玲 (subtitle)

### Student list table (StudentRow)
- Name column: `ln(student, 'name')` — no subtitle (too compact)

### All other name displays
- Dashboard search, cohort members, submission list, alerts — use `ln(student, 'name')` or pick from `name`/`name_zh` based on locale

### PersonalTab (profile edit)
- Add "Chinese Name" / "中文姓名" text field
- Editable with `student_profile` write permission
- Saved to `name_zh` via student profile update endpoint

## Import Changes

### CSV header mappings
Add to `student_import_service.py` header map:
- "中文姓名", "Chinese Name", "中文名" → `name_zh`

### Validation
- `name` (English) remains required
- `name_zh` (Chinese) is optional

## Data Migration

### Existing data
- Org1 (St Pauls): English names in `name` — no change, `name_zh` stays null
- Org2 (Test School ABC): Chinese names in `name` (陳美玲 etc.) — these stay in `name` for now. Teachers can manually add English names via profile edit or CSV re-import. No automatic transliteration (Cantonese romanization is personal preference).

## Files to Modify

| File | Change |
|---|---|
| `backend/app/modules/school_choice/models/models.py` | Add `name_zh` column |
| `backend/app/schemas/student.py` | Add `name_zh` to response/update schemas |
| `backend/app/api/v1/routes/students.py` | Add `name_zh` to responses, export, search |
| `backend/app/api/v1/routes/cohorts.py` | Add `name_zh` to member responses |
| `backend/app/api/v1/routes/submissions.py` | Add `student_name_zh` to responses |
| `backend/app/services/student_service.py` | Add `name_zh` to search filter |
| `backend/app/services/student_import_service.py` | Add `name_zh` header mapping |
| `backend/app/services/alert_service.py` | Include `name_zh` in alert data |
| `apps/web/src/components/StudentRow/StudentRow.jsx` | Use `useLocalizedName` for name display |
| `apps/web/src/pages/StudentProfile/StudentProfile.jsx` | Show primary + subtitle name |
| `apps/web/src/pages/StudentProfile/PersonalTab.jsx` | Add `name_zh` edit field |
| `packages/ui/src/i18n/en.json` | Add "Chinese Name" label |
| `packages/ui/src/i18n/zh-HK.json` | Add "中文姓名" label |

## Out of Scope

- Automatic Chinese → English transliteration
- Name romanization system selection (Cantonese vs Mandarin)
- Separate surname/given name fields
- Teacher bilingual names (teachers already have `display_name`)
