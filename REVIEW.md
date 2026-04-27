# REVIEW.md - Polypharmacy Interaction Visualizer Security & Privacy Audit

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL (red) | 5 |
| MEDIUM (yellow) | 8 |
| LOW (green) | 5 |

Overall: solid privacy posture (strong logging discipline, ownership filters, Pydantic LLM validation, refresh-token hashing, photo private ACL). Two genuine security holes plus a routing bug that breaks the entire medications API. Must NOT ship until critical items are resolved.

---

## CRITICAL

### C1. Double-prefix breaks every medication route
`backend/app/routers/medications.py:47` declares `APIRouter(prefix="/api/v1/medications")`, but `backend/app/main.py:136` mounts it with an additional `/api/v1` prefix. Resulting URLs are `/api/v1/api/v1/medications/...` — the frontend (which hits `/api/v1/medications/...`) cannot reach any medication endpoint. All other routers (`auth`, `interactions`, `history`, `dashboard`) use bare `/auth`, `/interactions` style prefixes; medications is the inconsistent one. Fix: change line 47 to `prefix="/medications"`.

### C2. BOLA on OCR confirm — photo_url is unvalidated client input
`backend/app/routers/medications.py:317-339` accepts `payload.photo_url` from the client and stores it directly as the medication's `photo_url`. There is no check that the supplied object key was actually uploaded by `current_user`. A malicious user can submit `medications/<otherUserId>/<known-uuid>.jpg` (or any key) and `_to_response` (line 99) will mint a signed URL for it — letting them read another user's medication photo. Fix: store object keys in a short-lived server-side table keyed to the uploader, or sign+verify the key in `/scan` and require the signed token on `/confirm`.

### C3. DELETE /auth/me does not exist — account deletion is broken
The PRP Security & Privacy Gates require account-deletion cascade. `frontend/src/pages/SettingsPage.tsx:55` calls `DELETE /auth/me`, but `backend/app/routers/auth.py` defines no DELETE handler. The frontend silently swallows 404/405 with a "Coming soon" toast (`SettingsPage.tsx:67-75`), so users believe deletion works. The DB cascade is configured (`models/user.py:54-68`), but no endpoint exercises it.

### C4. Tokens stored in localStorage — XSS-stealable
`frontend/src/services/api.ts:25` and `frontend/src/context/AuthContext.tsx:46-66` persist both access AND refresh tokens in `localStorage`. Any successful XSS gives an attacker a 7-day refresh token. The PRP calls medication data PHI-equivalent. Fix: refresh token in HttpOnly+Secure+SameSite=Strict cookie; access token in memory only.

### C5. Reset-password endpoint is a no-op stub
`backend/app/routers/auth.py:131-140` returns 200 without verifying the token or updating the password. Combined with the forgot-password stub (line 122) that never sends mail, the entire password-reset flow is non-functional. Ship-blocker for any account-recovery promise.

---

## MEDIUM

### M1. Refresh tokens not single-use on rotation race
`backend/app/services/auth_service.py:97-119` revokes the old refresh token then issues a new pair, but lookup is by `token_hash` only and there is no transaction lock. A concurrent refresh with the same token can succeed twice before the first commit revokes it. Wrap in `SELECT ... FOR UPDATE` or atomic `UPDATE ... WHERE revoked=false`.

### M2. CSP and HSTS missing
`frontend/nginx.conf:26-29` sets X-Frame-Options, X-Content-Type-Options, Referrer-Policy — but no `Content-Security-Policy` and no `Strict-Transport-Security`. PRP gate explicitly requires HSTS in prod.

### M3. Frontend nginx runs as root
`frontend/Dockerfile:17-31` does not switch to a non-root user. Backend Dockerfile correctly uses `appuser`; frontend should mirror this.

### M4. Rate limiter is in-memory only
`backend/app/routers/auth.py:33` uses `slowapi`'s default in-memory storage. With multiple uvicorn workers or container replicas the limit is per-process, so 5/min becomes 5*N/min. Comment on `main.py:113` flags this for post-MVP, but it is a real auth-brute-force gap today.

### M5. SECRET_KEY default in `database.py` and weak example
`backend/app/database.py:12-15` falls back to a hardcoded `postgresql://user:password@...` URL when `DATABASE_URL` is unset. `.env.example:13` ships `SECRET_KEY=change-me-in-production-use-a-long-random-string` which is harmless as a template, but config.py treats `SECRET_KEY` as required only via Pydantic — there is no startup assertion that it is not the placeholder.

### M6. `get_current_user` returns 403 for missing/invalid tokens, not 401
`backend/app/dependencies.py:55-73` raises `ForbiddenError` (HTTP 403) for missing/expired tokens. By RFC 7235 missing auth is 401; the frontend interceptor (`services/api.ts:37`) only triggers refresh on 401, so expired access tokens here never auto-refresh. Functional bug + spec violation.

### M7. OCR `raw_text` persisted in DB without redaction
`backend/app/models/medication.py:48` stores `ocr_raw_text` indefinitely. PRP marks it PHI-equivalent. While not logged (good), it should at minimum be deletable independently of the medication, and ideally retained only briefly. No retention policy is implemented.

### M8. `EmailStr` is the only email validation, but emails are still echoed in API errors
Login/register raise `ForbiddenError("Invalid email or password")` (good — no enumeration), but `register_user` raises `ConflictError("An account with this email already exists")` (`auth_service.py:41`) on duplicate registration, which IS an enumeration vector. Combine with rate-limited 200 on register or hash-and-defer.

---

## LOW

### L1. CORS allow_credentials with `allow_headers=["*"]`
`backend/app/main.py:47-53` — works but overly permissive. Restrict to needed headers (`Authorization`, `Content-Type`).

### L2. `dashboard_service.get_summary` recent_activity merges streams in Python
`backend/app/services/dashboard_service.py:85-131` issues two separate top-5 queries and merges. Fine for MVP; replace with UNION ALL for tighter bound and ordering.

### L3. `interactions.py` analyze endpoint runs LLM synchronously
`backend/app/routers/interactions.py:39-61` returns 202 status code but blocks on the LLM call (line 52). Misleading status; either move to BackgroundTasks or return 200/201 sync.

### L4. Frontend uses `localStorage.getItem` repeatedly for the same token
`AuthContext.tsx:45-50, 80-83, 129` and `api.ts:25,39` — multiple readers can drift. Centralize in a single util.

### L5. Disclaimer is a footer on every page (PageWrapper)
`frontend/src/components/layout/PageWrapper.tsx:27` — broadly compliant with PRP gate, but it shows on `/login`, `/register` etc., which is fine but slightly noisy. Acceptable.

---

## Recommendations (priority order)

1. Fix the medications router prefix (C1) — without this, no Phase-3 smoke test can pass.
2. Validate OCR `photo_url` server-side: have `/scan` issue a one-time `upload_token` keyed to user+key with short TTL, require it on `/confirm` (C2).
3. Implement `DELETE /auth/me` and exercise it from the existing SettingsPage flow (C3).
4. Move tokens off localStorage (C4): refresh in HttpOnly cookie, access token in JS memory.
5. Either complete forgot/reset password or remove the routes entirely until shipped (C5).
6. Wrap refresh-token rotation in a `with_for_update()` lock (M1).
7. Add `Content-Security-Policy` and `Strict-Transport-Security` to nginx (M2).
8. Switch frontend Dockerfile to nginx-unprivileged (M3).
9. Replace in-memory slowapi storage with Redis before the first multi-replica deploy (M4).
10. Standardize 401 vs 403 in `get_current_user` (M6) so the frontend refresh path actually fires.
