# Phase 4: Import and Export - Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 12 new/modified files
**Analogs found:** 11 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/import_service.py` | service | file-I/O | `backend/app/modules/school_choice/services/plan_generator.py` | role-match |
| `backend/app/api/v1/routes/entities.py` | route | request-response | `backend/app/api/v1/routes/entities.py` (extend) | exact (modify existing) |
| `backend/app/platform/crud_generator.py` | utility | CRUD | `backend/app/platform/crud_generator.py` (extend) | exact (modify existing) |
| `backend/app/platform/yaml_loader.py` | model | transform | `backend/app/platform/yaml_loader.py` (extend) | exact (modify existing) |
| `backend/tests/test_import_export.py` | test | file-I/O | `backend/tests/test_platform.py` + `backend/tests/test_entities.py` | role-match |
| `frontend/src/pages/ImportWizardPage/ImportWizardPage.jsx` | component | request-response | `frontend/src/pages/EntityListPage/EntityListPage.jsx` | role-match |
| `frontend/src/components/ImportWizard/ImportWizard.jsx` | component | request-response | `frontend/src/pages/EntityDetailPage/EntityDetailPage.jsx` (useMutation pattern) | role-match |
| `frontend/src/components/ColumnMapper/ColumnMapper.jsx` | component | transform | `frontend/src/components/EntityListView/EntityListView.jsx` (table layout) | partial |
| `frontend/src/components/ValidationSummary/ValidationSummary.jsx` | component | request-response | `frontend/src/components/QueryBoundary/QueryBoundary.jsx` (conditional rendering) | partial |
| `frontend/src/components/SearchFilterBar/SearchFilterBar.jsx` | component | request-response | `frontend/src/pages/EntityListPage/EntityListPage.jsx` (useQuery pattern) | role-match |
| `frontend/src/components/FilterControl/FilterControl.jsx` | component | transform | `frontend/src/components/EntityListView/EntityListView.jsx` (schema-driven rendering) | role-match |
| `frontend/src/components/ActionBar/ActionBar.jsx` | component | request-response | `frontend/src/pages/EntityListPage/EntityListPage.jsx` | partial |
| `frontend/src/api/entities.js` | utility | request-response | `frontend/src/api/entities.js` (extend) | exact (modify existing) |

---

## Pattern Assignments

### `backend/app/services/import_service.py` (service, file-I/O)

**Analog:** `backend/app/modules/school_choice/services/plan_generator.py`

**Imports pattern** (plan_generator.py lines 13-18):
```python
from __future__ import annotations

import html
import json
from datetime import datetime, timezone
```

**New file imports pattern** (derived from research + stdlib):
```python
from __future__ import annotations

import csv
import io
from difflib import SequenceMatcher
from typing import Any

import openpyxl

from app.platform.yaml_loader import EntityConfig
```

**Core service pattern — `html.escape()` for safe output** (plan_generator.py line 135):
```python
return html.escape(str(value) if value is not None else "")
```

**Apply to import_service.py:** Every value read from a user-uploaded file must be treated as untrusted. Use `str(value) if value is not None else ""` normalization before storing in preview dicts.

**HTML escape pattern for export** (plan_generator.py — the `_esc` helper, line 135):
```python
def _esc(value: Any) -> str:
    return html.escape(str(value) if value is not None else "")
```
Apply the same helper in any HTML export rendering that interpolates entity field values.

**Column auto-mapping core pattern** (from RESEARCH.md Pattern 2 — verified stdlib):
```python
from difflib import SequenceMatcher

def normalize(s: str) -> str:
    return s.lower().replace(" ", "_").replace("-", "_")

def auto_map_columns(file_columns: list[str], entity_fields: list[str]) -> dict[str, str | None]:
    mapping = {}
    available = list(entity_fields)
    for col in file_columns:
        best_field = None
        best_score = 0.0
        for field in available:
            score = SequenceMatcher(None, normalize(col), normalize(field)).ratio()
            if score > best_score:
                best_score = score
                best_field = field
        if best_score >= 0.6:
            mapping[col] = best_field
            available.remove(best_field)
        else:
            mapping[col] = None
    return mapping
```

**openpyxl parsing pattern** (RESEARCH.md Pattern 7 — verified openpyxl 3.0.9):
```python
import io
import openpyxl

def parse_excel(content: bytes, config: EntityConfig) -> dict:
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sheet_names = wb.sheetnames
    return {
        "format": "excel",
        "sheets": sheet_names,
        "selected_sheet": sheet_names[0] if sheet_names else None,
    }

def parse_excel_sheet(content: bytes, sheet_name: str, config: EntityConfig) -> dict:
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return {"columns": [], "preview_rows": [], "auto_mapping": {}}
    headers = [str(h) if h is not None else "" for h in rows[0]]
    entity_field_names = [f.name for f in config.fields]
    preview = [[str(c) if c is not None else "" for c in row] for row in rows[1:4]]
    return {
        "columns": headers,
        "preview_rows": preview,
        "auto_mapping": auto_map_columns(headers, entity_field_names),
    }
```

**CSV parsing pattern** (RESEARCH.md Code Examples — verified stdlib):
```python
import csv, io

def parse_csv(content: bytes, config: EntityConfig) -> dict:
    text = content.decode("utf-8-sig")  # utf-8-sig strips BOM
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    preview_rows = []
    all_rows = []
    for i, row in enumerate(reader):
        all_rows.append(dict(row))
        if i < 5:
            preview_rows.append(list(row.values()))
    entity_fields = [f.name for f in config.fields]
    return {
        "format": "csv",
        "sheets": None,
        "columns": list(headers),
        "preview_rows": preview_rows,
        "all_rows": all_rows,
        "auto_mapping": auto_map_columns(list(headers), entity_fields),
    }
```

**Row validation pattern** (RESEARCH.md Code Examples — uses existing `build_pydantic_schema`):
```python
from app.platform.crud_generator import build_pydantic_schema

def validate_rows(rows: list[dict], mapping: dict, config: EntityConfig) -> tuple[list, list]:
    Schema = build_pydantic_schema(config, "ImportRow")
    valid, errors = [], []
    for i, raw_row in enumerate(rows):
        mapped = {entity_field: raw_row.get(file_col)
                  for file_col, entity_field in mapping.items()
                  if entity_field}
        try:
            Schema(**mapped)
            valid.append(mapped)
        except Exception as e:
            errors.append({"row_index": i + 2, "data": mapped, "error_reason": str(e)})
    return valid, errors
```

---

### `backend/app/api/v1/routes/entities.py` (route, request-response — extend existing)

**Analog:** `backend/app/api/v1/routes/entities.py` (current file)

**Existing imports pattern** (entities.py lines 1-15):
```python
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_user
from app.db.models import User
from app.platform.entity_registry import registry

router = APIRouter(prefix="/entities", tags=["entities"])
```

**Extend with** — add these imports when adding new endpoints:
```python
from fastapi import File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.import_service import (
    parse_csv, parse_excel, parse_excel_sheet,
    validate_rows, auto_map_columns,
)
```

**Auth guard pattern** (entities.py lines 18-19, 31-32) — every endpoint uses `Depends(get_current_user)`:
```python
@router.get("", status_code=200)
def list_entities(current_user: User = Depends(get_current_user)):
```

**Registry lookup + 404 pattern** (entities.py lines 32-36):
```python
config = registry.get_config(name)
if not config:
    raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")
```

**File upload endpoint pattern** (from RESEARCH.md Pattern 1 — derived from this codebase's route style):
```python
@router.post("/{name}/import/parse")
async def import_parse(
    name: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    config = registry.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")
    content = await file.read()
    if file.filename.endswith((".xlsx", ".xls")):
        result = parse_excel(content, config)
    else:
        result = parse_csv(content, config)
    return result
```

**StreamingResponse CSV export pattern** (RESEARCH.md Pattern 3):
```python
import csv, io
from fastapi.responses import StreamingResponse
from datetime import date

@router.get("/{name}/export")
def export_entity_csv(
    name: str,
    q: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = registry.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")
    model_cls = registry.get_model(name)
    rows = db.query(model_cls).all()
    field_names = [f.name for f in config.fields]

    def generate():
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=field_names, extrasaction="ignore")
        writer.writeheader()
        yield output.getvalue()
        for row in rows:
            output.seek(0)
            output.truncate(0)
            writer.writerow({f: getattr(row, f, "") for f in field_names})
            yield output.getvalue()

    filename = f"{name}-export-{date.today().isoformat()}.csv"
    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

**HTML export pattern** (plan.py lines 472-479 — how `generate_html_plan` is invoked and returned):
```python
html_content = generate_html_plan(
    student_for_regen,
    match_results_for_regen,
    plan.action_items or [],
    plan_type="UNIVERSITY",
    template_id=plan.template_id,
    overrides=plan.overrides or {},
)
# Returns as download: wrap in Response with content-disposition
from fastapi import Response
return Response(
    content=html_content,
    media_type="text/html",
    headers={"Content-Disposition": f'attachment; filename="plan-{plan_id}.html"'},
)
```

---

### `backend/app/platform/crud_generator.py` (utility, CRUD — extend existing)

**Analog:** `backend/app/platform/crud_generator.py` (current file, read fully above)

**Existing list endpoint pattern** (crud_generator.py lines 62-67):
```python
@router.get("", status_code=status.HTTP_200_OK)
def list_entities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(model_cls).all()
```

**Extend to** — add `q` and `filters` query params using RESEARCH.md Pattern 4 + Pitfall 4 guidance:
```python
from fastapi import Query as QueryParam
import json

@router.get("", status_code=status.HTTP_200_OK)
def list_entities(
    q: str | None = QueryParam(None, description="Text search across string/text fields"),
    filters: str | None = QueryParam(None, description="JSON-encoded field filter dict"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import or_
    query = db.query(model_cls)
    if q:
        ilike_clauses = [
            getattr(model_cls, f.name).ilike(f"%{q}%")
            for f in entity_config.fields
            if f.type in ("string", "text", "enum")
            if hasattr(model_cls, f.name)
        ]
        if ilike_clauses:
            query = query.filter(or_(*ilike_clauses))
    if filters:
        try:
            filter_dict = json.loads(filters)
        except (ValueError, TypeError):
            filter_dict = {}
        for field_name, value in filter_dict.items():
            if hasattr(model_cls, field_name) and value not in (None, "", {}):
                query = query.filter(getattr(model_cls, field_name) == value)
    return query.all()
```

**Auth pattern** (crud_generator.py lines 64-66) — unchanged, carry through to all generated endpoints:
```python
current_user: User = Depends(get_current_user),
```

---

### `backend/app/platform/yaml_loader.py` (model — extend existing)

**Analog:** `backend/app/platform/yaml_loader.py`

Read the current structure to understand the `EntityConfig` dataclass before adding `key_fields`:
```python
# Extend EntityConfig dataclass — add optional key_fields:
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class EntityConfig:
    name: str
    table: str
    fields: list  # list[FieldConfig]
    auto_crud: bool = True
    key_fields: list[str] = field(default_factory=list)  # NEW: for duplicate detection
```

Add `key_fields` parsing in `load_entity_yaml()` — follow the same pattern as existing optional fields (`auto_crud`):
```python
key_fields = raw.get("key_fields", [])
```

---

### `backend/tests/test_import_export.py` (test, file-I/O — new file)

**Analog:** `backend/tests/test_entities.py` + `backend/tests/test_platform.py`

**Test file structure pattern** (test_entities.py lines 1-12):
```python
"""
tests/test_entities.py

Tests for GET /api/v1/entities and GET /api/v1/entities/{name}/schema.
"""

def test_list_entities_unauthenticated(client):
    """Unauthenticated request returns 401."""
    response = client.get("/api/v1/entities")
    assert response.status_code == 401
```

**Auth header pattern** (test_entities.py lines 14-15):
```python
def test_list_entities_authenticated(client, auth_headers):
    response = client.get("/api/v1/entities", headers=auth_headers)
    assert response.status_code == 200
```

**Conftest fixtures available** (conftest.py lines 83-98):
```python
@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
```

**File upload test pattern** (derived from FastAPI TestClient + test_entities.py style):
```python
def test_parse_csv(client, auth_headers):
    """Parse a minimal CSV file — returns columns, preview_rows, auto_mapping."""
    csv_content = b"name,email\nAlice,alice@example.com\nBob,bob@example.com"
    response = client.post(
        "/api/v1/entities/student/import/parse",
        headers=auth_headers,
        files={"file": ("test.csv", csv_content, "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "columns" in data
    assert "preview_rows" in data
    assert "auto_mapping" in data
```

**Unit test pattern** (test_platform.py lines 39-60 — class-based for grouped unit tests):
```python
class TestEntityYamlParse:
    """Tests for YAML entity config parsing."""

    def test_valid_yaml_loads(self, tmp_path):
        ...
        assert ec.name == "widget"
```

---

### `frontend/src/pages/ImportWizardPage/ImportWizardPage.jsx` (component, request-response)

**Analog:** `frontend/src/pages/EntityListPage/EntityListPage.jsx`

**Page shell pattern** (EntityListPage.jsx lines 1-12):
```javascript
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import QueryBoundary from '../../components/QueryBoundary/QueryBoundary';
import { getEntitySchema } from '../../api/entities';
import { getAccount } from '../../api/account';

const pageStyle = { background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' };
const contentStyle = { paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' };
```

**Schema query + QueryBoundary pattern** (EntityListPage.jsx lines 13-46):
```javascript
export default function EntityListPage() {
  const { name } = useParams();
  const navigate = useNavigate();

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const schemaQuery = useQuery({ queryKey: ['schema', name], queryFn: () => getEntitySchema(name) });

  return (
    <div style={pageStyle}>
      <NavBarV2 account={accountQuery.data ?? null} />
      <main id="main-content" className="px-4 md:px-8 overflow-x-auto" style={contentStyle}>
        <h1 style={headingStyle}>{name}</h1>
        <QueryBoundary
          isLoading={schemaQuery.isLoading}
          isError={schemaQuery.isError}
          error={schemaQuery.error}
          refetch={schemaQuery.refetch}
          resourceName={name}
        >
          {/* child component here */}
        </QueryBoundary>
      </main>
    </div>
  );
}
```

**ImportWizardPage** wraps `ImportWizard` the same way: `useParams` for `name`, schema query, QueryBoundary guard, then pass `entityName` and `schema` as props to `ImportWizard`.

---

### `frontend/src/components/ImportWizard/ImportWizard.jsx` (component, request-response)

**Analog:** `frontend/src/pages/EntityDetailPage/EntityDetailPage.jsx`

**useMutation pattern** (EntityDetailPage.jsx lines 27-37):
```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: (payload) => updateEntity(schemaQuery.data?.table || name, id, payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['entities', name] });
    navigate(`/entities/${name}`);
  },
  onError: () => {
    toast.error(`Failed to update ${name}.`);
  },
});
```

**ImportWizard uses three mutations** — one per API phase:
```javascript
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { importParse, importValidate, importCommit } from '../../api/entities';

const STEPS = ['upload', 'sheetSelect', 'columnMapping', 'validationPreview', 'done'];

export default function ImportWizard({ entityName, schema }) {
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [mapping, setMapping] = useState({});
  const [validationResult, setValidationResult] = useState(null);

  const parseMutation = useMutation({
    mutationFn: (f) => importParse(entityName, f),
    onSuccess: (data) => {
      setParseResult(data);
      setStep(data.sheets?.length > 1 ? 'sheetSelect' : 'columnMapping');
    },
    onError: () => toast.error('Failed to parse file.'),
  });

  const validateMutation = useMutation({
    mutationFn: (p) => importValidate(entityName, p),
    onSuccess: (data) => { setValidationResult(data); setStep('validationPreview'); },
    onError: () => toast.error('Validation failed.'),
  });

  const commitMutation = useMutation({
    mutationFn: (p) => importCommit(entityName, p),
    onSuccess: () => { toast.success('Import complete.'); setStep('done'); },
    onError: () => toast.error('Import failed.'),
  });
}
```

**Error toast pattern** (EntityDetailPage.jsx line 34-36):
```javascript
onError: () => {
  toast.error(`Failed to update ${name}.`);
},
```

---

### `frontend/src/components/ColumnMapper/ColumnMapper.jsx` (component, transform)

**Analog:** `frontend/src/components/EntityListView/EntityListView.jsx` (table layout + schema-driven column iteration)

**Table layout pattern** (EntityListView.jsx lines 1-10, 41-65):
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

const tdStyle = {
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: 'var(--border-width) solid var(--color-border)',
  fontSize: 'var(--font-size-md)',
  color: 'var(--color-text-primary)',
};
```

**ColumnMapper** renders two-column rows: file column name + shadcn Select for entity field target. Use these exact CSS variable tokens for spacing and border styling, matching EntityListView.

---

### `frontend/src/components/ValidationSummary/ValidationSummary.jsx` (component, request-response)

**Analog:** `frontend/src/components/QueryBoundary/QueryBoundary.jsx` (conditional display based on state)

**QueryBoundary conditional render pattern** (to read if needed for exact structure):
```javascript
// Pattern: show different content branches based on state flags
// ValidationSummary follows same: show banner always, show table conditionally
export default function ValidationSummary({ validationResult, onConfirm, onBack }) {
  const { valid_count, error_count, warning_count, error_rows } = validationResult;
  // summary banner always visible
  // error_rows table visible only if error_count > 0
}
```

**EntityListView table pattern** (EntityListView.jsx lines 41-65) — reuse for error rows table.

---

### `frontend/src/components/SearchFilterBar/SearchFilterBar.jsx` (component, request-response)

**Analog:** `frontend/src/pages/EntityListPage/EntityListPage.jsx` (useQuery with dynamic key)

**useQuery with dynamic key pattern** (EntityListPage.jsx lines 19-23):
```javascript
const listQuery = useQuery({
  queryKey: ['entities', name],
  queryFn: () => getEntityList(schemaQuery.data?.table || name),
  enabled: !!schemaQuery.data,
});
```

**SearchFilterBar extends this pattern** — adds debounce via `useEffect` and passes `q`/`filters` into queryKey:
```javascript
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

export default function SearchFilterBar({ schema, onSearch, onFilter }) {
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => onSearch(searchText), 300);
    return () => clearTimeout(handle);
  }, [searchText, onSearch]);

  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
      <Input
        placeholder="Search..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ maxWidth: 320 }}
      />
      {/* FilterControl per filterable field */}
    </div>
  );
}
```

**CSS variable spacing** — use `var(--space-3)`, `var(--space-4)` consistently with EntityListView and EntityListPage inline styles.

---

### `frontend/src/components/FilterControl/FilterControl.jsx` (component, transform)

**Analog:** `frontend/src/components/EntityListView/EntityListView.jsx` (schema-driven field-type rendering) + Phase 3 FIELD_COMPONENT_MAP pattern

**Schema-driven conditional render pattern** (EntityListView.jsx lines 33-35):
```javascript
const displayFields = schema?.fields?.slice(0, 5) ?? [];
```

**FilterControl polymorphic pattern** (RESEARCH.md Code Examples — verified against shadcn components to be installed):
```javascript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function FilterControl({ field, value, onChange }) {
  if (field.type === 'enum') {
    return (
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={`All ${field.name}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All</SelectItem>
          {field.choices?.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === 'date') {
    return (
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Input type="date" value={value?.from ?? ''} onChange={e => onChange({ ...value, from: e.target.value })} />
        <Input type="date" value={value?.to ?? ''} onChange={e => onChange({ ...value, to: e.target.value })} />
      </div>
    );
  }
  if (field.type === 'int' || field.type === 'decimal') {
    return (
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Input type="number" placeholder="Min" style={{ width: 80 }} value={value?.min ?? ''} onChange={e => onChange({ ...value, min: e.target.value })} />
        <Input type="number" placeholder="Max" style={{ width: 80 }} value={value?.max ?? ''} onChange={e => onChange({ ...value, max: e.target.value })} />
      </div>
    );
  }
  return null;
}
```

---

### `frontend/src/components/ActionBar/ActionBar.jsx` (component, request-response)

**Analog:** No exact match. Closest structural reference is `EntityListPage.jsx` (button-level UI above EntityListView).

**Button import pattern** (EntityDetailPage.jsx uses button via shadcn):
```javascript
import { Button } from '@/components/ui/button';
```

**Axios blob download pattern** (RESEARCH.md Pitfall 5 — critical for auth-gated export):
```javascript
// In ActionBar or called from it via entities.js:
import client from '../../api/client';

export const exportEntityCSV = async (name, params = {}) => {
  const resp = await client.get(`/api/v1/entities/${name}/export`, {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

**ActionBar layout** — use `var(--space-3)` gap and flex row matching EntityListPage heading area style.

---

### `frontend/src/api/entities.js` (utility, request-response — extend existing)

**Analog:** `frontend/src/api/entities.js` (current file, read fully above)

**Existing pattern** (entities.js lines 1-40) — all functions follow:
```javascript
import client from './client';

const SAFE_TABLE_NAME = /^[a-z][a-z0-9_]*$/;

function validateTableName(tableName) {
  if (!SAFE_TABLE_NAME.test(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }
}

export const getEntityList = (tableName) => {
  validateTableName(tableName);
  return client.get(`/api/v1/${tableName}`).then((r) => r.data);
};
```

**Extend `getEntityList` to accept params** (maintain existing function signature, add optional second arg):
```javascript
export const getEntityList = (tableName, params = {}) => {
  validateTableName(tableName);
  return client.get(`/api/v1/${tableName}`, { params }).then((r) => r.data);
};
```

**New import API functions** (follow exact style of existing functions):
```javascript
export const importParse = (entityName, file) => {
  const formData = new FormData();
  formData.append('file', file);
  // Do NOT set Content-Type — let Axios set multipart boundary automatically
  return client.post(`/api/v1/entities/${entityName}/import/parse`, formData)
    .then((r) => r.data);
};

export const importValidate = (entityName, payload) =>
  client.post(`/api/v1/entities/${entityName}/import/validate`, payload)
    .then((r) => r.data);

export const importCommit = (entityName, payload) =>
  client.post(`/api/v1/entities/${entityName}/import/commit`, payload)
    .then((r) => r.data);

export const exportEntityCSV = async (entityName, params = {}) => {
  const resp = await client.get(`/api/v1/entities/${entityName}/export`, {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${entityName}-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportReportHTML = async (studentId, planId) => {
  const resp = await client.get(`/api/v1/students/${studentId}/plan/export-html`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plan-${planId}.html`;
  a.click();
  URL.revokeObjectURL(url);
};
```

---

## Shared Patterns

### Authentication Guard
**Source:** `backend/app/api/v1/routes/entities.py` lines 18-19
**Apply to:** All new backend endpoints — `import/parse`, `import/validate`, `import/commit`, `/export`
```python
current_user: User = Depends(get_current_user)
```
No endpoint in this phase is public. `get_current_user` raises 401 automatically if token is missing or invalid.

---

### Registry Lookup + 404 Pattern
**Source:** `backend/app/api/v1/routes/entities.py` lines 32-36
**Apply to:** All `/entities/{name}/...` endpoints
```python
config = registry.get_config(name)
if not config:
    raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")
```

---

### Axios Auth Interceptor (Frontend)
**Source:** `frontend/src/api/client.js` lines 6-13
**Apply to:** All new `entities.js` API functions — they automatically inherit Bearer token because they all use the shared `client` instance
```javascript
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```
Critical for export: never use `<a href="...">` for auth-gated downloads — always use `client.get(..., { responseType: 'blob' })`.

---

### Toast Error Handling (Frontend)
**Source:** `frontend/src/pages/EntityDetailPage/EntityDetailPage.jsx` lines 6, 34-36
**Apply to:** All `useMutation` `onError` callbacks in ImportWizard, ActionBar
```javascript
import { toast } from 'sonner';

onError: () => {
  toast.error(`Failed to update ${name}.`);
},
```

---

### CSS Variable Token System
**Source:** `frontend/src/components/EntityListView/EntityListView.jsx` lines 1-32 and `frontend/src/pages/EntityListPage/EntityListPage.jsx` lines 9-11
**Apply to:** All new frontend components — use only `var(--color-*)`, `var(--space-*)`, `var(--font-*)`, `var(--border-*)` tokens. Never hardcode colors, font sizes, or spacing values.
```javascript
const pageStyle = { background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' };
// gap: 'var(--space-3)', padding: 'var(--space-4)', color: 'var(--color-text-primary)'
```

---

### HTML Escape for User Data
**Source:** `backend/app/modules/school_choice/services/plan_generator.py` line 135
**Apply to:** `import_service.py` any preview data returned to frontend; HTML export rendering
```python
def _esc(value) -> str:
    return html.escape(str(value) if value is not None else "")
```

---

### QueryBoundary Wrapping
**Source:** `frontend/src/pages/EntityListPage/EntityListPage.jsx` lines 30-38
**Apply to:** `ImportWizardPage` (wraps schema load), `EntityListPage` (already uses it; extend to pass search/filter props)
```javascript
<QueryBoundary
  isLoading={schemaQuery.isLoading || listQuery.isLoading}
  isError={schemaQuery.isError || listQuery.isError}
  error={schemaQuery.error || listQuery.error}
  refetch={() => { schemaQuery.refetch(); listQuery.refetch(); }}
  resourceName={name}
>
  {/* child */}
</QueryBoundary>
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/src/components/ActionBar/ActionBar.jsx` | component | request-response | No existing action bar / toolbar component in codebase; closest structural reference is the heading area of EntityListPage but no dedicated button-bar component exists |

Planner should use RESEARCH.md patterns for ActionBar: shadcn `Button` + `DropdownMenu` for export options, lucide-react `Upload` and `Download` icons, flex row layout with `var(--space-3)` gap.

---

## Metadata

**Analog search scope:** `backend/app/`, `backend/tests/`, `frontend/src/`
**Files read:** 13 source files
**Pattern extraction date:** 2026-04-25
