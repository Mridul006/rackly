import itertools
import os
import re
from dataclasses import dataclass
from pathlib import Path

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