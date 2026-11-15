from datetime import timedelta

def test_owner_can_add_and_remove_windows(client, signup, make_gpu, add_window, now):
    provider = signup("provider")
    gpu = make_gpu(provider)

    created = add_window(provider, gpu, now, now + timedelta(days=2))
    assert created.status_code == 201

    listed = client.get(f"/gpus/{gpu['id']}/availability").json()
    assert len(listed) == 1

    deleted = client.delete(
        f"/gpus/{gpu['id']}/availability/{created.json()['id']}", headers=provider.headers
    )
    assert deleted.status_code == 204
    assert client.get(f"/gpus/{gpu['id']}/availability").json() == []


def test_overlapping_windows_are_rejected_but_back_to_back_is_fine(
    client, signup, make_gpu, add_window, now
):
    provider = signup("provider")
    gpu = make_gpu(provider)
    add_window(provider, gpu, now, now + timedelta(days=2))

    overlapping = add_window(provider, gpu, now + timedelta(days=1), now + timedelta(days=4))
    touching = add_window(provider, gpu, now + timedelta(days=2), now + timedelta(days=4))

    assert overlapping.status_code == 409
    assert touching.status_code == 201


def test_window_validation(client, signup, make_gpu, add_window, now):
    provider = signup("provider")
    gpu = make_gpu(provider)

    ends_before_start = add_window(provider, gpu, now + timedelta(days=2), now + timedelta(days=1))
    already_over = add_window(provider, gpu, now - timedelta(days=3), now - timedelta(days=2))
    naive_time = client.post(
        f"/gpus/{gpu['id']}/availability",
        json={"start_at": "2030-01-01T09:00:00", "end_at": "2030-01-02T09:00:00"},
        headers=provider.headers,
    )

    assert ends_before_start.status_code == 422
    assert already_over.status_code == 400
    assert naive_time.status_code == 422


def test_other_providers_cannot_touch_my_windows(client, signup, make_gpu, add_window, now):
    owner = signup("provider")
    intruder = signup("provider")
    gpu = make_gpu(owner)
    window = add_window(owner, gpu, now, now + timedelta(days=2)).json()

    add_attempt = add_window(intruder, gpu, now + timedelta(days=5), now + timedelta(days=6))
    delete_attempt = client.delete(
        f"/gpus/{gpu['id']}/availability/{window['id']}", headers=intruder.headers
    )

    assert add_attempt.status_code == 403
    assert delete_attempt.status_code == 403


def test_cannot_delete_a_window_through_a_different_gpu(client, signup, make_gpu, add_window, now):
    provider = signup("provider")
    victim_gpu = make_gpu(provider)
    my_gpu = make_gpu(provider)
    window = add_window(provider, victim_gpu, now, now + timedelta(days=2)).json()

    response = client.delete(
        f"/gpus/{my_gpu['id']}/availability/{window['id']}", headers=provider.headers
    )

    assert response.status_code == 404