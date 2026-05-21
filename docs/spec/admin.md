<!-- spec-tracks: apps/web/src/pages/AdminManage/AdminManage.jsx, apps/web/src/pages/AdminTeacherGroups/AdminTeacherGroups.jsx, apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx, apps/web/src/pages/AdminDataRefresh/AdminDataRefresh.jsx, apps/web/src/api/admin.js, apps/web/src/api/teacherGroups.js, backend/app/api/v1/routes/admin.py, backend/app/api/v1/routes/teacher_groups.py -->

# Admin Spec

---

## Admin Manage (/admin/manage)

### Elements

- **NavBarV2** — top navigation bar
- **Page title**: "Admin Management" (h1)
- **Section tab buttons** (4 tabs):
  1. **Teacher Groups** (Shield icon, default active) — embeds `AdminTeacherGroups`
  2. **Cohort Management** (BookOpen icon) — inline cohort CRUD
  3. **Teachers** (Users icon) — user list with role management
  4. **Settings** (Settings icon) — org-level configuration
- Active tab: primary color background, white text, medium font weight
- Inactive tab: no background, secondary text, normal weight

---

### Teacher Groups Tab (activeSection === 'groups')

Renders `<AdminTeacherGroups embedded />` — see dedicated section below.

---

### Teachers Tab (activeSection === 'teachers')

#### Elements
- **Card** with:
  - **Header row**: info text "Teachers and admins in your organisation" + **"Create User" button**
  - **Table columns**: Name, Email, Role, Actions
    - **Name**: display_name or email prefix (medium weight)
    - **Email**: plain text
    - **Role badge**: pill with background color
      - Admin: blue background (#dbeafe), blue text (#1d4ed8)
      - Counsellor: gray background (#f3f4f6), gray text (#6b7280)
    - **Actions**: role change dropdown (counsellor/admin) — hidden for self
  - Role change dropdown: `<select>` with options "Counsellor", "Admin"
  - Disabled while mutation is pending
- **LoadingSpinner** — while users loading

#### Create User Dialog
- **Title**: "Create User"
- **Fields**:
  - **Email** (required, type="email", placeholder "teacher@school.hk")
  - **Password** (required, type="password")
  - **Full Name** (optional)
  - **Role dropdown**: Counsellor (default), Admin
- **Footer buttons**: Cancel, Create User (disabled while pending or if email/password empty)
- Toast: "User created" on success; "Email already exists" on 409; "Create failed" on other errors

### Data flow

**List users:**
- `GET /api/v1/admin/users` -> `{ items: UserAdminResponse[], total }`
  - `UserAdminResponse`: `{ id, email, display_name, role, is_active, created_at }`
  - Admin only. Scoped to user's organisation via `OrganisationMembership`

**Create user:**
- `POST /api/v1/admin/users` with `{ email, password, display_name, role }`
  - Returns `UserAdminResponse`
  - Auto-joins admin's organisation
  - 409 if email exists

**Update user role:**
- `PATCH /api/v1/admin/users/{userId}` with `{ role }` -> `UserAdminResponse`
  - Can also update: `display_name`, `password`, `can_manage_cohorts`

**Delete user (not exposed in UI):**
- `DELETE /api/v1/admin/users/{userId}` -> 204
  - Soft-delete (`is_active=false`)
  - Self-delete blocked (403)

### Key behaviors

- Teachers list filtered client-side: `allUsers.filter(u => u.role === 'counsellor' || u.role === 'admin')`
- Cannot change own role (row hides action dropdown for current user)
- Query invalidation on create/update for real-time UI refresh

---

### Cohorts Tab (activeSection === 'cohorts')

#### Elements
- **Two-column layout** (flex wrap):

**Left column** (flex 1, min-width 260px):
- **Header row**: "{count} cohorts" label + **"Create Cohort" button**
- **Cohort list card** (scrollable, max-height 70vh):
  - Each item: cohort name + "Student cohort" badge (blue pill) + description + member count
  - **Selected state**: blue-tinted background, 3px left border (primary color)
  - Click selects cohort
  - `role="button"`, `tabIndex={0}`, keyboard Enter support
- **Empty state text** when no cohorts

**Right column** (flex 2, min-width 340px):
- **Placeholder**: "Select a cohort to see details" when none selected
- When selected:
  - **Cohort header card**: name (h2) + description + button row:
    - **"Add Students" button** (secondary variant)
    - **"View Full" button** (outline, navigates to `/cohorts/{id}`)
    - **"Edit" button** (outline, opens rename dialog; hidden for default cohorts)
    - **"Delete" button** (red outline; hidden for default cohorts)
  - **Members card**:
    - **Title**: "Members ({count})"
    - **Table** (max-height 400px scroll): Name, Class, Year, Actions
      - Name: clickable, navigates to `/students/{id}/profile`
      - **"Remove" button** per row (red outline)
    - **LoadingSpinner** while detail loading
    - **Empty text** when no members

#### Create Cohort Dialog
- **Title**: "Create Cohort"
- **Fields**: Name (required), Description (optional)
- **Buttons**: Cancel, Create Cohort

#### Delete Cohort Dialog
- **Title**: "Delete Cohort"
- **Text**: "Are you sure? This will delete cohort {name}."
- **Buttons**: Cancel, Delete (destructive)

#### Rename Cohort Dialog
- **Title**: "Rename Cohort"
- **Field**: New Cohort Name (Enter key submits)
- **Buttons**: Cancel, Save

#### Add Students Dialog
- **Title**: "Add Students to Cohort"
- **Search row**: name input + Search button
- **Results list** (scrollable, max-height 260px):
  - Click to toggle selection (blue highlight)
  - Already-in-cohort items grayed out with "Already in cohort" label
- **Buttons**: Cancel, "Add {count} Selected"

### Data flow

- Uses same cohorts API as Cohort List page
- `GET /api/v1/cohorts/{id}` for detail (via React Query `cohort-detail` key)
- Mutations: `createCohort`, `deleteCohort`, `updateCohort` (rename), `addCohortMembers`, `removeCohortMember`
- Auto-selects first cohort when list loads

### Key behaviors

- Auto-selects first cohort on initial load
- Selected cohort detail fetches lazily (React Query `enabled: !!selectedCohort?.id`)
- All mutations invalidate relevant query keys for real-time updates
- Rename updates `selectedCohort` in-place for immediate UI feedback
- Delete resets selection if deleted cohort was selected

---

### Settings Tab (activeSection === 'settings')

#### Elements
- **Section title**: "Settings" (h2)

**Submission Rate Limit Card** (max-width 480px):
- **Label**: "Submission Rate Limit"
- **Description text**: explains cooldown between submissions
- **Input row**:
  - **Number input** (`id="submission-rate"`, min=1, max=50, width 80px)
  - **"per student per day"** label
  - **Save button** — disabled while saving

**Plan Detail Level Card** (max-width 480px):
- **Label**: "Plan Detail Level"
- **Description text**: explains what each level shows
- **Radio buttons** (3 options):
  - **Band A Only** (value="A")
  - **Band A + B** (value="B")
  - **Band A + B + C** (value="C")
- **Save button** — disabled while saving

### Data flow

**Submission rate limit:**
- `GET /api/v1/admin/settings/submission-rate-limit` -> `{ cooldown_days }` (default 3)
- `PUT /api/v1/admin/settings/submission-rate-limit` with `{ rate_limit }` or `{ cooldown_days }`
  - Stored in `Organisation.metadata_` JSON field
  - Validates: integer, 1-365

**Plan detail level:**
- `GET /api/v1/admin/settings/plan-detail-level` -> `{ level: "A"|"B"|"C" }` (default "A")
- `PUT /api/v1/admin/settings/plan-detail-level` with `{ level }`
  - Stored in `Organisation.metadata_` JSON field
  - Validates: must be A, B, or C

### Key behaviors

- Settings are org-level (stored on Organisation model)
- Both cards save independently
- Toast notifications on success/failure
- Initial values loaded from API and synced to local state via `useEffect`

---

## Teacher Groups (/admin/teacher-groups, also embedded in Admin Manage)

### Elements

- **NavBarV2** — standalone mode only (not when embedded)
- **Page title**: "Teacher Groups" — standalone mode only
- **Two-column layout** (flex wrap):

**Left panel** (flex 1, min-width 260px):
- **Create group row**:
  - **Name input** (placeholder "New group name...", Enter to submit)
  - **Create button** — disabled while pending or empty name
- **Group list card** (scrollable, max-height 70vh):
  - Each item: group name + "Members ({count})" label + **Delete button** (red outline)
  - **Selected state**: blue-tinted background, 3px left border
  - Click selects group
  - `role="button"`, `tabIndex={0}`, keyboard support (Enter/Space)
- **Empty text** when no groups

**Right panel** (flex 2, min-width 400px):
- **Placeholder**: "Select a group to manage" when none selected
- When selected:

  #### Group Header Card
  - Group name (h2, bold)

  #### Members Card
  - **Title**: "Members ({count})"
  - **Members table**:
    - **Columns**: Name, Email, Role, Actions
    - Name: display_name or email prefix
    - Role badge: Admin (blue) or Counsellor (gray) — same pill style as Teachers tab
    - **"Remove" button** per row (red outline)
  - **LoadingSpinner** while members loading
  - **Empty text** when no members
  - **Add Teacher section** (below table, border-top separator):
    - **Label**: "Add Teacher"
    - **Search input** (placeholder "Search by name or email...")
    - **Search results dropdown** (max-height 200px, shown when typing):
      - Each result: display name + email + **"Add" button**
      - "No matching teachers" text when no results
      - Excludes existing members from results

  #### Permissions Card
  - **Title**: "Permissions"
  - Renders `<GroupPermissions groupId={selectedGroupId} />`

#### Remove Member Confirmation Modal
- **Title**: "Remove"
- **Text**: "Remove {name} from group?"
- **Buttons**: Cancel, Confirm (danger variant)

### Data flow

**List groups:**
- `GET /api/v1/admin/teacher-groups` -> `{ groups: [{ id, name, description, member_count, created_at, updated_at }] }`
  - Admin only. Scoped to user's organisation

**Create group:**
- `POST /api/v1/admin/teacher-groups` with `{ name }`
  - Returns group object
  - Auto-creates `CohortPermission` rows for all org cohorts with default `read_write` permissions
  - Auto-selects newly created group

**Delete group:**
- `DELETE /api/v1/admin/teacher-groups/{id}` -> `{ message: "Group deleted" }`
  - Cascade deletes members + permissions
  - Resets selection if deleted group was selected

**List members:**
- `GET /api/v1/admin/teacher-groups/{id}/members` -> `{ members: [{ id, user_id, email, display_name, role }] }`

**Add member:**
- `POST /api/v1/admin/teacher-groups/{id}/members` with `{ user_ids: [uuid_string] }`
  - Returns `{ added: [id], count }`
  - Silently skips duplicates and invalid IDs

**Remove member:**
- `DELETE /api/v1/admin/teacher-groups/{groupId}/members/{userId}` -> `{ message: "Member removed" }`

### Key behaviors

- `embedded` prop: when true, renders without NavBar and page title (used inside AdminManage)
- Auto-selects first group on initial load
- Teacher search filters `allUsers` client-side by name/email substring match
- Search dropdown only appears when search input is non-empty
- Already-member teachers excluded from search results
- All mutations invalidate both `teacher-groups` and `group-members` query keys
- Confirmation modal for member removal
- Toast notifications for all operations

---

## Group Permissions (embedded in Teacher Groups)

### Elements

- **Permissions table** (horizontally scrollable):
  - **Columns**:
    1. **Cohort** — cohort name (medium weight); "All Students" for default cohort
    2. **Visible** — checkbox (16x16px) to toggle visibility
    3. **Programmes** — access dropdown
    4. **Grades** — access dropdown
    5. **Plans** — access dropdown
    6. **Submissions** — access dropdown
    7. **Reports** — access dropdown
    8. **Cohort Mgmt** — access dropdown
    9. **Data Import** — access dropdown
    10. **Account Assign** — access dropdown
    11. **Student Delete** — access dropdown
    12. **Student Profile** — access dropdown
  - One row per cohort in the organisation
  - **Access dropdown options**: None, View, Edit (maps to `none`, `read_only`, `read_write`)
  - Dropdowns disabled when `visible=false` (grayed out, opacity 0.5, cursor not-allowed)
  - Row background changes to `var(--color-background)` when hidden
- **Save button** — bottom-right, disabled when no unsaved changes or while saving
- **LoadingSpinner** — while permissions loading
- **"No cohorts"** text when no permissions to display

### Permission Tool Keys

| Key | UI Label |
|-----|----------|
| `programme_choices` | Programmes |
| `grades` | Grades |
| `plan_generation` | Plans |
| `submissions` | Submissions |
| `reports` | Reports |
| `cohort_management` | Cohort Mgmt |
| `data_import` | Data Import |
| `account_assignment` | Account Assign |
| `student_delete` | Student Delete |
| `student_profile` | Student Profile |

### Data flow

**Load permissions:**
- `GET /api/v1/admin/teacher-groups/{groupId}/permissions`
  ```
  {
    permissions: [{
      cohort_id, cohort_name, visible,
      programme_choices, grades, plan_generation, submissions,
      reports, cohort_management, data_import, account_assignment,
      student_delete, student_profile
    }]
  }
  ```
  - Returns all org cohorts with current permission values
  - Missing permissions default to `visible=true`, tools=`read_write`

**Save permissions:**
- `PUT /api/v1/admin/teacher-groups/{groupId}/permissions` with:
  ```
  { permissions: [{ cohort_id, visible, programme_choices, grades, ... }] }
  ```
  - Bulk upsert: creates new or updates existing `CohortPermission` rows
  - Returns `{ updated: count }`

### Key behaviors

- Local state tracks all permission changes; `dirty` flag enables/disables Save
- Toggling `visible=false` visually disables all tool dropdowns for that row
- Each dropdown has `aria-label="{tool} access for {cohort_name}"`
- Visibility checkbox has `aria-label="Toggle visibility for {cohort_name}"`
- Save resets `dirty` flag on success
- Toast notifications for save success/failure
- Re-loads from server when `groupId` changes (React Query key includes `groupId`)

---

## Admin Data Refresh (/admin/data-refresh)

### Elements

- **NavBarV2** — top navigation bar
- **Page header**: "Data Management" title + "Admin" badge (amber)

#### Refresh Status Card
- **Title**: "Refresh Status" (h2)
- **Last refresh timestamp** — "Never" if not triggered
- **Source status rows** (3 rows, border-bottom separated):
  - Subjects — status icon
  - Schools — status icon
  - JUPAS — status icon
  - Status icons: "---" (idle/unknown), "..." (pending/running, amber), checkmark (complete, green)

#### CSV Diff Preview Card
- **Title**: "CSV Diff Preview" (h2)
- **Description text** explaining the feature
- **Input row**:
  - **Entity type dropdown**: Schools (default), Subjects
  - **CSV file input** (accept=".csv")
  - **"Preview Changes" button** — disabled while previewing or no file
- **Preview results** (shown after preview):
  - **Summary badges** (4 flex items):
    - Added: green badge ("+ {N} added")
    - Updated: amber badge ("~ {N} updated")
    - Unchanged: gray badge ("= {N} unchanged")
    - Total: bordered badge ("Total rows: {N}")
  - **New Records table** (if any added):
    - Title: "New Records" (green)
    - Columns: Key, Fields
  - **Updated Records table** (if any updated):
    - Title: "Updated Records" (amber)
    - Columns: Key, Field, Old (red strikethrough), New (green)
    - Multi-row span for key when multiple fields changed
  - **"Publish Changes" button** — triggers data refresh

#### Trigger Refresh Card
- **Title**: "Trigger Refresh" (h2)
- **Description text** explaining what refresh does
- **"Trigger Refresh" button** — disabled after trigger ("Refresh Triggered")

#### Recent Messages Card
- **Title**: "Recent Messages" (h2)
- **Console log** (monospace, 200px height, scrollable):
  - `role="log"`, `aria-live="polite"`
  - Shows timestamped messages
  - "No messages yet." placeholder

#### Confirmation Modal
- **Title**: "Confirm Data Refresh"
- **Text**: confirmation description
- **Buttons**: Cancel, Confirm (shows "Triggering..." while pending)

### Data flow

**Trigger refresh:**
- `POST /api/v1/admin/data-refresh` -> `{ task_id, triggered_at, status: "pending" }`
  - Runs background task: re-executes `seed_schools.sql`
  - Admin only (403 for non-admin)

**Check status (not currently polled in UI):**
- `GET /api/v1/admin/data-refresh/status` -> `{ task_id, triggered_at, status }`
  - Status values: idle, pending, running, complete, "failed: {error}"

**Preview CSV diff:**
- `POST /api/v1/admin/data-refresh/preview?entity_type={schools|subjects}` (multipart/form-data with CSV file)
  ```
  {
    entity_type, total_rows,
    added: count, updated: count, unchanged: count,
    added_preview: [{ key, fields }]  (max 20),
    updated_preview: [{ key, changes: { field: { old, new } } }]  (max 20)
  }
  ```

### Key behaviors

- Admin role guard: redirects to `/dashboard` if `account.role !== 'admin'`
- Trigger button disabled after first use (no re-trigger in same session)
- CSV preview is independent of trigger — can preview without triggering
- Entity type change resets preview result
- File change resets preview result
- Messages array is append-only (accumulates during session)
- In-memory refresh status on backend (not persisted to DB)
- Publish Changes button reuses the same confirmation modal as direct trigger
