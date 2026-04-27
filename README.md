# Polypharmacy Interaction Visualizer

> An AI-powered web app that helps patients understand drug-drug interactions across all the medications they take — with a colour-coded interaction graph, plain-language top-3 risks, and questions to bring to their doctor.

---

## Why this exists

Most patients on multiple prescriptions never see their full medication list analysed for interactions. Pill bottles get added one prescriber at a time, leaflets are ignored, and the patient is left to assume the system caught any dangerous combinations.

This product flips that. The patient enters every medication they're taking — by typing or photographing the bottle — and gets back:

1. **A visual interaction graph** with red / yellow / green edges so dangerous combinations are immediately obvious.
2. **A plain-language summary of the top three risks**, ranked by the AI.
3. **A printable list of questions to ask their doctor** at the next appointment.

It is informational, not medical advice — but it gives a patient (or caregiver) something concrete to walk into a clinic with.

---

## Who it's for

- **Patients on multiple prescriptions** (polypharmacy) who want to understand their own regimen.
- **Older adults and their caregivers** managing complex, multi-prescriber medication lists.
- **Anyone preparing for a doctor's visit** who wants to advocate for themselves with specific, informed questions.

---

## How it helps

| Pain | What this does |
|------|----------------|
| Confusing leaflets, no big-picture view | One screen, all your meds, colour-coded by severity |
| "Is this safe to take together?" anxiety | Plain-English explanation per interaction |
| Forgetting what to ask the doctor | Auto-generated, copy-pasteable question list |
| Manually retyping prescription names | Photo-of-bottle OCR entry |
| Losing past analyses | Every analysis is saved to your account history |

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | FastAPI (Python 3.11) | Fast, async, great OpenAPI docs |
| Frontend | React + Vite + TypeScript | Strict typing, fast dev loop, mature ecosystem |
| Database | PostgreSQL + SQLAlchemy 2.0 + Alembic | Relational integrity matters for health data |
| Auth | JWT (HS256) + bcrypt + HttpOnly refresh-token cookies | Refresh token never in localStorage |
| UI | Chakra UI v2 | Accessible by default; healthcare apps need that |
| Graph viz | React Flow | Smooth, interactive, well-maintained |
| AI | Anthropic Claude (`claude-opus-4-7`) | Plain-language clinical summarisation |
| OCR | Tesseract (with regex heuristics for MVP) | Free, self-hosted; clinical NER post-MVP |
| Storage | S3-compatible (MinIO in dev) | Photos kept private, served via signed URLs |
| Container | Docker Compose | Single-command boot |
| CI | GitHub Actions | Lint, type-check, test, build on every PR |

---

## Project structure

```
.
├── backend/                 FastAPI service
│   ├── app/
│   │   ├── main.py          App entrypoint, CORS, error handlers, router includes
│   │   ├── config.py        Pydantic Settings (env-driven)
│   │   ├── database.py      SQLAlchemy engine + session factory
│   │   ├── models/          SQLAlchemy 2.0 models (User, Medication, Analysis, ...)
│   │   ├── schemas/         Pydantic v2 request/response schemas
│   │   ├── routers/         API endpoints, one file per module
│   │   ├── services/        Business logic (auth, OCR, LLM, dashboard, storage)
│   │   └── auth/            JWT helpers, password hashing
│   ├── alembic/             Database migrations
│   ├── tests/               pytest unit + integration tests
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                React + Vite + TS app
│   └── src/
│       ├── pages/           One component per route
│       ├── components/      Layout, UI primitives, feature components
│       ├── services/        Typed Axios wrappers per backend module
│       ├── context/         AuthContext (React Context API)
│       ├── hooks/           Custom React hooks
│       └── types/           Shared TS types matching the API
├── docker-compose.yml       Production-style stack (Postgres + MinIO + backend + frontend)
├── docker-compose.dev.yml   Dev overrides (bind mounts, hot reload, exposed ports)
├── .env.example             Template for environment variables
├── .github/workflows/ci.yml Lint, type-check, test, build on every PR
├── PRPs/                    Implementation blueprints
├── REVIEW.md                Security + privacy audit (read before deploying!)
└── CLAUDE.md                Project rules for AI-assisted development
```

---

## Quick start (Docker — recommended)

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/polypharmacy-interaction-visualizer.git
cd polypharmacy-interaction-visualizer

# 2. Create your local env file
cp .env.example .env
# Open .env and fill in:
#   - SECRET_KEY (any long random string; `openssl rand -hex 32` works)
#   - ANTHROPIC_API_KEY (optional; without it the AI returns a deterministic stub)

# 3. Bring up the stack
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# 4. Run the initial database migration (first time only)
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend \
  alembic revision --autogenerate -m "initial"
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend \
  alembic upgrade head
```

Then open:

- **Frontend (Vite dev):** http://localhost:5173
- **Backend API docs:** http://localhost:8000/docs
- **MinIO console:** http://localhost:9001 (login: `minioadmin` / `minioadmin`)

To stop everything: `docker compose -f docker-compose.yml -f docker-compose.dev.yml down`

---

## Environment variables

All settings are read from `.env` at the project root. The minimum needed:

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `DATABASE_URL` | Postgres connection string | Yes |
| `SECRET_KEY` | JWT signing key — keep this secret in prod | Yes |
| `ANTHROPIC_API_KEY` | Claude API key for real interaction analysis | No (stub fallback) |
| `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_ENDPOINT_URL` | Object storage for medication photos | Yes (MinIO defaults work in dev) |
| `COOKIE_SECURE` | `false` for local http; `true` in prod (HTTPS only) | Yes |
| `FRONTEND_ORIGIN` | CORS origin for the SPA | Yes |
| `VITE_API_URL` | Backend URL the frontend points at | Yes |

See [`.env.example`](./.env.example) for the full list with sensible defaults.

---

## Running tests

```bash
# Backend (pytest)
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest -v

# Frontend (vitest)
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec frontend npm test
```

The CI workflow at `.github/workflows/ci.yml` runs the full lint + type-check + test + build matrix on every push and pull request.

---

## Privacy and safety

This product handles patient medication data. Even where formal HIPAA does not apply, this codebase treats medication lists as PHI-equivalent:

- All medication and analysis records are scoped to `user_id`; every query filters by the current user.
- Refresh tokens live in HttpOnly cookies, never in `localStorage`.
- Refresh tokens are stored hashed (SHA-256) and rotated on every use.
- Medication photos are uploaded to S3 with a private ACL and served only via short-lived signed URLs.
- LLM responses are validated against a Pydantic schema before persistence — never trust raw model output.
- Logs never contain medication names, OCR raw text, or full email addresses at INFO/DEBUG.
- The UI shows a clear "informational only, not medical advice" disclaimer on every analysis page.
- Accounts can be fully deleted, and deletion cascades to all owned data.

Before any production deploy, **read [`REVIEW.md`](./REVIEW.md)** — it lists the security findings from the build review along with what remains to be addressed.

---

## Roadmap

### MVP (shipped)
- [x] Email/password registration and login (HttpOnly refresh-token cookie, bcrypt, JWT)
- [x] Manual medication entry
- [x] Photo-of-bottle upload + OCR extraction (review screen before save)
- [x] Run an interaction analysis: graph + top-3 risks + doctor questions
- [x] History list of past analyses
- [x] Account deletion with cascade

### Post-MVP (planned)
- [ ] Link each risk to the specific graph edges it covers
- [ ] Google OAuth login
- [ ] PDF export of an analysis
- [ ] History compare (side-by-side diff between two analyses)
- [ ] Email delivery for password reset (currently logs the reset URL in dev)
- [ ] Admin panel
- [ ] Real clinical NER for OCR (current MVP uses regex heuristics)
- [ ] Replace in-memory rate limiter with Redis (per-process limits today)

---

## Important medical disclaimer

This software is **informational only** and is **not a substitute for professional medical advice, diagnosis, or treatment**. Always seek the advice of a qualified healthcare provider with any questions about your medications. Do not change, stop, or start any medication based on output from this tool without consulting your doctor.

---

## License

To be added before public release. Until then, no licence is granted; treat as "all rights reserved."
