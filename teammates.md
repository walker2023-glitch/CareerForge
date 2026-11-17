# Current project state

Updated 2026-11-17 from the source tree of `walker2023-glitch/CareerForge` on the stacked T-001/T-002/T-003 feature branches. This file is a short handoff, not an assignment sheet. Recheck `main` and the active PRs before relying on a status here.

The fork retains code from a four-person hackathon. Ownership now lives on each [task](tasks/INDEX.md); the former `assignments/` folder and dated deadlines are no longer active instructions. Prior teammates and PR links may still appear in historical comments and `demo/` files; they do not grant current ownership or prove current deployment state.

## Confirmed in source

| Area | Observed state | Evidence |
| --- | --- | --- |
| Auth/profile | Supabase password sign-in page, snapshot/CAS RPCs and atomic PATCH; isolated SQL tests pass, full Supabase browser checks blocked | `src/app/sign-in/page.tsx`, `src/app/(student)/profile/page.tsx`, `src/app/api/profile/route.ts` |
| Jobs | Published-job DB reader and pasted-job parser; private save and authorized detail reads are connected conditionally | `src/lib/jobs/job-adapter.ts`, `src/app/api/jobs/parse/route.ts`, `src/app/(student)/jobs/job-api-client.ts` |
| Match/résumé | Authorized jobs/facts, bounded provider, trusted generation insert and own read/edit paths connected; external AI unverified | `src/app/(student)/match/[id]/page.tsx`, `src/app/api/resume/` |
| Saved/calendar | Fictional preview pages; edits are not durable | `src/app/(student)/saved/page.tsx`, `src/app/(student)/calendar/page.tsx` |
| Tests | CI typechecks, tests, builds and runs fixture-based Chromium smoke | `.github/workflows/ci.yml` |

Local stock PostgreSQL migration, rollback, concurrent-writer and RLS checks passed with simulated JWT claims. This does not verify Supabase Auth/cookies. Both full Supabase local image attempts exceeded managed Docker storage. Live deployment, applied hosted migrations, external AI and end-to-end browser isolation remain **UNKNOWN**. See [feature evidence](docs/demo-claims.md) for the fuller route map.

## Next work

T-001 through T-003 are implemented and tested independently of unavailable external services; acceptance remains blocked on actual Supabase browser/provider checks. [T-004](tasks/T-004.md) and [T-005](tasks/T-005.md) define saved-application and calendar integration before implementation. Pick a task owner when work starts. For each handoff, record owner, changed paths, observed results, checks actually run, blockers, and next action in that task.
