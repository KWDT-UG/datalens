# Backend Development Handoff

The active implementation handoff in this repository is
`docs/data_lens_codex_backend.md`.

The request referenced `docs/data_lens_codex_backend_handoff_unittest.md`, but
that file is not present in this checkout. Until a newer handoff is added, use:

1. `docs/data_lens_codex_backend.md`
2. `AGENTS.md`
3. existing code and tests

This backend foundation now covers the MVP model/API scaffold for:

- `Community`
- `Group`
- `Member`
- `Institution`
- `Committee`
- `CommitteeMembership`
- `Cooperative`
- `CooperativeMembership`
- `ThematicArea`
- `Resource`
- `ResourceBeneficiary`
- `ResourceThematicArea`
- `ResourceStatusEvent`
- `ImpactRecord`
- `ApprovalRequest`

Local development also includes idempotent seed-data commands and an API smoke
command for checking representative endpoint payloads.
