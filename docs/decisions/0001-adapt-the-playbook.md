# Decision 0001: Adapt the playbook to CareerForge

Date: 2026-11-17. Status: adopted for this fork.

**Context.** The fork contains dated four-person handoffs and assignment files from a hackathon. [agentic-playbook](https://github.com/drewcurley/agentic-playbook) teaches grounded project memory, a separate task ledger, role-based reviews, and contract regression checks. Its nine-agent sign-offs, mandatory hooks, multi-repository model and starter CI are sized for a different project.

**Decision.** Keep `docs/` as verified project memory and `tasks/` as work in progress. Use three review perspectives and require evidence for every live feature claim. Keep one task owner and one active writer per file. Remove the active `assignments/` structure and its references. Start with documentation and existing CI; add automation only when a real repeated failure justifies it.

**Why.** A new contributor can learn to trace a feature from UI through validation and RLS, and can see exactly which promises have been tested. The process stays usable by one student or a small team.

**Tradeoff.** Manual docs and task updates can drift. Counter this by checking the route and contract diff during every feature PR and correcting the relevant row in the same change. Do not present adapted guidance as upstream playbook rules or copy its licensed text wholesale.
