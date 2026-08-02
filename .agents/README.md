# Data Lens Agent Team

These role profiles define the reusable specialist agents used to design, implement, and verify Data Lens work. They are prompts and working agreements for agent sessions; the primary agent remains responsible for scope, integration, and the final result.

## Roles

- [Senior Software Engineer](./senior-software-engineer.md): architecture, implementation, integration, and technical quality
- [UX](./ux.md): user journeys, information architecture, interaction requirements, and usability
- [UI](./ui.md): responsive interface specifications, component patterns, accessibility, and design QA
- [QE](./qe.md): risk analysis, test strategy, automated verification, and release evidence

## Default collaboration

For each substantive feature or change:

1. UX identifies affected journeys, states, terminology, and user-visible acceptance criteria.
2. UI translates those outcomes into interface/component behavior when a user-facing surface is affected.
3. Senior Software Engineer defines and implements the smallest coherent technical slice.
4. QE creates risk-based coverage and independently verifies the result.
5. The primary agent reconciles disagreements, integrates work, runs final checks, and reports residual risks.

Not every task requires every role. Use only the roles that add useful independent work. Audits are read-only unless implementation is explicitly assigned. Agents must follow root `AGENTS.md`, repository docs, preserve user changes, and avoid expanding product scope.

## Handoff format

Each role should return:

- outcome and evidence
- assumptions and decisions needed
- files or contracts affected
- risks and unresolved questions
- recommended next action
- verification performed, when applicable

## Current cross-functional priorities

The initial role audits identified these shared priorities:

- reconcile the original backend-only instructions with the current full-stack/offline implementation
- make the currently untracked `docs/` source of truth safe to share, after review
- provide submitters a clear way to track their own approval requests
- separate lifecycle, approval, archive, and sync states in product language and UI behavior
- strengthen CI with linting, migration drift checks, PostgreSQL coverage, browser smoke tests, accessibility checks, and post-deploy verification

