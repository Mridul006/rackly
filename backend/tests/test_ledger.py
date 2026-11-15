from datetime import timedelta
from decimal import Decimal


def assert_ledger_balances(fetch, deposited):
    total = fetch("SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions")[0][0]
    assert total == Decimal(deposited), f"ledger sums to {total}, expected {deposited}"

    unbalanced = fetch(
        "SELECT booking_id, SUM(amount) FROM wallet_transactions "
        "WHERE booking_id IS NOT NULL GROUP BY booking_id HAVING SUM(amount) <> 0"
    )
    assert unbalanced == [], f"bookings whose rows do not net to zero: {unbalanced}"


def test_the_ledger_always_sums_to_total_deposits(
    scene, signup, make_gpu, add_window, deposit, book, cancel, fetch, now
):
    provider_two = signup("provider")
    gpu_two = make_gpu(provider_two, price_per_hour="4.00")
    assert add_window(provider_two, gpu_two, now, now + timedelta(days=5)).status_code == 201
    other = signup("renter")
    deposit(other, "50.00")
    deposited = Decimal("150.00")
    assert_ledger_balances(fetch, deposited)

    first = book(scene.renter, scene.gpu, now + timedelta(hours=2), now + timedelta(hours=4))
    assert first.status_code == 201, first.text
    assert_ledger_balances(fetch, deposited)

    second = book(other, gpu_two, now + timedelta(hours=10), now + timedelta(hours=20))
    assert second.status_code == 201, second.text
    assert_ledger_balances(fetch, deposited)

    refused = book(other, gpu_two, now + timedelta(hours=30), now + timedelta(hours=90))
    assert 400 <= refused.status_code < 500
    assert_ledger_balances(fetch, deposited)

    cancel(scene.renter, first.json()["id"])
    assert_ledger_balances(fetch, deposited)

    third = book(scene.renter, scene.gpu, now + timedelta(hours=30), now + timedelta(hours=33))
    assert third.status_code == 201, third.text
    assert_ledger_balances(fetch, deposited)

    cancel(other, second.json()["id"])
    assert_ledger_balances(fetch, deposited)

    deposit(other, "25.00")
    assert_ledger_balances(fetch, deposited + Decimal("25.00"))


def test_a_deposit_adds_exactly_one_ledger_row(signup, deposit, fetch, balance):
    renter = signup("renter")

    deposit(renter, "25.50")

    assert fetch("SELECT type, amount FROM wallet_transactions") == [("deposit", Decimal("25.50"))]
    assert balance(renter) == Decimal("25.50")


def test_bad_deposits_are_refused_and_write_nothing(client, signup, fetch):
    renter = signup("renter")

    for amount in ("0", "-5", "10000.01"):
        response = client.post(
            "/wallet/deposits", json={"amount": amount}, headers=renter.headers
        )
        assert 400 <= response.status_code < 500, amount

    assert fetch("SELECT COUNT(*) FROM wallet_transactions") == [(0,)]