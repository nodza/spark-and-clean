# Stripe deposit checkout

A logged-in client can start a card deposit from their booking status page. Checkout does not change `paymentStatus`. Reading the stored status does not record a payment. `POST /api/webhooks/stripe` verifies `Stripe-Signature` and is the automatic writer: a paid `checkout.session.completed`, `checkout.session.async_payment_succeeded`, or `payment_intent.succeeded` event records one ledger row and the ledger derives `DEPOSIT` or `PAID`. Replaying that event does not add the amount again. `POST /api/payments/webhook` runs the same handler.

## Environment variables

Set these in the host secret store or local `.env`. Do not commit values.

| Name | Used by |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server. Creates the Checkout Session. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser. Initializes the embedded Checkout form. This is a Next.js app, so the name uses `NEXT_PUBLIC_`, not `VITE_`. |
| `APP_URL` | Server. Absolute origin for the success and cancel return URLs, with no trailing path. Example shape: `https://example.com` |
| `STRIPE_WEBHOOK_SECRET` | Server. Verifies `Stripe-Signature` on `POST /api/webhooks/stripe` before the ledger marks a booking paid. |

Deposit percent is `DEPOSIT_FRACTION` in `src/lib/payments/deposit.ts` (default `0.5`).
