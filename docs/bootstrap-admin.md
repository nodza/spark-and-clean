# Bootstrap first full admin (SCW-34)

Technicians cannot self-register and admins are not public signups. A clean environment still needs one **full** admin.

There is **no** public register-admin page.

## Dev / staging (CLI)

When no active full admin exists:

```bash
# .env.local
MONGODB_URI=...
SEED_DEMO_PASSWORD=...   # or BOOTSTRAP_ADMIN_PASSWORD
# optional:
# BOOTSTRAP_ADMIN_EMAIL=admin@sparkandclean.co.za
# BOOTSTRAP_ADMIN_NAME=Spark Admin (Full)

npm run bootstrap:admin
```

- Creates one `role: admin`, `adminTier: full` user if none exists
- If a full admin already exists → no-op
- Password comes from the team vault env var (never commit plaintext)

Broader demo users (client, marketing admin, technicians): `npm run seed:users`.

## Production (runbook — not a public form)

1. Provision MongoDB and set `MONGODB_URI` / `AUTH_SECRET` in the host secrets store.
2. From a secured ops machine (VPN / bastion), set `BOOTSTRAP_ADMIN_PASSWORD` (or vault equivalent) and run `npm run bootstrap:admin` once against production, **or** insert one full-admin user via an approved DB ops path with a bcrypt password hash.
3. Sign in at `/login` with that email + password → `/admin`.
4. Rotate the bootstrap password after first login if a shared vault secret was used.
5. Further admins are provisioned by an existing full admin (or ops), never via a public signup page.

## Marketing header

Anonymous visitors see **Login** and **Sign up** only — not Admin or Technician.  
Logged-in clients see their portal link + **Log out**.
