import itertools
import os
import re
from dataclasses import dataclass
from pathlib import Path
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import threading
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

# Point the app at the TEST database *before* anything imports app.config.
os.environ["DATABASE_NAME"] = os.environ.get("TEST_DATABASE_NAME", "rackly_test")
os.environ["DATABASE_HOSTNAME"] = os.environ.get("TEST_DATABASE_HOSTNAME", "localhost")
os.environ["DATABASE_PORT"] = os.environ.get("TEST_DATABASE_PORT", "5433")
os.environ.setdefault("SECRET_KEY", "test-secret-key-never-used-in-production")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import URL  # noqa: E402
from sqlalchemy.exc import OperationalError  # noqa: E402

import app.models  # noqa: E402, F401  (registers the tables on Base)
from app.config import settings  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402

if not settings.database_name.endswith("_test"):
    raise RuntimeError(
        f"Refusing to run tests against database '{settings.database_name}'. "
        "The test database name must end in _test."
    )

BACKEND_DIR = Path(__file__).resolve().parents[1]
TABLES = ", ".join(t.name for t in Base.metadata.sorted_tables)


def ensure_test_database() -> None:
    name = settings.database_name
    if not re.fullmatch(r"[a-z0-9_]+", name):
        raise RuntimeError(f"Unsafe test database name: {name}")

    admin_url = URL.create(
        "postgresql+psycopg2",
        username=settings.database_username,
        password=settings.database_password,
        host=settings.database_hostname,
        port=int(settings.database_port),
        database="postgres",
    )
    admin = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            exists = conn.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": name}
            )
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{name}"'))
    finally:
        admin.dispose()


def reset_schema() -> None:
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))


def run_migrations() -> None:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")


@pytest.fixture(scope="session", autouse=True)
def database():
    try:
        ensure_test_database()
    except OperationalError as exc:
        pytest.exit(
            f"Cannot reach Postgres at {settings.database_hostname}:{settings.database_port}.\n"
            f"Start it with: docker compose up -d db\n{exc.orig}",
            returncode=1,
        )
    reset_schema()
    run_migrations()
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def clean_tables(database):
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE TABLE {TABLES} RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True)
def events(monkeypatch):
    """Replace the Redis publisher with a recorder, so tests need no Redis."""
    calls: list[tuple[int, str]] = []

    def fake_notify(gpu_id: int, reason: str) -> None:
        calls.append((gpu_id, reason))

    for module in ("app.routers.bookings", "app.routers.gpus", "app.worker"):
        monkeypatch.setattr(f"{module}.notify_datacenter", fake_notify)
    return calls


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@dataclass(frozen=True)
class Account:
    id: int
    email: str
    password: str
    role: str
    headers: dict


@pytest.fixture
def signup(client):
    counter = itertools.count(1)

    def make(role: str = "renter", email: str | None = None, password: str = "password123"):
        email = email or f"{role}{next(counter)}@rackly.dev"
        created = client.post(
            "/auth/signup", json={"email": email, "password": password, "role": role}
        )
        assert created.status_code == 201, created.text
        logged_in = client.post("/auth/login", data={"username": email, "password": password})
        assert logged_in.status_code == 200, logged_in.text
        token = logged_in.json()["access_token"]
        return Account(
            id=created.json()["id"],
            email=email,
            password=password,
            role=role,
            headers={"Authorization": f"Bearer {token}"},
        )

    return make

@pytest.fixture
def make_gpu(client):
    def make(provider, **overrides):
        body = {
            "model": "RTX 4090",
            "vram_gb": 24,
            "gpu_count": 1,
            "price_per_hour": "1.50",
            "location": "Delhi",
        }
        body.update(overrides)
        response = client.post("/gpus", json=body, headers=provider.headers)
        assert response.status_code == 201, response.text
        return response.json()

    return make


@pytest.fixture
def add_window(client):
    def add(provider, gpu, start, end):
        return client.post(
            f"/gpus/{gpu['id']}/availability",
            json={"start_at": start.isoformat(), "end_at": end.isoformat()},
            headers=provider.headers,
        )

    return add


@pytest.fixture
def now():
    return datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)


@pytest.fixture
def fetch():
    """Run a SELECT against the test database and return plain tuples."""

    def run(statement: str, **params):
        with engine.connect() as conn:
            return [tuple(row) for row in conn.execute(text(statement), params).all()]

    return run


@pytest.fixture
def run_sql():
    """Run an UPDATE or INSERT against the test database (used to move time around)."""

    def run(statement: str, **params):
        with engine.begin() as conn:
            conn.execute(text(statement), params)

    return run


@pytest.fixture
def balance(fetch):
    def of(account):
        return fetch(
            "SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE user_id = :u",
            u=account.id,
        )[0][0]

    return of


@pytest.fixture
def deposit(client):
    def add(account, amount="100.00"):
        response = client.post(
            "/wallet/deposits", json={"amount": str(amount)}, headers=account.headers
        )
        assert response.status_code in (200, 201), response.text
        return response.json()

    return add


@pytest.fixture
def book(client):
    def make(renter, gpu, start, end):
        return client.post(
            "/bookings",
            json={
                "gpu_id": gpu["id"],
                "start_at": start.isoformat(),
                "end_at": end.isoformat(),
            },
            headers=renter.headers,
        )

    return make


@pytest.fixture
def cancel(client):
    def go(renter, booking_id):
        return client.post(f"/bookings/{booking_id}/cancel", headers=renter.headers)

    return go


@pytest.fixture
def scene(signup, make_gpu, add_window, deposit, now):
    """A provider with a 1.50/hour GPU open for 5 days, and a renter holding 100.00."""
    provider = signup("provider")
    renter = signup("renter")
    gpu = make_gpu(provider)
    assert add_window(provider, gpu, now, now + timedelta(days=5)).status_code == 201
    deposit(renter, "100.00")
    return SimpleNamespace(provider=provider, renter=renter, gpu=gpu)

@pytest.fixture
def race():
    def run(requests):
        barrier = threading.Barrier(len(requests))

        def worker(spec):
            method, url, kwargs = spec
            thread_client = TestClient(app)
            barrier.wait(timeout=15)
            return thread_client.request(method, url, **kwargs)

        with ThreadPoolExecutor(max_workers=len(requests)) as pool:
            futures = [pool.submit(worker, spec) for spec in requests]
            return [future.result() for future in futures]

    return run


@pytest.fixture
def ledger_balances(fetch):
    def check(deposited):
        total = fetch("SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions")[0][0]
        assert total == Decimal(deposited), f"ledger sums to {total}, expected {deposited}"

        unbalanced = fetch(
            "SELECT booking_id, SUM(amount) FROM wallet_transactions "
            "WHERE booking_id IS NOT NULL GROUP BY booking_id HAVING SUM(amount) <> 0"
        )
        assert unbalanced == [], f"bookings whose rows do not net to zero: {unbalanced}"

    return check