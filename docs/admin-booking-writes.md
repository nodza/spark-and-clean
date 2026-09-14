# Admin booking writes (status, payment, assignment)

Ops changes persist in MongoDB via `PATCH /api/bookings/[id]`.

## Fields

- `status`
- `paymentStatus`
- `assignedDriverId` — set a driver id, or `null` to **unassign**

## Assign → status rule

| Current status | On assign | On unassign |
|----------------|-----------|-------------|
| `BOOKED` | set `SCHEDULED` | unchanged |
| `SCHEDULED` or later (`COLLECTED`…`DELIVERED`) | **status unchanged** | unchanged |

Never silently reset a `CLEANING` (etc.) job back to `SCHEDULED`.

## Auth

- Technician: may only PATCH `status` on jobs assigned to them
- Admin: ops writes require `adminTier === "full"` (marketing-only → 403)
- Client / anonymous: 401/403

## UI

Admin detail (`/admin/bookings/[id]`) uses optimistic updates; on PATCH failure the store rolls back and shows an error toast.
