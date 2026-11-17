# Project memory

Read [workflow](workflow.md) for the method, [contracts](contracts.md) for interfaces, and [demo claims](demo-claims.md) for the current behavior. [Private test setup](private-test-setup.md) lists isolated-project variables and account setup. [Testing](testing.md) separates fixture, SQL and real-service checks. [Deployment](deployment.md) records how to check the hosted app. [Decisions](decisions/0001-adapt-the-playbook.md) explain consequential choices. `teammates.md` is the short changing handoff; `tasks/` tracks work in progress.

**Grounding rule:** descriptive statements point to source files or observed tests. A target is labeled **planned**. A deployment or service that has not been checked is **UNKNOWN**. If a doc differs from current code, correct the doc with the change; never treat an old screenshot or a green fixture test as proof of live data.

Update `contracts.md` when an API route, public schema, SQL table/policy, external provider, environment flag, or client API changes. Update `demo-claims.md` when a visible feature moves between fixture, conditional, live, fail-closed and planned. Update `teammates.md` when a handoff changes. Keep task outcomes and test evidence in the task file.
