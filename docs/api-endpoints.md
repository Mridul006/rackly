# Rackly API Endpoints

## Conventions

- All requests and responses use JSON.
- Protected endpoints need the header `Authorization: Bearer <token>`, where the token comes from `POST /auth/login`.
- Endpoint names are plural nouns, and the HTTP method says the action.
- List endpoints accept `page` and `page_size` query parameters.
- Money is always a decimal with 2 places.
- Times are ISO 8601 in UTC, for example `2026-11-02T14:00:00Z`.

**Status codes used:** 200 OK, 201 Created, 400 bad input, 401 not logged in, 403 not allowed for this role, 404 not found, 409 conflict (for example, a double-booking), 422 failed validation.

**Priority:** v1 is the core flow (list, book, pay). v2 is added after the core works.

## 1. Auth and users

| Method | Path | Who | Priority | Story it serves |
|---|---|---|---|---|
| POST | /auth/signup | anyone | v1 | sign up as a renter or provider |
| POST | /auth/login | anyone | v1 | log in, returns a token |
| GET | /users/me | logged in | v1 | see my profile and role |

Logout needs no endpoint. Tokens are stateless, so the frontend logs out by deleting its stored token.

## 2. GPUs (provider side)

| Method | Path | Who | Priority | Story it serves |
|---|---|---|---|---|
| POST | /gpus | provider | v1 | add a GPU listing |
| PATCH | /gpus/{gpu_id} | owner | v1 | change price or switch a listing off |
| POST | /gpus/{gpu_id}/availability | owner | v1 | set when a GPU can be rented |
| DELETE | /gpus/{gpu_id}/availability/{window_id} | owner | v1 | remove an availability window |
| GET | /providers/me/gpus | provider | v1 | see all my GPUs and which are free now |
| GET | /providers/me/bookings | provider | v1 | see which of my GPUs are rented, and until when |
| GET | /providers/me/earnings | provider | v1 | see earnings per GPU |

`GET /providers/me/bookings` accepts `status=active` or `status=confirmed` as a filter. `GET /providers/me/earnings` adds up `provider_payout` rows grouped by GPU.

## 3. GPUs (browsing)

| Method | Path | Who | Priority | Story it serves |
|---|---|---|---|---|
| GET | /gpus | anyone | v1 | search and filter GPUs |
| GET | /gpus/{gpu_id} | anyone | v1 | GPU details, for the click in the 3D view |
| GET | /gpus/{gpu_id}/availability | anyone | v1 | see when a GPU can be booked |

Filters for `GET /gpus`: `min_price`, `max_price`, `model`, `min_gpu_count`, `location`, `available_from`, `available_to`. Only active listings are returned.

## 4. 3D datacenter view

| Method | Path | Who | Priority | Story it serves |
|---|---|---|---|---|
| GET | /datacenter | anyone | v1 | all active GPUs with rack, slot and current status, to draw the 3D room |

Each GPU in the response has a status of `available`, `rented` or `offline`. Later (Phase 6) a WebSocket will push status changes live.

## 5. Bookings

| Method | Path | Who | Priority | Story it serves |
|---|---|---|---|---|
| POST | /bookings | renter | v1 | book a GPU for a start and end time |
| GET | /bookings | renter | v1 | see all my bookings (upcoming, active, past) |
| GET | /bookings/{booking_id} | the renter, or the GPU's owner | v1 | see one booking |
| POST | /bookings/{booking_id}/cancel | the renter | v1 | cancel before it starts and get a refund |

**POST /bookings** takes `gpu_id`, `start_at` and `end_at`. The backend then:
1. checks that the time range falls inside an availability window,
2. checks that no other booking overlaps it (409 if one does),
3. calculates the total price,
4. checks the wallet balance is enough (400 if not),
5. creates the booking and the charge in one database transaction.

**Cancel** is a `POST`, not a `DELETE`, because nothing is deleted. The status changes to `cancelled`, and a `refund` row is added to the ledger. A booking that has already started can't be cancelled (400).

## 6. Wallet

| Method | Path | Who | Priority | Story it serves |
|---|---|---|---|---|
| GET | /wallet | logged in | v1 | see my balance |
| POST | /wallet/deposits | logged in | v1 | add money (simulated, no real payment) |
| GET | /wallet/transactions | logged in | v1 | history of bookings and payments |

The balance is the sum of the user's `wallet_transactions` rows. Nothing ever edits the balance directly.

## 7. Problem reports

| Method | Path | Who | Priority | Story it serves |
|---|---|---|---|---|
| POST | /bookings/{booking_id}/reports | the renter | v2 | report a problem with a GPU |
| GET | /reports | renter, provider or admin | v2 | see reports (the renter's own, or those for a provider's GPUs) |
| PATCH | /reports/{report_id} | provider or admin | v2 | mark a report resolved |

## 8. Admin

| Method | Path | Who | Priority | Story it serves |
|---|---|---|---|---|
| PATCH | /admin/gpus/{gpu_id} | admin | v2 | deactivate a fake or abusive listing (`is_active: false`) |

## 9. Operations

| Method | Path | Who | Priority | Purpose |
|---|---|---|---|---|
| GET | /health | anyone | v1 | tells deployment tools the server is alive (used in the DevOps phase) |

## Not here yet

- **WebSocket** for live GPU status in the 3D view (Phase 6).
- **Provider agent endpoints**, such as registering GPUs and sending heartbeats (added when the agent is built).