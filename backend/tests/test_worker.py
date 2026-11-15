import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from app import worker


def book_for_later(book, scene, now, hours_ahead):
    start = now + timedelta(hours=hours_ahead)
    response = book(scene.renter, scene.gpu, start, start + timedelta(hours=2))
    assert response.status_code == 201, response.text
    return response.json()["id"]


def shift(run_sql, booking_id, start_hours, end_hours):
    """Move a booking in time relative to now (the API refuses to book in the past)."""
    run_sql(
        "UPDATE bookings "
        "SET start_at = now() + make_interval(hours => :s), "
        "    end_at = now() + make_interval(hours => :e) "
        "WHERE id = :b",
        s=start_hours,
        e=end_hours,
        b=booking_id,
    )


def status_of(fetch, booking_id):
    return fetch("SELECT status FROM bookings WHERE id = :b", b=booking_id)[0][0]


def test_a_running_booking_becomes_active_and_the_room_is_told(
    scene, book, run_sql, fetch, events, now
):
    booking_id = book_for_later(book, scene, now, 2)
    shift(run_sql, booking_id, -1, 1)
    events.clear()

    worker.tick()

    assert status_of(fetch, booking_id) == "active"
    assert events == [(scene.gpu["id"], "booking_started")]


def test_a_finished_booking_goes_straight_to_completed(scene, book, run_sql, fetch, events, now):
    booking_id = book_for_later(book, scene, now, 2)
    shift(run_sql, booking_id, -3, -1)
    events.clear()

    worker.tick()

    assert status_of(fetch, booking_id) == "completed"
    assert events == [(scene.gpu["id"], "booking_ended")]


def test_a_future_booking_is_left_alone(scene, book, fetch, events, now):
    booking_id = book_for_later(book, scene, now, 2)
    events.clear()

    worker.tick()

    assert status_of(fetch, booking_id) == "confirmed"
    assert events == []


def test_a_cancelled_booking_is_never_touched(scene, book, cancel, run_sql, fetch, events, now):
    booking_id = book_for_later(book, scene, now, 2)
    assert cancel(scene.renter, booking_id).status_code == 200
    events.clear()

    shift(run_sql, booking_id, -1, 1)
    worker.tick()
    assert status_of(fetch, booking_id) == "cancelled"

    shift(run_sql, booking_id, -3, -1)
    worker.tick()
    assert status_of(fetch, booking_id) == "cancelled"

    assert events == []


def test_running_the_worker_twice_changes_nothing_the_second_time(
    scene, book, run_sql, fetch, events, now
):
    booking_id = book_for_later(book, scene, now, 2)
    shift(run_sql, booking_id, -1, 1)
    events.clear()

    worker.tick()
    worker.tick()

    assert status_of(fetch, booking_id) == "active"
    assert events == [(scene.gpu["id"], "booking_started")]


def test_a_booking_walks_through_its_whole_life(scene, book, run_sql, fetch, events, now):
    booking_id = book_for_later(book, scene, now, 2)
    events.clear()

    worker.tick()
    assert status_of(fetch, booking_id) == "confirmed"

    shift(run_sql, booking_id, -1, 1)
    worker.tick()
    assert status_of(fetch, booking_id) == "active"

    shift(run_sql, booking_id, -3, -1)
    worker.tick()
    assert status_of(fetch, booking_id) == "completed"

    worker.tick()
    assert status_of(fetch, booking_id) == "completed"
    gpu_id = scene.gpu["id"]
    assert events == [(gpu_id, "booking_started"), (gpu_id, "booking_ended")]


def test_the_worker_never_moves_money(scene, book, run_sql, fetch, ledger_balances, now):
    running = book_for_later(book, scene, now, 2)
    finished = book_for_later(book, scene, now, 10)
    shift(run_sql, running, -1, 1)
    shift(run_sql, finished, -5, -3)
    rows_before = fetch("SELECT COUNT(*) FROM wallet_transactions")

    worker.tick()

    assert fetch("SELECT COUNT(*) FROM wallet_transactions") == rows_before
    ledger_balances("100.00")


def test_several_workers_ticking_at_once_announce_a_start_only_once(
    scene, book, run_sql, fetch, events, now
):
    booking_id = book_for_later(book, scene, now, 2)
    shift(run_sql, booking_id, -1, 1)
    events.clear()
    barrier = threading.Barrier(4)

    def go():
        barrier.wait(timeout=15)
        worker.tick()

    with ThreadPoolExecutor(max_workers=4) as pool:
        for future in [pool.submit(go) for _ in range(4)]:
            future.result()

    assert status_of(fetch, booking_id) == "active"
    assert events == [(scene.gpu["id"], "booking_started")]