<!-- spec-tracks: apps/web/src/pages/Submissions/SubmissionList.jsx, apps/web/src/pages/Submissions/SubmissionDetail.jsx, apps/web/src/pages/Analytics/SubmissionsAnalytics.jsx, apps/web/src/api/submissions.js, apps/web/src/api/analytics.js, backend/app/api/v1/routes/submissions.py -->

# Submissions Specification

Submissions are JUPAS programme choice lists submitted by students for counsellor review. A submission contains up to 20 ranked programme choices organized into bands A through E.

---

## Page: Submission List (`/submissions`)

### Elements

#### NavBar
- `<NavBarV2 account={account} />` — standard navigation bar

#### Page Title
- `<h1>` "Submission History" — XL size, bold, primary text color

#### Submission History Chart Section
- **Summary stats line** — "Total: N submitted, N approved"
  - Visible when `historyQuery.data` is loaded
  - Font: SM, secondary color, tabular-nums
- **Granularity toggle** — segmented button group with 3 options:
  - `daily` / `weekly` / `monthly`
  - Active button: surface background, primary color, shadow
  - Inactive button: transparent background, secondary color
  - Each button has `aria-pressed` attribute
  - Container: background border, rounded, 2px padding
- **Line chart** (Recharts `<LineChart>`) — 280px height, surface background, rounded border
  - `<CartesianGrid>` — dashed, border color
  - `<XAxis>` — date labels
    - Monthly: "MMM" format
    - Daily/Weekly: "MMM D" format
    - 12px font, tabular-nums
  - `<YAxis>` — integer scale, 12px font, tabular-nums
  - `<Tooltip>` — full date format, 13px font, rounded
  - `<Legend>` — auto
  - **Total line** — primary color, 2px stroke, 3px dots, label "Total Submissions"
  - **Approved line** — success color, 2px stroke, 3px dots, label "Approved Submissions"
  - Visible only when `chartData.length > 0`

#### Pending Submissions Heading
- `<h2>` "Pending Submissions (N)" — LG size, bold
  - Count shown only when loaded and no error

#### Loading State
- `<LoadingSpinner label="Loading submissions..." />`

#### Error State
- `<ErrorMessage message={error} />`

#### Empty State
- `<EmptyState message="No programme choices have been submitted yet." />`

#### Submissions Table (visible when `submissions.length > 0`)
- Wrapper: `overflowX: auto` for mobile
- `<table>` with `aria-label="Pending Submissions"`
- **Table styles**: full width, collapsed borders, surface background, rounded border

##### Table Columns

| Column | Header | Content |
|---|---|---|
| Name | "Name" | `sub.student_name` or "Unknown Student" |
| Class | "Class" | `sub.class_name` or "-" |
| Choices | "Choices" | `sub.choice_count` or `sub.choices.length` or "-", tabular-nums |
| Submitted | "Submitted" | `new Date(sub.submitted_at).toLocaleDateString()` or "-" |
| Actions | "Actions" | `<Link>` "Review" → `/submissions/:id`, primary color, medium weight |

##### Table Styling
- Header: SM font, medium weight, secondary color, background color, border-bottom
- Body cells: SM font, primary color, border-bottom
- Row key: `sub.id`

### Data Flow

#### Queries (React Query)
1. `getAccount()` — key: `['account']`
2. `getSubmissions()` — key: `['submissions']`
   - `GET /api/v1/submissions`
   - Response: `{ submissions: [...], total: N }`
   - Only returns `status: "pending"` submissions
3. `getSubmissionHistory({ granularity, days: 90 })` — key: `['analytics', 'submission-history', granularity]`
   - `GET /api/v1/analytics/submission-history?granularity=daily&days=90`
   - Response: `{ data: [{ date, total, approved }], total_submissions, total_approved }`

#### Submission List Item Shape
```json
{
  "id": "uuid",
  "student_id": "uuid",
  "student_name": "Chan Tai Man",
  "class_name": "6A",
  "status": "pending",
  "choice_count": 15,
  "submitted_at": "2025-01-15T10:30:00Z"
}
```

### Key Behaviors

- Only pending submissions are listed (backend filters `status == "pending"`)
- Organisation isolation: backend filters by `student.organisation_id` matching user's active org
- Granularity change triggers new analytics query (daily/weekly/monthly)
- Chart data covers 90-day window

---

## Page: Submission Detail (`/submissions/:id`)

### Elements

#### NavBar
- `<NavBarV2 account={account} />` — standard navigation bar

#### Back Link
- `<Link>` — "Back to Submissions" → `/submissions`
  - Primary color, no underline, SM font, block display, bottom margin

#### Loading State
- `<LoadingSpinner label="Loading submission..." />`

#### Error State
- `<ErrorMessage message={error} />`

#### Header Section
- **Student name** — `<h1>` XL bold, primary color, `textWrap: balance`
- **Status badge** — inline pill:
  - `pending`: yellow background (#fef3c7), brown text (#92400e)
  - `approved`: green background (#d1fae5), green text (#065f46)
  - `revision_requested`: red background (#fee2e2), red text (#991b1b)
  - `rejected`: red background (#fee2e2), red text (#991b1b)
  - Capitalized text, XS font, medium weight
- **Flagged count badge** — (visible when `isPending && flaggedCount > 0`)
  - Yellow background, brown text, rounded pill
  - "N flagged"
- **Subtitle line** — SM font, secondary color:
  - Class name (if present)
  - Separator "·"
  - "Submitted {date}"
  - Separator "·"
  - "N choices"

#### Counsellor Notes Banner
- Visible when `submission.counsellor_notes` exists AND `status !== 'pending'`
- Yellow background (#fef3c7), amber border (#fde68a), rounded
- Bold "Counsellor Notes:" label + notes text

#### 20-Slot Banded JUPAS Table
- Surface background, rounded border, overflow hidden
- `<table>` full width, collapsed borders

##### JUPAS Band Definitions

| Band | Slots | Background | Border | Text Color | Tooltip |
|---|---|---|---|---|---|
| A | 1, 2, 3 | #fff1f2 | #fecdd3 | #be123c | "Top Picks" |
| B | 4, 5, 6 | #fef9c3 | #fde68a | #a16207 | "Strong Interest" |
| C | 7, 8, 9, 10 | #d1fae5 | #a7f3d0 | #047857 | "Interested/Reasonable" |
| D | 11, 12, 13, 14 | #dbeafe | #bfdbfe | #1d4ed8 | "Backup Choices" |
| E | 15, 16, 17, 18, 19, 20 | #f1f5f9 | #e2e8f0 | #475569 | "Safety Net" |

##### Table Columns

| Column | Width | Header | Content |
|---|---|---|---|
| Rank | 50px | "Rank" | Slot number (1-20), bold, center-aligned |
| Band | 40px | "Band" | Letter (A-E), `rowSpan` per band, bold, large font, band colors, 3px right border |
| JUPAS Code | 80px | "JUPAS Code" | Monospace badge (#f1f5f9 bg), XS bold font |
| Programme Name | auto | "Programme Name" | Programme name (medium weight) + optional: AT RISK badge, notes, saved flag notes, inline flag input |
| Match % | 80px | "Match %" | Percentage, color-coded: green ≥70%, amber ≥40%, red <40%. Bold, tabular-nums |
| Risk | 70px | "Risk" | "AT RISK" badge (red bg, XS font) for `at_risk` level |
| Flag | 50px | "Flag" (only when `isPending`) | Flag toggle button |

##### Row Styling
- **Flagged row**: yellow background (#fef3c7)
- **Previously flagged row**: light orange background (#fff7ed)
- **Filled slot**: surface background
- **Empty slot**: band background at 40% opacity

##### Programme Name Cell Details
- **Programme name** — medium weight, primary color
- **AT RISK badge** — (inline, below name) red background (#dc2626), white text, 10px font, 700 weight, 6px border-radius
- **Notes** — XS font, secondary color, 2px top margin
- **Saved flag note** — (for `revision_requested` status) XS font, red (#dc2626), italic, "⚑ {note}"
- **Inline flag note input** — (visible when slot is flagged)
  - `<input>` with `aria-label="Flag note for choice N"`
  - Amber border, cream background (#fffbeb), XS font
  - Placeholder: configurable via i18n

##### Flag Toggle Button (per row, only for pending + filled slots)
- `<button>` with `<Flag size={12}>` icon
- **Flagged state**: amber background (#f59e0b), amber border, white icon
- **Unflagged state**: transparent background, border color, secondary icon
- `aria-label`: "Remove flag" / "Flag as questionable"

#### Action Buttons Row (visible only when `isPending`)
- Flex row with gap, wrapping

##### Approve Button
- `<Button>` "Approve" / "Processing..."
- Green background (#16a34a), white text
- **Disabled when**: `actionLoading || flaggedCount > 0 || !canEditSubmissions`
- Gray background (#9ca3af) when flags present or no permission
- 50% opacity + not-allowed cursor when no permission
- `title` tooltip explains permission requirement

##### Send Back for Revision Button
- `<Button variant="outline">`
- Label: "Send Back ({N} flagged)" when flags present, or "Send Back for Revision"
- Disabled when: `actionLoading || !canEditSubmissions`
- Opens revision modal

##### Reject Button
- `<Button variant="outline">`
- Red text (#dc2626), red border
- Disabled when: `actionLoading || !canEditSubmissions`
- Opens reject modal

##### Flag Hint Text
- Visible when `flaggedCount > 0`
- "Clear flags to approve" — XS font, secondary color

#### Revision Modal (`<Modal>`)
- Title: "Send Back for Revision"
- Close resets `notes` to empty string

##### Flagged Choices Summary (visible when `flaggedCount > 0`)
- Yellow background box
- Bold header: "N choice(s) flagged:"
- `<ul>` listing each flagged choice: "Rank N: {programme_name} — {note}"

##### Notes Textarea
- `<label htmlFor="revise-notes">` — "Additional notes" (when flags) or "Notes (required)" (no flags)
- `<textarea id="revise-notes" rows={4}>`
  - Full width, border, rounded, SM font, vertical resize
  - Placeholder: configurable via i18n

##### Confirm Button
- Label: "Send Revision"
- Calls `handleRevise()` — requires notes OR flags

#### Reject Modal (`<Modal>`)
- Title: "Reject Submission"
- Close resets `reason` to empty string

##### Reason Textarea
- `<label htmlFor="reject-reason">` — "Reason (required)"
- `<textarea id="reject-reason" rows={4}>`
  - Full width, border, rounded, SM font, vertical resize
  - Placeholder: configurable via i18n

##### Confirm Button
- Label: "Reject"
- `confirmVariant="danger"`
- Calls `handleReject()` — requires non-empty reason

### Data Flow

#### Queries (React Query)
1. `getAccount()` — key: `['account']`
2. `getSubmission(id)` — key: `['submission', id]`
   - `GET /api/v1/submissions/:id`

#### Submission Detail Response Shape
```json
{
  "id": "uuid",
  "student_id": "uuid",
  "student_name": "Chan Tai Man",
  "class_name": "6A",
  "status": "pending",
  "choices": [
    {
      "rank": 1,
      "band": "A",
      "jupas_code": "JS1001",
      "programme_name": "Bachelor of Medicine",
      "match_score": 0.72,
      "risk_level": "at_risk",
      "notes": "Student notes"
    }
  ],
  "counsellor_notes": "Please revise choice 3",
  "flagged_choices": [
    { "rank": 3, "note": "Unlikely to meet requirements" }
  ],
  "submitted_at": "2025-01-15T10:30:00Z"
}
```

#### Backend Detail Computation
- For each choice in `choices` array:
  1. Look up `JupasProgramme` by `jupas_code`
  2. If found + student has grades: run `score_student_for_programme()`
     - Returns `{ admission_probability, risk_level, eligible, ... }`
  3. Map rank to band via `_rank_to_band()`
  4. Populate `match_score` and `risk_level` from scorer result

#### Approve Action
- `POST /api/v1/submissions/:id/approve`
- Request: empty body
- Response: `{ status: "approved", targets_created: N }`

**Backend side effects:**
1. For each choice in submission:
   - Look up `JupasProgramme` by jupas_code
   - Run JUPAS scoring for match_score, eligibility, at_risk
   - Derive band and confidence from rank
   - Upsert `StudentSchoolTarget` row (by student_id + jupas_code)
     - Fields: school_id, student_rank, programme_name, preference_confidence, intended_majors, match_score, eligibility_pass, at_risk, status="CONSIDERING"
2. Set submission status to `approved`
3. Set `reviewed_at` and `reviewed_by`
- Only works on `pending` submissions (400 otherwise)

#### Band Confidence Mapping (backend)

| Band | Confidence Score |
|---|---|
| A (rank 1-3) | 5 |
| B (rank 4-6) | 4 |
| C (rank 7-10) | 3 |
| D (rank 11-14) | 2 |
| E (rank 15-25) | 1 |

#### Revise Action
- `POST /api/v1/submissions/:id/revise`
- Request: `{ notes: "...", flagged_choices: [{ rank: 3, note: "..." }] }`
- Response: `{ status: "revision_requested" }`

**Backend side effects:**
1. Set status to `revision_requested`
2. Store `counsellor_notes`
3. Store `flagged_choices` array (serialized from Pydantic models)
4. Set `reviewed_at` and `reviewed_by`
- Only works on `pending` submissions (400 otherwise)

#### Reject Action
- `POST /api/v1/submissions/:id/reject`
- Request: `{ reason: "..." }`
- Response: `{ status: "rejected" }`

**Backend side effects:**
1. Set status to `rejected`
2. Store reason as `counsellor_notes`
3. Set `reviewed_at` and `reviewed_by`
- Only works on `pending` submissions (400 otherwise)

### Key Behaviors

- **Permission check**: Uses `useFeatureAccess('submissions')` hook — `canEdit` controls all action buttons. Without permission: 50% opacity, not-allowed cursor, tooltip.
- **Flag-approve interlock**: Approve button is disabled when ANY choice is flagged. User must clear flags or use "Send Back" instead.
- **Flag toggle**: Click flag button to toggle. First click adds flag (empty note). Second click removes flag entirely.
- **Flag note inline editing**: When flagged, a text input appears below programme name for optional note.
- **Previously flagged display**: If submission was previously sent back with flags (`flagged_choices`), those are shown as italic red text with ⚑ icon (read-only).
- **Navigation after action**: All three actions (approve/revise/reject) navigate to `/submissions` on success.
- **Toast feedback**: Success/failure toasts for all actions.
- **Revision without notes**: If flags exist, notes are optional (auto-generated: "N choice(s) flagged for review."). If no flags, notes are required.
- **Status guard**: Backend rejects approve/revise/reject on non-pending submissions (HTTP 400).

---

## Page: Student Submissions (student-facing)

Referenced in other routes but not a separate page file in this codebase. Students see their submissions via the student profile.

---

## API Endpoint Summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/submissions` | List pending submissions (org-scoped) |
| GET | `/api/v1/submissions/:id` | Submission detail with match scores |
| POST | `/api/v1/submissions/:id/approve` | Approve + create targets |
| POST | `/api/v1/submissions/:id/revise` | Send back with notes + flags |
| POST | `/api/v1/submissions/:id/reject` | Reject with reason |
| GET | `/api/v1/submissions/student/:studentId` | All submissions for a student |
| GET | `/api/v1/analytics/submission-history` | Submission trend data |

---

## Backend Schemas

### FlaggedChoice
```python
class FlaggedChoice(BaseModel):
    rank: int
    note: str = ""
```

### ReviseRequest
```python
class ReviseRequest(BaseModel):
    notes: str
    flagged_choices: list[FlaggedChoice] = []
```

### RejectRequest
```python
class RejectRequest(BaseModel):
    reason: str
```

### JUPAS Scoring Integration
- `score_student_for_programme(student_grades, prog_dict)` from `jupas_scorer`
- Input: `{ subject_code: grade }` dict + programme dict with `scoring_formula`, `minimum_requirements`, `admission_stats`
- Output: `{ admission_probability, risk_level, eligible, ... }`
- Used in both detail view (for display) and approve action (for target creation)
