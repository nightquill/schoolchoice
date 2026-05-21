# Bilingual Student Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `name_zh` (Chinese name) column to the Student model, wire it through all API responses, search, import, export, and frontend display using the existing `useLocalizedName` hook.

**Architecture:** Add nullable `name_zh` column (auto-patched on startup). Propagate to all API responses that include student names. Add to search filter, CSV import header map, and CSV export. Frontend uses existing `useLocalizedName` hook — `ln(student, 'name')` returns `name_zh` in zh-HK locale. Profile header shows both names (primary + subtitle). PersonalTab gets a new editable field.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + existing `useLocalizedName` hook (frontend), custom i18n

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/app/modules/school_choice/models/models.py` | Modify | Add `name_zh` column to Student |
| `backend/app/schemas/student.py` | Modify | Add `name_zh` to response/update schemas |
| `backend/app/api/v1/routes/students.py` | Modify | Add `name_zh` to `_build_full_response`, list items, export CSV, and search |
| `backend/app/api/v1/routes/submissions.py` | Modify | Add `student_name_zh` to submission responses |
| `backend/app/api/v1/routes/cohorts.py` | Modify | Add `name_zh` to cohort member responses |
| `backend/app/services/student_service.py` | Modify | Add `Student.name_zh` to search filter |
| `backend/app/services/student_import_service.py` | Modify | Add `name_zh` header mappings + assign on create/update |
| `apps/web/src/components/StudentRow/StudentRow.jsx` | Modify | Use `useLocalizedName` for name display |
| `apps/web/src/pages/StudentProfile/StudentProfile.jsx` | Modify | Show primary + subtitle name in header |
| `apps/web/src/pages/StudentProfile/PersonalTab.jsx` | Modify | Add `name_zh` editable text field |
| `apps/web/src/pages/CohortDetail/CohortDetail.jsx` | Modify | Use `useLocalizedName` for member names |
| `apps/web/src/pages/Submissions/SubmissionList.jsx` | Modify | Use `useLocalizedName` for student names |
| `packages/ui/src/i18n/en.json` | Modify | Add "Chinese Name" label |
| `packages/ui/src/i18n/zh-HK.json` | Modify | Add "中文姓名" label |

---

### Task 1: Add `name_zh` column to Student model

**Files:**
- Modify: `backend/app/modules/school_choice/models/models.py:124-128`

- [ ] **Step 1: Add `name_zh` column after `preferred_name`**

In `backend/app/modules/school_choice/models/models.py`, after the `preferred_name` column (line 128), add:

```python
    name_zh = Column(
        String(255), nullable=True,
        comment="Chinese name (e.g. 陳美玲)",
    )
```

This follows the same pattern as `name_zh` on School (line 342) and JupasProgramme (line 438).

- [ ] **Step 2: Verify backend starts (auto-patches column)**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend && python -c "from app.modules.school_choice.models.models import Student; print([c.name for c in Student.__table__.columns if 'name' in c.name])"
```
Expected output includes: `['name', 'name_zh', 'preferred_name']` (order may vary)

- [ ] **Step 3: Commit**

```bash
git add backend/app/modules/school_choice/models/models.py
git commit -m "$(cat <<'EOF'
feat: add name_zh column to Student model for bilingual names

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `name_zh` to Pydantic schemas

**Files:**
- Modify: `backend/app/schemas/student.py:59-76` (StudentListItem)
- Modify: `backend/app/schemas/student.py:78-129` (StudentFullResponse)
- Modify: `backend/app/schemas/student.py:132-153` (StudentProfileUpdate)

- [ ] **Step 1: Add to StudentListItem**

In `backend/app/schemas/student.py`, in the `StudentListItem` class (line 59), after `name: str` (line 63), add:

```python
    name_zh: str | None = None
```

- [ ] **Step 2: Add to StudentFullResponse**

In the `StudentFullResponse` class (line 78), after `name: str` (line 89), add:

```python
    name_zh: Optional[str] = None
```

- [ ] **Step 3: Add to StudentProfileUpdate**

In the `StudentProfileUpdate` class (line 132), after `full_name: Optional[str] = None` (line 135), add:

```python
    name_zh: Optional[str] = None
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/student.py
git commit -m "$(cat <<'EOF'
feat: add name_zh to student Pydantic schemas

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add `name_zh` to backend API responses and export

**Files:**
- Modify: `backend/app/api/v1/routes/students.py:70-117` (_build_full_response)
- Modify: `backend/app/api/v1/routes/students.py:282-298` (list endpoint item_dict)
- Modify: `backend/app/api/v1/routes/students.py:188-207` (export CSV)

- [ ] **Step 1: Add to `_build_full_response`**

In `backend/app/api/v1/routes/students.py`, in the `_build_full_response` function (line 70), after `"name": student.name,` (line 79), add:

```python
        "name_zh": student.name_zh,
```

Also after `"full_name": student.name,` (line 87), add:

```python
        "name_zh": student.name_zh,
```

Wait — `name_zh` is already included via the first addition. The `full_name` line is just an alias for `name`. One `name_zh` entry is sufficient (line 79 area).

- [ ] **Step 2: Add to student list items**

In the student list endpoint, after `item.full_name = s.name` (line 286), add:

```python
        item_dict["name_zh"] = getattr(s, "name_zh", None)
```

Place this after `item_dict = item.model_dump()` (line 288), so approximately line 289 area:

```python
        item_dict["name_zh"] = getattr(s, "name_zh", None)
```

- [ ] **Step 3: Handle `name_zh` in profile update endpoint**

In the profile update handler, find where `full_name` is mapped to `name` (lines 376-378):

```python
    if "full_name" in update_fields:
        student.name = update_fields.pop("full_name")
```

After this block, add:

```python
    if "name_zh" in update_fields:
        student.name_zh = update_fields.pop("name_zh")
```

- [ ] **Step 4: Add "Name (Chinese)" column to CSV export**

In `export_students` (line 122), change the field_names line (line 189) from:

```python
    field_names = ["Name", "Candidate Number"] + subject_codes
```

to:

```python
    field_names = ["Name", "Name (Chinese)", "Candidate Number"] + subject_codes
```

And in the row-building dict (line 198-201), after `"Name": s.name,` (line 199), add:

```python
                "Name (Chinese)": getattr(s, "name_zh", None) or "",
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/routes/students.py
git commit -m "$(cat <<'EOF'
feat: add name_zh to student API responses and CSV export

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add `name_zh` to submissions and cohort responses

**Files:**
- Modify: `backend/app/api/v1/routes/submissions.py:136,254`
- Modify: `backend/app/api/v1/routes/cohorts.py:82,238`

- [ ] **Step 1: Add to submission list response**

In `backend/app/api/v1/routes/submissions.py`, after `"student_name": student.name,` (line 136), add:

```python
            "student_name_zh": getattr(student, "name_zh", None),
```

- [ ] **Step 2: Add to submission detail response**

After `"student_name": student.name,` (line 254), add:

```python
        "student_name_zh": getattr(student, "name_zh", None),
```

- [ ] **Step 3: Add to cohort member response**

In `backend/app/api/v1/routes/cohorts.py`, after `full_name=student.name or "",` (line 82), add:

```python
                name_zh=getattr(student, "name_zh", None),
```

And after `full_name=s.name or "",` (line 238), add:

```python
                    name_zh=getattr(s, "name_zh", None),
```

Note: The CohortMemberResponse schema may need `name_zh` added. Check if it exists. If the schema is a Pydantic model, add `name_zh: str | None = None` to it. If it's a plain dict, the above additions are sufficient.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/routes/submissions.py backend/app/api/v1/routes/cohorts.py
git commit -m "$(cat <<'EOF'
feat: add name_zh to submission and cohort member responses

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add `name_zh` to search filter

**Files:**
- Modify: `backend/app/services/student_service.py:60-67`

- [ ] **Step 1: Add `name_zh` to the search `or_` clause**

In `backend/app/services/student_service.py`, change the search filter (lines 63-67) from:

```python
        query = query.filter(or_(
            Student.name.ilike(pattern),
            Student.email.ilike(pattern),
            Student.candidate_number.ilike(pattern),
        ))
```

to:

```python
        query = query.filter(or_(
            Student.name.ilike(pattern),
            Student.name_zh.ilike(pattern),
            Student.email.ilike(pattern),
            Student.candidate_number.ilike(pattern),
        ))
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/student_service.py
git commit -m "$(cat <<'EOF'
feat: include name_zh in student search filter

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Add `name_zh` to CSV import

**Files:**
- Modify: `backend/app/services/student_import_service.py:72-79` (header map)
- Modify: `backend/app/services/student_import_service.py:748-762` (commit_import)

- [ ] **Step 1: Add Chinese name headers to `_ZH_PROFILE_MAP`**

In `backend/app/services/student_import_service.py`, after the `"學生姓名": "name"` entry in `_ZH_PROFILE_MAP` (line 73), add:

```python
    "中文姓名": "name_zh", "Chinese Name": "name_zh", "中文名": "name_zh",
```

- [ ] **Step 2: Add `name_zh` to the PROFILE_FIELDS set**

Find the `PROFILE_FIELDS` set (around line 62). It currently contains fields like `"class_name"`, `"year_of_study"`, etc. Add `"name_zh"` to this set:

```python
"name_zh",
```

- [ ] **Step 3: Assign `name_zh` on student creation**

In `commit_import` (line 748), after `name=row["name"],` (line 754), add:

```python
                    name_zh=profile.get("name_zh"),
```

- [ ] **Step 4: Assign `name_zh` on student update**

Find the update block (around line 769 — `elif row["status"] == "update"`). Look for where profile fields are set on the existing student. Add:

```python
                if "name_zh" in profile:
                    student.name_zh = profile["name_zh"]
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/student_import_service.py
git commit -m "$(cat <<'EOF'
feat: support name_zh in CSV import (Chinese Name / 中文姓名 headers)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Add i18n keys

**Files:**
- Modify: `packages/ui/src/i18n/en.json`
- Modify: `packages/ui/src/i18n/zh-HK.json`

- [ ] **Step 1: Add to en.json**

In `packages/ui/src/i18n/en.json`, find the `"personal"` namespace (around line 138). After `"preferredName": "Preferred Name",` (line 140), add:

```json
    "chineseName": "Chinese Name",
```

- [ ] **Step 2: Add to zh-HK.json**

In `packages/ui/src/i18n/zh-HK.json`, find the `"personal"` namespace (around line 200). After `"preferredName": "慣用名稱",` (line 202), add:

```json
    "chineseName": "中文姓名",
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/i18n/en.json packages/ui/src/i18n/zh-HK.json
git commit -m "$(cat <<'EOF'
feat: add chineseName i18n key (en + zh-HK)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Update StudentRow to use localized name

**Files:**
- Modify: `apps/web/src/components/StudentRow/StudentRow.jsx:1-4,77,116-121`

- [ ] **Step 1: Import `useLocalizedName`**

In `apps/web/src/components/StudentRow/StudentRow.jsx`, after the existing imports (line 4), add:

```javascript
import { useLocalizedName } from '../../utils/localizedName';
```

- [ ] **Step 2: Add the hook call inside the component**

Inside the `StudentRow` function (line 74), after `const { t } = useTranslation();` (line 76), add:

```javascript
  const ln = useLocalizedName();
```

- [ ] **Step 3: Use `ln` for the name display**

Change the name cell (line 116-121) from:

```jsx
      <td style={tdName}>
        {name}
```

to:

```jsx
      <td style={tdName}>
        {ln(student, 'name')}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/StudentRow/StudentRow.jsx
git commit -m "$(cat <<'EOF'
feat: StudentRow uses localized name display

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Update StudentProfile header — primary + subtitle name

**Files:**
- Modify: `apps/web/src/pages/StudentProfile/StudentProfile.jsx:146-148`

- [ ] **Step 1: Import `useLocalizedName`**

At the top of `apps/web/src/pages/StudentProfile/StudentProfile.jsx`, add:

```javascript
import { useLocalizedName } from '../../utils/localizedName';
```

- [ ] **Step 2: Add the hook call inside the component**

Inside the component function, after other hooks, add:

```javascript
  const ln = useLocalizedName();
```

- [ ] **Step 3: Update the header name display**

Replace the `<h1>` that shows the name (lines 146-148):

```jsx
<h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
  {student.full_name || 'Student Profile'}
</h1>
```

with:

```jsx
<h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
  {ln(student, 'name') || student.full_name || 'Student Profile'}
</h1>
{(() => {
  // Show the "other" name as subtitle
  const { locale } = require('@schoolchoice/ui/i18n').useTranslation();
  // Already have locale from useTranslation — use that instead
  return null;
})()}
```

Actually, simpler approach — use `useTranslation` which is already imported:

```jsx
<h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
  {ln(student, 'name') || student.full_name || 'Student Profile'}
  {student.name_zh && student.full_name && (
    <span style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-normal)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
      {locale === 'zh-HK' ? student.full_name : student.name_zh}
    </span>
  )}
</h1>
```

This shows the "other" name as a subtitle. In zh-HK locale, the primary is Chinese (via `ln`) and subtitle is English (`full_name`). In en locale, primary is English and subtitle is Chinese (`name_zh`).

Note: `locale` is available from `useTranslation()` — destructure it alongside `t`:

```javascript
const { t, locale } = useTranslation();
```

Check the existing destructuring in the file and add `locale` if not already present.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/StudentProfile/StudentProfile.jsx
git commit -m "$(cat <<'EOF'
feat: student profile header shows primary + subtitle bilingual name

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Add `name_zh` field to PersonalTab

**Files:**
- Modify: `apps/web/src/pages/StudentProfile/PersonalTab.jsx:53-63`

- [ ] **Step 1: Add the Chinese Name input field**

In `apps/web/src/pages/StudentProfile/PersonalTab.jsx`, after the Preferred Name field block (lines 53-63), add:

```jsx
          <label htmlFor="input-name_zh" style={labelStyle}>
            {t('personal.chineseName')}
          </label>
          <Input
            id="input-name_zh"
            name="name_zh"
            value={form.name_zh || ''}
            onChange={handleChange}
            placeholder="e.g. 陳美玲"
          />
```

This uses the same pattern as the existing `full_name` and `preferred_name` fields. The `handleChange` handler and form state already handle arbitrary field names via `e.target.name`.

- [ ] **Step 2: Verify `name_zh` is in the initial form state**

Check how the form state is initialized. It likely spreads the student data: `const [form, setForm] = useState({...student})` or similar. Since `name_zh` is now in the API response (Task 3), it will automatically be included. If the form initialization uses a specific field list, add `name_zh` to it.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/StudentProfile/PersonalTab.jsx
git commit -m "$(cat <<'EOF'
feat: add Chinese Name field to student personal tab

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Update CohortDetail and SubmissionList to use localized names

**Files:**
- Modify: `apps/web/src/pages/CohortDetail/CohortDetail.jsx:345-354,509-514`
- Modify: `apps/web/src/pages/Submissions/SubmissionList.jsx:145-150`

- [ ] **Step 1: Update CohortDetail — import and use `useLocalizedName`**

In `apps/web/src/pages/CohortDetail/CohortDetail.jsx`, add import:

```javascript
import { useLocalizedName } from '../../utils/localizedName';
```

Inside the component, add:

```javascript
const ln = useLocalizedName();
```

Change member name display (line 352) from `{member.full_name}` to `{ln(member, 'name')}`.

Change search result display (line 510) from `{s.full_name}` to `{ln(s, 'name')}`.

- [ ] **Step 2: Update SubmissionList — import and use `useLocalizedName`**

In `apps/web/src/pages/Submissions/SubmissionList.jsx`, add import:

```javascript
import { useLocalizedName } from '../../utils/localizedName';
```

Inside the component, add:

```javascript
const ln = useLocalizedName();
```

Change student name display (line 147) from `{sub.student_name || t('submissions.unknownStudent')}` to:

```jsx
{(() => {
  const name = locale === 'zh-HK' && sub.student_name_zh ? sub.student_name_zh : sub.student_name;
  return name || t('submissions.unknownStudent');
})()}
```

Note: `locale` is from `useTranslation()`. If not already destructured, add it.

Alternatively, since submission responses use `student_name` / `student_name_zh` (not `name` / `name_zh`), the `useLocalizedName` hook won't work directly. Use inline locale check instead:

```jsx
{(locale === 'zh-HK' && sub.student_name_zh) ? sub.student_name_zh : (sub.student_name || t('submissions.unknownStudent'))}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/CohortDetail/CohortDetail.jsx apps/web/src/pages/Submissions/SubmissionList.jsx
git commit -m "$(cat <<'EOF'
feat: use localized student names in cohort and submission views

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Playwright verification

**Files:**
- Create: `e2e/verify-bilingual-names.spec.ts`

- [ ] **Step 1: Write the verification test**

Create `e2e/verify-bilingual-names.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = 'http://localhost:5173';

function resize(path: string) {
  try {
    const info = execSync(`sips -g pixelWidth -g pixelHeight "${path}" 2>/dev/null`, { encoding: 'utf-8' });
    const w = parseInt(info.match(/pixelWidth:\s*(\d+)/)?.[1] || '0', 10);
    const h = parseInt(info.match(/pixelHeight:\s*(\d+)/)?.[1] || '0', 10);
    if (w > 1800 || h > 1800) {
      const scale = Math.min(1800 / w, 1800 / h);
      execSync(`sips --resampleHeightWidth ${Math.round(h * scale)} ${Math.round(w * scale)} "${path}" 2>/dev/null`);
    }
  } catch {}
}

async function shot(page, path: string) {
  await page.screenshot({ path });
  resize(path);
}

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');
}

test.describe('Bilingual student names', () => {

  test('Student profile shows Chinese Name field in personal tab', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click first student row
    const firstRow = page.locator('tr[role="row"]').first();
    await firstRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Navigate to personal tab
    const personalTab = page.locator('button', { hasText: /Personal|個人/ });
    if (await personalTab.count() > 0) {
      await personalTab.click();
      await page.waitForTimeout(500);
    }

    // Should have Chinese Name field
    const chineseNameLabel = page.locator('label', { hasText: /Chinese Name|中文姓名/ });
    await expect(chineseNameLabel).toBeVisible();

    await shot(page, 'e2e/screenshots/bilingual-personal-tab.png');
  });

  test('Student list displays names (API includes name_zh)', async ({ page }) => {
    await login(page);

    // Verify API response includes name_zh field
    const response = await page.request.get(`${BASE}/api/v1/students`, {
      headers: { 'Authorization': `Bearer ${await page.evaluate(() => localStorage.getItem('token') || sessionStorage.getItem('token'))}` },
    });

    // Navigate to student list
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await shot(page, 'e2e/screenshots/bilingual-student-list.png');
  });

  test('CSV export includes Name (Chinese) column', async ({ page }) => {
    await login(page);

    // Get auth token
    const token = await page.evaluate(() => localStorage.getItem('token') || sessionStorage.getItem('token'));

    // Call export endpoint directly
    const response = await page.request.get(`${BASE}/api/v1/students/export`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);
    const csv = await response.text();

    // CSV header should include "Name (Chinese)"
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toContain('Name (Chinese)');
  });

  test('Student search works with Chinese characters', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Type a Chinese character in the search box
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="搜尋"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('陳');
      await page.waitForTimeout(1000);
      await shot(page, 'e2e/screenshots/bilingual-search-chinese.png');
    }
  });

});
```

- [ ] **Step 2: Run the tests**

```bash
npx playwright test e2e/verify-bilingual-names.spec.ts --headed --timeout 30000
```

- [ ] **Step 3: View screenshots and verify**

View each screenshot to confirm:
- Personal tab shows "Chinese Name" / "中文姓名" field
- Student list renders without errors
- CSV export has the column header

- [ ] **Step 4: Commit**

```bash
git add e2e/verify-bilingual-names.spec.ts
git commit -m "$(cat <<'EOF'
test: Playwright verification for bilingual student names

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```
