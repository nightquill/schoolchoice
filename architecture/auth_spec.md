# Authentication Specification
# Intelligent Academic Advisor — MVP
# Document Owner: System Architect
# Date: 2026-03-27
# Status: BASELINE

---

## REQ-IDs Covered

REQ-010, REQ-011, REQ-024, REQ-031

---

## 1. Authentication Mechanism

The system uses **JSON Web Tokens (JWT)** for stateless authentication. See ADR-001 for the rationale behind choosing JWT over session cookies.

Credential type: email address + password.

No OAuth, no social login, no third-party identity provider (REQ-011).

No roles or permission levels exist in MVP. Every authenticated user (counselor) has identical access rights to their own data (REQ-011). Ownership-based data isolation (a counselor can only access students they created) is enforced at the API layer by comparing the `user_id` in the validated JWT against the `user_id` column on student records.

---

## 2. Token Lifecycle

### 2.1 Token Creation (Login)

1. The counselor submits `email` and `password` to `POST /api/v1/auth/login`.
2. The backend retrieves the user record matching the email.
3. The backend verifies the submitted password against the stored bcrypt hash.
4. On success, the backend signs a new JWT using the `SECRET_KEY` environment variable and the `ALGORITHM` specified in environment configuration.
5. The signed token is returned in the response body as `access_token`.

**JWT Payload (claims):**

| Claim | Value | Notes |
|-------|-------|-------|
| `sub` | User UUID (string) | Standard JWT subject; identifies the counselor |
| `exp` | Unix timestamp | Expiry time; computed as `now + ACCESS_TOKEN_EXPIRE_MINUTES` |
| `iat` | Unix timestamp | Issued-at time |

No role or permission claims are included (REQ-011).

### 2.2 Token Validation (Protected Routes)

On every request to a protected endpoint:

1. The backend extracts the token from the `Authorization: Bearer <token>` header.
2. The backend decodes and verifies the token signature using `SECRET_KEY`.
3. The backend checks the `exp` claim. If the token is expired, `401 Unauthorized` is returned.
4. The backend extracts `sub` (the `user_id`) and uses it to scope all database queries for the request.
5. If the header is absent or the token is malformed, `401 Unauthorized` is returned.

### 2.3 Token Expiry

- Default expiry: defined by the `ACCESS_TOKEN_EXPIRE_MINUTES` environment variable (see environment_spec.md).
- Recommended MVP value: 60 minutes for development; 30 minutes for production.
- There is no refresh token mechanism in MVP. When a token expires, the counselor must log in again.
- The backend does not maintain a server-side session or token blacklist; tokens are self-contained and stateless.

### 2.4 Token Invalidation

Because the system uses stateless JWTs without a token blacklist, there is no explicit logout mechanism at the backend in MVP. Logout is implemented on the frontend by discarding the in-memory token (see §4 below). The token remains cryptographically valid until its `exp` claim is reached, but without it stored in the browser, it cannot be replayed.

---

## 3. Password Storage

- Passwords are hashed with **bcrypt** before storage.
- Plaintext passwords are never written to the database.
- Plaintext passwords are never logged.
- The `hashed_password` field is never returned in any API response.

---

## 4. Token Storage — Frontend Recommendation

**Recommended:** Store the JWT in **React component state or a React context object** (in-memory storage).

**Do not** store the JWT in `localStorage` or `sessionStorage`.

**Rationale:**
- `localStorage` is accessible to any JavaScript running on the page, making it vulnerable to XSS attacks that could steal the token.
- In-memory storage (React state/context) is cleared when the tab is closed or the page is refreshed, which limits the token's exposure window.
- Since this is an internal tool used by counselors (not a consumer application), requiring re-login after a page refresh is an acceptable trade-off for the MVP.

**Frontend token handling flow:**
1. On successful login, store `access_token` in a React context (e.g., `AuthContext`).
2. Attach the token as `Authorization: Bearer <token>` to every outbound API request.
3. On logout (user action) or on `401` response from the API, clear the token from context and redirect to the Login page.
4. On page refresh, the token is lost; the counselor must log in again.

---

## 5. Protected vs Public Routes

### Public Routes (no JWT required)

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/v1/auth/register | Create a new counselor account |
| POST | /api/v1/auth/login | Authenticate and receive a JWT |

### Protected Routes (JWT Bearer required)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/v1/students | List all students for authenticated counselor |
| POST | /api/v1/students | Create a new student profile |
| GET | /api/v1/students/{id} | Retrieve a student profile |
| PUT | /api/v1/students/{id} | Update a student profile |
| DELETE | /api/v1/students/{id} | Delete a student profile |
| GET | /api/v1/schools | List all schools |
| POST | /api/v1/schools | Create a school record |
| GET | /api/v1/schools/{id} | Retrieve a school record |
| PUT | /api/v1/schools/{id} | Update a school record |
| DELETE | /api/v1/schools/{id} | Delete a school record |
| POST | /api/v1/students/{id}/recommendations | Trigger matching engine |
| GET | /api/v1/students/{id}/recommendations | Retrieve stored recommendations |
| POST | /api/v1/students/{id}/action-plan | Generate action plan |
| GET | /api/v1/students/{id}/action-plan | Retrieve stored action plan |

### Frontend Route Protection

- All frontend pages except the Login page require a valid token in the React context.
- If no token is present when navigating to a protected page, the frontend redirects to the Login page.
- If the backend returns `401` for any API call, the frontend clears the token from context and redirects to the Login page.

---

## 6. Ownership Enforcement

Beyond token validity, the backend enforces data ownership on every student-scoped endpoint:

1. Validate and decode the JWT to extract `user_id`.
2. Load the requested student record from the database.
3. Compare `student.user_id` with the JWT `user_id`.
4. If they do not match, return `403 Forbidden`.

This ensures a counselor cannot read, modify, or generate recommendations for another counselor's students, even with a valid token.

School records are not owner-scoped; any authenticated counselor can read and manage schools. This reflects the system's internal-tool nature where the school database is a shared resource.

---

## 7. Non-Goals (MVP Exclusions)

- No refresh tokens.
- No token revocation / blacklist.
- No role-based access control (REQ-011).
- No OAuth or social login (REQ-011).
- No multi-factor authentication.
- No session management on the backend.
- No "remember me" / persistent login across browser restarts.
