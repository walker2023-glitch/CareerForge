# CareerForge

CareerForge is a Next.js and Supabase prototype for turning a student's experience into evidence-based career applications. This repository is a continuation of the BYU-Idaho hackathon codebase. Its screens have different levels of functionality; read [the feature evidence table](docs/demo-claims.md) before describing a feature as live.

## Run it

Use Node.js 20 and npm. Copy `.env.example` to `.env.local`, set your own Supabase project URL and publishable key, then run:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. The Supabase migrations live in `supabase/migrations/`. Configure authentication and apply migrations to an isolated development project before testing authenticated database flows. A local start or successful build does not establish that a hosted Supabase instance or AI provider is configured. Do not commit `.env.local`, account passwords, or real student profiles.

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium # once, if needed
npm run smoke
```

The GitHub Actions workflow runs these checks with fictional profile/job fixture flags. It does not exercise a live database or deployed AI provider; there is no lint script. See [the workflow](docs/workflow.md) for what checks prove and [the deployment checklist](docs/deployment.md) for a hosted verification procedure.

## How to work on this project

1. Read [AGENTS.md](AGENTS.md), [the current state](teammates.md), and the relevant files under [docs/](docs/README.md).
2. Check [tasks/INDEX.md](tasks/INDEX.md) for existing work. Record the desired outcome and a testable example in one task file before changing a feature.
3. Trace the affected UI, API, Zod contract, and database policy. Mark unknowns and distinguish a future goal from verified code.
4. Implement a small slice on a branch. Review product behavior, implementation, and verification in that order; update docs and task evidence in the same PR.

The playbook-inspired process is explained, with a worked example, in [docs/workflow.md](docs/workflow.md). Its principles come from [drewcurley/agentic-playbook](https://github.com/drewcurley/agentic-playbook); this repository adapts the ideas for a smaller project and does not copy its files or nine-agent approval system.

Start with [T-001](tasks/T-001.md): reconcile a reliable student journey and its contracts. Avoid relying on the dated hackathon handoffs that have been removed from the active workflow.
