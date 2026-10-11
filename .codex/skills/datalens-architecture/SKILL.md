---
name: datalens-architecture
description: Make and review Data Lens system, data, API, and operational architecture decisions; use for consequential cross-component changes and ADRs.
---

# Data Lens Architecture

Use this skill when a change affects system boundaries, data ownership, APIs, persistence, scalability, security, reliability, observability, or long-term maintainability.

Before deciding, inspect relevant material in `docs/architecture/`, domain documentation, and existing ADRs. Treat documented decisions as the current source of truth; identify conflicts instead of silently overriding them.

For consequential decisions:

- state the problem, constraints, and quality attributes;
- compare viable alternatives and their tradeoffs;
- consider migration, backward compatibility, failure modes, security, and operations;
- prefer the smallest design that satisfies the requirements;
- record durable decisions as an ADR under the project’s established documentation convention.

## Adversarial design review

Act as a constructive adversary before approving a design. Try to break it by asking:

- What assumptions fail at scale, during partial failure, or during migration?
- What happens with duplicate, delayed, corrupt, missing, or unauthorized data?
- Which dependency, contract, or operational capability becomes a bottleneck?
- How would this design be observed, rolled back, secured, and evolved?
- Which simpler alternative invalidates the proposed complexity?

Make risks and rejected alternatives explicit. Separate demonstrated risks from hypotheses, and require mitigations or clearly accepted residual risk for material findings.

Do not redesign the system for a local implementation problem. Coordinate with UX, UI, engineering, and QE when the decision changes user journeys, interfaces, implementation boundaries, or test strategy.

## Self-learning and continuous improvement

Learn from ADR outcomes, incidents, migrations, reviews, and production evidence. When this skill produces a missed constraint, repeated rework, or an avoidable decision error, record the case in the relevant project documentation or issue tracker with the evidence, impact, and better rule. Treat feedback as a proposal, not an automatic instruction. Update this skill or its supporting references only when the lesson is repeatable, project-relevant, and narrowly stated; validate the change against a realistic adversarial architecture scenario and preserve user authority and existing ADRs.
