# SCW-34 follow-up (review gap)

## Why these changes

I compared the **task description** with the **PR description / What Changed**.

The PR said first-admin bootstrapping was done, but the PR only changed:
- `Header.tsx`
- `robots.ts`

That covered header + robots, but **not** this acceptance criterion:

> A clean environment can obtain one full admin without a public register-admin page.

So this follow-up adds the missing bootstrap CLI + docs, and tightens the marketing header so it never shows Admin/Technician links.

## What changed

| Change | Why |
|--------|-----|
| `scripts/bootstrap-admin.cjs` + `npm run bootstrap:admin` | Creates the first **full** admin only when none exists (dev/staging). No public admin signup. |
| `docs/bootstrap-admin.md` | Documents CLI usage and the **production runbook** (ops, not a public form). |
| `Header.tsx` | Removes Admin/Technician from the marketing nav entirely; keeps Login / Sign up and client portal + Log out. |
| `.env.example` / `docs/user-schema.md` | Point people at the bootstrap env vars and docs. |

`robots.ts` already disallows `/portal`, `/tech`, `/signup` — no further change needed there.
