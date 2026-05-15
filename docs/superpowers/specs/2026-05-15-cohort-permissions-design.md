# Cohort-Based Feature Permissions — Design Spec

**Date:** 2026-05-15
**Status:** Approved

## Summary

Add cohort-level, per-tool permission controls managed through teacher groups. Admin creates teacher groups, assigns teachers to groups, then configures per-cohort permissions on each group — controlling visibility and read/read_write/none access for each tool. Replaces the existing binary read_write/read_only CohortPermission model.

## Data Model

### TeacherGroup (new table: `teacher_groups`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID, PK | |
| `organisation_id` | UUID, FK to organisations | |
| `name` | String(100) | e.g. "Form 5 Teachers", "Science Dept" |
| `description` | Text, nullable | |
| `created_at` | Timestamp | |
| `updated_at` | Timestamp | |

### TeacherGroupMember (new table: `teacher_group_members`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID, PK | |
| `group_id` | UUID, FK to teacher_groups (CASCADE) | |
| `user_id` | UUID, FK to users (CASCADE) | |
| Unique on (group_id, user_id) | | |

### CohortPermission (modify existing `cohort_permissions`)

Replace `user_id` with `group_id`. Add per-tool columns.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | UUID, PK | | |
| `group_id` | UUID, FK to teacher_groups (CASCADE) | | Was `user_id` |
| `cohort_id` | UUID, FK to student_cohorts (CASCADE) | | |
| `visible` | Boolean | True | Can users in this group see students in this cohort? |
| `programme_choices` | String(10) | "read_write" | none / read_only / read_write |
| `grades` | String(10) | "read_write" | none / read_only / read_write |
| `plan_generation` | String(10) | "read_write" | none / read_only / read_write |
| `submissions` | String(10) | "read_write" | none / read_only / read_write |
| `reports` | String(10) | "read_only" | none / read_only / read_write |
| `cohort_management` | String(10) | "none" | none / read_only / read_write |
| Unique on (group_id, cohort_id) | | | |

When `visible=False`, all tools are implicitly `none` for that cohort regardless of individual tool settings.

### Tool List (fixed)

| Tool key | What it controls |
|----------|-----------------|
| `programme_choices` | Add/edit/remove programme targets for students |
| `grades` | View/edit student grades and grade builds |
| `plan_generation` | Generate/edit/release academic plans |
| `submissions` | Review/approve/reject JUPAS submissions |
| `reports` | View cohort reports and analytics |
| `cohort_management` | Edit cohort membership, rename, delete cohort |

### Permission Resolution

When checking if user can do X on a student in cohort Y:

1. Find all teacher groups the user belongs to
2. Find CohortPermission rows for those groups + cohort Y
3. If multiple groups have permissions on the same cohort: **most permissive wins** (read_write > read_only > none; visible=true > visible=false)
4. If no CohortPermission row exists for any of the user's groups + this cohort: fall back to role defaults

**Role defaults** (when no CohortPermission exists):
- **admin**: visible=true, all tools read_write. Admin also bypasses all checks entirely.
- **counsellor**: visible=true, all tools read_write except cohort_management=none
- **student**: N/A — students see only their own data via student_id scoping

**Admin bypasses all checks** — `user.role == "admin"` returns read_write for everything, always.

### Migration from existing CohortPermission

The existing `cohort_permissions` table has `user_id` and a single `permission` column. Migration:
1. Create teacher_groups and teacher_group_members tables
2. Add new columns to cohort_permissions (group_id, visible, tool columns)
3. For each existing CohortPermission row: create a single-user teacher group, migrate the permission to the new schema
4. Drop the old `user_id` column

For simplicity, since this is a dev database: drop and recreate the `cohort_permissions` table with the new schema. Existing overrides are minimal and can be re-set by admin.

## API Endpoints

### Teacher Group CRUD (admin only)

```
GET    /admin/teacher-groups
       → {groups: [{id, name, description, member_count, created_at}, ...]}

POST   /admin/teacher-groups
       body: {name, description?}
       → {id, name, description, created_at}

PUT    /admin/teacher-groups/{id}
       body: {name?, description?}
       → {id, name, description, updated_at}

DELETE /admin/teacher-groups/{id}
       → 204 (deletes group, cascades members + permissions)
```

### Group Member Management (admin only)

```
GET    /admin/teacher-groups/{id}/members
       → {members: [{user_id, email, display_name, role}, ...]}

POST   /admin/teacher-groups/{id}/members
       body: {user_ids: ["uuid", ...]}
       → {added: N, already_member: N}

DELETE /admin/teacher-groups/{id}/members/{user_id}
       → 204
```

### Cohort Permissions (admin only)

```
GET    /admin/teacher-groups/{id}/permissions
       → {permissions: [{cohort_id, cohort_name, visible, programme_choices, grades, plan_generation, submissions, reports, cohort_management}, ...]}

PUT    /admin/teacher-groups/{id}/permissions
       body: [{cohort_id, visible, programme_choices, grades, plan_generation, submissions, reports, cohort_management}, ...]
       → {updated: N}
```

Bulk upsert: for each item, create or update CohortPermission row for this group + cohort.

### My Permissions (any authenticated user)

```
GET    /account/permissions
       → {cohorts: [{cohort_id, cohort_name, visible, programme_choices, grades, plan_generation, submissions, reports, cohort_management}, ...]}
```

Returns the resolved (merged across groups) permissions for the current user. Admin gets all cohorts with read_write. Frontend caches this and uses it to show/hide/disable UI elements.

## Permission Check Integration

### New service: `permission_service.py`

Three main functions:

**`check_feature_permission(user, db, student_id, feature) -> str`**
- Finds which cohort(s) the student belongs to
- Finds which groups the user belongs to
- Looks up CohortPermission for those groups x cohorts
- Merges: most permissive wins across groups and cohorts
- Returns `"read_write"`, `"read_only"`, or `"none"`
- Admin always returns `"read_write"`

**`get_visible_student_ids(user, db) -> set[UUID] | None`**
- Returns None for admin (= no filter, see everything)
- For others: finds user's groups -> CohortPermissions where visible=True -> student IDs in those cohorts
- Used by list_students to filter results

**`resolve_user_permissions(user, db) -> list[dict]`**
- Returns the full cohort permission matrix for a user (merged across groups)
- Used by GET /account/permissions

### Dependency updates in `dependencies.py`

**Modify `check_write_permission`** to use the new group-based system:
- Instead of looking up CohortPermission by user_id directly, resolve through groups
- Check `visible` first, then specific tool permission

**New `require_feature_permission(feature, level="read_write")`** factory:
- Returns a dependency that checks the feature permission for the student in the request path
- Raises 403 if insufficient

### Route enforcement

**List endpoints** (GET /students, GET /submissions): filter by visibility via `get_visible_student_ids`.

**Action endpoints**: wrapped with `require_feature_permission`:
- Grade routes: `require_feature_permission("grades")`
- Target/programme routes: `require_feature_permission("programme_choices")`
- Plan generation: `require_feature_permission("plan_generation")`
- Submission review: `require_feature_permission("submissions")`
- Cohort edit: `require_feature_permission("cohort_management")`

## Frontend Integration

### Permission hook: `usePermission.js`

```javascript
function usePermission(cohortId, feature) → "none" | "read_only" | "read_write"
```

Reads from cached `/account/permissions` response. Components call this to decide what to render.

### UI behavior per access level

| Permission | UI behavior |
|-----------|-------------|
| `none` | Tab/button/section hidden entirely |
| `read_only` | Visible but edit/save/delete buttons disabled, forms render as read-only text |
| `read_write` | Full access, all controls enabled |

### Where permission checks apply

- `StudentProfile` tabs: grades tab hidden if grades=none, edit disabled if read_only
- `ProgrammeChoicesTab`: "Add Programme" hidden if programme_choices != read_write
- Plan generation: "Generate Plan" hidden if plan_generation != read_write
- Submissions review: approve/reject hidden if submissions != read_write
- Cohort page: edit/delete hidden if cohort_management != read_write
- Student list: only shows students in visible cohorts

### Admin UI — `/admin/teacher-groups`

- List of groups with member count
- Click group → two panels:
  - **Members panel**: list of users with add/remove buttons, searchable user picker
  - **Permissions panel**: grid with rows=cohorts, columns=tools. Each cell is a dropdown (none/read_only/read_write). Visible toggle per-row. Save button bulk-updates all permissions.

## What We Skip (YAGNI)

- Per-student permission overrides (cohort-level sufficient)
- Permission inheritance/hierarchy (flat groups only)
- Audit log of permission changes
- Time-based permissions
- Custom tool definitions (fixed tool list, add new tools in code)
- Student-to-student visibility (students see own data only)

## Files to Modify/Create

### Backend

| File | Change |
|------|--------|
| `backend/app/db/models.py` | Add TeacherGroup, TeacherGroupMember. Modify CohortPermission (group_id, feature columns) |
| `backend/app/services/permission_service.py` | New: check_feature_permission, get_visible_student_ids, resolve_user_permissions |
| `backend/app/api/v1/routes/teacher_groups.py` | New: group CRUD, member mgmt, permission mgmt |
| `backend/app/api/v1/routes/account.py` | Add GET /account/permissions |
| `backend/app/core/dependencies.py` | Modify check_write_permission, add require_feature_permission |
| `backend/app/api/v1/routes/students.py` | Filter by visible cohorts |
| `backend/app/main.py` | Register teacher_groups router |
| `backend/tests/test_permissions.py` | New: permission resolution, visibility, merge logic tests |

### Frontend

| File | Change |
|------|--------|
| `apps/web/src/api/teacherGroups.js` | New: group + permission API client |
| `apps/web/src/hooks/usePermission.js` | New: permission resolution hook |
| `apps/web/src/pages/AdminTeacherGroups/AdminTeacherGroups.jsx` | New: group list + member management |
| `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx` | New: cohort x tool permission grid |
| `apps/web/src/App.jsx` | Add admin/teacher-groups route |
| Student/plan/submission pages | Add usePermission checks |
