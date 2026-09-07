# Password reset & recovery

Applies to **client**, **technician**, and **admin** accounts (one shared flow).

## User flow

1. `/forgot-password` (also linked from `/login` and `/tech` via **Forgot?**)
2. User submits email → always sees the same message (no email enumeration)
3. If an active account exists: single-use token (hashed in DB), **60 minute** TTL, email link to `/reset-password?token=…`
4. User sets new password (min 8 characters, matches Auth.dc.html signup) + confirm
5. On success: password hash updated, token marked used, prior sessions invalidated, new session issued; role unchanged

Disabled users are treated like unknown emails on the public form.

## Session invalidation

`User.sessionsInvalidatedAt` is set on reset. JWTs with `iat` before that timestamp are rejected in `getSession()` (pre-reset cookies stop working). `AuthSession` rows for the user are marked `revokedAt`.

## Email / env vars

| Variable | Purpose |
|----------|---------|
| `APP_URL` | Public origin for reset links |
| `APP_ENV` | Set `staging` / `production` to require SMTP |
| `SMTP_HOST` | SMTP server |
| `SMTP_PORT` | Default `587` |
| `SMTP_USER` / `SMTP_PASS` | SMTP auth |
| `EMAIL_FROM` | From header |

**Local/dev:** if SMTP is not configured, the reset URL is printed in the **server log**.

**Staging/production:** SMTP must be configured or send will fail (API still returns the generic public message).

## Pages

- `/forgot-password` — request link (+ “Check your inbox” confirmation) — `AuthLayout`, matches `design/Auth.dc.html`
- `/reset-password?token=` — set new password or friendly invalid/expired state
