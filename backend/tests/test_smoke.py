from sqlalchemy import text


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_database_is_reachable(client):
    response = client.get("/health/db")
    assert response.status_code == 200
    assert response.json() == {"database": "ok"}


def test_booking_overlap_constraint_exists_after_migrations(db):
    found = db.scalar(
        text("SELECT 1 FROM pg_constraint WHERE conname = 'ex_bookings_no_overlap'")
    )
    assert found == 1


def test_listing_a_gpu_assigns_a_slot_and_publishes_an_event(client, signup, events):
    provider = signup("provider")

    response = client.post(
        "/gpus",
        json={
            "model": "RTX 4090",
            "vram_gb": 24,
            "gpu_count": 1,
            "price_per_hour": "1.50",
            "location": "Delhi",
        },
        headers=provider.headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert (body["rack_no"], body["slot_no"]) == (1, 1)
    assert events == [(body["id"], "gpu_listed")]