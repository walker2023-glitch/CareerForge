# Deploy and verify (current checklist)

These are steps to perform, **not evidence that this fork is deployed**. The original hackathon deployment checklist was inside `assignments/`; this page retains the operational checks without old people, deadlines or a presumed deployment.

1. Choose an isolated Supabase project for testing. Confirm whether `supabase/migrations/20261113200000_career_forge_initial.sql` and `20261114091500_security_integrity_fixes.sql` are already applied before running migrations; apply them in order. Check the SQL and existing data before changing a populated database.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in local `.env.local` and in your hosting provider's environment settings. Configure the Supabase Auth site/redirect URLs for the real development and hosted domains. Use `.env.example` to check other names; keep secrets and test passwords out of commits and PRs.
3. Build and run fixture tests locally with `npm run typecheck`, `npm test`, `npm run build`, and `npm run smoke`. These do not validate a deployed database. Keep fixture flags unset or `0` in an environment intended to show live data.
4. Use fictional accounts and the test procedure in `supabase/SECURITY_CHECKS.md` to test ownership and RLS with a user-scoped client. Seed a fictional published employer job through trusted setup if you need to demonstrate `/jobs`; describe it as fictional and unverified.
5. On the hosted URL, test signed-out redirect, sign-in, profile save and reload, published-job browse and detail, paste preview and each failure state. Test cross-account isolation before claiming private jobs or résumés work. Capture the exact URL, commit SHA, environment, date and observed results in the relevant task.
6. Add `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` or a live `JOB_SEARCH_PROVIDER` only when the corresponding route is actually wired and smoke-tested. A configured key by itself does not turn fixture screens into AI features.

Deployment status for this fork: **UNKNOWN**. Update this document and `demo-claims.md` after an actual run, not after reading a previous team's handoff.
