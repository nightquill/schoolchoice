# Agent Packet: System Architect
# Intelligent Academic Advisor — MVP
# Issued by: PM (Requirements Authority)
# Date: 2026-03-27

---

## Scope

This packet contains every requirement in the [ARCH] domain that the System Architect owns or must enforce. Requirements from other domains are referenced where the Architect must provide a structural decision that unblocks downstream agents.

---

## Owned Requirements

### REQ-001 [ARCH]
**Description:** The system must be a web-based internal tool (not a mobile or desktop application).
**Source:** preferences.md §1, §7
**Priority:** Must Have

---

### REQ-002 [ARCH]
**Description:** The system is decision-support only; it must not automate decisions on behalf of users.
**Source:** preferences.md §1
**Priority:** Must Have

---

### REQ-003 [ARCH]
**Description:** The system must follow a three-tier architecture: Frontend → Backend API → Database. No tier may bypass an intermediate tier.
**Source:** preferences.md §4
**Priority:** Must Have

---

### REQ-004 [ARCH]
**Description:** The frontend must be implemented in React.
**Source:** preferences.md §4
**Priority:** Must Have

---

### REQ-005 [ARCH]
**Description:** The backend must be implemented with FastAPI (Python).
**Source:** preferences.md §4
**Priority:** Must Have

---

### REQ-006 [ARCH]
**Description:** The database must be PostgreSQL.
**Source:** preferences.md §4
**Priority:** Must Have

---

### REQ-007 [ARCH]
**Description:** The architecture must be modular and extensible to allow future addition of ML-based scoring, multi-agent reasoning, external system integration, and advanced planning tools, without requiring a rewrite of MVP components.
**Source:** preferences.md §3, §8
**Priority:** Should Have (design constraint)

---

### REQ-008 [ARCH]
**Description:** The matching engine must use rule-based logic only. No machine learning models may be introduced in MVP.
**Source:** preferences.md §3, §7
**Priority:** Must Have

---

### REQ-009 [ARCH]
**Description:** The system must produce transparent, interpretable outputs. Black-box outputs are not acceptable.
**Source:** preferences.md §3
**Priority:** Must Have

---

## Cross-Domain Structural Constraints the Architect Must Document

The following requirements from other domains carry architectural implications. The Architect must confirm how the chosen structure satisfies each.

| REQ-ID | Domain | Implication |
|---|---|---|
| REQ-010 | BACKEND | Auth mechanism must fit within the three-tier model (REQ-003) |
| REQ-011 | BACKEND | No OAuth / role-based auth; single-role session model only |
| REQ-023 | BACKEND | No external API calls; system is fully self-contained |
| REQ-041 | INTEGRATION | No real-time collaboration; no WebSocket or pub/sub layer required |
| REQ-042 | INTEGRATION | Build order is prescribed; architecture must be deliverable incrementally |

---

## Non-Goals (Architect Must Enforce)

The following must NOT appear in any architectural design produced for MVP:

- Machine learning models or inference layers
- External API integrations (UCAS, JUPAS, or any third-party system)
- Real-time collaboration infrastructure
- Role-based access control
- Mobile or desktop application layers

**Source:** preferences.md §7

---

## Deliverable Expected from This Agent

- A structural architecture document describing how the three tiers interact
- Technology confirmation for each tier (React / FastAPI / PostgreSQL)
- Identification of module boundaries that support future extensibility (REQ-007)
- Nothing beyond what is listed above; do not design UI, SQL schema, or API contracts

---
*Packet issued by PM — do not modify REQ-IDs or descriptions.*
