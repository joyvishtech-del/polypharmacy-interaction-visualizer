# PRP: Polypharmacy Interaction Visualizer

> Implementation blueprint for parallel agent execution

---

## METADATA

| Field | Value |
|-------|-------|
| **Product** | Polypharmacy Interaction Visualizer |
| **Type** | SaaS (patient-facing web app) |
| **Version** | 1.0 |
| **Created** | 2026-04-26 |
| **Complexity** | High (AI + OCR + graph viz + PHI-equivalent data) |

---

## PRODUCT OVERVIEW

**Description:** AI-powered tool that lets patients enter their medications (text or photo via OCR), then returns an interaction graph (red/yellow/green severity edges), a plain-language summary of the top 3 risks, and questions to ask the doctor.

**Value Proposition:** Patients on multiple prescriptions get clarity, advocate confidently with their doctors, and surface dangerous combinations before they become incidents — without having to interpret clinical literature.

**MVP Scope:**
- [ ] Email/password registration and login
- [ ] Add medications manually (text entry)
- [ ] File upload + OCR for medication bottle photos
- [ ] Run interaction analysis → graph + top-3 risks + doctor questions
- [ ] View past analyses (basic history list)

**Post-MVP:**
- Google OAuth, history compare, email notifications, admin panel, analytics dashboard, PDF export

---

## TECH STACK

| Layer | Technology | Skill Reference |
|-------|------------|-----------------|
| Backend | FastAPI + Python 3.11+ | skills/BACKEND.md |
| Frontend | React + Vite + TypeScript | skills/FRONTEND.md |
| Database | PostgreSQL + SQLAlchemy + Alembic | skills/DATABASE.md |
| Auth | JWT (HS256) + bcrypt | skills/BACKEND.md |
| UI | Chakra UI | skills/FRONTEND.md |
| Graph viz | React Flow (recommended) or Cytoscape.js | skills/FRONTEND.md |
| AI | Anthropic Claude API (interaction analysis) | skills/BACKEND.md |
| OCR | Tesseract (or cloud OCR API) | skills/BACKEND.md |
| Storage | S3-compatible object storage (private ACL, signed URLs) | skills/DEPLOYMENT.md |
| Testing | pytest + React Testing Library | skills/TESTING.md |
| Deployment | Docker + GitHub Actions | skills/DEPLOYMENT.md |

---

## DATABASE MODELS

### User
- `id` (PK), `email` (unique, indexed), `hashed_password`, `full_name`, `is_active`, `is_verified`, `oauth_provider` (nullable), `oauth_subject` (nullable), `role` (enum: user/admin), `created_at`, `updated_at`

### RefreshToken
- `id` (PK), `user_id` (FK → User), `token_hash`, `expires_at`, `revoked`, `created_at`
- Index on `(user_id, revoked)` for fast lookup; tokens stored hashed

### Medication
- `id` (PK), `user_id` (FK → User, indexed), `name`, `dosage`, `frequency`, `start_date` (nullable), `notes` (nullable), `source` (enum: manual / ocr), `photo_url` (nullable), `ocr_raw_text` (nullable), `created_at`, `updated_at`

### Analysis
- `id` (PK), `user_id` (FK → User, indexed), `summary` (text), `status` (enum: pending / completed / failed), `created_at`, `completed_at` (nullable)

### AnalysisMedication (join)
- `analysis_id` (FK → Analysis), `medication_id` (FK → Medication)
- Composite PK `(analysis_id, medication_id)`

### InteractionEdge
- `id` (PK), `analysis_id` (FK → Analysis, indexed), `drug_a`, `drug_b`, `severity` (enum: red / yellow / green), `explanation` (text)

### Risk
- `id` (PK), `analysis_id` (FK → Analysis, indexed), `rank` (smallint, 1–3), `title`, `plain_language_description` (text)
- Unique constraint `(analysis_id, rank)`

### DoctorQuestion
- `id` (PK), `analysis_id` (FK → Analysis, indexed), `question` (text), `position` (smallint)

**Relationships:**
- `User 1 ── ∞ Medication`
- `User 1 ── ∞ Analysis`
- `Analysis ∞ ── ∞ Medication` (via `AnalysisMedication`)
- `Analysis 1 ── ∞ InteractionEdge / Risk / DoctorQuestion`

**Cascade rule:** deleting a User cascades to RefreshTokens, Medications, Analyses, and all child records.

---

## MODULES

### Module 1: Authentication
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/register | Create account |
| POST | /api/v1/auth/login | Get access + refresh tokens |
| POST | /api/v1/auth/refresh | Rotate refresh token |
| POST | /api/v1/auth/logout | Revoke refresh token |
| GET | /api/v1/auth/me | Current user profile |
| PUT | /api/v1/auth/me | Update profile |
| POST | /api/v1/auth/forgot-password | Trigger reset email (always 200) |
| POST | /api/v1/auth/reset-password | Complete reset |
| GET | /api/v1/auth/google/login | OAuth init (post-MVP) |
| GET | /api/v1/auth/google/callback | OAuth callback (post-MVP) |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /login | LoginPage | LoginForm, PasswordField |
| /register | RegisterPage | RegisterForm |
| /forgot-password | ForgotPasswordPage | ForgotForm |
| /reset-password | ResetPasswordPage | ResetForm |
| /profile | ProfilePage | ProfileForm (protected) |

---

### Module 2: Medications
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/medications | List user's medications |
| POST | /api/v1/medications | Add medication (manual) |
| GET | /api/v1/medications/{id} | Get medication |
| PUT | /api/v1/medications/{id} | Update medication |
| DELETE | /api/v1/medications/{id} | Delete medication |
| POST | /api/v1/medications/scan | Upload photo → OCR candidate |
| POST | /api/v1/medications/scan/confirm | Confirm OCR result → persist |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /medications | MedicationListPage | MedicationCard, EmptyState |
| /medications/new | MedicationCreatePage | MedicationForm |
| /medications/scan | MedicationScanPage | PhotoUploader, OCRReviewForm |
| /medications/:id | MedicationDetailPage | MedicationForm (edit mode) |

**Services (backend):**
- `services/ocr_service.py` — wraps Tesseract or cloud OCR; returns structured `{name, dosage, raw_text}` candidate
- `services/storage_service.py` — uploads photos to S3-compatible bucket with private ACL, returns signed URL

---

### Module 3: Interactions
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/interactions/analyze | Run analysis on medication IDs (returns analysis_id) |
| GET | /api/v1/interactions/{id} | Full analysis (graph, risks, questions, summary) |
| GET | /api/v1/interactions/{id}/export | PDF/printable report (post-MVP) |
| DELETE | /api/v1/interactions/{id} | Delete analysis |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /interactions/new | NewAnalysisPage | MedicationPicker, RunAnalysisButton |
| /interactions/:id | AnalysisDetailPage | InteractionGraph, RiskList, DoctorQuestionList, Disclaimer, ExportButton |

**Services (backend):**
- `services/interaction_analysis_service.py` — calls Anthropic Claude API with the medication list, validates the LLM response against a Pydantic schema, persists `Analysis`, `InteractionEdge`, `Risk`, `DoctorQuestion`

**LLM contract (Pydantic-validated):**
```json
{
  "summary": "string",
  "edges": [{"drug_a": "string", "drug_b": "string", "severity": "red|yellow|green", "explanation": "string"}],
  "risks": [{"rank": 1, "title": "string", "plain_language": "string"}],
  "doctor_questions": ["string", "string", "string"]
}
```

---

### Module 4: History
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/history | Paginated past analyses |
| GET | /api/v1/history/compare | Compare two analyses (post-MVP) |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /history | HistoryListPage | AnalysisRow, Pagination |
| /history/compare | HistoryComparePage | SideBySideViewer (post-MVP) |

---

### Module 5: Dashboard
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/dashboard/summary | Aggregates for current user |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /dashboard | DashboardPage | StatCard, RecentActivity, NewAnalysisCTA |
| /settings | SettingsPage | AccountSettingsForm, DeleteAccountButton |

---

### Module 6: Admin Panel (Post-MVP)
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/admin/users | List users (admin only) |
| PUT | /api/v1/admin/users/{id} | Update user status |
| GET | /api/v1/admin/stats | Platform stats |
| GET | /api/v1/admin/analytics | Usage metrics |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /admin | AdminDashboardPage | StatCard, AlertList |
| /admin/users | UserManagementPage | UserTable, RoleSelect |
| /admin/analytics | AnalyticsPage | ChartGrid |

---

## PHASE EXECUTION PLAN

**Phase 1: Foundation (4 agents in parallel)**
- DATABASE-AGENT: All 7 models (User, RefreshToken, Medication, Analysis, AnalysisMedication, InteractionEdge, Risk, DoctorQuestion), Alembic migrations, `database.py`
- BACKEND-AGENT: `main.py`, `config.py`, project structure, JWT helpers, base auth dependencies
- FRONTEND-AGENT: Vite + TS + Chakra setup, folder structure, auth context, API client, base components (PageShell, ProtectedRoute, Disclaimer)
- DEVOPS-AGENT: `Dockerfile` (backend + frontend), `docker-compose.yml` (incl. Postgres + S3-compatible MinIO for dev), `.env.example`, GitHub Actions CI workflow

**Validation Gate 1:** `pip install -r requirements.txt`, `alembic upgrade head`, `npm install`, `docker-compose config`

**Phase 2: Modules (backend + frontend pairs in parallel)**
- Auth Module: register/login/refresh/me/logout endpoints + Login/Register/Profile pages
- Medications Module: CRUD + scan/scan-confirm endpoints + List/New/Scan/Detail pages + OCR + storage services
- Interactions Module: analyze + get + delete endpoints + NewAnalysis/AnalysisDetail pages + LLM service + Pydantic-validated response handling + InteractionGraph component
- History Module: list endpoint + History list page
- Dashboard Module: summary endpoint + Dashboard + Settings pages

**Validation Gate 2:** `ruff check backend/`, `mypy backend/`, `npm run lint`, `npm run type-check`

**Phase 3: Quality (3 agents in parallel)**
- TEST-AGENT: pytest unit + integration tests (auth flow, ownership checks, OCR mocked, LLM mocked, analysis schema validation), RTL component tests, target 80%+ coverage
- REVIEW-AGENT: Security audit (ownership checks, rate limits, secret handling, photo ACL), privacy audit (no PHI in logs, account deletion cascade), Pydantic strictness, LLM response validation
- DEVOPS-AGENT (final pass): production Dockerfile, prod env handling, health endpoint

**Final Validation:** `pytest --cov --cov-fail-under=80`, `npm test`, `docker-compose up -d`, `curl localhost:8000/health`, smoke test of `/api/v1/interactions/analyze` with mocked LLM

---

## VALIDATION GATES

| Gate | Commands |
|------|----------|
| 1 (Foundation) | `alembic upgrade head` ; `npm install` ; `docker-compose config` |
| 2 (Modules) | `ruff check backend/` ; `mypy backend/` ; `npm run lint` ; `npm run type-check` |
| 3 (Tests) | `pytest --cov --cov-fail-under=80` ; `npm test -- --coverage` |
| Final | `docker-compose up -d` ; `curl -f localhost:8000/health` ; OpenAPI spec generates without errors |

---

## SECURITY & PRIVACY GATES (CRITICAL — patient data)

These must pass before MVP launch. REVIEW-AGENT enforces:

- [ ] Every medication/analysis query filters by `user_id` (no broken object-level auth)
- [ ] Bcrypt for passwords; refresh tokens stored hashed and rotated on use
- [ ] Rate limiting on `/auth/login`, `/auth/register`, `/auth/forgot-password`
- [ ] Photo uploads stored with private ACL; served via short-lived signed URLs
- [ ] Logs never contain medication names, OCR raw text, or full emails at INFO/DEBUG
- [ ] LLM responses validated with Pydantic before persistence
- [ ] Disclaimer rendered on every analysis page
- [ ] `DELETE /auth/me` (or settings flow) cascades to all user data
- [ ] HTTPS enforced in prod; HSTS header set
- [ ] No secrets in repo; all via environment variables

---

## ENVIRONMENT VARIABLES

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/polypharmacy

# Auth
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Google OAuth (post-MVP)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-7

# OCR
TESSERACT_PATH=/usr/bin/tesseract
# OR
OCR_API_KEY=...

# Object storage (S3-compatible; MinIO for local dev)
S3_BUCKET=polypharmacy-photos
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT_URL=  # set for MinIO; empty for AWS S3

# Frontend
VITE_API_URL=http://localhost:8000
```

---

## NEXT STEP

Execute with parallel agents:

```bash
/execute-prp PRPs/polypharmacy-interaction-visualizer-prp.md
```
