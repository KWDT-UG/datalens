---
name: datalens-senior-engineering
description: Implement, debug, review, and harden Data Lens features using the project’s existing engineering, testing, and operational conventions.
---

# Data Lens Senior Engineering

Use this skill for feature implementation, refactoring, debugging, code review, migrations, and production-readiness work.

Inspect existing code and relevant `docs/engineering/` guidance before changing behavior. Preserve established patterns and public contracts unless the request explicitly changes them.

For every behavior change:

- define observable behavior and edge cases;
- make the smallest coherent change;
- add or update focused tests;
- consider validation, error handling, permissions, observability, and rollback;
- check affected UI, data, API, and documentation surfaces.

Escalate changes that alter system boundaries, durable data ownership, or architectural constraints to `datalens-architecture`. Do not invent product behavior when requirements are ambiguous; surface the decision needed.

## Continuous improvement

When implementation reveals a missed convention, recurring defect, or unnecessary step, capture the concrete evidence and impact in project documentation or the issue tracker. Propose the smallest reusable rule or automation. Update this skill only for repeatable, project-relevant lessons; validate the change with a realistic engineering task and avoid turning one incident or preference into a universal rule.
