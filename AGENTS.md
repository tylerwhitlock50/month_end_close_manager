# Repository Guidelines

## Project Structure & Module Organization
The FastAPI backend lives in `backend/` with routers grouped under `backend/routers`, business logic in `backend/services`, and shared schemas in `backend/schemas.py`. Database migrations and seed data flow through `backend/migrations` and `init_db.py`. React code is in `frontend/src`, organized by feature folders such as `components/`, `pages/`, and `stores/`. Uploaded or generated artifacts land in `files/`, while reusable CSV templates sit in `backend/resources/`. Docker assets (`docker-compose.yml`, `Dockerfile.*`) anchor the local stack.

## Build, Test, and Development Commands
Use `./setup.sh` for the one-step Docker bootstrap. For iterative work: `docker-compose up -d` starts the full stack, and `docker-compose exec backend python init_db.py --seed` refreshes fixtures. Run the API locally with `uvicorn backend.main:app --reload`. Frontend work begins with `npm install` and `npm run dev` inside `frontend/`. Create production bundles via `npm run build`. Backend tests run with `pytest backend/tests`, and frontend linting uses `npm run lint`.

## Coding Style & Naming Conventions
Follow PEP 8 with 4-space indentation for Python, using snake_case for modules, functions, and service helpers, and PascalCase for SQLAlchemy models and Pydantic schemas. Type hints are expected in routers and services to keep FastAPI docs accurate. React components and Zustand stores use PascalCase filenames (e.g., `TaskBoard.tsx`, `CloseStore.ts`). Keep Tailwind utility classes readable by grouping related styles per line. Always run `npm run lint` before committing frontend changes.

## Testing Guidelines
Unit and API tests belong in `backend/tests/`, mirroring router and service package names; name files `test_<module>.py` and rely on `pytest-asyncio` for async routes. Target at least basic happy-path and permission coverage before PR review, and add `pytest --cov=backend` when touching critical flows. Frontend interaction tests should live alongside components as `<Component>.test.tsx`, covering state stores and key forms; use React Testing Library conventions.

## Commit & Pull Request Guidelines
Keep commit subjects short, present-tense, and task-focused ("Add trial balance import validation"). When a change spans backend and frontend, split into logical commits. Pull requests need a concise summary, testing notes (commands run), linked issue or task IDs, and screenshots or GIFs for UI tweaks. Double-check `.env` changes and redact secrets before pushing.

## Security & Configuration Tips
Copy `.env.example` to `.env` and never commit real credentials. Rotate `SECRET_KEY` and default admin passwords before deploying. The local `files/` mount may contain financial documents—purge sensitive data when creating repro cases and avoid attaching real statements to issues.
