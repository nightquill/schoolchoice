# Import & Account Assignment Permissions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `data_import` and `account_assignment` permission tools to the cohort-based permission system. Harden import and invite endpoints with per-student cohort permission checks. Import always creates unaccounted students.

**Architecture:** Extend existing CohortPermission with 2 new columns. Update TOOL_FIELDS and ROLE_DEFAULTS. Add permission checks to import preview/commit and invite endpoints. Auto-create cohort on import when no cohort column. Frontend adds 2 new tools to the permission grid.

**Tech Stack:** Python/FastAPI, SQLAlchemy, React

**Spec:** `docs/superpowers/specs/2026-05-18-import-account-permissions-design.md`

---

## File Structure

| File | Role |
|------|------|
| `backend/app/db/models.py` | Modify: add data_import + account_assignment columns to CohortPermission |
| `backend/app/services/permission_service.py` | Modify: update TOOL_FIELDS + ROLE_DEFAULTS |
| `backend/app/api/v1/routes/student_import.py` | Modify: add permission checks to preview + commit, auto-create cohort |
| `backend/app/api/v1/routes/invite.py` | Modify: replace require_role("admin") with permission checks |
| `backend/tests/test_permissions.py` | Modify: update tests for new tools |
| `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx` | Modify: add 2 new tools to TOOLS array |
| `packages/ui/src/i18n/en.json` | Modify: add translation keys |
| `packages/ui/src/i18n/zh-HK.json` | Modify: add translation keys |

---

### Task 1: Add data_import and account_assignment columns + update permission service

**Files:**
- Modify: `backend/app/db/models.py`
- Modify: `backend/app/services/permission_service.py`
- Modify: `backend/tests/test_permissions.py`

- [ ] **Step 1: Add columns to CohortPermission model**

In `backend/app/db/models.py`, find the `CohortPermission` class. After the `cohort_management` column, add:

```python
    data_import = Column(String(10), nullable=False, default="none", server_default="'none'")
    account_assignment = Column(String(10), nullable=False, default="none", server_default="'none'")
```

- [ ] **Step 2: Add columns to DB**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -c "
from app.db.session import engine
from sqlalchemy import text, inspect
insp = inspect(engine)
cols = [c['name'] for c in insp.get_columns('cohort_permissions')]
with engine.connect() as conn:
    if 'data_import' not in cols:
        conn.execute(text(\"ALTER TABLE cohort_permissions ADD COLUMN data_import VARCHAR(10) NOT NULL DEFAULT 'none'\"))
        print('Added data_import')
    if 'account_assignment' not in cols:
        conn.execute(text(\"ALTER TABLE cohort_permissions ADD COLUMN account_assignment VARCHAR(10) NOT NULL DEFAULT 'none'\"))
        print('Added account_assignment')
    conn.commit()
print('Done')
"
```

- [ ] **Step 3: Update TOOL_FIELDS in permission_service.py**

In `backend/app/services/permission_service.py`, replace the TOOL_FIELDS tuple:

```python
TOOL_FIELDS = (
    "programme_choices",
    "grades",
    "plan_generation",
    "submissions",
    "reports",
    "cohort_management",
    "data_import",
    "account_assignment",
)
```

- [ ] **Step 4: Update ROLE_DEFAULTS**

Replace the ROLE_DEFAULTS dict. Key change: counsellor and student get `none` for `data_import` and `account_assignment`. Admin gets `read_write` for all (already handled by the `**{f: "read_write" for f in TOOL_FIELDS}` pattern).

```python
ROLE_DEFAULTS: dict[str, dict] = {
    "admin": {"visible": True, **{f: "read_write" for f in TOOL_FIELDS}},
    "counsellor": {
        "visible": True,
        "programme_choices": "read_write",
        "grades": "read_write",
        "plan_generation": "read_write",
        "submissions": "read_write",
        "reports": "read_only",
        "cohort_management": "none",
        "data_import": "none",
        "account_assignment": "none",
    },
    "student": {
        "visible": True,
        "programme_choices": "read_only",
        "grades": "read_only",
        "plan_generation": "none",
        "submissions": "read_write",
        "reports": "none",
        "cohort_management": "none",
        "data_import": "none",
        "account_assignment": "none",
    },
}
```

- [ ] **Step 5: Update tests**

In `backend/tests/test_permissions.py`, update `TestRoleDefaults`:

```python
class TestRoleDefaults:
    def test_admin_all_readwrite(self):
        d = ROLE_DEFAULTS["admin"]
        assert d["visible"] is True
        for f in TOOL_FIELDS:
            assert d[f] == "read_write"

    def test_counsellor_no_elevated(self):
        d = ROLE_DEFAULTS["counsellor"]
        assert d["visible"] is True
        assert d["grades"] == "read_write"
        assert d["cohort_management"] == "none"
        assert d["data_import"] == "none"
        assert d["account_assignment"] == "none"

    def test_student_no_elevated(self):
        d = ROLE_DEFAULTS["student"]
        assert d["grades"] == "read_only"
        assert d["plan_generation"] == "none"
        assert d["data_import"] == "none"
        assert d["account_assignment"] == "none"

    def test_tool_fields_count(self):
        assert len(TOOL_FIELDS) == 8
        assert "data_import" in TOOL_FIELDS
        assert "account_assignment" in TOOL_FIELDS
```

- [ ] **Step 6: Run tests**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -m pytest tests/test_permissions.py -v
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/db/models.py backend/app/services/permission_service.py backend/tests/test_permissions.py
git commit -m "feat: add data_import and account_assignment permission tools"
```

---

### Task 2: Add permission checks to import endpoints + auto-create cohort

**Files:**
- Modify: `backend/app/api/v1/routes/student_import.py`
- Modify: `backend/app/services/student_import_service.py`

- [ ] **Step 1: Add permission helper to student_import.py**

In `backend/app/api/v1/routes/student_import.py`, add after the existing imports:

```python
from app.services.permission_service import check_feature_permission, _get_user_group_ids, TOOL_FIELDS
from app.db.models_v2 import StudentCohort, CohortMembership
from app.db.models import CohortPermission, TeacherGroupMember
```

Add a helper function:

```python
def _check_import_permission(user: User, db: Session, level: str = "read_write") -> None:
    """Check user has data_import permission on at least one cohort. Raises 403 if not."""
    if user.role == "admin":
        return  # Admin always allowed

    from app.services.permission_service import _get_user_group_ids, _get_cohort_permissions_for_groups, merge_permissions
    group_ids = _get_user_group_ids(user.id, db)
    if not group_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have data import permission. Ask an admin to grant it via teacher group settings.",
        )

    # Check if any cohort has data_import at the required level
    org_id = getattr(user, "active_organisation_id", None)
    cohorts = db.query(StudentCohort).filter(StudentCohort.organisation_id == org_id).all() if org_id else []

    rank = {"none": 0, "read_only": 1, "read_write": 2}
    required_rank = rank.get(level, 2)

    for c in cohorts:
        perms = _get_cohort_permissions_for_groups(group_ids, c.id, db)
        if perms:
            merged = merge_permissions(perms)
            if rank.get(merged.get("data_import", "none"), 0) >= required_rank:
                return  # Found at least one cohort with sufficient permission

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have data import permission on any cohort.",
    )
```

- [ ] **Step 2: Add permission checks to preview and commit endpoints**

In the `preview_import` function, add after `content = await _read_and_validate_file(file)`:

```python
    _check_import_permission(current_user, db, level="read_only")
```

In the `commit_student_import` function, add after `content = await _read_and_validate_file(file)`:

```python
    _check_import_permission(current_user, db, level="read_write")
```

- [ ] **Step 3: Add auto-create cohort in commit_import service**

In `backend/app/services/student_import_service.py`, in the `commit_import` function, add cohort auto-creation logic at the beginning (after the subject lookup, before the row loop):

```python
    # Auto-create import cohort if no cohort column in CSV
    has_cohort_column = any(r.get("profile", {}).get("cohort") for r in rows if r["status"] != "error")
    auto_cohort = None
    if not has_cohort_column:
        from datetime import datetime, timezone
        from app.db.models_v2 import StudentCohort
        auto_name = f"Import {datetime.now(timezone.utc).strftime('%Y-%m-%d')} by {user_id}"
        auto_cohort = StudentCohort(
            user_id=user_id,
            organisation_id=org_id,
            name=auto_name,
            description="Auto-created from CSV import",
        )
        db.add(auto_cohort)
        db.flush()
```

Then at the end of the create/update block for each student (after `created += 1` and `updated += 1`), add cohort membership for the auto-cohort:

```python
            # Auto-assign to import cohort if no cohort column
            if auto_cohort and not row.get("profile", {}).get("cohort"):
                from app.db.models_v2 import CohortMembership
                existing_cm = db.query(CohortMembership).filter(
                    CohortMembership.cohort_id == auto_cohort.id,
                    CohortMembership.student_id == student.id,
                ).first()
                if not existing_cm:
                    db.add(CohortMembership(cohort_id=auto_cohort.id, student_id=student.id))
```

- [ ] **Step 4: Auto-grant import cohort visibility to importer's groups**

After creating the auto_cohort (still in commit_import), grant visibility to the importer's groups:

```python
    if auto_cohort:
        from app.db.models import CohortPermission, TeacherGroupMember
        user_group_ids = [
            m.group_id for m in db.query(TeacherGroupMember).filter(
                TeacherGroupMember.user_id == user_id
            ).all()
        ]
        for gid in user_group_ids:
            perm = CohortPermission(
                group_id=gid,
                cohort_id=auto_cohort.id,
                visible=True,
                data_import="read_write",
                account_assignment="read_write",
            )
            db.add(perm)
        db.flush()
```

- [ ] **Step 5: Verify backend starts**

```bash
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -c "from app.main import app; print('OK')"
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/routes/student_import.py backend/app/services/student_import_service.py
git commit -m "feat: add data_import permission checks and auto-create import cohort"
```

---

### Task 3: Replace require_role("admin") on invite endpoints with permission checks

**Files:**
- Modify: `backend/app/api/v1/routes/invite.py`

- [ ] **Step 1: Add permission check helper**

In `backend/app/api/v1/routes/invite.py`, add after imports:

```python
from app.db.models_v2 import CohortMembership
from app.services.permission_service import check_feature_permission
```

Add helper:

```python
def _check_account_assignment(user: User, db: Session, student_id: str) -> None:
    """Check user has account_assignment=read_write for this student's cohort(s).
    Admin always allowed. Raises 403 if insufficient.
    """
    if user.role == "admin":
        return
    from uuid import UUID
    perm = check_feature_permission(user, db, student_id=UUID(student_id), feature="account_assignment")
    if perm != "read_write":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to assign accounts for this student.",
        )
```

- [ ] **Step 2: Update bulk_invite_students**

Change the dependency from `require_role("admin")` to `get_current_user`:

```python
@router.post("/admin/students/invite")
def bulk_invite_students(
    payload: InviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```

Inside the loop, add permission check per student (after finding the student, before generating token):

```python
        # Permission check
        try:
            _check_account_assignment(current_user, db, sid)
        except HTTPException:
            errors.append({"student_id": sid, "error": "No account assignment permission for this student"})
            continue
```

- [ ] **Step 3: Update single_invite_student**

Change dependency from `require_role("admin")` to `get_current_user`:

```python
@router.post("/admin/students/{student_id}/invite")
def single_invite_student(
    student_id: str,
    payload: SingleInviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```

Add after finding the student:

```python
    _check_account_assignment(current_user, db, student_id)
```

- [ ] **Step 4: Update reinvite_student**

Same pattern — change `require_role("admin")` to `get_current_user`, add `_check_account_assignment`:

```python
@router.post("/admin/students/{student_id}/reinvite")
def reinvite_student(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ...
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    _check_account_assignment(current_user, db, student_id)
    ...
```

- [ ] **Step 5: Add email validation**

In the `single_invite_student` function, after setting the email, validate format:

```python
    if student.email:
        import re
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', student.email):
            raise HTTPException(status_code=400, detail="Invalid email format")
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/routes/invite.py
git commit -m "feat: replace admin-only invite with permission-based account_assignment checks"
```

---

### Task 4: Frontend — add new tools to permission grid + i18n

**Files:**
- Modify: `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx`
- Modify: `packages/ui/src/i18n/en.json`
- Modify: `packages/ui/src/i18n/zh-HK.json`

- [ ] **Step 1: Add i18n keys**

In `packages/ui/src/i18n/en.json`, in the `groupPermissions` section, add:

```json
"dataImport": "Data Import",
"accountAssign": "Account Assign"
```

In `packages/ui/src/i18n/zh-HK.json`, in the `groupPermissions` section, add:

```json
"dataImport": "數據匯入",
"accountAssign": "帳戶指派"
```

- [ ] **Step 2: Add tools to GroupPermissions TOOLS array**

In `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx`, find the TOOLS array inside the component and add 2 new entries after `cohort_management`:

```javascript
  const TOOLS = [
    { key: 'programme_choices', label: t('groupPermissions.programmes') },
    { key: 'grades', label: t('groupPermissions.grades') },
    { key: 'plan_generation', label: t('groupPermissions.plans') },
    { key: 'submissions', label: t('groupPermissions.submissions') },
    { key: 'reports', label: t('groupPermissions.reports') },
    { key: 'cohort_management', label: t('groupPermissions.cohortMgmt') },
    { key: 'data_import', label: t('groupPermissions.dataImport') },
    { key: 'account_assignment', label: t('groupPermissions.accountAssign') },
  ];
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx packages/ui/src/i18n/en.json packages/ui/src/i18n/zh-HK.json
git commit -m "feat: add data import and account assignment to permission grid UI"
```

---

### Task 5: E2E verification

**Files:** None (verification only)

- [ ] **Step 1: Restart backend**

```bash
kill $(lsof -ti:8000) 2>/dev/null; sleep 1
cd /Users/bsg/Downloads/schoolchoice/backend
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 3
```

- [ ] **Step 2: Test that teacher without permission is blocked from import**

```bash
TOKEN=$(curl -sf -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"demo@school.hk","password":"demo12345"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Teacher tries to preview import — should be 403
echo "=== Teacher import without permission ==="
echo "name\nTest" | curl -sf -X POST http://localhost:8000/api/v1/import/students/preview \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@data/sample-students.csv" 2>&1 | python3 -c "import sys; print(sys.stdin.read()[:200])"
```

Expected: 403 with "do not have data import permission"

- [ ] **Step 3: Test that admin can still import**

```bash
ADMIN_TOKEN=$(curl -sf -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"verify@test.com","password":"verify123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "=== Admin import ==="
curl -sf -X POST http://localhost:8000/api/v1/import/students/preview \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@data/sample-students.csv" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK: {d[\"summary\"][\"total\"]} rows')"
```

Expected: Succeeds with row count

- [ ] **Step 4: Test permission grid returns new tools**

```bash
# Create group, get permissions
GRP=$(curl -sf -X POST http://localhost:8000/api/v1/admin/teacher-groups -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"name":"Perm Test"}')
GRP_ID=$(echo "$GRP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

curl -sf "http://localhost:8000/api/v1/admin/teacher-groups/$GRP_ID/permissions" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "
import sys,json; d=json.load(sys.stdin)
p = d['permissions'][0] if d['permissions'] else {}
print(f'data_import: {p.get(\"data_import\", \"MISSING\")}')
print(f'account_assignment: {p.get(\"account_assignment\", \"MISSING\")}')"

# Cleanup
curl -sf -X DELETE "http://localhost:8000/api/v1/admin/teacher-groups/$GRP_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
```

Expected: Both show "read_write" (default for new cohort permissions)

- [ ] **Step 5: Test teacher invite without permission is blocked**

```bash
echo "=== Teacher invite without permission ==="
# Get an unaccounted student
STUDENT_ID=$(curl -sf "http://localhost:8000/api/v1/students?unaccounted=true&limit=1" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; print(items[0]['id'] if items else 'NONE')")

curl -s -X POST "http://localhost:8000/api/v1/admin/students/$STUDENT_ID/invite" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"test-blocked@school.hk"}' 2>&1 | python3 -c "import sys; print(sys.stdin.read()[:200])"
```

Expected: 403 with "do not have permission to assign accounts"

- [ ] **Step 6: Run all tests**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -m pytest tests/test_permissions.py tests/test_invite_service.py tests/test_student_import.py --tb=short -q
```

Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: complete import & account assignment permissions — E2E verified"
```
