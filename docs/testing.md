# Verification boundaries

## Fixture checks

Run `npm ci`, `npm run typecheck`, `npm test`, then `CAREERFORGE_E2E_PROFILE_FIXTURE=1 CAREERFORGE_E2E_JOBS_FIXTURE=1 npm run build` and the relevant `npm run smoke` specs. Fixture pages explicitly label fictional data; no fixture is a database isolation or external-AI test. This environment used a local Playwright config selecting `/usr/bin/chromium`, with desktop/mobile projects unchanged.

## Isolated PostgreSQL checks

The session used `postgres:15-alpine` in the `careerforge_sql_verify` container, with no network or host ports. `tests/db/bootstrap-auth-shim.sql` creates minimal Supabase-style auth roles/functions so SQL policies can run on stock PostgreSQL. **It simulates JWT claims; it does not test Supabase Auth, cookie validation, PostgREST or browser reload. Never apply the shim to Supabase or any shared database.**

On a newly created disposable container only:

```sh
docker run -d --name careerforge_sql_verify --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:15-alpine
docker exec -i careerforge_sql_verify psql -U postgres -v ON_ERROR_STOP=1 < tests/db/bootstrap-auth-shim.sql
for migration in supabase/migrations/*.sql; do
  docker exec -i careerforge_sql_verify psql -U postgres -v ON_ERROR_STOP=1 < "$migration" || exit 1
done
for check in tests/db/jobs-private.sql tests/db/profile-atomic.sql tests/db/resume-ownership.sql; do
  docker exec -i careerforge_sql_verify psql -U postgres -v ON_ERROR_STOP=1 < "$check" || exit 1
done
python tests/db/profile-concurrency.py careerforge_sql_verify
```

Transaction checks roll back fictional rows. The concurrency check commits fictional rows to allow separate connections, and retains them in the disposable container. It asserts one concurrent commit, one stale conflict and a fresh connection seeing the winner. Container removal is separate; these commands do not reset or clean a shared database.

## Real Supabase browser checks

Follow the [private setup guide](private-test-setup.md) for exact variables, migration order and fictional account creation.

Use an explicitly approved isolated Supabase project with all migrations applied and two **fictional** student accounts. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `E2E_ISOLATED_DB=1`, and `E2E_STUDENT_{A,B}_{EMAIL,PASSWORD}` through the execution environment's private settings (or an uncommitted `.env.local` for separate local development). Résumé insertion also needs server-only `SUPABASE_SECRET_KEY`. Disable both fixture flags. Never print or commit values. Rebuild so public configuration reaches the browser, then:

```sh
npm run build
npm run smoke -- --project=desktop --workers=1 tests/e2e/dallas-private-jobs-db.spec.ts tests/e2e/profile-db.spec.ts tests/e2e/resume-db.spec.ts
```

The résumé database spec injects a model response only in the test process, then exercises the real database and browser read/edit/reload routes. It does not call Anthropic. Production has no model-fixture switch. An actual AI smoke check additionally requires configured `ANTHROPIC_API_KEY` and an explicitly confirmed `CLAUDE_MODEL`; only that can verify the external provider.

## Observed infrastructure limitation

On 2026-11-17 the Supabase CLI v3.2.0 could not write its configuration under the read-only home. CLI v2.58.5 could initialize locally. Its PostgreSQL 17 image failed Docker layer registration with `no space left on device` under the managed VFS driver. The supported PostgreSQL 15 image failed the same way; both attempts were stopped without changing Docker settings. Stock PostgreSQL checks are reported distinctly; hosted deployment and external AI remain UNKNOWN unless independently observed.
