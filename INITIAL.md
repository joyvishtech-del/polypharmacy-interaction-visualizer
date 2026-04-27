# INITIAL.md - Polypharmacy Interaction Visualizer Product Definition

> AI-powered tool that lets patients enter their medications (text or photo via OCR), then returns an interaction graph, top-3 risks in plain language, and questions to ask their doctor.

---

## PRODUCT

### Name
Polypharmacy Interaction Visualizer

### Description
A patient-facing web app that helps people understand drug-drug interactions across all the medications they take. Patients enter medications by typing them in or uploading a photo of the bottle (parsed via OCR). An AI engine analyzes the combination and returns:

- A **visual interaction graph** with nodes (medications) connected by red/yellow/green edges (severity)
- A **plain-language summary of the top 3 risks**
- A **list of questions to ask the doctor**

The product reduces medication-related anxiety, empowers patients to advocate for themselves at appointments, and surfaces potentially dangerous combinations early.

### Target User
Patients — particularly those on multiple prescriptions (polypharmacy), older adults, caregivers managing medications for family members, and anyone seeking clarity on their medication regimen before a doctor's visit.

### Type
- [x] SaaS (Software as a Service)

---

## TECH STACK

### Backend
- [x] FastAPI + Python 3.11+

### Frontend
- [x] React + Vite + TypeScript

### Database
- [x] PostgreSQL + SQLAlchemy

### Authentication
- [x] Email/Password + Google OAuth (JWT-based)

### UI Framework
- [x] Chakra UI

### Payments
- [ ] None (free product for MVP)

### AI / OCR
- [x] OCR for medication photos (e.g., Tesseract or cloud OCR API)
- [x] LLM-based interaction analysis (Anthropic Claude API)
- [x] Graph rendering (React Flow / Cytoscape.js / D3)

---

## MODULES

### Module 1: Authentication (Required)

**Description:** User authentication and authorization with email/password and Google OAuth.

**Models:**
- `User`: id, email, hashed_password, full_name, is_active, is_verified, oauth_provider, oauth_subject, role (user/admin), created_at, updated_at
- `RefreshToken`: id, user_id, token, expires_at, revoked, created_at

**API Endpoints:**
- `POST /api/v1/auth/register` — Create new account
- `POST /api/v1/auth/login` — Login with email/password
- `POST /api/v1/auth/refresh` — Refresh access token
- `POST /api/v1/auth/logout` — Revoke refresh token
- `GET /api/v1/auth/me` — Get current user profile
- `PUT /api/v1/auth/me` — Update profile
- `POST /api/v1/auth/forgot-password` — Trigger password reset email
- `POST /api/v1/auth/reset-password` — Complete password reset
- `GET /api/v1/auth/google/login` — Initiate Google OAuth (post-MVP)
- `GET /api/v1/auth/google/callback` — Google OAuth callback (post-MVP)

**Frontend Pages:**
- `/login` — Login page
- `/register` — Registration page
- `/forgot-password` — Forgot password page
- `/reset-password` — Reset password page
- `/profile` — User profile page (protected)

---

### Module 2: Medications

**Description:** Manage the patient's list of medications. Entries can be added manually or extracted from a photo of a medication bottle via OCR.

**Models:**
- `Medication`: id, user_id (FK), name, dosage, frequency, start_date, notes, source (enum: manual / ocr), photo_url (nullable), ocr_raw_text (nullable), created_at, updated_at

**API Endpoints:**
- `GET /api/v1/medications` — List current user's medications
- `POST /api/v1/medications` — Add medication (manual entry)
- `GET /api/v1/medications/{id}` — Get medication detail
- `PUT /api/v1/medications/{id}` — Edit medication
- `DELETE /api/v1/medications/{id}` — Delete medication
- `POST /api/v1/medications/scan` — Upload bottle photo, return OCR-parsed candidate medication for user review
- `POST /api/v1/medications/scan/confirm` — Confirm OCR result and persist as a medication

**Frontend Pages:**
- `/medications` — List of all medications
- `/medications/new` — Add medication (manual form)
- `/medications/scan` — Photo upload + OCR review screen
- `/medications/:id` — Detail / edit medication

---

### Module 3: Interactions

**Description:** Run an AI-powered interaction analysis across selected medications. Produces a graph, top-3 risks in plain language, and doctor questions.

**Models:**
- `Analysis`: id, user_id (FK), created_at, summary, status (enum: pending / completed / failed)
- `AnalysisMedication`: analysis_id (FK), medication_id (FK)  *(many-to-many join)*
- `InteractionEdge`: id, analysis_id (FK), drug_a, drug_b, severity (enum: red / yellow / green), explanation
- `Risk`: id, analysis_id (FK), rank (1–3), title, plain_language_description
- `DoctorQuestion`: id, analysis_id (FK), question

**API Endpoints:**
- `POST /api/v1/interactions/analyze` — Run analysis on a set of medication IDs (returns analysis_id, async-friendly)
- `GET /api/v1/interactions/{id}` — Get full analysis (graph edges, risks, questions, summary)
- `GET /api/v1/interactions/{id}/export` — Export analysis as PDF/printable report
- `DELETE /api/v1/interactions/{id}` — Delete analysis

**Frontend Pages:**
- `/interactions/new` — Select medications → run analysis
- `/interactions/:id` — View graph + top-3 risks + doctor questions + export button

---

### Module 4: History

**Description:** Browse, re-open, and compare past analyses. Reuses `Analysis` records from the Interactions module.

**API Endpoints:**
- `GET /api/v1/history` — List past analyses (paginated)
- `GET /api/v1/history/compare?a={id1}&b={id2}` — Compare two analyses side-by-side

**Frontend Pages:**
- `/history` — List of past analyses
- `/history/compare` — Side-by-side comparison view

---

### Module 5: Dashboard

**Description:** Landing page after login. Shows aggregate state and quick actions.

**Aggregates Surfaced:**
- Total medications on file
- Date of last analysis
- Highest severity from the most recent analysis
- Recent activity (last 5 events: med added, analysis run, etc.)

**API Endpoints:**
- `GET /api/v1/dashboard/summary` — Aggregated stats for current user

**Frontend Pages:**
- `/dashboard` — Main dashboard with widgets, stats, and a CTA to run a new analysis
- `/settings` — User settings and preferences

---

### Module 6: Admin Panel (Post-MVP)

**Description:** Admin-only management interface.

**API Endpoints:**
- `GET /api/v1/admin/users` — List all users
- `PUT /api/v1/admin/users/{id}` — Update user status (activate/deactivate, change role)
- `GET /api/v1/admin/stats` — Platform-wide statistics
- `GET /api/v1/admin/analytics` — Usage metrics, charts, reports

**Frontend Pages:**
- `/admin` — Admin dashboard (admin only)
- `/admin/users` — User management
- `/admin/analytics` — Analytics dashboard

---

## MVP SCOPE

### Must Have (MVP)
- [x] Email/password registration and login
- [x] Add medications manually (text entry)
- [x] File upload + OCR for medication bottle photos
- [x] Run interaction analysis → graph + top-3 risks + doctor questions
- [x] View past analyses (basic history list)

### Nice to Have (Post-MVP)
- [ ] Google OAuth login
- [ ] History compare (side-by-side)
- [ ] Email notifications (welcome, password reset, analysis-ready)
- [ ] Admin panel (user management)
- [ ] Analytics dashboard (usage metrics, charts, reports)
- [ ] Export analysis as PDF
- [ ] Mobile-optimized scan flow

---

## ACCEPTANCE CRITERIA

### Authentication
- [ ] User can register with email/password
- [ ] User can log in with email/password
- [ ] JWT access + refresh tokens work correctly
- [ ] Protected routes redirect unauthenticated users to `/login`
- [ ] Password is hashed with bcrypt (never stored in plain text)
- [ ] Rate limiting applied to `/auth/login` and `/auth/register`

### Medications
- [ ] User can add a medication manually (name, dosage, frequency)
- [ ] User can upload a photo and have name/dosage extracted via OCR
- [ ] User can review and edit OCR-extracted fields before saving
- [ ] User can edit and delete their own medications
- [ ] A user cannot see another user's medications

### Interactions
- [ ] User can select 2+ medications and run an analysis
- [ ] Analysis returns a graph with red/yellow/green severity edges
- [ ] Analysis returns exactly the top-3 risks in plain language
- [ ] Analysis returns at least 3 doctor questions
- [ ] Graph renders correctly on desktop and mobile

### History
- [ ] User sees a paginated list of their past analyses
- [ ] User can re-open any past analysis
- [ ] User can delete a past analysis

### Dashboard
- [ ] Dashboard loads for authenticated users
- [ ] Aggregate stats reflect the user's current data
- [ ] CTA to start a new analysis is prominent

### Quality
- [ ] All API endpoints documented in OpenAPI / Swagger
- [ ] Backend test coverage 80%+
- [ ] Frontend TypeScript strict mode passes (no `any`)
- [ ] Docker builds and runs successfully
- [ ] Linting passes (ruff for backend, eslint for frontend)

---

## SPECIAL REQUIREMENTS

### Security
- [x] Rate limiting on auth endpoints
- [x] Input validation on all endpoints (Pydantic schemas)
- [x] SQL injection prevention (parameterized queries via SQLAlchemy)
- [x] XSS prevention (escape rendered strings, sanitize OCR text)
- [x] CSRF protection on OAuth flows (state parameter)
- [x] All medication and analysis records scoped to `user_id` — strict ownership checks on every endpoint
- [x] Uploaded photos stored in object storage with private ACL; signed URLs only

### Privacy / Compliance
- [x] **Patient health data is sensitive.** Treat medication lists as PHI-equivalent.
- [x] Data encrypted at rest (DB + object storage)
- [x] Data encrypted in transit (HTTPS only)
- [x] Clear disclaimer in UI: this tool is informational, not medical advice
- [x] User can delete their account and all associated data (right to erasure)

### Integrations
- [x] OCR service (Tesseract self-hosted, or cloud OCR API)
- [x] Anthropic Claude API for interaction analysis
- [x] Object storage for medication bottle photos (S3-compatible)
- [ ] Email service (post-MVP, for notifications)

---

## AGENTS

> These agents will build your product in parallel:

| Agent | Role | Works On |
|-------|------|----------|
| DATABASE-AGENT | Creates all models and migrations | All database models |
| BACKEND-AGENT | Builds API endpoints, auth, and AI/OCR integration | All modules' backends |
| FRONTEND-AGENT | Creates UI pages, the graph viewer, and the OCR review flow | All modules' frontends |
| DEVOPS-AGENT | Sets up Docker, CI/CD, environments | Infrastructure |
| TEST-AGENT | Writes unit and integration tests | All code |
| REVIEW-AGENT | Security and code quality audit | All code |

---

# READY?

```bash
/generate-prp INITIAL.md
```

Then:

```bash
/execute-prp PRPs/polypharmacy-interaction-visualizer-prp.md
```
