COMPOSE ?= docker compose
BACKEND ?= $(COMPOSE) run --rm backend
FRONTEND ?= $(COMPOSE) run --rm frontend

.PHONY: help bootstrap build up down logs migrate makemigrations superuser test check shell init-roles seed-reference-data seed-demo-data smoke-api frontend-install frontend-build frontend-lint frontend-dev

help:
	@echo "KWDT Data Lens commands"
	@echo "  make bootstrap       Create .env, build images, and run migrations"
	@echo "  make build           Build Docker images"
	@echo "  make up              Start backend, frontend, and PostgreSQL"
	@echo "  make down            Stop services"
	@echo "  make logs            Show Docker Compose logs"
	@echo "  make migrate         Apply migrations"
	@echo "  make makemigrations  Create migrations"
	@echo "  make init-roles      Create local role groups"
	@echo "  make seed-reference-data  Seed reference data"
	@echo "  make seed-demo-data       Seed demo data"
	@echo "  make smoke-api       Seed demo data and check API endpoint payloads"
	@echo "  make superuser       Create a Django superuser"
	@echo "  make test            Run Django unittest suite"
	@echo "  make check           Run Django system checks"
	@echo "  make shell           Open Django shell"
	@echo "  make frontend-install  Install frontend dependencies"
	@echo "  make frontend-build    Build the frontend"
	@echo "  make frontend-lint     Type-check the frontend"
	@echo "  make frontend-dev      Start only the frontend dev service"

bootstrap:
	cp -n .env.example .env || true
	$(COMPOSE) build
	$(BACKEND) python manage.py migrate

build:
	$(COMPOSE) build

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

migrate:
	$(BACKEND) python manage.py migrate

makemigrations:
	$(BACKEND) python manage.py makemigrations

init-roles:
	$(BACKEND) python manage.py init_roles

seed-reference-data:
	$(BACKEND) python manage.py seed_reference_data

seed-demo-data:
	$(BACKEND) python manage.py seed_demo_data

smoke-api:
	$(BACKEND) python manage.py smoke_api --seed-demo-data --username api-smoke --create-user

frontend-install:
	cd frontend && npm install

frontend-build:
	cd frontend && npm run build

frontend-lint:
	cd frontend && npm run lint

frontend-dev:
	$(COMPOSE) up frontend

superuser:
	$(BACKEND) python manage.py createsuperuser

test:
	$(BACKEND) python manage.py test --settings=config.settings.test

check:
	$(BACKEND) python manage.py check

shell:
	$(BACKEND) python manage.py shell
