# Contract map (source-checked 2026-11-17)

This is a navigation and change-impact map for the fork at inspection time. Read the referenced files for exact request/response fields and status codes; this table deliberately does not invent a uniform API envelope. Some handlers return `{data}` or `{error: {code, message}}`, whereas `src/app/api/profile/route.ts` and `src/app/api/jobs/route.ts` return plain string errors. Recheck the tree for additions before editing.

## Data shapes and persistence

| Boundary | Source | Change impact |
| --- | --- | --- |
| Profile and student facts | `src/contracts/student.ts`, `src/app/api/profile/route.ts`, `supabase/migrations/` | Fact IDs, timestamps and snapshot evidence for résumé generation |
| Job draft/posting and enums | `src/contracts/job.ts`, `src/lib/jobs/parse-job-input.ts` | Parser, published browser, private import and listing status |
| Match result/résumé version | `src/contracts/resume.ts`, `src/lib/claude/resume-handlers.ts` | Fact evidence, edited bullets, own-version reads |
| Tables and access policies | `supabase/migrations/20261113200000_career_forge_initial.sql`, `supabase/migrations/20261114091500_security_integrity_fixes.sql` | `profiles`, `user_roles`, `employers`, `student_facts`, `jobs`, `saved_applications`, `resume_versions`, `job_views`; check grants, constraints and RLS before writes |

## HTTP routes in `src/app/api/`

| Method/path | Code | Source-observed behavior |
| --- | --- | --- |
| GET `/api/profile` | `profile/route.ts` | Own consistent snapshot via `read_student_profile`, 401 signed out |
| PATCH `/api/profile` | `profile/route.ts` | Bounded authenticated save via `save_student_profile`; locks profile, compares exact expectedUpdatedAt, updates profile/facts in one transaction; 409 stale, 400 invalid, 403 role denial, 503 unavailable |
| POST `/api/jobs/parse` | `jobs/parse/route.ts` | Bounded, stateless job preview; no save |
| POST `/api/jobs` | `jobs/route.ts` | Compatibility alias of `/api/jobs/import`; same bounded body and `{data}`/structured errors (200 on save) |
| POST `/api/jobs/import` | `jobs/import/route.ts` | Canonical authenticated import; session-scoped adapter forces pasted/private/unverified provenance |
| GET `/api/jobs/[id]` | `jobs/[id]/route.ts` | Session-scoped RLS read; own private or authorized employer job, 404 for missing/foreign rows, 401 signed out |
| POST `/api/resume/suggest` | `resume/suggest/route.ts` | Handler lacks data/model dependencies; fail-closed |
| GET, PATCH `/api/resume/[id]` | `resume/[id]/route.ts` | Own-version handler lacks adapter; fail-closed |
| POST `/api/prep/questions` | `prep/questions/route.ts` | Handler depends on absent live job/fact/model wiring; check implementation before enabling |
| POST `/api/prep/buzzwords` | `prep/buzzwords/route.ts` | Handler depends on absent job/model wiring; check implementation before enabling |
| GET `/api/prep/news` | `prep/news/route.ts` | Handler behavior is conditional on provider environment; check provider before claiming live news |

The published list and authorized detail pages read through `src/lib/jobs/job-adapter.ts`, not through `/api/jobs`. Client-side job import uses `src/app/(student)/jobs/job-api-client.ts`. Import requests are enabled. Detail reads allow own private jobs. Database configuration is required; failures never return a saved state.

T-001: `JobDraftSchema` trims and bounds title/company at 300 characters, matching SQL. Migration `20261117210000_private_job_import.sql` restricts direct ordinary-user imports to unverified pasted rows with null provider provenance. The security follow-up guards duplicate constraints for fresh migration replay; no shared database was altered.

## Configuration and test boundary

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configure browser/server clients; `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_URL` appear in isolated E2E configuration. `ANTHROPIC_API_KEY` and `CLAUDE_MODEL` are server-side AI settings; `JOB_SEARCH_PROVIDER` selects a provider or `none`; `APP_URL` is the redirect base. `CAREERFORGE_E2E_JOBS_FIXTURE` and `CAREERFORGE_E2E_PROFILE_FIXTURE` enable fictional test paths. Names and intended uses are in `.env.example`; inspect actual reads before changing defaults. Do not put privileged keys behind `NEXT_PUBLIC_`.

The CI workflow `.github/workflows/ci.yml` sets both fixture flags and runs `npm ci`, typecheck, Vitest, build and Playwright smoke. For a contract change run those checks and focused tests around the modified route. Verify authenticated database behavior separately; CI fixture success does not establish migration status or RLS on a deployed project.

## Atomic profile saves (T-002)

`ProfileUpdateSchema` is shared in `src/contracts/student.ts`; duplicate IDs, per-entry lengths and 30,000 combined fact characters are bounded. `expectedUpdatedAt` is an opaque ISO timestamp retaining PostgreSQL microseconds, never converted through JavaScript Date. `read_student_profile()` returns profile plus facts in one statement. `save_student_profile(timestamptz,text,text,jsonb)` locks the authenticated student's row and performs CAS plus fact replacement atomically. A trigger guarantees a strictly newer version even within one transaction. Foreign fact IDs are invalid; identity cannot be provided by the client.

Migration `20261117220000_atomic_profile.sql` revokes direct profile/fact writes from authenticated clients so REST requests cannot bypass the transaction/version boundary. The narrowly scoped SECURITY DEFINER save function pins its search path, validates input, requires the student role and restricts every write to `auth.uid()`. Own reads retain RLS. No production migrations were applied.
