# Permission Hardening Design

**Date:** 2026-05-20
**Status:** Approved
**Scope:** Fix permission propagation, enforce permissions on all 18 unguarded endpoints, gate frontend UI, add data_export feature

## Context

The app has a well-designed permission system (TeacherGroup → CohortPermission with 11 feature flags) but it's broken in three layers:

1. **Cache propagation** — Admin saves permission changes, DB updates, but frontend React Query cache (`'my-permissions'`, staleTime 30s) is never invalidated. Teachers see stale permissions.
2. **Backend enforcement** — 18 mutation endpoints skip `check_feature_permission()`. Any teacher can modify grades, approve submissions, view reports regardless of their permission level.
3. **Frontend gating** — UI controls (edit buttons, delete icons, import page) are not hidden/disabled based on permission level. Teachers see controls they can't use.

Additionally, `data_export` is missing as a controllable permission — any teacher can export all student data.

Research confirms the current architecture matches ManageBac's pattern (feature-level toggles per group×cohort). The fixes are enforcement-level, not architectural.

## Layer 1: Cache Propagation Fix

### GroupPermissions.jsx
After `setGroupPermissions()` succeeds, add:
```javascript
queryClient.invalidateQueries({ queryKey: ['my-permissions'] });
```

### usePermission.js
Change the permissions query config:
```javascript
staleTime: 0,           // was 30_000 — permissions are security-critical
refetchOnMount: 'always' // refetch on every page navigation
```

**Result:** Permission changes take effect on the next page navigation. No re-login needed. Matches ManageBac's per-request evaluation pattern.

## Layer 2: Backend Enforcement

Add `check_feature_permission()` calls to all unguarded endpoints. The pattern is identical for each — one function call, one 403 check:

```python
perm = check_feature_permission(current_user, db, student_id=student_id, feature="<feature>")
if perm != "read_write":
    raise HTTPException(status_code=403, detail="<Feature> write permission required.")
```

For read-only endpoints (reports), accept both `read_only` and `read_write`:
```python
if perm == "none":
    raise HTTPException(status_code=403, detail="No access to reports for this student.")
```

### Endpoints to fix

**grades.py (3 endpoints):**
- `POST /students/{student_id}/grades` — check `grades`
- `PUT /students/{student_id}/grades/{grade_id}` — check `grades`
- `DELETE /students/{student_id}/grades/{grade_id}` — check `grades`

**submissions.py (3 endpoints):**
- `POST /submissions/{submission_id}/approve` — check `submissions`
- `POST /submissions/{submission_id}/revise` — check `submissions`
- `POST /submissions/{submission_id}/reject` — check `submissions`

Note: submission endpoints use `submission_id` not `student_id`. Must look up `student_id` from the submission record first.

**reports.py (3 endpoints):**
- `GET /reports/cohort/{cohort_id}/target-distribution` — check `reports` (read_only OK)
- `GET /reports/cohort/{cohort_id}/risk-breakdown` — check `reports` (read_only OK)
- `GET /reports/cohort/{cohort_id}/subject-performance` — check `reports` (read_only OK)

Note: report endpoints use `cohort_id` not `student_id`. Must check permission for any student in the cohort, or check cohort-level visibility directly.

**students.py (5 endpoints):**
- `POST /students/{student_id}/language-scores` — check `student_profile`
- `PUT /students/{student_id}/teacher-evaluations` — check `student_profile`
- `POST /students/{student_id}/extracurricular` — check `student_profile`
- `POST /students/{student_id}/awards` — check `student_profile`
- `POST /students/{student_id}/graduate` — check `student_profile`

**plan.py (4 endpoints):**
- `POST /students/{student_id}/plan/chat` — check `plan_generation`
- `PATCH /students/{student_id}/plan/template` — check `plan_generation`
- `PATCH /students/{student_id}/plan/section` — check `plan_generation`
- `DELETE /students/{student_id}/plan/section/{key}` — check `plan_generation`

## Layer 3: Frontend Gating

Following ManageBac pattern: hide features entirely for `none`, show read-only for `read_only`.

### GradesTab.jsx
- `useFeatureAccess('grades')` — if not `canEdit`: hide add grade button, hide edit (pencil) icon, hide delete button, hide transcript upload. Grade table is still visible (read-only view).

### SubmissionDetail.jsx (or wherever approve/reject buttons live)
- `useFeatureAccess('submissions')` — if not `canEdit`: hide approve/revise/reject buttons.

### StudentImport.jsx
- `useFeatureAccess('data_import')` — if not `canEdit`: redirect to dashboard or show "no access" message.

### Dashboard.jsx (export button)
- `useFeatureAccess('data_export')` — if not `canEdit`: hide the export students CSV button.

### StudentRow.jsx
- Already gates `canDelete` and `onAssignAccount` via props from StudentListPage.
- Verify `onInvite` is properly gated.

### StudentProfile tabs
- `useFeatureAccess('student_profile')` — if `read_only`: hide edit controls in PersonalTab, LanguageTab, OtherTab. Show data but no edit buttons.

## Layer 4: New `data_export` Permission Feature

### Database
Add column to CohortPermission:
```python
data_export = Column(String(10), nullable=False, default="none", server_default="'none'")
```

The auto-column-patch in main.py will add this on startup.

### Backend
Add to `TOOL_FIELDS` list in permission_service.py (or wherever the feature list is maintained).

Gate the student export endpoint:
```python
# In students.py export endpoint
# Check data_export permission for the user's org — not student-specific
# Use a simplified check: any cohort with data_export != "none"
```

### Admin UI
GroupPermissions.jsx: add `data_export` to the feature grid. Same dropdown pattern as other features (none/read_only/read_write).

### i18n
Add keys:
- `groupPermissions.data_export` → "Data Export" / "資料匯出"

## Implementation Order

1. Fix cache propagation (GroupPermissions.jsx + usePermission.js)
2. Add `data_export` column to CohortPermission model
3. Backend enforcement — all 18+1 endpoints
4. Frontend gating — all UI controls
5. Playwright verification

## Out of Scope

- No new permission features beyond data_export
- No changes to TeacherGroup/CohortPermission data model structure
- No admin UI redesign
- No predefined role templates
- No field-level permissions (PowerSchool-level granularity)
