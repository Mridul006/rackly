from datetime import timedelta


def test_gpu_listing_validation(client, signup):
    provider = signup("provider")
    base = {
        "model": "RTX 4090",
        "vram_gb": 24,
        "gpu_count": 1,
        "price_per_hour": "1.50",
        "location": "Delhi",
    }

    for bad in (
        {"price_per_hour": "-5"},
        {"price_per_hour": "0"},
        {"price_per_hour": "1.999"},
        {"vram_gb": 0},
        {"gpu_count": 0},
    ):
        response = client.post("/gpus", json={**base, **bad}, headers=provider.headers)
        assert response.status_code == 422, bad


def test_slots_are_assigned_in_order_and_roll_over_to_the_next_rack(client, signup, make_gpu):
    provider = signup("provider")

    positions = [
        (g["rack_no"], g["slot_no"]) for g in (make_gpu(provider) for _ in range(12))
    ]

    assert positions[:3] == [(1, 1), (1, 2), (1, 3)]
    assert positions[9] == (1, 10)
    assert positions[10] == (2, 1)
    assert len(set(positions)) == 12


def test_manual_position_is_honoured_and_cannot_be_reused(client, signup, make_gpu):
    provider = signup("provider")
    other = signup("provider")

    make_gpu(provider, rack_no=5, slot_no=2)
    duplicate = client.post(
        "/gpus",
        json={
            "model": "A100", "vram_gb": 80, "gpu_count": 1, "price_per_hour": "8.00",
            "location": "Mumbai", "rack_no": 5, "slot_no": 2,
        },
        headers=other.headers,
    )

    assert duplicate.status_code == 409


def test_rack_and_slot_must_come_together(client, signup):
    provider = signup("provider")

    response = client.post(
        "/gpus",
        json={
            "model": "A100", "vram_gb": 80, "gpu_count": 1, "price_per_hour": "8.00",
            "location": "Mumbai", "rack_no": 3,
        },
        headers=provider.headers,
    )

    assert response.status_code == 422


def test_switching_a_gpu_off_frees_its_slot(client, signup, make_gpu):
    provider = signup("provider")
    first = make_gpu(provider)

    client.patch(f"/gpus/{first['id']}", json={"is_active": False}, headers=provider.headers)
    second = make_gpu(provider)

    assert (second["rack_no"], second["slot_no"]) == (first["rack_no"], first["slot_no"])


def test_switching_back_on_fails_when_the_slot_was_taken(client, signup, make_gpu):
    provider = signup("provider")
    first = make_gpu(provider)
    client.patch(f"/gpus/{first['id']}", json={"is_active": False}, headers=provider.headers)
    make_gpu(provider)

    response = client.patch(
        f"/gpus/{first['id']}", json={"is_active": True}, headers=provider.headers
    )

    assert response.status_code == 409


def test_only_the_owner_can_edit_a_gpu(client, signup, make_gpu):
    owner = signup("provider")
    other = signup("provider")
    gpu = make_gpu(owner)

    response = client.patch(
        f"/gpus/{gpu['id']}", json={"price_per_hour": "9.99"}, headers=other.headers
    )

    assert response.status_code == 403


def test_browse_hides_inactive_gpus_and_filters_by_price(client, signup, make_gpu):
    provider = signup("provider")
    cheap = make_gpu(provider, price_per_hour="1.00")
    make_gpu(provider, price_per_hour="9.00")
    hidden = make_gpu(provider, price_per_hour="0.50")
    client.patch(f"/gpus/{hidden['id']}", json={"is_active": False}, headers=provider.headers)

    everything = client.get("/gpus").json()
    affordable = client.get("/gpus", params={"max_price": "2"}).json()

    assert len(everything) == 2
    assert [g["id"] for g in affordable] == [cheap["id"]]
    assert client.get(f"/gpus/{hidden['id']}").status_code == 404


def test_datacenter_status_comes_from_availability(client, signup, make_gpu, add_window, now):
    provider = signup("provider")
    with_window = make_gpu(provider)
    without_window = make_gpu(provider)
    add_window(provider, with_window, now, now + timedelta(days=3))

    rows = {g["id"]: g["status"] for g in client.get("/datacenter").json()}

    assert rows[with_window["id"]] == "available"
    assert rows[without_window["id"]] == "offline"