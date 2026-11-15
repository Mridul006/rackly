from datetime import timedelta
from decimal import Decimal


def test_booking_charges_the_renter_and_pays_the_provider(scene, book, balance, fetch, now):
    response = book(scene.renter, scene.gpu, now + timedelta(hours=2), now + timedelta(hours=4))

    assert response.status_code == 201, response.text
    body = response.json()
    assert Decimal(str(body["total_price"])) == Decimal("3.00")
    assert balance(scene.renter) == Decimal("97.00")
    assert balance(scene.provider) == Decimal("3.00")

    rows = fetch(
        "SELECT user_id, type, amount FROM wallet_transactions WHERE booking_id = :b ORDER BY id",
        b=body["id"],
    )
    assert rows == [
        (scene.renter.id, "booking_charge", Decimal("-3.00")),
        (scene.provider.id, "provider_payout", Decimal("3.00")),
    ]


def test_changing_the_gpu_price_later_does_not_change_an_existing_booking(
    client, scene, book, now
):
    booked = book(scene.renter, scene.gpu, now + timedelta(hours=2), now + timedelta(hours=4)).json()

    client.patch(
        f"/gpus/{scene.gpu['id']}", json={"price_per_hour": "9.99"}, headers=scene.provider.headers
    )
    listed = client.get("/bookings", headers=scene.renter.headers).json()

    mine = next(b for b in listed if b["id"] == booked["id"])
    assert Decimal(str(mine["total_price"])) == Decimal("3.00")


def test_insufficient_balance_is_refused_and_leaves_nothing_behind(
    scene, signup, deposit, book, balance, fetch, events, now
):
    poor = signup("renter")
    deposit(poor, "2.00")

    response = book(poor, scene.gpu, now + timedelta(hours=2), now + timedelta(hours=4))

    assert 400 <= response.status_code < 500, response.text
    assert fetch("SELECT COUNT(*) FROM bookings") == [(0,)]
    assert fetch("SELECT COUNT(*) FROM wallet_transactions WHERE type <> 'deposit'") == [(0,)]
    assert balance(poor) == Decimal("2.00")
    assert balance(scene.provider) == Decimal("0")
    assert [e for e in events if e[1].startswith("booking")] == []


def test_booking_must_fit_inside_one_availability_window(scene, book, balance, now):
    after_the_window = book(
        scene.renter, scene.gpu, now + timedelta(days=5, hours=2), now + timedelta(days=5, hours=4)
    )
    straddling_the_end = book(
        scene.renter, scene.gpu, now + timedelta(days=5, hours=-1), now + timedelta(days=5, hours=1)
    )

    assert 400 <= after_the_window.status_code < 500
    assert 400 <= straddling_the_end.status_code < 500
    assert balance(scene.renter) == Decimal("100.00")


def test_booking_cannot_start_in_the_past(scene, make_gpu, add_window, book, balance, now):
    gpu = make_gpu(scene.provider)
    assert add_window(scene.provider, gpu, now - timedelta(days=1), now + timedelta(days=5)).status_code == 201

    response = book(scene.renter, gpu, now - timedelta(hours=3), now - timedelta(hours=1))

    assert 400 <= response.status_code < 500, response.text
    assert balance(scene.renter) == Decimal("100.00")


def test_duration_must_be_a_whole_number_of_hours(scene, book, fetch, now):
    start = now + timedelta(hours=2)

    for end in (start + timedelta(minutes=90), start + timedelta(minutes=30), start, start - timedelta(hours=1)):
        response = book(scene.renter, scene.gpu, start, end)
        assert 400 <= response.status_code < 500, (end - start, response.text)

    assert fetch("SELECT COUNT(*) FROM bookings") == [(0,)]


def test_overlapping_bookings_are_refused_but_back_to_back_is_fine(
    scene, signup, deposit, book, balance, now
):
    other = signup("renter")
    deposit(other, "100.00")

    first = book(scene.renter, scene.gpu, now + timedelta(hours=2), now + timedelta(hours=4))
    overlapping = book(other, scene.gpu, now + timedelta(hours=3), now + timedelta(hours=5))
    touching = book(other, scene.gpu, now + timedelta(hours=4), now + timedelta(hours=6))

    assert first.status_code == 201
    assert overlapping.status_code == 409, overlapping.text
    assert touching.status_code == 201, touching.text
    assert balance(other) == Decimal("97.00")


def test_booking_a_gpu_that_does_not_exist_is_a_404(scene, book, now):
    response = book(scene.renter, {"id": 9999}, now + timedelta(hours=2), now + timedelta(hours=4))

    assert response.status_code == 404


def test_a_switched_off_gpu_cannot_be_booked(client, scene, book, balance, now):
    client.patch(
        f"/gpus/{scene.gpu['id']}", json={"is_active": False}, headers=scene.provider.headers
    )

    response = book(scene.renter, scene.gpu, now + timedelta(hours=2), now + timedelta(hours=4))

    assert 400 <= response.status_code < 500
    assert balance(scene.renter) == Decimal("100.00")


def test_booking_requires_login(client, scene, now):
    response = client.post(
        "/bookings",
        json={
            "gpu_id": scene.gpu["id"],
            "start_at": (now + timedelta(hours=2)).isoformat(),
            "end_at": (now + timedelta(hours=4)).isoformat(),
        },
    )

    assert response.status_code == 401


def test_booking_and_cancelling_publish_live_events(scene, book, cancel, events, now):
    booked = book(scene.renter, scene.gpu, now + timedelta(hours=2), now + timedelta(hours=4)).json()
    cancel(scene.renter, booked["id"])

    booking_events = [e for e in events if e[1].startswith("booking")]
    assert booking_events == [
        (scene.gpu["id"], "booking_created"),
        (scene.gpu["id"], "booking_cancelled"),
    ]