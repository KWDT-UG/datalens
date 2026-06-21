# KWDT Data Lens

Data Lens is the MVP platform for managing community, group, member,
institution, resource, impact, and approval records for KWDT. The backend is
Django 5, Django REST Framework, PostgreSQL, and Docker Compose. The frontend
foundation is React, TypeScript, Vite, PatternFly, TanStack Query, Dexie, and
Nginx.

## Current Scope

Implemented in this foundation pass:

- Django project under `backend/`
- Docker Compose backend and PostgreSQL services
- shared timestamp, audit, and offline-prep metadata fields
- `Community`, `Group`, `Member`, and `Institution` models
- `Committee`, `CommitteeMembership`, `Cooperative`, and `CooperativeMembership`
  models
- `ThematicArea`, `Resource`, `ResourceBeneficiary`, `ResourceThematicArea`, and
  `ResourceStatusEvent` models
- `ImpactRecord` and `ApprovalRequest` models
- governance code consolidated under `backend/apps/participation/`
- resource and thematic-area code consolidated under `backend/apps/resources/`
- impact and approval code implemented in `backend/apps/impacts/` and
  `backend/apps/approvals/`
- admin registration for those models
- DRF CRUD endpoints under `/api/v1/`
- structured API error payloads with a normalized `errors` list
- exact filtering, search, and whitelisted ordering on implemented list endpoints
- eight KWDT-aligned MVP roles with centralized capability enforcement
- token/session/basic auth endpoints for UI integration
- approval review actions that can apply supported create/update/delete payloads
- offline sync endpoints for pull and conflict-detecting push/apply
- impact reporting summary endpoints
- React/Vite frontend scaffold under `frontend/`
- dark app shell, route structure, health check, communities list, and community
  detail foundation based on the UI mockups
- frontend Docker development service and production Nginx static/proxy target
- basic nested read endpoints for community summaries, community groups,
  community institutions, group members, committee memberships,
  cooperative memberships, resource beneficiaries, resource status events, and
  resource detail
- Django `unittest` coverage using `TestCase` and `subTest()`

Donor workflows and full offline sync are intentionally out of scope.

## Local Development

Copy the example environment when you want local overrides:

```bash
cp .env.example .env
```

Build and run the stack:

```bash
make up
```

The frontend dev server is available at:

```text
http://127.0.0.1:5173
```

The backend API remains available at:

```text
http://127.0.0.1:8000
```

Watch container logs:

```bash
make logs
```

Apply migrations:

```bash
make migrate
```

Reset the local Docker Postgres database from scratch:

```bash
make db-reset
```

This stops the Compose stack, deletes the local Postgres volume, applies
migrations, and seeds reference data. It is destructive and intended only for
local development data.

Create a superuser:

```bash
make superuser
```

Run the unittest suite:

```bash
make test
```

Run Django system checks:

```bash
make check
```

Create new migrations when model changes require them:

```bash
make makemigrations
```

Create local role groups:

```bash
make init-roles
```

Seed reference data:

```bash
make seed-reference-data
```

Seed a small demo dataset and a login-capable local administrator:

```bash
make seed-demo-data
```

The seeded administrator is for local development only:

```text
username=admin
password=adm!n@pass123
```

Set `DATALENS_LOCAL_ADMIN_USERNAME`, `DATALENS_LOCAL_ADMIN_PASSWORD`, or
`DATALENS_LOCAL_ADMIN_EMAIL` in `.env` before seeding to override those defaults.

Run a local endpoint smoke check with demo data:

```bash
make smoke-api
```

Install and build the frontend locally:

```bash
make frontend-install
make frontend-build
```

Run the production-style Nginx frontend image:

```bash
docker compose --profile production up --build nginx
```

Then open:

```text
http://127.0.0.1:8080
```

Check the API:

```text
GET /health/
GET /api/v1/communities/
GET /api/v1/groups/
GET /api/v1/members/
GET /api/v1/institutions/
GET /api/v1/committees/
GET /api/v1/committee-memberships/
GET /api/v1/cooperatives/
GET /api/v1/cooperative-memberships/
GET /api/v1/thematic-areas/
GET /api/v1/resources/
GET /api/v1/resource-beneficiaries/
GET /api/v1/resource-thematic-areas/
GET /api/v1/impact-records/
GET /api/v1/approval-requests/
POST /api/v1/auth/login/
GET /api/v1/auth/me/
GET /api/v1/sync/pull/
POST /api/v1/sync/push/
```

Local development enforces role-aware authentication. Set
`DATALENS_ALLOW_ANONYMOUS_API=true` only for disposable demo environments.
UI integration details are documented in `docs/ui-integration-readiness.md`.

For frontend integration details, see:

```text
docs/ui-integration-readiness.md
```

## Repository Layout

```text
backend/   Django project, domain apps, tests, and dependency files
frontend/  React/Vite app, Dockerfile, and Nginx production config
docs/      product handoff and implementation notes
Makefile   local Docker Compose workflow commands
```

## Staging Images

Pull requests to `main` run the GitHub Actions workflow in
`.github/workflows/ci.yml`. Merges to `main` run
`.github/workflows/staging-images.yml`, which runs the full backend Django test
suite and frontend checks first, then publishes Docker Hub images only after
those checks pass.

Required GitHub repository variable:

```text
DOCKERHUB_USERNAME
```

Required GitHub repository variable or secret:

```text
DOCKER_IMAGE_REPOSITORY=dmjx/datalens
```

Required GitHub repository secret:

```text
DOCKERHUB_TOKEN
```

`DOCKERHUB_TOKEN` should be a Docker Hub access token with permission to push to
the configured image repository. The workflow passes this token to
`docker/login-action` as the Docker login password.

Published staging image references:

```text
dmjx/datalens:backend-staging
dmjx/datalens:frontend-staging
dmjx/datalens:backend-sha-<git-sha>
dmjx/datalens:frontend-sha-<git-sha>
```

Railway staging should point at the moving `*-staging` tags with image auto
updates enabled. Use an `Anytime` maintenance window if staging should redeploy
as soon as Railway detects the new pushed tag. Production should remain
manually promoted to a specific immutable `*-sha-<git-sha>` tag or image digest
from a known-good staging run.

The staging workflow publishes the backend image before the frontend image.
This lets Railway redeploy the backend first, then restart the frontend Nginx
proxy after the backend's private-network address has settled.

The backend image starts Gunicorn with:

```bash
gunicorn config.wsgi:application --bind [::]:${PORT:-8000}
```

On Railway, make sure the frontend service's `BACKEND_UPSTREAM` points to the
backend service's internal hostname and the same port, for example:

```text
BACKEND_UPSTREAM=http://backend.railway.internal:8000
```

Also set the backend service's public frontend settings to the Railway frontend
domain so generated invitation emails and CSRF-protected browser requests use
the staging site rather than local development defaults:

```text
FRONTEND_APP_URL=https://<frontend-service>.up.railway.app
DJANGO_CSRF_TRUSTED_ORIGINS=https://<frontend-service>.up.railway.app
DJANGO_ALLOWED_HOSTS=<frontend-service>.up.railway.app,<backend-service>.railway.internal
```

If `FRONTEND_APP_URL` is accidentally left as `http://localhost:5173`, the
invitation API falls back to the browser request origin for admin-created
invitations. The explicit Railway variable is still the canonical setting.

## Invitation email delivery

Without a Mailtrap token, local development uses Django's console email
backend and prints invitation emails to backend logs. Setting
`MAILTRAP_API_KEY` switches invitation delivery to the Mailtrap API; SMTP
settings are not required.

For safe local testing, use Mailtrap Email Sandbox. Messages appear in the
chosen Mailtrap inbox rather than being sent to recipients:

```text
MAILTRAP_API_KEY=<mailtrap-api-token>
MAILTRAP_USE_SANDBOX=true
MAILTRAP_INBOX_ID=<mailtrap-sandbox-inbox-id>
DJANGO_DEFAULT_FROM_EMAIL=KWDT Data Lens <noreply@example.test>
FRONTEND_APP_URL=http://localhost:5173
```

To send real email in local development, staging, or production, configure
Mailtrap Email Sending instead:

```text
MAILTRAP_API_KEY=<environment-specific-sending-token>
MAILTRAP_USE_SANDBOX=false
DJANGO_DEFAULT_FROM_EMAIL=KWDT Data Lens <noreply@your-verified-domain.example>
```

Mailtrap must authorize the sender address/domain before real delivery will
succeed. Use a different Mailtrap token for local, staging, and production.
Keep tokens only in untracked local `.env` files or the hosting platform's
secret manager; never commit, log, or share them. If a token is exposed,
revoke it and create a replacement in Mailtrap.

After changing local email settings, recreate the backend container:

```bash
docker compose up -d --build --force-recreate backend
```

Invitation links use `FRONTEND_APP_URL`. Set it to the public frontend URL for
staging and production so recipients do not receive a `localhost` link.
