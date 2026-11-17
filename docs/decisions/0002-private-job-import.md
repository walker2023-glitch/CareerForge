# One private job import boundary

Use `POST /api/jobs/import` for the student flow; retain `POST /api/jobs` as an alias so it cannot diverge. Both validate a bounded JobDraft and derive provenance from verified session auth. User-scoped Supabase queries and RLS determine visibility; detail reads include own private jobs. Parsing stays stateless and its synthetic preview ID never becomes a saved identifier.

Direct REST imports also must be pasted/private/unverified. Employer publishing policies remain separate. A successful fixture UI test proves neither persistence nor deployed RLS. Apply migrations only to an approved isolated project for tests; production deployment and existing data review are separate work.
