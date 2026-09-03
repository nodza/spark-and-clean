# User role model & schema

Foundation for portals (F6.5 / E4): every sign-in identity is a single `User` with exactly one role.

## Roles

| Role | `adminTier` | Notes |
|------|-------------|--------|
| `client` | must be `null` | Customer portal / bookings |
| `technician` | must be `null` | Tech portal; optional `driverProfileId` → Driver vehicle display |
| `admin` | required: `full` \| `marketing-only` | Admin portal scoping |

There is **no** `roles[]` array and **no** multi-role join table (that would preempt F6.6).

Email is unique and stored lowercase (one inbox = one account).

## Related collections

- **User** — `passwordHash` (bcrypt, `select: false`, stripped in `toJSON` / `toClientUser`), `emailVerifiedAt`, `disabledAt`, timestamps
- **AuthSession** — optional persisted session ledger (JWT remains live session); schema only
- **PasswordResetToken** — reset token hashes; schema only
- **Booking.userId** — optional ObjectId ref for registered clients; `customer.email` still used for guests

## Guest checkout & convert-to-account

Guests complete Confirm Booking with contact info only (name, email, phone). **No User row and no session cookie** are created. Tracking is `/booking/[id]` — the booking reference is the capability.

**Attach-all-unclaimed-by-email:** when a client registers with email+password (Credentials, not magic link), every booking whose `customer.email` matches that inbox **and** that has no `userId` is linked to the new user. The booking `id` never changes and a second booking is not created.

If that email already has a full account, registration returns `ACCOUNT_EXISTS`. After login, `/booking/[id]` **offers** to attach still-unclaimed bookings (same email rule). Login does not silent-claim.

Guest leftover JWTs are treated as logged out: `/dashboard` and `/portal` redirect to `/login`. Register always creates `role: client` — never technician or admin.

## Seed (dev/staging)

```bash
npm run seed:users
```

Creates: `sarah.j@example.com` (client), full + marketing-only admins, technicians Thabo & Sipho (with driver profiles).

Passwords: set `SEED_DEMO_PASSWORD` from the team vault. Never commit plaintext passwords.

## Invariants

Enforced in `assertRoleTierInvariants` (unit-tested) and `User` mongoose `pre("validate")`.
