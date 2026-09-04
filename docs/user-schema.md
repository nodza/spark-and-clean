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

- **User** — `passwordHash` (bcrypt, `select: false`, stripped in `toJSON` / `toClientUser`), `emailVerifiedAt`, `disabledAt`, `sessionsInvalidatedAt` (password reset), timestamps
- **AuthSession** — session ledger; revoked on password reset
- **PasswordResetToken** — hashed one-time reset tokens (60 min TTL)
- **Booking.userId** — optional ObjectId ref for registered clients; `customer.email` still used for guests

See also: [password-reset.md](./password-reset.md).

## Seed (dev/staging)

```bash
npm run seed:users
```

Creates: `sarah.j@example.com` (client), full + marketing-only admins, technicians Thabo & Sipho (with driver profiles).

Passwords: set `SEED_DEMO_PASSWORD` from the team vault. Never commit plaintext passwords.

## Invariants

Enforced in `assertRoleTierInvariants` (unit-tested) and `User` mongoose `pre("validate")`.
