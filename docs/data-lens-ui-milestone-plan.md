# Data Lens UI Milestone Plan for Codex Implementation

## 1. Purpose

This document defines the frontend implementation milestones for the Data Lens MVP UI. It is intended to guide Codex or another implementation assistant through the next phase of development after the backend has moved from an MVP scaffold to a UI-ready MVP API.

The backend already provides Django REST Framework APIs under `/api/v1/` for the core entities, including communities, groups, members, institutions, committees, cooperatives, resources, thematic areas, impact records, and approvals. The UI work should now focus on turning the finalized Figma mockups and backend API capabilities into a containerized, implementation-ready frontend.

---

## 2. Current Backend Status

The backend is considered UI-ready for MVP implementation.

Implemented backend capabilities include:

- Django 5
- Django REST Framework
- PostgreSQL
- Docker Compose
- CRUD endpoints under `/api/v1/`
- Core domain entities:
  - Communities
  - Groups
  - Members
  - Institutions
  - Committees
  - Cooperatives
  - Resources
  - Thematic Areas
  - Impact Records
  - Approvals
- Soft delete support
- Audit fields
- Sync fields
- Filtering
- Search
- Ordering
- Pagination
- Structured API errors

The frontend should consume the existing backend API instead of recreating business logic locally.

---

## 3. Final Frontend Technical Stack

Recommended frontend stack:

- React
- TypeScript
- Vite
- PatternFly React
- PatternFly Icons
- React Router
- TanStack Query
- React Hook Form
- Zod
- Dexie.js
- IndexedDB
- vite-plugin-pwa
- Nginx
- Docker / Docker Compose

### 3.1 Stack Summary

| Area | Tooling | Purpose |
|---|---|---|
| UI framework | React | Build reusable frontend components and screens |
| Language | TypeScript | Add safer data models, props, API response types, and status values |
| Build tool | Vite | Fast local development and static production builds |
| UI system | PatternFly React | Reliable open-source enterprise UI components |
| Routing | React Router | Manage frontend routes and page navigation |
| API state | TanStack Query | Fetching, caching, loading states, errors, pagination, and refetching |
| Forms | React Hook Form | Efficient form state management |
| Validation | Zod | Frontend schema validation and typed form data |
| Offline storage | Dexie.js / IndexedDB | Local drafts, sync queue, cached reference data |
| PWA | vite-plugin-pwa | Service worker, offline shell, installable app support |
| Static serving / reverse proxy | Nginx | Serve frontend build and proxy API requests |
| Deployment | Docker / Docker Compose | Containerized local, staging, and on-prem deployment |

---

## 4. Target Containerized Architecture

Recommended runtime shape:

```text
Browser
  ↓
Nginx container
  ├─ serves React/Vite static frontend
  └─ proxies /api/v1/ requests to Django backend
        ↓
      Django REST API container
        ↓
      PostgreSQL
```

Recommended Docker Compose services:

```text
nginx       # reverse proxy and static frontend server
frontend    # local dev/build service for React/Vite
backend     # Django + DRF + Gunicorn
postgres    # PostgreSQL with persistent volume
redis       # optional future service for cache/background jobs
```

For production or on-prem deployment, the frontend should be built into static files and served by Nginx. A Node.js server should not be required at runtime.

---

## 5. UI Design Readiness Summary

The latest Figma mockups establish the main implementation direction:

- Dark theme app shell
- Left navigation
- Top global search
- User profile area
- Communities table view
- Communities card view
- Community detail page
- Community breakdown navigation
- Members, groups, cooperatives, committees, and resources tables
- Bulk actions pattern
- Export actions
- Profile/settings form pattern
- Pagination
- Row selection
- Table/card toggle

The UI is ready for implementation planning, but several design gaps must be resolved or handled carefully during implementation.

---

## 6. Design Gaps to Resolve During Implementation

### 6.1 Replace Placeholder Columns

The Figma mocks include placeholder table columns. These must be replaced with real MVP columns before or during implementation.

Recommended MVP table columns are defined later in this document.

### 6.2 Correct Sample Data

Some community table mockups use person names as community names. These should be replaced with community-like names, such as:

- Katosi Women Fishing & Development Association
- Manyi Gamulimi Kiyoola
- Nakinsunga Ntafunvu
- Twekembe
- Ntanzi
- Bulinda

### 6.3 Clarify “Networks” Navigation

The left nav currently includes `Networks`, but the backend entities are more specific:

- Groups
- Institutions
- Committees
- Cooperatives

Recommended MVP decision:

- Either remove `Networks` from the first implementation, or
- Define `Networks` as an umbrella section for groups, institutions, cooperatives, and committees.

Until the product meaning is finalized, avoid introducing a deep Networks workflow.

### 6.4 Add Approval and Sync States

The backend supports approval and sync-related concepts, but the mockups do not yet fully show these states.

The UI should introduce status chips for:

- Approved
- Pending Review
- Needs Changes
- Rejected
- Synced
- Pending Sync
- Sync Failed
- Conflict
- Archived

### 6.5 Define Dashboard MVP

The dashboard appears in navigation but has not been fully mocked. The MVP dashboard should include simple summary cards and a small number of charts or lists.

Recommended dashboard widgets:

- Total communities
- Total groups
- Total active members
- Total resources
- Pending approvals
- Resources by status
- Impact by thematic area
- Recent activity

---

## 7. Recommended MVP Navigation

Recommended first-pass navigation:

```text
Dashboard
Communities
Resources
Impact
Approvals
Reports
Donors
Staff / Volunteers
Admin / Settings
```

Notes:

- `Communities` should be the main operational hub.
- `Resources` should be top-level because resource delivery is central to impact reporting.
- `Approvals` should be top-level because approvals are a major governance workflow.
- `Impact` and `Reports` may start simple but should be represented.
- `Donors` can remain shallow if the MVP only needs basic donor linkage.
- `Networks` should be deferred or clearly defined.

---

## 8. Frontend Route Plan

Recommended route structure:

```text
/                         -> redirect to /dashboard
/dashboard                -> Dashboard
/communities              -> Communities list
/communities/:id          -> Community detail overview
/communities/:id/members  -> Community members breakdown
/communities/:id/groups   -> Community groups breakdown
/communities/:id/institutions -> Community institutions breakdown
/communities/:id/committees   -> Community committees breakdown
/communities/:id/cooperatives -> Community cooperatives breakdown
/communities/:id/resources    -> Community resources breakdown
/resources                -> Global resources list
/resources/:id            -> Resource detail
/impact                   -> Impact records list
/impact/:id               -> Impact record detail
/approvals                -> Approval queue
/reports                  -> Reports overview
/donors                   -> Donors list
/profile                  -> User profile/settings
/admin                    -> Admin/settings area
```

The community detail screen may use internal tabs or nested routes. Nested routes are preferred if the URL should be shareable and restorable.

---

## 9. Shared UI Components to Build Early

Codex should prioritize reusable components before implementing every page separately.

### 9.1 Layout Components

- `AppShell`
- `SidebarNav`
- `TopBar`
- `GlobalSearch`
- `UserMenu`
- `PageHeader`
- `Breadcrumbs`
- `ContentPanel`

### 9.2 Table Components

- `DataTable`
- `TableToolbar`
- `TableSearchInput`
- `TablePagination`
- `BulkActionToolbar`
- `ColumnHeaderSort`
- `EmptyState`
- `LoadingState`
- `ErrorState`

### 9.3 Status Components

- `ApprovalStatusBadge`
- `SyncStatusBadge`
- `ResourceStatusBadge`
- `RecordStatusBadge`

### 9.4 Form Components

- `FormTextInput`
- `FormSelect`
- `FormTextarea`
- `FormDateInput`
- `FormCheckbox`
- `FormErrorMessage`
- `FormActions`
- `EntityFormPage`

### 9.5 Offline Components

- `OfflineBanner`
- `SyncStatusIndicator`
- `PendingSyncDrawer`
- `DraftSavedNotice`
- `ConflictWarning`

---

## 10. Recommended Entity Table Columns

### 10.1 Communities Table

Required MVP columns:

- Community name
- Subcounty
- Residents count
- Groups count
- Members count
- Committees count
- Cooperatives count
- Resources count
- Status
- Last updated

Actions:

- View details
- Edit community
- Export
- Archive / soft delete, depending on permissions

### 10.2 Community Members Table

Required MVP columns:

- Member name
- Email
- Group
- Cooperative
- Committee
- Status
- Approval status

Optional later:

- Phone
- Date joined
- Last updated
- Sync status

Actions:

- View member
- Edit member
- Copy email
- Add member
- Remove/archive member
- Export selected

### 10.3 Groups Table

Required MVP columns:

- Group name
- Members count
- Primary activity
- Lead contact
- Status
- Date formed

Actions:

- View group
- Edit group
- Export
- Archive group

### 10.4 Institutions Table

Required MVP columns:

- Institution name
- Institution type
- Contact person
- Resources linked
- Status
- Last updated

Actions:

- View institution
- Edit institution
- Export
- Archive institution

### 10.5 Committees Table

Required MVP columns:

- Committee name
- Committee type
- Members count
- Chairperson
- Status
- Last updated

Actions:

- View committee
- Edit committee
- Export
- Archive committee

### 10.6 Cooperatives Table

Required MVP columns:

- Cooperative name
- Members count
- Primary activity
- Lead contact
- Resources linked
- Status

Actions:

- View cooperative
- Edit cooperative
- Export
- Archive cooperative

### 10.7 Resources Table

Required MVP columns:

- Resource name
- Resource type
- Community
- Thematic area
- Lifecycle status
- Beneficiaries
- Approval status
- Last updated

Actions:

- View resource
- Edit resource
- Submit for approval
- Export
- Archive resource

### 10.8 Impact Records Table

Required MVP columns:

- Impact record name / summary
- Community
- Resource
- Thematic area
- Reporting period
- Beneficiary count
- Approval status
- Last updated

Actions:

- View impact record
- Edit impact record
- Submit for approval
- Export

### 10.9 Approvals Table

Required MVP columns:

- Submitted item
- Entity type
- Submitted by
- Submitted date
- Current status
- Related community
- Reviewer

Actions:

- Review
- Approve
- Reject
- Request changes

---

## 11. Offline User Experience Scope

Offline support should be phased. Do not attempt full offline-first behavior in the first UI milestone.

### Phase 1: Online-First Foundation

- App works fully when online.
- API errors and loading states are handled cleanly.
- Offline indicator appears when the browser is offline.

### Phase 2: Offline App Shell

- The app shell loads while offline.
- Recently visited screens can show cached data where available.
- User sees that data may be stale.

### Phase 3: Offline Drafts

- Field officers can open create/edit forms.
- Forms can be saved locally as drafts.
- Drafts are stored in IndexedDB through Dexie.js.
- Drafts show `Draft` or `Pending Sync` status.

### Phase 4: Pending Sync Queue

- Locally saved submissions are queued.
- When connection returns, the app attempts to sync pending items.
- Successful sync removes items from the queue.
- Failed sync displays a retry option.

### Phase 5: Conflict Handling

- If the server record changed while the user was offline, show a conflict warning.
- Allow the user to review local draft vs. server version.
- Conflict resolution can be basic for MVP and improved later.

---

## 12. UI Milestones

## Milestone 1: Frontend Project Bootstrap and Container Setup

### Goal

Create the frontend application foundation using the agreed technical stack and make it runnable through Docker Compose.

### Scope

- Create a React + TypeScript + Vite app.
- Install and configure PatternFly React and PatternFly CSS.
- Install React Router.
- Install TanStack Query.
- Install React Hook Form and Zod.
- Install Dexie.js.
- Install vite-plugin-pwa.
- Add frontend Dockerfile.
- Add or update Docker Compose service for frontend development.
- Add Nginx configuration for production static serving and `/api/v1/` proxying.
- Add basic environment configuration for API base URL.

### Acceptance Criteria

- `docker compose up` can run frontend and backend services together.
- Frontend app loads in the browser.
- Frontend can call backend health or smoke endpoint.
- Production build can be generated with Vite.
- Nginx can serve the built frontend and proxy API requests.

### Suggested Codex Prompt

Implement the frontend project bootstrap for Data Lens using React, TypeScript, Vite, PatternFly React, React Router, TanStack Query, React Hook Form, Zod, Dexie.js, and vite-plugin-pwa. Add Docker and Docker Compose support so the frontend can run alongside the Django backend. Add an Nginx configuration that serves the built frontend and proxies `/api/v1/` to the backend service.

---

## Milestone 2: App Shell, Navigation, and Global Layout

### Goal

Implement the main PatternFly-based application shell based on the finalized mockups.

### Scope

- Dark theme layout.
- Left sidebar navigation.
- Top bar with global search.
- User profile/menu area.
- Breadcrumb support.
- Main content container.
- Responsive collapse behavior for smaller screens.
- Initial routes for major sections.

### Acceptance Criteria

- App shell matches the general structure of the Figma mocks.
- Sidebar navigation includes the agreed MVP nav items.
- Page content renders inside a consistent layout.
- Active navigation item is visually indicated.
- User can move between placeholder pages without reloads.

### Suggested Codex Prompt

Build the Data Lens app shell using PatternFly React. Implement a dark themed sidebar navigation, top header with global search, user menu, breadcrumb area, and main content container. Add React Router routes for Dashboard, Communities, Resources, Impact, Approvals, Reports, Donors, Profile, and Admin. Use placeholder pages for routes that are not implemented yet.

---

## Milestone 3: API Client, Types, and Query Infrastructure

### Goal

Create a typed frontend API layer for communicating with the Django REST API.

### Scope

- Define TypeScript types for core API entities.
- Create API client wrapper with base URL handling.
- Add structured error handling.
- Add pagination response types.
- Add reusable query hooks using TanStack Query.
- Add initial hooks for communities.

### Acceptance Criteria

- Frontend has typed models for core entities.
- API client handles JSON responses and errors consistently.
- TanStack Query provider is wired into the app.
- Communities list can fetch real backend data.
- Pagination metadata can be consumed by tables.

### Suggested Codex Prompt

Create a typed API client layer for the Data Lens frontend. Define TypeScript interfaces for communities, groups, members, institutions, committees, cooperatives, resources, thematic areas, impact records, approvals, pagination responses, structured errors, approval statuses, sync statuses, and resource lifecycle statuses. Add reusable TanStack Query hooks starting with communities.

---

## Milestone 4: Shared Table System

### Goal

Build the reusable table components needed by all entity list screens.

### Scope

- PatternFly-based data table component.
- Search input.
- Pagination.
- Sorting support where backend supports ordering.
- Bulk row selection.
- Bulk action toolbar.
- Export action placeholder.
- Loading state.
- Error state.
- Empty state.

### Acceptance Criteria

- Table component can render arbitrary column definitions.
- Table supports row selection and bulk actions.
- Table can consume paginated backend responses.
- Search and ordering update the query parameters.
- Loading, empty, and error states are visually clear.

### Suggested Codex Prompt

Implement a reusable PatternFly-based DataTable system for Data Lens. It should support paginated backend responses, search, ordering, row selection, bulk actions, loading states, error states, and empty states. Keep the table generic so it can be reused for Communities, Members, Groups, Resources, Impact Records, and Approvals.

---

## Milestone 5: Communities List — Table and Card Views

### Goal

Implement the Communities page using both table and card views from the mockups.

### Scope

- Communities list page.
- Page header and description.
- Create community button placeholder.
- Search.
- Table view.
- Card view.
- Table/card toggle.
- Export action placeholder.
- Pagination.
- Link to community detail.

### Acceptance Criteria

- Communities page fetches real data from the backend.
- User can search communities.
- User can switch between table and card view.
- Community cards display counts and descriptions.
- Community table displays real MVP columns.
- Clicking a community opens the community detail route.

### Suggested Codex Prompt

Implement the Communities page using the existing app shell, API hooks, and shared table system. Add a table/card view toggle matching the Figma direction. Fetch real communities from the DRF backend, support search and pagination, and link each community to its detail page.

---

## Milestone 6: Community Detail Layout and Breakdown Navigation

### Goal

Implement the reusable community detail page layout and breakdown navigation.

### Scope

- Community header.
- Address/location card.
- Community summary details.
- Breakdown sidebar/list.
- Nested content region.
- Routes or tabs for:
  - Members
  - Groups
  - Institutions
  - Committees
  - Cooperatives
  - Resources
  - Impact
- Breadcrumbs.

### Acceptance Criteria

- Community detail page fetches the selected community.
- Breakdown navigation matches the mockup pattern.
- Each breakdown route renders a placeholder or table.
- Breadcrumbs show `Communities > Community Name`.
- Page gracefully handles missing or deleted communities.

### Suggested Codex Prompt

Implement the Community Detail layout for Data Lens. Use the Figma mockups as the visual reference: community header, address card, breakdown selector, and main table area. Add nested routes or tabs for Members, Groups, Institutions, Committees, Cooperatives, Resources, and Impact.

---

## Milestone 7: Community Breakdown Tables

### Goal

Implement the actual community-scoped tables for related entities.

### Scope

- Community Members table.
- Community Groups table.
- Community Institutions table.
- Community Committees table.
- Community Cooperatives table.
- Community Resources table.
- Search within each breakdown.
- Pagination for each table.
- Row actions.
- Bulk actions.

### Acceptance Criteria

- Each breakdown fetches real backend data scoped to the selected community.
- Placeholder columns are replaced with real MVP columns.
- Search and pagination work for each breakdown table.
- Bulk selection works where appropriate.
- Export action is present, even if initially implemented as a placeholder.

### Suggested Codex Prompt

Implement all community-scoped breakdown tables for Members, Groups, Institutions, Committees, Cooperatives, and Resources. Use the reusable DataTable system and fetch data from the backend using community-scoped API filters or nested endpoints. Replace all placeholder columns with the MVP columns defined in the UI milestone document.

---

## Milestone 8: Shared Form System and Profile Form Pattern

### Goal

Create reusable form components and implement the profile/settings form pattern from the mockups.

### Scope

- Shared form wrapper.
- Text input component.
- Select component.
- Textarea component.
- Date input component.
- Checkbox component.
- Validation message component.
- Form actions.
- Profile/settings page.
- React Hook Form integration.
- Zod validation schemas.

### Acceptance Criteria

- Forms use React Hook Form and Zod.
- Validation errors display consistently.
- Profile/settings screen follows the mockup pattern.
- Form components can be reused for entity create/edit screens.

### Suggested Codex Prompt

Build a reusable form system for Data Lens using PatternFly React, React Hook Form, and Zod. Implement a Profile/Settings page that follows the Figma mockup pattern with personal information, contact fields, required indicators, validation messages, and save actions.

---

## Milestone 9: Create/Edit Workflows for Core Entities

### Goal

Implement create/edit workflows for the core records needed by the MVP.

### Scope

Create/edit forms for:

- Community
- Group
- Member
- Institution
- Committee
- Cooperative
- Resource
- Impact Record

### Acceptance Criteria

- Forms use shared components.
- Forms call real backend create/update endpoints.
- Backend validation errors are displayed to the user.
- Successful save navigates back to the relevant list or detail view.
- Unsaved changes warning is considered for long forms.

### Suggested Codex Prompt

Implement create and edit workflows for the Data Lens core entities using the shared form system. Connect each form to the DRF API create/update endpoints. Display backend validation errors clearly and navigate users back to the relevant detail or list page after successful save.

---

## Milestone 10: Resource Management Workflow

### Goal

Implement the resource workflow as a first-class UI area.

### Scope

- Global resources list.
- Resource detail page.
- Resource create/edit form.
- Resource lifecycle status display.
- Thematic area display.
- Beneficiary count display.
- Community relationship display.
- Approval status display.

### Acceptance Criteria

- User can view resources globally and by community.
- User can open resource detail pages.
- Resource lifecycle and approval status are distinct in the UI.
- Resource forms support required fields and backend validation.
- Resource table supports search, pagination, and sorting.

### Suggested Codex Prompt

Implement the Data Lens Resource Management UI. Add a global resources list, resource detail page, and create/edit resource form. Clearly separate resource lifecycle status from approval status. Use the shared table, badge, form, and API client components.

---

## Milestone 11: Approval Queue and Approval Actions

### Goal

Implement the approval workflow UI for administrators and program managers.

### Scope

- Approvals list/queue.
- Filters for approval status.
- Approval detail view.
- Approve action.
- Reject action.
- Request changes action.
- Reviewer comment field.
- Status badges.

### Acceptance Criteria

- Approval queue fetches real backend approval records.
- User can filter by pending, approved, rejected, and needs changes.
- Approval actions call backend endpoints.
- After an action, the approval queue updates.
- Status is visible on related resources and impact records.

### Suggested Codex Prompt

Implement the Data Lens Approval Queue UI. Add an approvals list with status filters, an approval detail view, and actions for approve, reject, and request changes. Connect actions to the backend approval endpoints and show approval status badges consistently across related entity screens.

---

## Milestone 12: Offline/PWA Foundation

### Goal

Add the first practical offline experience for field officers.

### Scope

- Configure vite-plugin-pwa.
- Add service worker registration.
- Add app manifest.
- Cache static app shell.
- Add offline indicator.
- Add Dexie database setup.
- Add local draft storage for selected forms.
- Add pending sync queue foundation.

### Acceptance Criteria

- App shell can load after initial visit when offline.
- Offline banner appears when connection is lost.
- A selected create/edit form can save a draft locally.
- Drafts are visible to the user.
- Pending sync queue exists, even if automatic sync is limited.

### Suggested Codex Prompt

Add the offline/PWA foundation for Data Lens using vite-plugin-pwa, a service worker, app manifest, Dexie.js, and IndexedDB. Cache the application shell, show an offline indicator, and implement local draft saving for selected forms. Create a pending sync queue foundation for future synchronization.

---

## Milestone 13: Dashboard MVP

### Goal

Implement a useful first dashboard for all users.

### Scope

- Summary cards.
- Pending approvals card.
- Resource status breakdown.
- Impact by thematic area.
- Recent activity list.
- Links to relevant sections.

### Acceptance Criteria

- Dashboard loads after login or at `/dashboard`.
- Dashboard uses real backend data where endpoints exist.
- If aggregate endpoints are not available, use simple list endpoints temporarily and document needed backend improvements.
- Dashboard remains simple and readable.

### Suggested Codex Prompt

Implement the Data Lens Dashboard MVP. Add summary cards for communities, groups, active members, resources, and pending approvals. Add simple resource status and impact summaries. Use real backend data where available and document any backend aggregate endpoints that would improve the dashboard.

---

## Milestone 14: Reports and Export MVP

### Goal

Implement the first reporting and export experience.

### Scope

- Reports overview page.
- Community summary report.
- Resource delivery report.
- Impact summary report.
- CSV export hooks for key tables.
- Export selected rows where applicable.

### Acceptance Criteria

- Reports page gives users a clear starting point.
- At least one report can be generated from real backend data.
- Table export is available for communities and resources.
- Export behavior is documented if backend export endpoints are needed.

### Suggested Codex Prompt

Implement the Reports MVP for Data Lens. Add a reports overview page with community summary, resource delivery, and impact summary entry points. Add CSV export support for key tables where frontend-side export is practical, and document backend export endpoints needed for larger datasets.

---

## Milestone 15: Responsiveness, Accessibility, and UX Polish

### Goal

Prepare the UI for field use, stakeholder review, and MVP release.

### Scope

- Responsive layout review.
- Keyboard navigation review.
- PatternFly accessibility best practices.
- Loading and error states cleanup.
- Empty states cleanup.
- Form validation polish.
- Confirmation dialogs for destructive actions.
- Toast notifications.
- Browser testing.
- Basic PWA install behavior review.

### Acceptance Criteria

- App is usable on desktop and reasonably usable on tablet-size screens.
- Forms and tables have clear empty/loading/error states.
- Destructive actions require confirmation.
- Keyboard navigation works for major workflows.
- User-facing labels are consistent.
- MVP UI is ready for stakeholder review.

### Suggested Codex Prompt

Polish the Data Lens MVP UI for stakeholder review. Improve responsive behavior, accessibility, loading states, empty states, error handling, confirmation dialogs, toast notifications, keyboard navigation, and user-facing labels. Ensure the UI remains consistent with PatternFly conventions and the finalized Figma mockups.

---

## 13. Recommended Implementation Order

Recommended order for Codex execution:

1. Frontend project bootstrap and container setup
2. App shell and navigation
3. API client, types, and TanStack Query setup
4. Shared table system
5. Communities list table/card views
6. Community detail layout
7. Community breakdown tables
8. Shared form system and profile form
9. Create/edit workflows
10. Resource management UI
11. Approval queue and approval actions
12. Offline/PWA foundation
13. Dashboard MVP
14. Reports/export MVP
15. Responsiveness, accessibility, and polish

This order prioritizes reusable infrastructure first, then core data screens, then governance/offline/reporting features.

---

## 14. Implementation Principles for Codex

Codex should follow these principles during implementation:

1. Use PatternFly components before creating custom UI components.
2. Keep components reusable and composable.
3. Avoid hardcoding mock data once backend endpoints are available.
4. Keep backend validation as the source of truth.
5. Surface structured backend errors clearly in the UI.
6. Keep approval status separate from lifecycle status.
7. Keep sync/offline status separate from approval status.
8. Do not implement full offline-first behavior prematurely.
9. Keep route names and API models aligned with backend entity names.
10. Prefer simple, working MVP flows over highly customized UI behavior.
11. Preserve dark theme direction from the mockups.
12. Use TypeScript types for API responses and status values.
13. Write tests for reusable components and critical workflows.
14. Document backend endpoint gaps rather than inventing frontend-only workarounds.

---

## 15. Suggested Frontend Test Strategy

### Unit and Component Tests

Recommended tools:

- Vitest
- React Testing Library

Initial test targets:

- Shared table component
- Status badges
- Form validation behavior
- API error display
- Empty/loading states

### End-to-End Tests

Recommended tool:

- Playwright

Initial E2E flows:

- Load dashboard
- View communities list
- Search communities
- Open community detail
- Switch breakdown sections
- Create/edit resource
- Submit approval action
- Save offline draft, if feasible in test environment

---

## 16. Open Questions Before Final UI Handoff

These should be clarified with stakeholders, UX, or the backend owner before final release:

1. Should `Networks` remain in the left navigation?
2. What exact user roles are supported in the MVP UI?
3. Which actions are available to Field Officers, Program Managers, and Admins?
4. Which forms should support offline drafts first?
5. Should export be frontend-generated CSV, backend-generated CSV, or both?
6. Which dashboard metrics are required for the first stakeholder review?
7. Should the app support only dark theme at MVP, or both light and dark?
8. Should donors be included in the first UI implementation or deferred?
9. Which records require approval before becoming visible in reports?
10. What is the minimum acceptable conflict resolution behavior for offline submissions?

---

## 17. Definition of UI-Ready MVP

The UI MVP can be considered implementation-complete when:

- The app is containerized and runs with the backend through Docker Compose.
- Nginx can serve the frontend build and proxy API requests.
- Users can navigate the app using the main app shell.
- Communities can be listed, searched, viewed, and opened.
- Community detail pages show members, groups, institutions, committees, cooperatives, and resources.
- Core records can be created and edited through forms.
- Resources have a usable management workflow.
- Approvals can be reviewed and acted upon.
- Dashboard provides useful summary data.
- Basic reports/export workflows exist.
- Offline indicator and local draft foundation exist.
- The UI is consistent with the finalized mockups and PatternFly conventions.
- The UI handles loading, errors, empty states, and validation errors clearly.

---

## 18. Final Recommendation

Proceed with the UI implementation using:

```text
React + TypeScript + Vite
PatternFly React
React Router
TanStack Query
React Hook Form + Zod
Dexie.js + IndexedDB
vite-plugin-pwa
Nginx
Docker Compose
```

This stack is reliable, open-source friendly, container-ready, compatible with the Django REST backend, and suitable for phased offline user experience support.
