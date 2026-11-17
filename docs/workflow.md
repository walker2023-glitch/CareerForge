# Build and learn with a small playbook

Adapted from the [agentic-playbook](https://github.com/drewcurley/agentic-playbook). Its useful lesson is **separating what the product does from the work being proposed**. This repo uses two ledgers:

| Ledger | Question it answers | Update it when |
| --- | --- | --- |
| `docs/` | What behavior and constraints have we verified? | A contract, capability, or consequential decision changes |
| `tasks/` | What are we trying to change, why, and how will we know it worked? | A task begins, moves, blocks, or completes |

The source and its tests remain the final evidence for current implementation. Documentation teaches future contributors what to check, and a task records the reasoning and proof for a specific change. Read the code as well as these files.

## Start a task

1. Pick an existing task from `tasks/INDEX.md` or copy `tasks/_TEMPLATE.md` with a new ID. Name one user outcome. Describe what is in scope and one example that would fail before the fix.
2. Trace the user journey across `src/app/` UI, `src/app/api/` handler, `src/contracts/` validation, Supabase migrations/RLS, and the relevant tests. Write down the observed state and any **UNKNOWN**. This prevents treating a plausible implementation plan as already shipped.
3. Review in three short passes: **product** (does the user get the intended outcome?), **design and data** (does the request cross authorization or contract boundaries?), **verification** (which positive and negative checks prove it?). One contributor can do all passes; note tradeoffs in the task.
4. Implement the smallest usable slice. If a contract changes, update `contracts.md` and its callers/tests with the code. Use a branch and a reviewable PR. There is no mandatory nine-agent sign-off or special git hook.
5. Run focused tests, `npm run typecheck`, `npm test`, `npm run build`, and relevant Playwright checks as feasible. Only claim checks actually run. For persistence, reload the page and test with a second fictional user in a real test database; fixture smoke alone proves UI wiring.
6. Update the task with results and risks; update `demo-claims.md` to reflect what a user can now actually do. Compare the PR diff against the task's intended paths. State what remains unverified.

## Worked example: private pasted job

**Goal:** A signed-in student pastes a description, saves it privately, and finds it again after reload.

**Trace:** `PasteJobForm.tsx` calls a preview parser; `job-api-client.ts` currently has `IS_JOB_PERSISTENCE_AVAILABLE = false`; `POST /api/jobs/import` fails closed while its adapter is missing; a separate `POST /api/jobs` directly inserts a private job. The existence of that second endpoint does not mean the user journey is connected or secure end to end.

**Plan check:** Decide on one import path and a single ownership model. Verify `JobDraftSchema` accepts the user input; derive identity server side; apply RLS; preserve the `private` status and unverified deadline. Include missing auth, cross-account read denial, duplicate/reload and database error cases.

**Proof:** In an isolated Supabase project, student A saves and reloads their private job; student B cannot read it; without a configured database the UI explains failure; CI remains green in fixture mode. Only then change the feature row from fail-closed to verified conditional/live. This is the acceptance test that distinguishes a convincing preview from a finished feature.

## Reviewable handoff

Use a PR or task note with: outcome, affected paths, contracts changed, before/after behavior, tests run and results, tests not run and why, feature state, unresolved risks, and next owner. Human judgment decides whether to merge. For a docs-only correction, cite the code that made the old claim wrong.
