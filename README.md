# Rackly

[![tests](https://github.com/Mridul006/rackly/actions/workflows/test.yml/badge.svg)](https://github.com/Mridul006/rackly/actions/workflows/test.yml)

**Rent GPUs by the hour.** Rackly is a marketplace where providers list datacenter GPUs and renters book them from one hour up to a year, with a live 3D datacenter you can fly through.

> Portfolio project. Payments are **simulated**: no real money moves.

<!-- TODO (Phase 9): add a screenshot or demo GIF of the datacenter here, for example docs/screenshots/datacenter.png -->

**Status:** the backend, frontend, 3D room, live updates and automated tests are done. Deployment is next, so there is no live demo link yet.

## Highlights

- **Double booking is impossible.** A PostgreSQL exclusion constraint rejects overlapping bookings for the same GPU, so the guarantee holds even if application code has a bug. A concurrency test fires eight simultaneous bookings at one slot and checks that exactly one wins.
- **Money is a ledger, not a balance column.** Every deposit, charge, refund and payout is an immutable row. A balance is the sum of a user's rows, and the whole table always sums to total deposits.
- **A live 3D datacenter.** About 1,400 server units are drawn with instanced meshes, with an LED on every slot showing real GPU status (available, rented, offline). Click a slot to open its details and book it.
- **Real-time everywhere.** A booking in one browser tab updates every other open page within about a second. Redis pub/sub carries the events, and WebSockets deliver them to the browser.
- **Bookings move through their life on their own.** A background worker marks bookings `active` when they start and `completed` when they end, and the LED flips with nobody clicking anything.
- **Tested.** 60+ pytest tests run against a real PostgreSQL database built from the real migrations, and GitHub Actions runs them on every push.

## How it works

**Renters** add funds to a wallet, browse and filter GPUs, book whole hours inside a provider's availability window, and cancel before the start time for a full refund.

**Providers** list a GPU (the platform assigns it a rack and slot), open availability windows, get paid per booking, and see their rentals and earnings.

Both can explore the datacenter. Only renters can deposit and book, and only providers can list GPUs and see earnings.

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python 3.14, FastAPI, SQLAlchemy 2 (sync), Alembic, pydantic-settings, PyJWT, pwdlib (Argon2) |
| Data | PostgreSQL 17 (exclusion constraint, row locks), Redis 7 (pub/sub only) |
| Real-time | Native WebSockets (FastAPI) and a background worker |
| Frontend | React 19, Vite, Tailwind CSS 4, React Router 7, JavaScript |
| 3D | three.js through React Three Fiber and drei, with instanced meshes |
| Testing and CI | pytest, GitHub Actions (with a Postgres service container) |
| Tooling | Docker and Docker Compose |

## Architecture

```
Renter books a GPU
      |
      v
 FastAPI --- commit ---> PostgreSQL (source of truth)
      |
      +-- publish --> Redis (channel "datacenter") <-- publish -- Worker (every 10 s)
                           |
                           v subscribe
                  FastAPI WebSocket (/ws/datacenter)
                           |
                           v push
        Every open browser tab refetches through the REST API
```

- **PostgreSQL holds all data.** Redis stores nothing and caches nothing. It only carries short "something changed" messages, so wiping it loses no data.
- **Events carry an id and a reason, never data.** A message looks like `{"type": "gpu_changed", "gpu_id": 5, "reason": "booking_created"}`. Each browser refetches through the authenticated API, so private data never travels on the shared channel.
- **The API and the worker are separate processes,** which is why Redis sits between them and the browsers: either one can publish, and every WebSocket connection receives.

## Quick start

### Prerequisites

- Docker Desktop (or Docker Engine with the Compose plugin)
- Node.js (current LTS) for the frontend
- Python 3.14 only if you want to run the tests or create migrations on your own machine

### 1. Configure

Copy the templates and fill them in (see [Configuration](#configuration) for every variable):

```
cp .env.example .env
cp backend/.env.example backend/.env
echo "VITE_API_URL=http://localhost:8000" > frontend/.env
```

Generate a secret key for `backend/.env`:

```
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Start the backend

```
docker compose up -d --build
docker compose exec api alembic upgrade head
docker compose exec api python -m app.seed
```

This starts PostgreSQL, Redis, the API on port 8000, and the worker. The seed script creates demo accounts, GPUs, availability windows, bookings and ledger rows, and prints the demo password when it finishes.

| Demo account | Role |
|---|---|
| `demo.provider1@rackly.dev` | provider |
| `demo.provider2@rackly.dev` | provider |
| `demo.renter1@rackly.dev` | renter |
| `demo.renter2@rackly.dev` | renter |

Rebuild the demo data at any time with `docker compose exec api python -m app.seed --reset`. It only touches the demo accounts. Never run it against a real deployment.

### 3. Start the frontend

```
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** (use `localhost`, not `127.0.0.1`: the WebSocket origin check is exact). The interactive API docs are at http://localhost:8000/docs.

### Daily routine

```
docker compose up -d          # start the backend
npm run dev                   # in frontend/, start the UI
docker compose down           # stop, keeping the data
docker compose down -v        # stop and wipe the database
```

After changing Python code, rebuild the images with `docker compose up -d --build`. PostgreSQL is also published on port 5433 if you want to connect with a client such as pgAdmin.

## Configuration

**Root `.env`** (read by Docker Compose to create the database):

| Variable | Meaning |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credentials and name of the database container |

**`backend/.env`**:

| Variable | Meaning | Default |
|---|---|---|
| `DATABASE_HOSTNAME`, `DATABASE_PORT` | Where the database is. Compose overrides these inside containers. Use `localhost` and `5433` for commands run on your machine | none |
| `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME` | Must match the root `.env` values | none |
| `SECRET_KEY` | Signs login tokens. Use a long random value and a different one per environment | none |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Login lifetime | none |
| `CORS_ORIGINS` | Comma-separated allowed browser origins. Also used to check WebSocket origins | `http://localhost:5173` |
| `REDIS_URL` | Redis address. Compose sets it for containers | `redis://localhost:6379/0` |
| `SLOTS_PER_RACK` | Server slots in each rack | `10` |

**`frontend/.env`**:

| Variable | Meaning |
|---|---|
| `VITE_API_URL` | Base URL of the API, for example `http://localhost:8000` |

Real `.env` files are git-ignored. Never commit them.

## Running the tests

```
docker compose up -d db
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

- Tests run on your machine against the Docker PostgreSQL, but in a **separate database**, `rackly_test`, which is created automatically. A guard refuses to run if the database name does not end in `_test`.
- `DATABASE_USERNAME` and `DATABASE_PASSWORD` in `backend/.env` must match the root `.env`, or the connection is rejected.
- The schema is built by running the real Alembic migrations, so the tests also check the migrations and the overlap constraint.
- Tables are truncated before each test (not rolled back), so the concurrency tests can see each other's commits.
- Redis is not needed: the event publisher is replaced with a recorder, so tests can also check which live events would have been sent.

What is covered:

| Area | Examples |
|---|---|
| Auth and roles | duplicate and case-insensitive emails, admin role rejected at signup, expired or garbage tokens, who may list, book or deposit |
| GPUs and availability | listing validation, automatic slot assignment and rollover, unique slots, no overlapping windows, ownership checks |
| Bookings | correct price, price frozen at booking time, must fit one window, no past starts, whole hours only, refused bookings leave nothing behind |
| Cancellation | full refund and payout reversal, no double cancel, cancel only before the start, freed slot can be rebooked |
| Ledger | the sum of all rows equals total deposits and every booking nets to zero, checked after every step of a mixed sequence |
| Concurrency | eight simultaneous bookings for one slot, an overdraft attempt, five simultaneous cancels, ten simultaneous deposits, and a deterministic check that PostgreSQL itself blocks and then refuses an overlapping insert |
| Worker | start, end, catch-up, cancelled bookings untouched, idempotent, several workers at once announce a start only once |

## Continuous integration

`.github/workflows/tests.yml` runs on every push to `main` and on pull requests:

- **backend:** starts a PostgreSQL service container, installs `requirements-dev.txt`, and runs `pytest`.
- **frontend:** runs `npm ci` and `npm run build`.

## Project structure

```
rackly/
├── backend/
│   ├── app/
│   │   ├── main.py            app, CORS, health checks, router registration
│   │   ├── config.py          settings from environment variables
│   │   ├── database.py        engine and session
│   │   ├── models.py          SQLAlchemy models
│   │   ├── schemas.py         request and response schemas
│   │   ├── security.py        password hashing, tokens, role guards
│   │   ├── pricing.py         server-side price calculation
│   │   ├── wallet.py          balance helper
│   │   ├── events.py          publishes live events to Redis
│   │   ├── worker.py          moves bookings to active and completed
│   │   ├── seed.py            demo data
│   │   └── routers/           auth, users, gpus, bookings, wallet, providers, datacenter, live
│   ├── alembic/               migrations
│   ├── tests/                 pytest suite
│   ├── Dockerfile
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   └── src/
│       ├── api.js             fetch wrapper, token handling, expiry handling
│       ├── auth.jsx           login state, synced across browser tabs
│       ├── hooks/             live-update WebSocket hooks
│       ├── scene/             room layout and sample data
│       ├── components/        UI, and scene/ for the 3D components
│       └── pages/             landing, login, signup, browse, GPU detail, bookings,
│                              wallet, datacenter, provider dashboard, rentals, earnings
├── docs/                      user stories, data model, ER diagram, API list
├── docker-compose.yml
└── .github/workflows/tests.yml
```

## API overview

Full interactive documentation is at `/docs` when the API is running. The main endpoints:

| Area | Endpoints |
|---|---|
| Health | `GET /health`, `GET /health/db` |
| Auth | `POST /auth/signup`, `POST /auth/login` (form data, with the email as `username`) |
| Users | `GET /users/me` |
| GPUs | `POST /gpus` (provider), `GET /gpus` (filters: `model`, `max_price`, `min_gpu_count`, `limit`, `offset`), `GET /gpus/{id}`, `PATCH /gpus/{id}` (owner) |
| Availability | `POST` and `GET /gpus/{id}/availability`, `DELETE /gpus/{id}/availability/{window_id}` |
| Bookings | `POST /bookings` (renter), `GET /bookings` (`when=upcoming\|active\|past\|cancelled`), `GET /bookings/{id}`, `POST /bookings/{id}/cancel` |
| Wallet | `POST /wallet/deposits` (renter), plus balance and history (see `/docs`) |
| Provider | `GET /providers/me/gpus`, `GET /providers/me/bookings`, `GET /providers/me/earnings` |
| Datacenter | `GET /datacenter` (public: active GPUs with their rack, slot and status) |
| Live | `WS /ws/datacenter` (events as JSON) |

## Data model

![ER diagram](docs/data_model.png)

**Booking life cycle:** `confirmed` then `active` then `completed`, or `confirmed` then `cancelled`. Cancelling is only allowed before the start time.

**Wallet ledger.** Amounts are signed, and a balance is the sum of a user's rows.

| Type | Written when | Amount |
|---|---|---|
| `deposit` | a renter adds funds | positive, renter |
| `booking_charge` | a booking is made | negative, renter |
| `provider_payout` | a booking is made | positive, provider |
| `refund` | a booking is cancelled | positive, renter |
| `payout_reversal` | a booking is cancelled | negative, provider |

The rows for one booking always net to zero.

## Design decisions

- **A constraint, not just a check.** The application checks for overlaps to give a friendly error, but the exclusion constraint on `(gpu, time range)` is the real guarantee. Cancelled bookings are excluded from it.
- **Row locks for the read-then-write cases.** Booking locks the renter's row before checking the balance, so two simultaneous bookings cannot both pass the check. Cancelling locks the booking row, so two simultaneous cancels cannot both refund.
- **Why a ledger.** Appending rows means concurrent deposits cannot overwrite each other, every cent can be traced to a booking, and the invariant "the table sums to total deposits" is easy to test.
- **Prices are computed on the server.** The client sends times only, and the price per hour is copied into the booking, so later price changes never alter an existing booking.
- **All times are timezone-aware.** Naive timestamps are rejected.
- **Events are published after the commit and are best effort.** A browser that refetches immediately sees saved data, and if Redis is down a booking still succeeds.
- **Redis is a message bus, not a cache.** Pages always read from PostgreSQL. With the current volume, caching would add risk (stale availability) for no visible gain.
- **Native WebSockets, not Socket.IO.** The need is one-way broadcast. The client reconnects with backoff and refetches after every reconnect, since messages sent while it was offline are gone. The server checks the `Origin` header itself, because browsers do not apply CORS to WebSockets.
- **The worker needs no lock.** Each transition is a single `UPDATE ... WHERE status = ... RETURNING`, so running several workers is safe: a booking can only move once, and only the worker that moved it publishes the event.
- **The public datacenter endpoint exposes no owner or user data,** only GPU specs, position and status.

## Known limitations

- Payments are simulated, with no payment gateway, and a provider is paid at booking time (there is no escrow).
- A booking must fit entirely inside one availability window.
- No rate limiting on login, no password reset, and no email verification yet.
- Login tokens live in `localStorage`, and there are no refresh tokens.
- Each WebSocket connection holds its own Redis subscription. That is fine at this scale, but a larger deployment would share one subscription per process and fan out in memory.
- Providers can request a specific rack and slot through the API. By default the platform assigns them.
- The 3D room is built procedurally from simple geometry and textures drawn in code, so it uses no external 3D models.

## Roadmap

- Deployment: frontend on Vercel, API and worker as containers, with managed PostgreSQL and Redis
- Provider agent (mock mode) reporting GPU utilisation heartbeats to the room
- Login rate limiting with Redis counters
- Problem reports and an admin view
- A visual availability calendar
- Per-user live events over an authenticated socket

## Documentation

The `docs/` folder has the [user stories](docs/user-stories.md), the [data model](docs/data-model.md) (with [DBML](docs/data-model.png) and [CSV](docs/data-model.csv) exports), the ER diagram, and an [API endpoint list](docs/api-endpoints.md).

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank page in the browser | Open the browser console (`Cmd+Option+J`). The first red line names the file and the problem |
| `password authentication failed` from the tests or Alembic | `DATABASE_PASSWORD` in `backend/.env` must equal `POSTGRES_PASSWORD` in the root `.env`. PostgreSQL only reads its password when the data volume is first created, so after changing it, `docker compose down -v` and start again (this wipes the data) |
| The API container exits on start | `docker compose logs api --tail 30`. The last line names the error, and a `ModuleNotFoundError` usually means a misspelled file name |
| Live updates say "Reconnecting" | Open the app at `http://localhost:5173`, not `127.0.0.1`, and make sure `CORS_ORIGINS` contains the exact origin you use |
| Python changes have no effect | Rebuild: `docker compose up -d --build` |
| `pytest` cannot reach the database | Start it with `docker compose up -d db` |

