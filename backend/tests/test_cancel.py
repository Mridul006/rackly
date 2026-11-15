from datetime import timedelta
from decimal import Decimal


def test_cancelling_refunds_in_full_and_reverses_the_payout(
    scene, book, cancel, balance, fetch, now
):
    booked = book(scene.renter, scene.gpu, now + timedelta(hours=2), now + timedelta(hours=4)).json()

    response = cancel(scene.renter, booked["id"])

    assert response.status_code in (200, 204), response.text
    assert fetch("SELECT status FROM bookings WHERE id = :b", b=booked["id"]) == [("cancelled",)]
    assert balance(scene.renter) == Decimal("100.00")
    assert balance(scene.provider) == Decimal("0")

    rows = fetch(
        "SELECT type, amount FROM wallet_transactions WHERE booking_id = :b", b=booked["id"]
    )
    assert sorted(rows) == sorted(
        [
            ("booking_charge", Decimal("-3.00")),
            ("provider_payout", Decimal("3.00")),
            ("refund", Decimal("3.00")),
            ("payout_reversal", Decimal("-3.00")),
        ]
    )


def test_a_booking_cannot_be_cancelled_twice(scene, book, cancel, balance, fetch, now):
    booked = book(scene.renter, scene.gpu, now + timedelta(hours=2), now + timedelta(hours=4)).json()
    cancel(scene.renter, booked["id"])

    second = cancel(scene.renter, booked["id"])

    assert 400 <= second.status_code < 500, second.text
    assert fetch("SELECT COUNT(*) FROM wallet_transactions WHERE booking_id = :b", b=booked["id"]) == [(4,)]
    assert balance(scene.renter) == Decimal("100.00")


def test_someone_else_cannot_cancel_my_booking(scene, signup, book, cancel, balance, fetch, now):
    booked = book(scene.renter, scene.gpu, now + timedelta(hours=2), now + timedelta(hours=4)).json()
    stranger = signup("renter")

    response = cancel(stranger, booked["id"])

    assert response.status_code in (403, 404), response.text
    assert fetch("SELECT status FROM bookings WHERE id = :b", b=booked["id"]) == [("confirmed",)]
    assert balance(scene.renter) == Decimal("97.00")


def test_a_booking_that_has_started_cannot_be_cancelled(
    scene, book, cancel, balance, fetch, run_sql, now
):
    booked = book(scene.renter, scene.gpu, now + timedelta(hours=2), now + timedelta(hours=4)).json()
    run_sql(
        "UPDATE bookings SET start_at = now() - interval '1 hour', "
        "end_at = now() + interval '1 hour' WHERE id = :b",
        b=booked["id"],
    )

    response = cancel(scene.renter, booked["id"])

    assert 400 <= response.status_code < 500, response.text
    assert fetch("SELECT status FROM bookings WHERE id = :b", b=booked["id"]) == [("confirmed",)]
    assert balance(scene.renter) == Decimal("97.00")


def test_a_cancelled_booking_frees_the_slot_for_someone_else(
    scene, signup, deposit, book, cancel, now
):
    start, end = now + timedelta(hours=2), now + timedelta(hours=4)
    booked = book(scene.renter, scene.gpu, start, end).json()
    cancel(scene.renter, booked["id"])
    other = signup("renter")
    deposit(other, "100.00")

    again = book(other, scene.gpu, start, end)

    assert again.status_code == 201, again.text