# Stripe deposit checkout

A logged-in client can start a card deposit from their booking status page. Checkout does not change `paymentStatus`, and neither does the success redirect or a browser status check. `POST /api/webhooks/stripe` is the only automatic writer: it verifies `Stripe-Signature`, and a paid `checkout.session.completed`, `checkout.session.async_payment_succeeded`, or `payment_intent.succeeded` event records one ledger row. The ledger derives `DEPOSIT` or `PAID`. Replaying that event does not add the amount again. `POST /api/payments/webhook` runs the same handler.

## Environment variables

Set these in the host secret store or local `.env`. Do not commit values.

| Name | Used by |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server. Creates the Checkout Session. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser. Initializes the embedded Checkout form. This is a Next.js app, so the name uses `NEXT_PUBLIC_`, not `VITE_`. |
| `APP_URL` | Server. Absolute origin for the success and cancel return URLs, with no trailing path. Example shape: `https://example.com` |
| `STRIPE_WEBHOOK_SECRET` | Server. Verifies `Stripe-Signature` on `POST /api/webhooks/stripe` before the ledger marks a booking paid. |

Deposit percent is `DEPOSIT_FRACTION` in `src/lib/payments/deposit.ts` (default `0.5`).

## Local webhook forwarding

`npm run dev` and `npm run stripe:listen` need to run together. The listen script uses `STRIPE_SECRET_KEY` from `.env`, so events are for the same account that creates Checkout Sessions. Copy the `whsec_...` value it prints into `STRIPE_WEBHOOK_SECRET`, then restart `npm run dev` so the server loads it.

In PowerShell, an unquoted `--events a,b,c` is split into separate arguments and Stripe CLI does not subscribe to those events. `npm run stripe:listen` keeps the event list as one argument.
