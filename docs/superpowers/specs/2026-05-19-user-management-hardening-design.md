# Spec B: User Management Hardening

> Secure account lifecycle with soft delete, proper cascades, enforced permissions at both API and UI layers, and no-access-until-assigned default for teachers.

## Problem

7 of 11 permissions exist as database columns but are never checked by any API endpoint. Frontend has a `usePermission` hook that no page uses. Teachers without group assignments get full read_write defaults. Deleting a counsellor cascades to all their student records. Deleting a student orphans their login account. The permission system is architecturally sound but functionally unenforced.

## Permission Matrix (11 permissions)

| # | Permission | Protects | Levels | Currently enforced? |
|---|---|---|---|---|
| 1 | `visible` | Can group see students in this cohort | boolean | Partial (backend only) |
| 2 | `programme_choices` | JUPAS choices, target schools | none / read_only / read_write | NO |
| 3 | `grades` | Grades, transcripts | none / read_only / read_write | YES (backend) |
| 4 | `plan_generation` | Academic plans, AI chat | none / read_only / read_write | NO |
| 5 | `submissions` | Approve/reject submissions | none / read_only / read_write | NO |
| 6 | `reports` | Cohort reports, data analysis | none / read_only | NO |
| 7 | `cohort_management` | Create/edit/delete cohorts, members | none / read_write | NO |
| 8 | `data_import` | CSV/Excel import | none / read_write | NO |
| 9 | `account_assignment` | Invite students, assign accounts | none / read_write | YES (backend) |
| 10 | `student_delete` | Delete student records | none / read_write | NO |
| 11 | `student_profile` | Edit personal info, language, evaluations, activities, notes | none / read_only / read_write | NEW — not yet in DB |

## Scope

### 1. Database changes (2 files)

**`backend/app/modules/school_choice/models/models.py`:**
- Change `Student.user_id` FK from `ondelete="CASCADE"` to `ondelete="SET NULL"`
- Add `deleted_at = Column(DateTime, nullable=True, default=None)` to Student model
- Add global query filter: all student list queries exclude `deleted_at IS NOT NULL`

**`backend/app/db/models.py`:**
- Add `deleted_at = Column(DateTime, nullable=True, default=None)` to User model
- Add `student_profile` column to `CohortPermission` model (String, default "none")
- Add `student_profile` to `CohortPermissionSet` schema

### 2. Backend permission enforcement (8 files)

Every write endpoint gets a permission check. Pattern: `require_feature_permission(feature, level)` as a FastAPI dependency.

| Route file | Endpoint | Permission checked |
|---|---|---|
| `routes/targets.py` | POST/PUT/DELETE targets | `programme_choices` read_write |
| `routes/targets.py` | GET targets | `programme_choices` read_only |
| `routes/grades.py` | POST/PUT/DELETE grades | `grades` read_write (already done) |
| `routes/transcripts.py` | POST transcript upload | `grades` read_write |
| `routes/plan.py` | POST generate plan | `plan_generation` read_write |
| `routes/plan.py` | GET plan | `plan_generation` read_only |
| `routes/plan.py` | POST chat, PATCH template/section | `plan_generation` read_write |
| `routes/plan.py` | DELETE plan | `plan_generation` read_write |
| `routes/submissions.py` | POST approve/reject/send-back | `submissions` read_write |
| `routes/submissions.py` | GET submissions list | `submissions` read_only |
| `routes/cohorts.py` | POST/PUT/DELETE cohorts | `cohort_management` read_write |
| `routes/cohorts.py` | POST/DELETE cohort members | `cohort_management` read_write |
| `routes/students.py` | POST import | `data_import` read_write |
| `routes/students.py` | DELETE student | `student_delete` read_write |
| `routes/students.py` | PUT student profile/personal | `student_profile` read_write |
| `routes/students.py` | PUT evaluations, POST activities/awards/language | `student_profile` read_write |
| `routes/invite.py` | POST invite/reinvite | `account_assignment` read_write (already done) |
| `routes/analytics.py` | GET analytics/reports | `reports` read_only |

### 3. Permission service changes (1 file)

**`backend/app/services/permission_service.py`:**
- Add `student_profile` to `TOOL_FIELDS` tuple
- Change counsellor role default: all permissions to `"none"` (no access until group assignment)
- Keep admin defaults unchanged (all read_write)
- Keep student defaults unchanged

### 4. Soft delete implementation (3 files)

**`backend/app/services/student_service.py`:**
- `delete_student()` → set `deleted_at = datetime.utcnow()` instead of `db.delete()`
- If student has linked User account: set `User.is_active = False`, `User.deleted_at = now()`
- All list queries: add `.filter(Student.deleted_at.is_(None))`

**`backend/app/api/v1/routes/admin.py`:**
- User deletion: set `is_active = False`, `deleted_at = now()` instead of hard delete
- If user owns students: require `reassign_to` parameter or explicit `confirm_no_reassign=true`
- Reassignment: update `Student.user_id` to new user before deactivating old user

**`backend/app/api/v1/routes/account.py`:**
- Self-delete: set `is_active = False`, `deleted_at = now()`, unlink `User.student_id = NULL`

### 5. Frontend permission enforcement (8 files)

**`apps/web/src/hooks/usePermission.js`:**
- Change optimistic default from `'read_write'` to `'none'` during loading
- Add `isLoading` boolean to return value
- Add `useFeatureAccess(feature)` convenience hook that returns `{ level, isLoading, canView, canEdit }`

**Permission enforcement pattern — hide for irrelevant, disable for unauthorized:**

| Page | Permission | Hide | Disable with tooltip |
|---|---|---|---|
| `NavBarV2.jsx` | role check | Hide "User Management", "Teacher Groups", "Data Refresh" for non-admin | — |
| `Dashboard.jsx` | `data_import` | — | "Import CSV" button disabled: "Requires data import permission" |
| `Dashboard.jsx` | no groups | — | Show empty state: "Your admin hasn't assigned you to any groups yet" |
| `StudentListPage.jsx` | `student_delete` | — | Delete button disabled: "Requires student delete permission" |
| `StudentListPage.jsx` | `account_assignment` | — | "Invite" button disabled: "Requires account assignment permission" |
| `StudentListPage.jsx` | `data_import` | — | "Import" button disabled: "Requires data import permission" |
| `StudentProfile/StudentProfile.jsx` | `student_profile` | — | Edit controls on Personal, Language, Evaluations, Activities, Notes tabs disabled |
| `StudentProfile/ProgrammeChoicesTab.jsx` | `programme_choices` | — | Add/edit/remove buttons disabled: "Requires programme choices permission" |
| `StudentProfile/GradesTab.jsx` | `grades` | — | Add/edit/delete/upload disabled (already partially done) |
| `StudentProfile/PlansTab.jsx` | `plan_generation` | — | "Generate Plan" button disabled: "Requires plan generation permission" |
| `CohortDetail/CohortDetail.jsx` | `cohort_management` | — | Add/remove members, edit cohort disabled |
| `pages/Submissions/SubmissionDetail.jsx` | `submissions` | — | Approve/reject/send-back buttons disabled |
| `pages/DataAnalysis/DataAnalysis.jsx` | `reports` | Hide entire tabs for `none` | — |

**Tooltip pattern:** Disabled buttons get `title="Requires {permission name} permission — contact your admin"` and `style={{ opacity: 0.5, cursor: 'not-allowed' }}`.

### 6. Permission grid UI update (2 files)

**`apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx`:**
- Add `student_profile` column to the permission grid table
- Label: "Student Profile" (en) / "學生檔案" (zh-HK)

**i18n keys:**
- `groupPermissions.studentProfile` → "Student Profile" / "學生檔案"

## Success Criteria

1. **Cascade fixed:** Deleting a counsellor does NOT delete their student records
2. **Soft delete works:** Deleted students have `deleted_at` set, disappear from lists, but data preserved in DB
3. **Account cleanup:** Deleting a student deactivates their login account
4. **All 11 permissions enforced at API layer:** Each write endpoint returns 403 without correct permission
5. **All 11 permissions enforced at UI layer:** Unauthorized buttons disabled with tooltip explaining required permission
6. **No-group default:** New teacher with no group sees empty dashboard with "contact admin" message
7. **Admin pages hidden:** Non-admin roles don't see admin nav links
8. **Permission grid:** Admin can set all 11 permissions per group per cohort, including new `student_profile`
9. **usePermission returns `none` during loading** — no optimistic write access

### E2E Test Requirements (Headed Playwright)

10. **Admin↔Teacher test:** Admin creates group → assigns teacher → sets permissions (grades: read_only, plans: none, student_profile: read_write) → login as teacher → verify: can view grades but not edit, plans tab shows "Generate Plan" disabled with tooltip, can edit personal info
11. **Teacher↔Student test:** Teacher invites student → student accepts → student logs in via candidate number → verify: programme choices read-only, can view released plan, can submit choices, cannot see teacher nav links
12. **No-group teacher test:** Register new teacher → login → verify empty dashboard with "contact admin" message → admin assigns to group → teacher refreshes → verify access granted
13. **Soft delete test:** Admin deletes student → verify removed from list → student login fails → counsellor's other students unaffected
14. **Cascade safety test:** Admin deactivates counsellor → verify counsellor's students still visible to other teachers and admin

## Out of Scope

- PDPO anonymization (deferred — soft delete is sufficient for now)
- Audit logging (deferred to separate spec)
- Token revocation list (JTI-based system is working)
- Email verification on invite (deferred)
- Rate limiting on invite endpoints (deferred)

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Deletion model | Soft delete everywhere | Preserves referential integrity, enables undo, required for HK education transcript retention |
| Cascade policy | SET NULL, not CASCADE | Counsellor deactivation must not destroy student data |
| Teacher default | No access until group assignment | Industrial standard: explicit grant, not implicit access |
| Frontend enforcement | Mixed: hide irrelevant, disable unauthorized | Industry UX consensus — hide admin pages, disable actions with tooltip |
| Permission loading | Pessimistic (`none` during load) | Prevents optimistic write access race condition |
| New permission | `student_profile` added | Separates "can see student" from "can edit personal data" |
| Permission count | 11 total (10 existing + 1 new) | Comprehensive coverage of all feature areas |
