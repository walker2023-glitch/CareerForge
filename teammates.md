# Current project state

Updated 2026-11-17 from the source tree of `walker2023-glitch/CareerForge` on `main`. This file is a short handoff, not an assignment sheet. Recheck `main` and the active PRs before relying on a status here.

The fork retains code from a four-person hackathon. Ownership now lives on each [task](tasks/INDEX.md); the former `assignments/` folder and dated deadlines are no longer active instructions. Prior teammates and PR links may still appear in historical comments and `demo/` files; they do not grant current ownership or prove current deployment state.

## Confirmed in source

| Area | Observed state | Evidence |
| --- | --- | --- |
| Auth/profile | Supabase password sign-in page, server profile read and PATCH route; live use requires configuration and database | `src/app/sign-in/page.tsx`, `src/app/(student)/profile/page.tsx`, `src/app/api/profile/route.ts` |
| Jobs | Published-job DB reader and pasted-job parser; private save and authorized detail reads are connected conditionally | `src/lib/jobs/job-adapter.ts`, `src/app/api/jobs/parse/route.ts`, `src/app/(student)/jobs/job-api-client.ts` |
| Match/résumé | Sample match screen; generation/read/edit HTTP routes lack connected persistence adapters | `src/app/(student)/match/[id]/page.tsx`, `src/app/api/resume/` |
| Saved/calendar | Fictional preview pages; edits are not durable | `src/app/(student)/saved/page.tsx`, `src/app/(student)/calendar/page.tsx` |
| Tests | CI typechecks, tests, builds and runs fixture-based Chromium smoke | `.github/workflows/ci.yml` |

Live deployment, applied migrations on this fork's project, AI provider availability, and end-to-end two-account isolation are **UNKNOWN** from repository inspection. See [feature evidence](docs/demo-claims.md) for the fuller route map.

## Next work

Start with [T-001](tasks/T-001.md) to reconcile the student journey and resolve the split private-import behavior. Then [T-002](tasks/T-002.md) addresses atomic profile persistence and authorization; [T-003](tasks/T-003.md) connects evidence-backed résumé generation. Pick a task owner when work starts. For each handoff, record owner, changed paths, observed results, checks actually run, blockers, and next action in that task.
