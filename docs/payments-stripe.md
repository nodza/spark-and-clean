# Stripe deposit checkout

A logged-in client can start a card deposit from their booking status page. Checkout does not change `paymentStatus`. A later webhook records the transfer and the ledger derives `DEPOSIT` or `PAID`.

## Environment variables

Set these in the host secret store or local `.env`. Do not commit values.

| Name | Used by |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server. Creates the Checkout Session. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser. Initializes the embedded Checkout form. This is a Next.js app, so the name uses `NEXT_PUBLIC_`, not `VITE_`. |
| `APP_URL` | Server. Absolute origin for the success and cancel return URLs, with no trailing path. Example shape: `https://example.com` |
| `STRIPE_WEBHOOK_SECRET` | Server. Verifies `checkout.session.completed` and `checkout.session.async_payment_succeeded` before the ledger marks a booking paid. |

Deposit percent is `DEPOSIT_FRACTION` in `src/lib/payments/deposit.ts` (default `0.5`).
