# Rackly

A marketplace where providers list GPUs and renters book them by the hour, day, week, month or year.

**Stack:** FastAPI, PostgreSQL, SQLAlchemy, Alembic, Docker (React frontend in progress)

## Features so far

- Signup and login with JWT, with renter and provider roles
- GPU listings with search and filters
- Provider availability windows
- Bookings with server-side pricing, and no double-booking enforced by a PostgreSQL exclusion constraint
- Ledger-based wallet: deposits, booking charges, refunds, and provider payouts
- Provider dashboard endpoints: earnings, GPUs, and bookings

## Run with Docker

**Requirements:** Docker Desktop

1. Clone the repo and open the project folder.
2. Create the environment files from the examples:
   - Copy `.env.example` to `.env` (database settings for Docker).
   - Copy `backend/.env.example` to `backend/.env`, and fill in your own `SECRET_KEY`.
3. Start everything:
   ```
   docker compose up --build
   ```
4. In a second terminal, create the database tables:
   ```
   docker compose exec api alembic upgrade head
   ```
5. Open http://localhost:8000/docs to try the API.

To stop it, run `docker compose down`. Your data is kept. Add `-v` to also delete the database.

## Project structure

```
backend/   FastAPI app, models, migrations, Dockerfile
frontend/  React app (in progress)
agent/     provider agent (planned)
docs/      user stories, data model, ER diagram, API endpoints
```

## Documentation

- [User stories](docs/user-stories.md)
- [Data model](docs/data-model.md)
- [API endpoints](docs/api-endpoints.md)