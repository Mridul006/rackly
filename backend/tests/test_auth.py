def test_signup_login_and_me(client, signup):
    renter = signup("renter")

    response = client.get("/users/me", headers=renter.headers)

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == renter.email
    assert body["role"] == "renter"
    assert "password" not in body
    assert "password_hash" not in body


def test_duplicate_email_is_rejected(client, signup):
    first = signup("renter")

    response = client.post(
        "/auth/signup",
        json={"email": first.email, "password": "password123", "role": "renter"},
    )

    assert response.status_code == 409


def test_email_matching_ignores_case(client, signup):
    signup("renter", email="Someone@rackly.dev")

    response = client.post(
        "/auth/signup",
        json={"email": "someone@rackly.dev", "password": "password123", "role": "renter"},
    )

    assert response.status_code == 409


def test_admin_role_cannot_be_chosen_at_signup(client):
    response = client.post(
        "/auth/signup",
        json={"email": "boss@rackly.dev", "password": "password123", "role": "admin"},
    )
    assert response.status_code == 422


def test_short_password_is_rejected(client):
    response = client.post(
        "/auth/signup",
        json={"email": "short@rackly.dev", "password": "short", "role": "renter"},
    )
    assert response.status_code == 422


def test_wrong_password_and_unknown_email_look_identical(client, signup):
    user = signup("renter")

    wrong = client.post("/auth/login", data={"username": user.email, "password": "wrong-password"})
    unknown = client.post(
        "/auth/login", data={"username": "nobody@rackly.dev", "password": "wrong-password"}
    )

    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_protected_endpoint_needs_a_token(client):
    assert client.get("/users/me").status_code == 401


def test_garbage_token_is_rejected(client):
    response = client.get("/users/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401