import threading
import time
from datetime import timedelta
from decimal import Decimal

from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import Booking


def booking_request(renter, gpu, start, end):
    return (
        "POST",
        "/bookings",
        {
            "json": {
                "gpu_id": gpu["id"],
                "start_at": start.isoformat(),
                "end_at": end.isoformat(),
            },
            "headers": renter.headers,
        },
    )


def test_only_one_of_many_simultaneous_bookings_for_the_same_slot_wins(
    scene, signup, deposit, race, fetch, balance, ledger_balances, now
):
    renters = [scene.renter] + [signup("renter") for _ in range(7)]
    for renter in renters[1:]:
        deposit(renter, "100.00")

    rounds = 5
    for r in range(rounds):
        start = now + timedelta(hours=2 + r * 3)
        end = start + timedelta(hours=3)

        responses = race([booking_request(renter, scene.gpu, start, end) for renter in renters])

        codes = sorted(response.status_code for response in responses)
        assert codes == [201] + [409] * 7, f"round {r}: {codes}"

    assert fetch("SELECT COUNT(*) FROM bookings") == [(rounds,)]
    assert balance(scene.provider) == Decimal("4.50") * rounds
    ledger_balances("800.00")


def test_simultaneous_bookings_cannot_overdraw_a_wallet(
    scene, make_gpu, add_window, race, balance, fetch, ledger_balances, now
):
    gpu = make_gpu(scene.provider, price_per_hour="10.00")
    assert add_window(scene.provider, gpu, now, now + timedelta(days=5)).status_code == 201

    requests = []
    for i in range(6):
        start = now + timedelta(hours=2 + i * 3)
        requests.append(booking_request(scene.renter, gpu, start, start + timedelta(hours=3)))

    responses = race(requests)

    codes = sorted(response.status_code for response in responses)
    assert codes.count(201) == 3, codes
    assert all(400 <= code < 500 for code in codes if code != 201), codes
    assert balance(scene.renter) == Decimal("10.00")
    assert balance(scene.provider) == Decimal("90.00")
    assert fetch("SELECT COUNT(*) FROM bookings") == [(3,)]
    ledger_balances("100.00")


def test_simultaneous_cancels_refund_only_once(
    scene, book, race, balance, fetch, ledger_balances, now
):
    booked = book(scene.renter, scene.gpu, now + timedelta(hours=2), now + timedelta(hours=4)).json()
    url = f"/bookings/{booked['id']}/cancel"

    responses = race([("POST", url, {"headers": scene.renter.headers}) for _ in range(5)])

    codes = sorted(response.status_code for response in responses)
    assert codes.count(200) == 1, codes
    assert all(400 <= code < 500 for code in codes if code != 200), codes
    assert fetch(
        "SELECT COUNT(*) FROM wallet_transactions WHERE booking_id = :b", b=booked["id"]
    ) == [(4,)]
    assert balance(scene.renter) == Decimal("100.00")
    assert balance(scene.provider) == Decimal("0")
    ledger_balances("100.00")


def test_simultaneous_deposits_are_never_lost(signup, race, balance, fetch):
    renter = signup("renter")

    responses = race(
        [
            ("POST", "/wallet/deposits", {"json": {"amount": "10.00"}, "headers": renter.headers})
            for _ in range(10)
        ]
    )

    assert all(response.status_code in (200, 201) for response in responses)
    assert fetch("SELECT COUNT(*) FROM wallet_transactions") == [(10,)]
    assert balance(renter) == Decimal("100.00")


def test_the_database_itself_refuses_overlapping_bookings(scene, signup, fetch, now):
    other = signup("renter")
    start = now + timedelta(hours=2)
    end = start + timedelta(hours=3)

    def row(renter, s, e):
        return Booking(
            gpu_id=scene.gpu["id"],
            renter_id=renter.id,
            start_at=s,
            end_at=e,
            price_per_hour=Decimal("1.50"),
            total_price=Decimal("4.50"),
        )

    first = SessionLocal()
    second = SessionLocal()
    outcome = {}

    def second_insert():
        try:
            second.add(row(other, start + timedelta(hours=1), end + timedelta(hours=1)))
            second.commit()
            outcome["result"] = "inserted"
        except IntegrityError:
            second.rollback()
            outcome["result"] = "refused"

    try:
        first.add(row(scene.renter, start, end))
        first.flush()

        thread = threading.Thread(target=second_insert)
        thread.start()
        time.sleep(0.5)
        assert thread.is_alive(), "the second insert should be waiting for the first transaction"

        first.commit()
        thread.join(timeout=10)
    finally:
        first.close()
        second.close()

    assert outcome == {"result": "refused"}
    assert fetch("SELECT COUNT(*) FROM bookings") == [(1,)]