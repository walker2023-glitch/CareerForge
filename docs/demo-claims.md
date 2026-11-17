# Feature evidence and demo claims

Source inspection on 2026-11-17; this is **not** a deployed smoke test. A row labeled conditional requires its named configuration and observed runtime check before a demo can claim success. Update these rows in the same PR that changes behavior.

| Visible flow | Source-observed state | What a demo can honestly say |
| --- | --- | --- |
| Sign in | Conditional: Supabase password client in `src/app/sign-in/page.tsx` | A sign-in form exists; live auth needs configured Supabase and a test account |
| Profile | Conditional: DB read and PATCH route; fixture flag available; PATCH is not atomic | Profile editing is wired to Supabase when configured, but a successful multi-account reload test is still needed |
| Published jobs | Conditional: DB reader or fixture flag, `src/lib/jobs/job-adapter.ts` | Can browse real published rows when auth/database/rows exist; fixture mode shows examples |
| Paste job | Preview: `POST /api/jobs/parse`; save switch off | A pasted description can be validated and previewed; private save from UI is unavailable |
| Direct private-job API | Separate endpoint: `POST /api/jobs` writes directly; import route fails closed | Do not describe the student import journey as saved until paths are reconciled and tested |
| Match and résumé | Fixture screen in `src/app/(student)/match/[id]/page.tsx`; suggestion/read/edit routes fail closed without adapters | Show fictional layout only, explicitly labeled sample; no claim of live AI or durable edits |
| Saved applications | Fixture state in `src/app/(student)/saved/` | Interactive sample; changes reset on reload |
| Calendar | Fixture schedule in `src/app/(student)/calendar/page.tsx` | Sample event display/exports; sample date is 2026-11-13 and events are not personal records |
| Preparation hub | Fixture UI in `src/app/(student)/jobs/[id]/prep/`; API endpoints exist with conditional or missing dependencies | Demonstrate sample preparation; verify individual API/provider paths separately |
| Employer workflow, live job discovery | No complete public UI flow verified in the inspected tree | Planned or unknown, pending a reproducible demo |

The repository alone cannot prove that the fork's Vercel deployment is running, migrations have been applied to its Supabase project, the provider is paid/configured, or any job posting is verified. Record those as **UNKNOWN** until observed with fictional accounts. Keep preview, conditional, and verified live claims distinct.
