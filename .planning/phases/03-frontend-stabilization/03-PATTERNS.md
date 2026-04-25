# Phase 3: Frontend Stabilization - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 22 new/modified files
**Analogs found:** 19 / 22

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/vite.config.js` | config | — | `frontend/vite.config.js` (extend) | exact (modify existing) |
| `frontend/src/test/setup.js` | config | — | `frontend/src/hooks/useAuth.js` (import-only files) | partial |
| `frontend/tailwind.config.js` | config | — | `frontend/vite.config.js` | partial |
| `frontend/src/App.jsx` | provider | request-response | `frontend/src/App.jsx` (extend) | exact (modify existing) |
| `frontend/src/pages/StudentProfile/StudentProfile.jsx` | component | request-response | `frontend/src/pages/Dashboard/Dashboard.jsx` | role-match |
| `frontend/src/pages/StudentProfile/PersonalTab.jsx` | component | request-response | existing `PersonalTab` inline fn in `StudentProfile.jsx` | exact (extract) |
| `frontend/src/pages/StudentProfile/GradesTab.jsx` | component | request-response | existing `GradesTab` inline fn in `StudentProfile.jsx` | exact (extract) |
| `frontend/src/pages/StudentProfile/LanguageTab.jsx` | component | request-response | existing inline fn in `StudentProfile.jsx` | exact (extract) |
| `frontend/src/pages/StudentProfile/EvaluationsTab.jsx` | component | request-response | existing inline fn in `StudentProfile.jsx` | exact (extract) |
| `frontend/src/pages/StudentProfile/ActivitiesTab.jsx` | component | request-response | existing inline fn in `StudentProfile.jsx` | exact (extract) |
| `frontend/src/pages/StudentProfile/NotesTab.jsx` | component | request-response | existing inline fn in `StudentProfile.jsx` | exact (extract) |
| `frontend/src/pages/StudentProfile/PlansTab.jsx` | component | request-response | existing inline fn in `StudentProfile.jsx` | exact (extract) |
| `frontend/src/hooks/usePersonalTab.js` | hook | request-response | `frontend/src/hooks/useToast.js` | role-match |
| `frontend/src/hooks/useGradesTab.js` | hook | request-response | `frontend/src/hooks/useToast.js` | role-match |
| `frontend/src/hooks/useLanguageTab.js` | hook | request-response | `frontend/src/hooks/useToast.js` | role-match |
| `frontend/src/hooks/useEvaluationsTab.js` | hook | request-response | `frontend/src/hooks/useToast.js` | role-match |
| `frontend/src/hooks/useActivitiesTab.js` | hook | request-response | `frontend/src/hooks/useToast.js` | role-match |
| `frontend/src/hooks/useNotesTab.js` | hook | request-response | `frontend/src/hooks/useToast.js` | role-match |
| `frontend/src/hooks/usePlansTab.js` | hook | request-response | `frontend/src/hooks/useToast.js` | role-match |
| `frontend/src/components/QueryBoundary/QueryBoundary.jsx` | component | request-response | `frontend/src/components/LoadingSpinner/LoadingSpinner.jsx` + `ErrorMessage/ErrorMessage.jsx` | role-match |
| `frontend/src/components/EntityListView/EntityListView.jsx` | component | request-response | `frontend/src/pages/StudentListPage/StudentListPage.jsx` | role-match |
| `frontend/src/components/EntityForm/EntityForm.jsx` | component | request-response | `frontend/src/components/StudentForm/StudentForm.jsx` | role-match |
| `frontend/src/api/entities.js` | utility | request-response | `frontend/src/api/students.js` | exact |
| `frontend/src/pages/EntityListPage/EntityListPage.jsx` | component | request-response | `frontend/src/pages/Dashboard/Dashboard.jsx` | role-match |
| `frontend/src/pages/EntityDetailPage/EntityDetailPage.jsx` | component | request-response | `frontend/src/pages/StudentProfile/StudentProfile.jsx` | role-match |
| `frontend/src/components/NavBarV2/NavBarV2.jsx` | component | request-response | `frontend/src/components/NavBarV2/NavBarV2.jsx` (extend) | exact (modify existing) |
| `backend/app/api/v1/routes/entities.py` | route | request-response | `backend/app/api/v1/routes/grades.py` | exact |

---

## Pattern Assignments

### `frontend/vite.config.js` (config, extend existing)

**Analog:** `frontend/vite.config.js` (lines 1-7 — current state) + Vitest docs pattern from RESEARCH.md

**Current file** (`frontend/vite.config.js`, lines 1-7):
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
```

**Add `test:` block and `resolve.alias`** — extend to:
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
```

---

### `frontend/src/test/setup.js` (config, new file)

**Analog:** No direct analog. Single-import file pattern seen in `frontend/src/hooks/useAuth.js` (lines 1-4).

**Pattern** (`frontend/src/hooks/useAuth.js`, lines 1-4):
```javascript
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export const useAuth = () => useContext(AuthContext);
```

**New file follows same minimal-import convention:**
```javascript
import '@testing-library/jest-dom'
```

---

### `frontend/tailwind.config.js` (config, new file generated by CLI)

**Analog:** `frontend/vite.config.js` structure (module.exports vs ES module — Tailwind v3 uses CommonJS).

**Core pattern** (generated by `npx tailwindcss init -p`, then add content):
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

---

### `frontend/src/App.jsx` (provider, extend existing)

**Analog:** `frontend/src/App.jsx` (lines 1-59 — current state, full file already read)

**Current import block** (`frontend/src/App.jsx`, lines 1-21):
```javascript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage/LoginPage';
// ... page imports
```

**ProtectedRoute pattern** (`frontend/src/App.jsx`, lines 22-25):
```javascript
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
```

**Route registration pattern** (`frontend/src/App.jsx`, lines 27-59):
```javascript
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        {/* Add new routes here following same pattern */}
      </Routes>
    </BrowserRouter>
  );
}
```

**Additions needed:**
1. Wrap `<BrowserRouter>` with `<QueryClientProvider client={queryClient}>` — QueryClient created at module scope, before the component.
2. Add new entity routes: `/entities/:name` → `EntityListPage`, `/entities/:name/:id` → `EntityDetailPage`.

```javascript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* existing routes unchanged */}
          <Route path="/entities/:name" element={<ProtectedRoute><EntityListPage /></ProtectedRoute>} />
          <Route path="/entities/:name/:id" element={<ProtectedRoute><EntityDetailPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

---

### `frontend/src/pages/StudentProfile/StudentProfile.jsx` (component, rewrite parent)

**Analog:** `frontend/src/pages/Dashboard/Dashboard.jsx` (full file, 282 lines)

**Import pattern** (`Dashboard.jsx`, lines 1-11):
```javascript
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import EmptyState from '../../components/EmptyState/EmptyState';
import Button from '../../components/Button/Button';
import { getStudents, createStudent } from '../../api/students';
import { getAccount } from '../../api/account';
```

**Current StudentProfile import block** (`StudentProfile.jsx`, lines 1-22):
```javascript
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import Tabs from '../../components/Tabs/Tabs';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../components/EmptyState/EmptyState';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import Button from '../../components/Button/Button';
import TextInput from '../../components/TextInput/TextInput';
// ... more imports
import { getStudent, graduateStudent } from '../../api/students';
import { getAccount } from '../../api/account';
// ... more api imports
```

**Current TABS constant** (`StudentProfile.jsx`, lines 23-31):
```javascript
const TABS = [
  { id: 'personal', label: 'Personal' },
  { id: 'grades', label: 'Grades' },
  { id: 'language', label: 'Language' },
  { id: 'evaluations', label: 'Teacher Evaluations' },
  { id: 'activities', label: 'Activities' },
  { id: 'notes', label: 'Notes' },
  { id: 'plans', label: 'Plans' },
];
```

**TanStack Query parent-fetch pattern** (D-01, from RESEARCH.md Pattern 3):
```javascript
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { getStudent } from '../../api/students'
import QueryBoundary from '../../components/QueryBoundary/QueryBoundary'
import PersonalTab from './PersonalTab'
// ... remaining tab imports

export default function StudentProfile() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'personal'

  const { data: student, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['student', id],
    queryFn: () => getStudent(id),
  })

  const tabContent = {
    personal: <PersonalTab student={student} studentId={id} />,
    grades: <GradesTab student={student} studentId={id} />,
    // ...
  }

  return (
    <div style={pageStyle}>
      <NavBarV2 account={null} />
      <QueryBoundary isLoading={isLoading} isError={isError} error={error} refetch={refetch} resourceName="student">
        <Tabs tabs={TABS} activeTab={activeTab} onChange={(id) => setSearchParams({ tab: id })}>
          {tabContent[activeTab]}
        </Tabs>
      </QueryBoundary>
    </div>
  )
}
```

---

### Tab components: `PersonalTab.jsx`, `GradesTab.jsx`, `LanguageTab.jsx`, `EvaluationsTab.jsx`, `ActivitiesTab.jsx`, `NotesTab.jsx`, `PlansTab.jsx` (component, extract from monolith)

**Analog:** The inline tab functions already defined in `frontend/src/pages/StudentProfile/StudentProfile.jsx` starting at line 34. Each tab is already written — the extraction job is to move each function to its own file.

**PersonalTab inline function** (`StudentProfile.jsx`, lines 34-50, representative):
```javascript
function PersonalTab({ studentId, student, onSaved, showToast }) {
  const [form, setForm] = useState({
    full_name: student?.full_name || '',
    // ... other fields
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (student) {
      setForm({ full_name: student.full_name || '', /* ... */ });
    }
  }, [student]);
  // ... handlers and JSX
}
```

**Extraction pattern:** Each tab file follows this skeleton:
```javascript
// PersonalTab.jsx
import { usePersonalTab } from '../../hooks/usePersonalTab'
// ... component imports as needed

export default function PersonalTab({ student, studentId }) {
  const { form, saving, errors, handleChange, handleSave } = usePersonalTab(student, studentId)
  // presentational JSX only — no data fetching
}
```

**File-level import pattern to copy** (from `StudentProfile.jsx` lines 1-9 — use only what the tab needs):
```javascript
import { useState, useEffect } from 'react';
import Button from '../../components/Button/Button';
import TextInput from '../../components/TextInput/TextInput';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
```

---

### Custom tab hooks: `usePersonalTab.js`, `useGradesTab.js`, etc. (hook, new files)

**Analog:** `frontend/src/hooks/useToast.js` (lines 1-19, full file)

**useToast pattern** (`frontend/src/hooks/useToast.js`, lines 1-19):
```javascript
import { useState, useCallback } from 'react';

let idCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}
```

**Tab hook pattern to copy:**
```javascript
// hooks/usePersonalTab.js
import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateStudent } from '../api/students';
import { useToast } from './useToast';

export function usePersonalTab(student, studentId) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [form, setForm] = useState(/* initial from student */);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (student) setForm(/* populate from student */);
  }, [student]);

  const mutation = useMutation({
    mutationFn: (payload) => updateStudent(studentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      showToast('Saved.', 'success');
    },
    onError: () => showToast('Failed to save.', 'error'),
  });

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }, []);

  const handleSave = useCallback(() => {
    mutation.mutate(form);
  }, [form, mutation]);

  return { form, saving: mutation.isPending, errors, handleChange, handleSave };
}
```

**Note for `useGradesTab.js`:** Must include polling cleanup per RESEARCH.md Pitfall 6:
```javascript
useEffect(() => {
  const handle = setInterval(() => { /* poll */ }, 3000);
  return () => clearInterval(handle); // cleanup required
}, []);
```

---

### `frontend/src/components/QueryBoundary/QueryBoundary.jsx` (component, new)

**Analog:** `frontend/src/components/LoadingSpinner/LoadingSpinner.jsx` (lines 1-14) and `frontend/src/components/ErrorMessage/ErrorMessage.jsx` (lines 1-18)

**LoadingSpinner pattern** (`LoadingSpinner/LoadingSpinner.jsx`, lines 1-14):
```javascript
function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--space-6) 0' }}
    >
      {label}
    </p>
  );
}

export default LoadingSpinner;
```

**ErrorMessage pattern** (`ErrorMessage/ErrorMessage.jsx`, lines 1-18):
```javascript
function ErrorMessage({ message }) {
  return (
    <p
      role="alert"
      style={{
        color: 'var(--color-error)',
        fontSize: 'var(--font-size-sm)',
        padding: 'var(--space-3) var(--space-4)',
        border: 'var(--border-width) solid var(--color-error)',
        borderRadius: 'var(--border-radius-sm)',
        background: 'rgba(220,38,38,0.08)',
        marginBottom: 'var(--space-4)',
      }}
    >
      {message}
    </p>
  );
}

export default ErrorMessage;
```

**QueryBoundary composition pattern** (D-11, RESEARCH.md Pattern 3):
```javascript
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';

export default function QueryBoundary({ isLoading, isError, error, refetch, children, resourceName = 'data' }) {
  if (isLoading) return <div style={{ padding: 'var(--space-6) 0', textAlign: 'center' }}><LoadingSpinner /></div>
  if (isError) return (
    <ErrorMessage message={`Something went wrong loading ${resourceName}.`}>
      <button
        onClick={() => refetch()}
        style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-base)' }}
      >
        Try again
      </button>
    </ErrorMessage>
  )
  return children
}
```

**Note:** `ErrorMessage` currently only accepts `message` prop (not children). It must be extended to optionally render a `children` slot for the Try again button, OR `QueryBoundary` renders button separately below `ErrorMessage`.

---

### `frontend/src/api/entities.js` (utility, new file)

**Analog:** `frontend/src/api/students.js` (lines 1-20, full file)

**students.js pattern** (`frontend/src/api/students.js`, lines 1-20):
```javascript
import client from './client';

export const getStudents = () =>
  client.get('/api/v1/students').then((r) => r.data);

export const getStudent = (id) =>
  client.get(`/api/v1/students/${id}`).then((r) => r.data);

export const createStudent = (data) =>
  client.post('/api/v1/students', data).then((r) => r.data);

export const updateStudent = (id, data) =>
  client.put(`/api/v1/students/${id}`, data).then((r) => r.data);

export const deleteStudent = (id) =>
  client.delete(`/api/v1/students/${id}`).then((r) => r.data);
```

**New `entities.js` follows identical convention:**
```javascript
import client from './client';

export const getEntities = () =>
  client.get('/api/v1/entities').then((r) => r.data);

export const getEntitySchema = (name) =>
  client.get(`/api/v1/entities/${name}/schema`).then((r) => r.data);

export const getEntityList = (name) =>
  client.get(`/api/v1/${name}`).then((r) => r.data);

export const getEntityDetail = (name, id) =>
  client.get(`/api/v1/${name}/${id}`).then((r) => r.data);

export const createEntity = (name, data) =>
  client.post(`/api/v1/${name}`, data).then((r) => r.data);

export const updateEntity = (name, id, data) =>
  client.put(`/api/v1/${name}/${id}`, data).then((r) => r.data);

export const deleteEntity = (name, id) =>
  client.delete(`/api/v1/${name}/${id}`).then((r) => r.data);
```

---

### `frontend/src/components/EntityListView/EntityListView.jsx` (component, new)

**Analog:** `frontend/src/pages/StudentListPage/StudentListPage.jsx` (lines 1-179, full file)

**Table structure pattern** (`StudentListPage.jsx`, lines 82-99):
```javascript
const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  background: 'var(--color-surface)',
  border: 'var(--border-width) solid var(--color-border)',
  borderRadius: 'var(--border-radius-md)',
  overflow: 'hidden',
};

const thStyle = {
  background: 'var(--color-background)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-secondary)',
  padding: 'var(--space-3) var(--space-4)',
  textAlign: 'left',
  borderBottom: 'var(--border-width) solid var(--color-border)',
};
```

**Loading/error/empty branch pattern** (`StudentListPage.jsx`, lines 149-169):
```javascript
{loading ? (
  <tr><td colSpan={4}><LoadingSpinner label="Loading students…" /></td></tr>
) : error ? (
  <tr><td colSpan={4}><ErrorMessage message={error} /></td></tr>
) : students.length === 0 ? (
  <tr><td colSpan={4}><EmptyState message="No students yet." /></td></tr>
) : (
  students.map((student) => (
    <StudentRow key={student.id} student={student} />
  ))
)}
```

**EntityListView adapts this pattern dynamically:**
```javascript
// Props: schema (from getEntitySchema), rows (from getEntityList), onRowClick, loading, error
export default function EntityListView({ schema, rows, onRowClick, loading, error }) {
  const keyFields = schema?.fields?.slice(0, 4) ?? [];
  return (
    <table style={tableStyle}>
      <thead>
        <tr>{keyFields.map(f => <th key={f.name} style={thStyle}>{f.name}</th>)}</tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={keyFields.length}><LoadingSpinner /></td></tr>
        ) : error ? (
          <tr><td colSpan={keyFields.length}><ErrorMessage message="Could not load data." /></td></tr>
        ) : rows?.length === 0 ? (
          <tr><td colSpan={keyFields.length}><EmptyState message="No records yet." /></td></tr>
        ) : (
          rows?.map((row) => (
            <tr key={row.id} onClick={() => onRowClick(row.id)} style={{ cursor: 'pointer' }}>
              {keyFields.map(f => <td key={f.name} style={tdStyle}>{String(row[f.name] ?? '')}</td>)}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
```

---

### `frontend/src/components/EntityForm/EntityForm.jsx` (component, new)

**Analog:** `frontend/src/components/StudentForm/StudentForm.jsx` (existing — for form structure pattern)

**Import pattern to copy** (from `StudentProfile.jsx` lines 9-10 — form components already in codebase):
```javascript
import TextInput from '../TextInput/TextInput';
import Button from '../Button/Button';
```

**Field type map pattern** (D-05, RESEARCH.md Pattern 6):
```javascript
// components/EntityForm/fieldComponents.js
export const FIELD_COMPONENT_MAP = {
  string:  ({ field, value, onChange }) => (
    <input
      id={field.name}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{ /* copy from Dashboard.jsx line 189 inline input style */ }}
    />
  ),
  int:     ({ field, value, onChange }) => (
    <input type="number" id={field.name} value={value ?? ''} onChange={e => onChange(Number(e.target.value))} />
  ),
  date:    ({ field, value, onChange }) => (
    <input type="date" id={field.name} value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
  boolean: ({ field, value, onChange }) => (
    <input type="checkbox" id={field.name} checked={!!value} onChange={e => onChange(e.target.checked)} />
  ),
  enum:    ({ field, value, onChange }) => (
    <select id={field.name} value={value ?? ''} onChange={e => onChange(e.target.value)}>
      {field.choices?.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  ),
  jsonb:   ({ field, value, onChange }) => (
    <textarea id={field.name} value={value ? JSON.stringify(value, null, 2) : ''}
      onChange={e => { try { onChange(JSON.parse(e.target.value)) } catch {} }} />
  ),
}
```

**Form shell pattern** (from `StudentListPage.jsx` lines 38-51 — handleCreate pattern):
```javascript
export default function EntityForm({ schema, initialValues = {}, onSubmit, onCancel, saving }) {
  const [form, setForm] = useState(initialValues);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      {schema?.fields?.map(field => {
        const Cmp = FIELD_COMPONENT_MAP[field.type] ?? FIELD_COMPONENT_MAP.string;
        return (
          <div key={field.name} style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor={field.name} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {field.name}{field.required && ' *'}
            </label>
            <Cmp field={field} value={form[field.name]} onChange={v => setForm(prev => ({ ...prev, [field.name]: v }))} />
          </div>
        );
      })}
      <Button label={saving ? 'Saving…' : 'Save'} variant="primary" type="submit" disabled={saving} />
      <Button label="Cancel" variant="secondary" onClick={onCancel} disabled={saving} />
    </form>
  );
}
```

---

### `frontend/src/pages/EntityListPage/EntityListPage.jsx` (component, new)

**Analog:** `frontend/src/pages/Dashboard/Dashboard.jsx` (full file — page-level structure, nav, content wrapper)

**Page skeleton pattern** (`Dashboard.jsx`, lines 151-155):
```javascript
return (
  <div style={pageStyle}>
    <NavBarV2 account={account} />
    <main id="main-content" style={contentStyle}>
```

**Page layout tokens** (`Dashboard.jsx`, lines 68-73):
```javascript
const pageStyle = {
  background: 'var(--color-background)',
  minHeight: '100vh',
  fontFamily: 'var(--font-family-base)',
};
const contentStyle = {
  padding: 'var(--space-6) var(--space-8)',
};
```

**Two-query page pattern** (schema query + data query at page level):
```javascript
export default function EntityListPage() {
  const { name } = useParams();
  const navigate = useNavigate();

  const schemaQuery = useQuery({ queryKey: ['schema', name], queryFn: () => getEntitySchema(name) });
  const listQuery = useQuery({ queryKey: ['entities', name], queryFn: () => getEntityList(name) });

  return (
    <div style={pageStyle}>
      <NavBarV2 account={null} />
      <main style={contentStyle}>
        <h1 style={headingStyle}>{name}</h1>
        <QueryBoundary isLoading={schemaQuery.isLoading || listQuery.isLoading}
                       isError={schemaQuery.isError || listQuery.isError}
                       refetch={() => { schemaQuery.refetch(); listQuery.refetch(); }}>
          <EntityListView
            schema={schemaQuery.data}
            rows={listQuery.data}
            onRowClick={(id) => navigate(`/entities/${name}/${id}`)}
          />
        </QueryBoundary>
      </main>
    </div>
  );
}
```

---

### `frontend/src/pages/EntityDetailPage/EntityDetailPage.jsx` (component, new)

**Analog:** `frontend/src/pages/StudentProfile/StudentProfile.jsx` (parent fetch pattern — lines 1-31)

**Pattern:** Single-entity fetch via useQuery, passes data to EntityForm, useMutation on save:
```javascript
export default function EntityDetailPage() {
  const { name, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const schemaQuery = useQuery({ queryKey: ['schema', name], queryFn: () => getEntitySchema(name) });
  const detailQuery = useQuery({ queryKey: ['entity', name, id], queryFn: () => getEntityDetail(name, id) });

  const mutation = useMutation({
    mutationFn: (payload) => updateEntity(name, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities', name] });
      queryClient.invalidateQueries({ queryKey: ['entity', name, id] });
    },
  });

  return (
    <div style={pageStyle}>
      <NavBarV2 account={null} />
      <main style={contentStyle}>
        <QueryBoundary isLoading={schemaQuery.isLoading || detailQuery.isLoading}
                       isError={schemaQuery.isError || detailQuery.isError}
                       refetch={() => { schemaQuery.refetch(); detailQuery.refetch(); }}>
          <EntityForm
            schema={schemaQuery.data}
            initialValues={detailQuery.data}
            onSubmit={(payload) => mutation.mutate(payload)}
            onCancel={() => navigate(`/entities/${name}`)}
            saving={mutation.isPending}
          />
        </QueryBoundary>
      </main>
    </div>
  );
}
```

---

### `frontend/src/components/NavBarV2/NavBarV2.jsx` (component, extend existing)

**Analog:** `frontend/src/components/NavBarV2/NavBarV2.jsx` (lines 1-136, full file already read)

**Current link pattern** (`NavBarV2.jsx`, lines 91-109):
```javascript
<div style={centreLinksStyle}>
  <Link to="/dashboard" style={getLinkStyle('/dashboard')}>Dashboard</Link>
  <Link to="/schools" style={getLinkStyle('/schools')}>School Directory</Link>
  <Link to="/cohorts" style={getLinkStyle('/cohorts')}>Cohorts</Link>
  <Link to="/data-analysis" style={getLinkStyle('/data-analysis')}>Data Analysis</Link>
  {isAdmin && (
    <Link to="/admin/data-refresh" style={getLinkStyle('/admin/data-refresh')}>Data Refresh</Link>
  )}
</div>
```

**Dynamic entity links — add after existing links using same `getLinkStyle` function:**
```javascript
import { useQuery } from '@tanstack/react-query';
import { getEntities } from '../../api/entities';

// Inside NavBarV2 component:
const entitiesQuery = useQuery({
  queryKey: ['entities'],
  queryFn: getEntities,
  staleTime: 5 * 60 * 1000, // cache entity list for 5 min
});

// Inside centreLinksStyle div, after existing links:
{entitiesQuery.data?.map(entity => (
  <Link key={entity.name} to={`/entities/${entity.name}`} style={getLinkStyle(`/entities/${entity.name}`)}>
    {entity.name}
  </Link>
))}
```

**Note:** Per RESEARCH.md open question 2, only show entities with `auto_crud: true` — the API response should filter this server-side, or the frontend filters by checking a flag on each entity object.

---

### `backend/app/api/v1/routes/entities.py` (route, new file)

**Analog:** `backend/app/api/v1/routes/grades.py` (lines 1-57)

**Import pattern** (`grades.py`, lines 1-27):
```python
"""
app/api/v1/routes/grades.py

StudentSubjectGrade CRUD endpoints.
REQ-068
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
```

**Router declaration pattern** (`grades.py`, line 28-29):
```python
router = APIRouter(prefix="/students", tags=["grades-v2"])
```

**New entities router follows the same pattern:**
```python
"""
app/api/v1/routes/entities.py

Entity registry endpoints — list all registered entities and return their
YAML config as JSON for frontend schema-driven rendering (PLAT-03 D-06, D-08).
All routes protected: Depends(get_current_user).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_user
from app.db.models import User
from app.platform.entity_registry import registry

router = APIRouter(prefix="/entities", tags=["entities"])


@router.get("", status_code=200)
def list_entities(current_user: User = Depends(get_current_user)):
    """Return list of all registered entity names. Used by NavBar for dynamic links (D-08)."""
    return [
        {"name": c.name, "table": c.table, "auto_crud": getattr(c, "auto_crud", True)}
        for c in registry.all_configs()
    ]


@router.get("/{name}/schema", status_code=200)
def get_entity_schema(name: str, current_user: User = Depends(get_current_user)):
    """Return entity config as JSON for frontend schema-driven rendering (D-06)."""
    config = registry.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")
    return {
        "name": config.name,
        "table": config.table,
        "fields": [
            {
                "name": f.name,
                "type": f.type,
                "required": f.required,
                "choices": getattr(f, "choices", None),
                "max_length": getattr(f, "max_length", None),
            }
            for f in config.fields
        ],
    }
```

**Router registration in `backend/app/main.py`** — follows existing pattern (`main.py`, lines 217-238):
```python
# In the import block (lines 17-29 of main.py), add:
from app.api.v1.routes import entities

# In the Routers — v2 section (after line 238), add:
app.include_router(entities.router, prefix="/api/v1")
```

---

## Shared Patterns

### CSS Design Tokens (apply to all new components)

**Source:** `frontend/src/components/Button/Button.jsx` (lines 2-14) — establishes the CSS variable vocabulary

All new component inline styles must use `var(--...)` tokens, not hard-coded values:

```javascript
// Token vocabulary (copy from Button.jsx, NavBarV2.jsx, Dashboard.jsx):
// Typography: var(--font-family-base), var(--font-size-sm/md/lg/xl/2xl), var(--font-weight-normal/medium/bold)
// Spacing: var(--space-1) through var(--space-8)
// Color: var(--color-background), var(--color-surface), var(--color-border)
//        var(--color-text-primary), var(--color-text-secondary)
//        var(--color-primary), var(--color-error), var(--color-success)
// Border: var(--border-width), var(--border-radius-sm/md)
// Shadow: var(--shadow-sm), var(--shadow-md)
// Line height: var(--line-height-tight), var(--line-height-normal)
```

### Auth Guard (apply to all new backend routes)

**Source:** `backend/app/api/v1/routes/grades.py` (line 15, 40+)

```python
from app.core.dependencies import get_current_user
from app.db.models import User

@router.get("/{name}/schema", status_code=200)
def get_entity_schema(name: str, current_user: User = Depends(get_current_user)):
```

Apply `Depends(get_current_user)` to every endpoint in `entities.py`. Security requirement per RESEARCH.md Security Domain table.

### Axios API Function Pattern (apply to all new api/*.js files)

**Source:** `frontend/src/api/students.js` (lines 1-20) and `frontend/src/api/grades.js` (lines 1-17)

```javascript
import client from './client';

export const functionName = (param) =>
  client.METHOD(`/api/v1/path/${param}`).then((r) => r.data);
```

Single-line arrow functions, `.then((r) => r.data)` unwrapping, named exports (not default).

### TanStack Query Key Convention (apply to all useQuery calls)

**Source:** RESEARCH.md Pattern 3 + established by `StudentProfile.jsx` migration

```javascript
// Key structure: [resource-type, ...identifiers]
{ queryKey: ['student', id] }           // single student
{ queryKey: ['entities', name] }        // entity list by type
{ queryKey: ['entity', name, id] }      // single entity record
{ queryKey: ['schema', name] }          // entity schema
{ queryKey: ['entities'] }              // all entity names (for nav)
```

### useMutation Cache Invalidation Pattern (apply to all mutation hooks)

**Source:** RESEARCH.md Pattern 3 (TanStack Query v5 pattern)

```javascript
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: (payload) => apiCall(payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['relevant-key'] });
    showToast('Saved.', 'success');
  },
  onError: () => showToast('Failed to save. Please try again.', 'error'),
});
```

**Critical:** No `onSuccess`/`onError` in `useQuery` — v5 removed these. Use `useMutation` options only.

### Page-level Layout Pattern (apply to all new page components)

**Source:** `frontend/src/pages/Dashboard/Dashboard.jsx` (lines 68-73, 151-154)

```javascript
const pageStyle = { background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' };
const contentStyle = { padding: 'var(--space-6) var(--space-8)' };

return (
  <div style={pageStyle}>
    <NavBarV2 account={account} />
    <main id="main-content" style={contentStyle}>
      {/* content */}
    </main>
  </div>
);
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns):

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `frontend/src/test/setup.js` | config | — | No test infrastructure exists; RTL setup pattern is a single import line with no codebase equivalent |
| `frontend/tailwind.config.js` | config | — | No CSS framework config exists; pattern comes from Tailwind CLI generation |
| `frontend/postcss.config.js` | config | — | No PostCSS config exists; generated by `npx tailwindcss init -p` |

---

## Metadata

**Analog search scope:** `frontend/src/` (components, hooks, pages, api, context), `backend/app/api/v1/routes/`
**Files scanned:** 34 source files read + directory listings
**Pattern extraction date:** 2026-04-24
