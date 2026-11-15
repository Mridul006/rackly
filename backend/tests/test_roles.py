from datetime import timedelta


GPU_BODY = {
    "model": "RTX 4090",
    "vram_gb": 24,
    "gpu_count": 1,
    "price_per_hour": "1.50",
    "location": "Delhi",
}


def test_renter_cannot_list_a_gpu(client, signup):
    renter = signup("renter")

    response = client.post("/gpus", json=GPU_BODY, headers=renter.headers)

    assert response.status_code == 403


def test_listing_a_gpu_requires_login(client):
    assert client.post("/gpus", json=GPU_BODY).status_code == 401


def test_provider_cannot_book(client, signup, make_gpu, add_window, now):
    provider = signup("provider")
    gpu = make_gpu(provider)
    add_window(provider, gpu, now, now + timedelta(days=5))

    response = client.post(
        "/bookings",
        json={
            "gpu_id": gpu["id"],
            "start_at": (now + timedelta(hours=2)).isoformat(),
            "end_at": (now + timedelta(hours=4)).isoformat(),
        },
        headers=provider.headers,
    )

    assert response.status_code == 403


def test_only_renters_can_deposit(client, signup):
    provider = signup("provider")

    response = client.post("/wallet/deposits", json={"amount": "10.00"}, headers=provider.headers)

    assert response.status_code == 403


def test_provider_dashboard_is_closed_to_renters(client, signup):
    renter = signup("renter")

    assert client.get("/providers/me/gpus", headers=renter.headers).status_code == 403
    assert client.get("/providers/me/earnings", headers=renter.headers).status_code == 403
    assert client.get("/providers/me/bookings", headers=renter.headers).status_code == 403


def test_bookings_list_is_closed_to_providers(client, signup):
    provider = signup("provider")

    assert client.get("/bookings", headers=provider.headers).status_code == 403