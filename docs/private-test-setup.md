# Set up private student-journey verification

Use a new, isolated Supabase project containing only fictional data. Supabase isolation, live persistence and external Anthropic behavior remain **UNVERIFIED** until the corresponding real-service checks pass. The local PostgreSQL/auth-shim exercises are lower-level SQL checks only.

## 1. Create the schema before the accounts

Create a development project in your own Supabase organization. In its SQL Editor, run these repository migrations once, in order:

1. `supabase/migrations/20261113200000_career_forge_initial.sql`
2. `supabase/migrations/20261114091500_security_integrity_fixes.sql`
3. `supabase/migrations/20261117210000_private_job_import.sql`
4. `supabase/migrations/20261117220000_atomic_profile.sql`
5. `supabase/migrations/20261117230000_resume_edit_boundary.sql`

Stop if any migration fails and preserve the error for investigation. Do not use the test auth shim in Supabase, rerun the initial migration on an existing schema, or reset a shared project. SQL Editor normally uses a privileged role: merely seeing rows there does not test RLS.

## 2. Create two fictional students

Enable email/password sign-in. In **Authentication → Users → Add user**, create these as confirmed users, using two different generated passwords stored privately:

- `student-a@careerforge-test.example`
- `student-b@careerforge-test.example`

Use user creation rather than email invitations: the reserved `.example` addresses cannot receive confirmation mail. The initial migration's auth trigger should create one profile and one `student` role for each new user. If the accounts were created before migrations, create fresh fictional accounts afterward so the trigger runs; do not manually promote roles through the application.

Set Auth's Site URL to the app URL used for testing, normally `http://127.0.0.1:3000`. Allow `http://localhost:3000` as a local redirect URL if you use it.

## 3. Attach private configuration to the execution environment

Enter these in the environment's private/secret settings, **not chat or Git**. Obtain keys from the isolated project's API settings.

| Variable | Value/purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Isolated project's HTTPS URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (or legacy anon key); used by ordinary sessions |
| `SUPABASE_SECRET_KEY` | Server-only secret key (or legacy service-role key); required for trusted résumé insertion and its DB test |
| `E2E_ISOLATED_DB` | `1`, explicitly authorizing the guarded tests against this isolated project |
| `E2E_STUDENT_A_EMAIL` | Fictional account A's email |
| `E2E_STUDENT_A_PASSWORD` | Account A's private password |
| `E2E_STUDENT_B_EMAIL` | Fictional account B's email |
| `E2E_STUDENT_B_PASSWORD` | Account B's private password |
| `CAREERFORGE_E2E_JOBS_FIXTURE` | `0` for real-service checks |
| `CAREERFORGE_E2E_PROFILE_FIXTURE` | `0` for real-service checks |

Only URL/publishable-key variables use `NEXT_PUBLIC_`. Keep the privileged key and both passwords server/test-side. No database password or Supabase management token is needed by these app checks when migrations are applied through the dashboard.

For now, leave `ANTHROPIC_API_KEY` and `CLAUDE_MODEL` unset. New AI suggestions will be visibly unavailable. The résumé DB test injects a model response inside the test process and verifies actual storage/authorization/edit/reload; it does not verify Anthropic. Later, actual AI verification requires both a server-only `ANTHROPIC_API_KEY` and an explicitly confirmed provider `CLAUDE_MODEL` ID.

## 4. Build and run the guarded checks

After attaching settings, refresh/restart the execution environment if needed so new processes inherit them. Use Node 24. With the private variables already present in the process environment:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run smoke -- --project=desktop --workers=1 tests/e2e/dallas-private-jobs-db.spec.ts tests/e2e/profile-db.spec.ts tests/e2e/resume-db.spec.ts
```

Install Chromium once with `npx playwright install chromium` if the environment lacks Playwright's browser. This managed environment also has `/usr/bin/chromium`; the recorded local runs use a scratch config selecting that executable. Stop any separately running port-3000 app before Playwright starts its own server. A rebuild is required after changing the public Supabase settings.

These tests intentionally create/update fictional job, profile and résumé records. They do not delete/reset project data. They sign in through the UI, use ordinary cookie sessions, reload persisted work and attempt cross-account access. Run serially against the isolated project to avoid tests competing over the same two profiles. Do not substitute real student accounts. Record exact results before marking acceptance complete; skipped tests prove nothing about isolation.

See [testing](testing.md) for fixture and stock-PostgreSQL boundaries. Saved applications and calendar stay fictional until T-004/T-005 are implemented.
