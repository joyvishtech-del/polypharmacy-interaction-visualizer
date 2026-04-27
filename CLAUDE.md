# CLAUDE.md - Polypharmacy Interaction Visualizer Project Rules

> Project-specific rules for Claude Code. This file is read automatically.

---

## Project Overview

**Project Name:** Polypharmacy Interaction Visualizer
**Description:** Patient-facing AI tool that takes medications (manual or photo+OCR) and returns an interaction graph, top-3 plain-language risks, and questions to ask the doctor.

**Tech Stack:**
- Backend: FastAPI + Python 3.11+
- Frontend: React + Vite + TypeScript
- Database: PostgreSQL + SQLAlchemy
- Auth: JWT (Email/Password + Google OAuth, post-MVP)
- UI: Chakra UI
- AI: Anthropic Claude API for interaction analysis
- OCR: Tesseract (or cloud OCR API)
- Graph rendering: React Flow (recommended) or Cytoscape.js

---

## Project Structure

```
polypharmacy-interaction-visualizer/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── refresh_token.py
│   │   │   ├── medication.py
│   │   │   ├── analysis.py
│   │   │   ├── interaction_edge.py
│   │   │   ├── risk.py
│   │   │   └── doctor_question.py
│   │   ├── schemas/
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── medications.py
│   │   │   ├── interactions.py
│   │   │   ├── history.py
│   │   │   ├── dashboard.py
│   │   │   └── admin.py
│   │   ├── services/
│   │   │   ├── ocr_service.py
│   │   │   ├── interaction_analysis_service.py
│   │   │   └── storage_service.py
│   │   └── auth/
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── medications/
│   │   │   ├── interactions/
│   │   │   │   └── InteractionGraph.tsx
│   │   │   └── shared/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── context/
│   │   └── types/
│   └── package.json
├── .claude/
│   └── commands/
├── skills/
├── agents/
└── PRPs/
```

---

## Code Standards

### Python (Backend)
```python
# ALWAYS use type hints
def get_medication(db: Session, medication_id: int) -> Medication:
    pass

# ALWAYS add docstrings for public functions
def create_medication(db: Session, user_id: int, data: MedicationCreate) -> Medication:
    """
    Create a new medication for a user.

    Args:
        db: Database session
        user_id: Owner of the medication
        data: Medication creation data

    Returns:
        Created Medication object
    """
    pass

# ALWAYS use async for I/O-bound endpoints
@router.post("/medications")
async def create(data: MedicationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pass
```

### TypeScript (Frontend)
```typescript
// ALWAYS define interfaces for props and data
interface Medication {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
  source: 'manual' | 'ocr';
  photoUrl?: string;
}

// NO any types allowed
const fetchMedication = async (id: number): Promise<Medication> => {
  // ...
};

// Severity is a strict union, never a string
type Severity = 'red' | 'yellow' | 'green';
```

---

## Forbidden Patterns

### Backend
- Never use `print()` — use the `logging` module
- Never store passwords in plain text — bcrypt only
- Never hardcode secrets — use environment variables
- Never use `SELECT *` — specify columns
- Never skip input validation — every endpoint takes a Pydantic schema
- Never return another user's medications, analyses, or photos — every query MUST filter by `user_id`
- Never log raw OCR text or medication names at INFO level — treat as sensitive

### Frontend
- Never use the `any` type
- Never leave `console.log` in production code
- Never skip error handling in async operations
- Never use inline styles — use Chakra UI components and theme tokens
- Never display medical advice as authoritative — always pair with the disclaimer

---

## Module-Specific Rules

### Medications Module
- Every `Medication` row MUST have a `user_id`; queries MUST filter by current user
- `source` is an enum: `manual` | `ocr` — never a free-form string
- OCR-extracted fields MUST be reviewable/editable by the user before persistence
- Medication photos go to private object storage; serve via signed URLs only
- File upload size limit: 10MB; accepted MIME types: `image/jpeg`, `image/png`, `image/webp`

### Interactions Module
- An `Analysis` MUST reference at least 2 medications, all owned by the same user
- `severity` enum is strict: `red` | `yellow` | `green` — never extend without UI updates
- Top risks are exactly 3, ranked 1–3
- LLM responses MUST be validated against a Pydantic schema before persisting (never trust raw LLM output)
- Every analysis page MUST display the medical disclaimer

### History Module
- List queries MUST be paginated (default 20 per page)
- Compare endpoint requires both analyses to belong to the requesting user

### Auth Module
- Access tokens expire in 30 minutes; refresh tokens in 7 days
- Refresh tokens are rotated on use and stored hashed
- `forgot-password` MUST NOT reveal whether an email is registered (always return 200)

---

## API Conventions

- All endpoints prefixed with `/api/v1/`
- Use plural nouns for resources: `/medications`, `/interactions`, `/history`
- Return appropriate HTTP status codes:
  - 200: Success
  - 201: Created
  - 202: Accepted (for async analysis runs)
  - 204: No Content (delete)
  - 400: Bad Request
  - 401: Unauthorized
  - 403: Forbidden (resource exists, but not yours)
  - 404: Not Found
  - 409: Conflict
  - 422: Validation error (Pydantic)
  - 429: Rate limited

---

## Authentication

### JWT Configuration
- Access token expires: 30 minutes
- Refresh token expires: 7 days
- Algorithm: HS256
- Refresh tokens are rotated on every use

### OAuth Providers (Post-MVP)
- Google OAuth 2.0
- Always verify the `state` parameter for CSRF protection
- Link OAuth identity to existing user by verified email

---

## Privacy & Compliance

This product handles patient medication data. Treat it as PHI-equivalent even if not formally HIPAA-regulated.

- Encrypt at rest: DB columns containing medication names and OCR text should use field-level encryption where practical, otherwise rely on disk encryption
- Encrypt in transit: HTTPS only
- Logs MUST NOT contain medication names, OCR raw text, or user emails at INFO/DEBUG level
- Provide a working "delete my account" endpoint that cascades to medications, analyses, photos
- Display the informational-only disclaimer on every analysis page

---

## Environment Variables

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
GOOGLE_CLIENT_SECRET=your-client-secret

# Anthropic Claude (interaction analysis)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-7

# OCR (choose one)
TESSERACT_PATH=/usr/bin/tesseract
# or cloud OCR
OCR_API_KEY=...

# Object storage (S3-compatible)
S3_BUCKET=polypharmacy-photos
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...

# Frontend
VITE_API_URL=http://localhost:8000
```

---

## Development Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev

# Docker
docker-compose up -d

# Tests
pytest backend/tests -v
cd frontend && npm test

# Linting
ruff check backend/
cd frontend && npm run lint && npm run type-check
```

---

## Commit Message Format

```
feat(medications): add OCR scan endpoint
fix(auth): rotate refresh token on use
refactor(interactions): extract LLM client to service layer
test(medications): add ownership-check tests
docs: update analysis disclaimer copy
```

---

## Skills Reference

| Task | Skill to Read |
|------|---------------|
| Database models | skills/DATABASE.md |
| API + Auth | skills/BACKEND.md |
| React + UI | skills/FRONTEND.md |
| Testing | skills/TESTING.md |
| Deployment | skills/DEPLOYMENT.md |

---

## Agent Coordination

For complex tasks, the ORCHESTRATOR coordinates:
- DATABASE-AGENT → Backend models + migrations
- BACKEND-AGENT → API, auth, OCR + LLM integration
- FRONTEND-AGENT → UI pages, graph viewer, OCR review flow
- TEST-AGENT → Testing
- REVIEW-AGENT → Security + privacy review (especially around PHI handling)
- DEVOPS-AGENT → Docker, CI/CD, secrets management

Read agent definitions in `/agents/` folder.
