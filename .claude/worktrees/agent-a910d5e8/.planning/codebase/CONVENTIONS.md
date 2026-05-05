# Coding Conventions

**Analysis Date:** 2026-04-24

## Naming Patterns

**Files:**
- React components: PascalCase with `.jsx` extension (e.g., `Button.jsx`, `StudentForm.jsx`, `Dashboard.jsx`)
- Component directories: Match component name (e.g., `src/components/Button/`, `src/components/Modal/`)
- API utilities: camelCase with `.js` extension (e.g., `auth.js`, `students.js`, `schoolsV2.js`)
- Python modules: snake_case with `.py` extension (e.g., `auth_service.py`, `plan_generator.py`, `matchmaker_v2.py`)
- Python test files: `test_*.py` pattern (e.g., `test_auth.py`, `test_v2_services.py`, `test_v2_routes.py`)

**Functions/Methods:**
- JavaScript/React: camelCase for all functions (e.g., `handleSubmit`, `validateInput`, `updateGradeRow`)
- Python: snake_case for all functions and methods (e.g., `register_user`, `login_for_access_token`, `compute_best5_aggregate`)
- Private/internal Python functions: leading underscore (e.g., `_build_full_response`, `_rate_limit_key`, `_keyword_overlap`)

**Variables:**
- React state: camelCase with descriptive names (e.g., `students`, `loading`, `formError`, `showAddForm`)
- React handlers: `handle` prefix followed by camelCase (e.g., `handleSubmit`, `handleCreateStudent`, `handleKeyDown`)
- Python variables: snake_case (e.g., `new_errors`, `filtered_students`, `unique_classes`)
- Constants: UPPER_SNAKE_CASE (e.g., `SQLALCHEMY_TEST_DATABASE_URL`, `COMPULSORY_CODES`, `GRADE_MAP`)

**Types/Classes:**
- React components: PascalCase function names matching file name
- Pydantic schemas: PascalCase class names (e.g., `UserCreate`, `StudentFullResponse`, `SchoolResponse`)
- SQLAlchemy ORM models: PascalCase (e.g., `User`, `Student`, `School`, `AcademicPlan`)

## Code Style

**Formatting:**
- No Prettier config in frontend; uses ESLint for linting
- No Black/autopep8 config in backend; uses Ruff for linting
- Frontend: 2-space indentation (React convention)
- Backend: 4-space indentation (Python convention)
- Line length: Not explicitly enforced; reasonable ~80-120 character lines observed

**Linting:**
- Frontend ESLint config: `eslint.config.js` with recommended rules
  - React hooks validation enabled via `eslint-plugin-react-hooks`
  - React Refresh validation via `eslint-plugin-react-refresh`
  - Unused variables ignored if they start with uppercase or underscore (`varsIgnorePattern: '^[A-Z_]'`)
- Backend: Ruff installed (`ruff==0.4.4` in requirements.txt) but no configuration file visible

## Import Organization

**JavaScript/React Order:**
1. Third-party libraries (React, react-router-dom, axios)
2. Custom context/hooks (`useAuth`, `useToast`)
3. Components and utilities
4. Styles (`.css`)
5. API utilities

**Example from `src/pages/Dashboard/Dashboard.jsx`:**
```javascript
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import { getStudents, createStudent } from '../../api/students';
```

**Python Order:**
1. Standard library (`os`, `datetime`, `uuid`)
2. Third-party packages (`fastapi`, `sqlalchemy`, `pydantic`)
3. Local application imports (`app.db`, `app.schemas`, `app.services`)
4. Future annotations at top (`from __future__ import annotations`)

**Example from `app/api/v1/routes/students.py`:**
```python
from __future__ import annotations
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user
from app.db.models import Student, User
```

**Path Aliases:**
- No path aliases in frontend; uses relative imports
- Backend: Direct imports from `app.*` modules (no aliases configured)

## Error Handling

**Patterns:**
- **React**: Try-catch blocks in async handlers; errors stored in state; user-facing error messages via `ErrorMessage` component
  - Example from `Dashboard.jsx`: `setError(err?.response?.data?.detail || 'Failed to load dashboard data.')`
- **API Client**: Axios interceptor at `src/api/client.js` catches 401 responses globally and redirects to `/login`
- **Backend**: HTTPException from FastAPI with appropriate status codes; service layer returns tuples `(data, error_code)` or raises exceptions
  - Example: `authenticate_user()` returns `(user, None)` on success or `(None, "error_reason")` on failure
  - Validation errors raised as Pydantic validation failures (422 status)
  - Integrity errors (duplicate emails) caught and re-raised as HTTP 409 Conflict

**Validation:**
- Frontend: Custom validation functions before form submission (e.g., `StudentForm.jsx` `validate()` function)
- Backend: Pydantic field validators in schemas (e.g., `UserCreate.password_min_length()` enforces 8-character minimum)

## Logging

**Framework:** No explicit logging framework detected in source code; uses `console` for React and standard Python `print` statements appear absent.

**Patterns:**
- Frontend: No structured logging; errors captured to state and displayed in UI
- Backend: No structured logging framework configured; errors handled via exceptions and HTTP responses

## Comments

**When to Comment:**
- Module-level docstrings for all Python files (docstring at top of file explaining purpose)
- Function docstrings for all public functions (rarely present on private functions)
- REQ-* references: Include requirement numbers in docstrings and route definitions for traceability
- Inline comments for complex logic (e.g., focus trap implementation in `Modal.jsx`)

**JSDoc/TSDoc:**
- Not widely used in frontend code
- Python docstrings follow simple format: description of purpose and parameters
- Example from `app/core/dependencies.py`:
```python
def get_current_user(...) -> User:
    """
    Extract the JWT from the Authorization: Bearer header, validate it,
    and return the corresponding User ORM object.

    Raises HTTP 401 if the token is absent, malformed, expired, or the
    user no longer exists in the database.
    """
```

## Function Design

**Size:** Functions are reasonably concise (20-60 lines typical)

**Parameters:**
- React components: Single props object parameter with destructuring (e.g., `function Button({ label, onClick, variant = 'primary' })`)
- Python functions: Multiple positional parameters with type hints and optional defaults

**Return Values:**
- React components: Return JSX or null (early return pattern used when `isOpen === false`)
- JavaScript API functions: Return promises (e.g., `return client.post(...).then(r => r.data)`)
- Python services: Return ORM objects or dicts; raise exceptions on errors
- Python validators: Return validated value or raise ValueError

## Module Design

**Exports:**
- React: Default export of component function (e.g., `export default Button`)
- JavaScript: Named exports for API functions and utility functions; default export for axios client
- Python: No explicit `__all__` exports; public functions are implicitly exported

**Barrel Files:**
- Frontend `src/api/` does not use barrel exports; each module exports independent functions
- Backend `app/services/__init__.py` does not define barrel imports; routes import directly from modules

## Access Control & Decoration

**Frontend:**
- Protected routes via `ProtectedRoute` component wrapper that checks `isAuthenticated` from `useAuth` hook
- Authentication state managed in `AuthContext.jsx` using React Context API

**Backend:**
- Protected endpoints via `Depends(get_current_user)` dependency injection on route handlers
- Public endpoints (auth) have no dependency
- Example from `app/api/v1/routes/students.py`:
```python
@router.get("/{id}", response_model=StudentFullResponse)
def get_student(id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Get a student by ID."""
```

## Requirement Traceability

**Patterns:**
- Requirements referenced in code via `REQ-###` comments
- Examples: `REQ-010` (authentication), `REQ-024` (user management), `REQ-088` (dashboard)
- Comments appear in docstrings, route decorators, and test file headers

---

*Convention analysis: 2026-04-24*
