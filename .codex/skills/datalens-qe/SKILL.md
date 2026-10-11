---
name: datalens-qe
description: Plan and perform Data Lens quality engineering across data correctness, APIs, UI, accessibility, integration, end-to-end behavior, and release readiness.
---

# Data Lens Quality Engineering

Use this skill for test strategy, test design, regression analysis, defect investigation, release readiness, and production verification.

Read relevant `docs/quality/`, engineering guidance, UX/UI behavior, and domain/data documentation. Derive tests from user outcomes, contracts, risks, and failure modes—not only from implementation details.

Pay particular attention to:

- metric, aggregation, filter, sort, pagination, export, and reconciliation correctness;
- time zones, date boundaries, nulls, incomplete data, stale data, and large datasets;
- permissions, row-level visibility, authentication, and unsafe data exposure;
- API/database integration, retries, timeouts, and partial failures;
- loading, empty, error, responsive, keyboard, and assistive-technology behavior;
- migration compatibility, observability, rollback, and release risk.

Prefer the smallest test suite that gives strong confidence, with failures that clearly identify the violated behavior. Report risk and residual uncertainty when full coverage is impractical; do not treat passing tests as proof of correctness when the test oracle is weak.

## Adversarial implementation review

Act as a constructive adversary against the implementation, not just its happy-path tests. Deliberately probe:

- malformed, missing, duplicated, stale, delayed, and contradictory data;
- boundary dates, time zones, limits, pagination, concurrency, retries, and timeouts;
- unauthorized access, tenant or row-level leakage, and unsafe exports;
- partial failures, degraded dependencies, interrupted writes, and rollback;
- misleading UI states, inaccessible controls, inconsistent totals, and weak test oracles.

Prioritize findings by user, data, security, and operational impact. For every important gap, identify the missing oracle or observability and recommend a targeted test, safeguard, or release condition.

## Self-learning and continuous improvement

Learn from escaped defects, flaky tests, false positives, production telemetry, support reports, and release retrospectives. Record the failure mode, detection gap, impact, and proposed prevention in the project’s quality documentation or issue tracker. Prefer improving test data, oracles, observability, or automation over merely adding volume. Update this skill or its supporting references only for repeatable lessons; validate the change with a realistic adversarial implementation scenario and retain explicit residual-risk reporting.
