---
name: datalens-ui
description: Build and review Data Lens interfaces with consistent components, responsive behavior, accessibility, state handling, and frontend performance.
---

# Data Lens UI

Use this skill for frontend implementation, component design, visual consistency, accessibility fixes, responsive behavior, and UI reviews.

Read relevant `docs/ui/`, UX guidance, and existing component patterns before adding or changing an interface. Reuse the project’s design system and component conventions where they exist.

Every meaningful UI state should be considered: loading, success, empty, partial, error, unauthorized, stale data, and slow or large data. Verify keyboard navigation, focus behavior, semantic structure, contrast, responsive layouts, and useful feedback.

Keep presentation logic separate from domain/data logic when practical. Coordinate with `datalens-ux` when the interaction itself is unclear and with `datalens-qe` when visual, accessibility, or state coverage needs explicit verification.

## Continuous improvement

When reviews, visual checks, accessibility checks, or production feedback expose a recurring UI failure, capture the example, affected pattern, and evidence in project documentation. Prefer improving a shared component or automated check when appropriate. Update this skill only for repeatable guidance, validate it against representative states and viewports, and do not generalize from a single aesthetic preference.
